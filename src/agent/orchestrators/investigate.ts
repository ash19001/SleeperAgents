// The investigation a utility's orchestrator runs once its contract checks
// out. Nemotron Ultra leads it, and Meterless Markovian runs the rounds:
// each step, Ultra reads the case file (World Model) and the state carried
// over from earlier steps, then hands out tasks or closes the case; code
// runs the specialists it asked for in parallel and writes their findings
// to the case file. Step 1 always sends every specialist; at most two
// follow-up rounds come after. Code, not Ultra, decides every verdict and £.
// Code also checks each specialist's work: a verdict its own measurement
// contradicts, or a cause it never tested, goes back to that specialist even
// if Ultra was ready to close. The timeline records the back-and-forth.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Markovian } from "#meterless/markovian";
import { z } from "zod";
import type { PartId } from "../../billmodel/decompose.ts";
import type { DataSource, EvidenceRecord, UBill } from "../../data/types.ts";
import { CAUSE_NAMES, PART_NAMES } from "../../lib/labels.ts";
import type { TimelineEntry, Utility } from "../../lib/types.ts";
import { CaseFile, type CaseFinding, type Issue, type Review } from "../../memory/casefile.ts";
import type { ExecutionContract } from "../../scout/types.ts";
import type { CauseId } from "../../billmodel/causes.ts";
import { openInvestigation, pairSplit, type MeasuredCause, type NotesMemory } from "../investigation.ts";
import { chat, deepModel, type Message } from "../llm.ts";
import { parseReport, type ChatFn } from "../loop.ts";
import { runSpecialist, SPECIALISTS, specialistsFor, type SpecialistName } from "../specialists.ts";
import type { Trace } from "../trace.ts";

export const MAX_FOLLOW_UPS = 2;

const Decision = z.object({
  done: z.boolean(),
  requests: z.array(z.object({ specialist: z.string(), task: z.string().min(3).max(600) })).max(6).default([]),
  note: z.string().max(600).default(""),
});

export interface InvestigationContext {
  trace: Trace;
  data: DataSource;
  memory?: NotesMemory;
  chatFn?: ChatFn;
}

export interface InvestigationResult {
  utility: Utility;
  contractId: string;
  a: UBill;
  b: UBill;
  change: number;
  parts: Record<PartId, number>;
  findings: CaseFinding[];
  measured: Partial<Record<CauseId, MeasuredCause>>; // code's measurement behind each finding
  unexplained: PartId[];
  reviews: Review[];
  rounds: number; // specialist rounds run
  note: string; // the orchestrator's last word on the case
  evidence: EvidenceRecord[];
  caseFile: CaseFile;
  markovian: { status: string; steps: number; tokensSaved: number };
  timeline: TimelineEntry[];
}

const gbp = (x: number) => `${x < 0 ? "−" : "+"}£${Math.abs(x).toFixed(2)}`;
const promptFile = readFileSync(resolve("src/agent/prompts/orchestrator.md"), "utf8");

function systemPrompt(utility: Utility, team: SpecialistName[]): string {
  const lines = team.map((s) => `- ${s}: ${SPECIALISTS[s].causes(utility).map((c) => `${c} ${CAUSE_NAMES[c]}`).join("; ")}`);
  return promptFile.replace("{utility}", utility).replace("{specialists}", lines.join("\n"));
}

// What the specialists hear: Ultra's task, plus their own findings on a follow-up.
function taskFor(file: CaseFile, name: SpecialistName, task: string | undefined, followUp: boolean): string {
  if (!followUp) return task || "Check your causes for why this bill changed.";
  const mine = file.findings().filter((f) => f.specialist === name);
  return `Follow-up from the orchestrator: ${task}\nYour findings so far: ${mine.map((f) => `${f.cause} ${f.verdict} (${gbp(f.effect_gbp)})`).join("; ") || "none"}.`;
}

const ULTRA = "Orchestrator (Nemotron Ultra)";
const LIGHTNING = "Specialists (Nemotron Lightning)";
const CHECK = "Code check";

// The task code sends back for an issue it found.
function issueTask(i: Issue, file: CaseFile): string {
  const f = file.findings().find((x) => x.cause === i.cause)!;
  return i.kind === "overruled"
    ? `Your verdict on ${i.cause} (${CAUSE_NAMES[i.cause]}) was ${f.claimed?.replace("_", " ")}, but test_cause measures ${f.value ?? "no value"} against "${f.threshold}", which makes it ${f.verdict.replace("_", " ")}. Run test_cause for ${i.cause} again, then agree or explain what the measurement misses.`
    : `You reported without testing ${i.cause} (${CAUSE_NAMES[i.cause]}). Run test_cause for ${i.cause} and give your verdict.`;
}

// The state Markovian carries from one step to the next.
function carryState(file: CaseFile, log: string[]): string {
  const gaps = file.unexplained();
  const open = file.openFollowUps();
  return [
    `COMPLETED: ${log.join("; ")}`,
    `REMAINING: ${gaps.length ? `no supported cause yet for ${gaps.map((p) => PART_NAMES[p]).join(", ")}` : "every part over £1 has a supported cause"}`,
    `DECISIONS: ${file.findings().map((f) => `${f.cause} ${f.verdict}`).join(", ")}`,
    `CONTEXT: ${open.length ? open.map((f) => `${f.specialist} asks: ${f.text}`).join(" | ") : "no open questions"}`,
  ]
    .join("\n")
    .slice(0, 1800);
}

export async function investigate(contract: ExecutionContract, utility: Utility, ctx: InvestigationContext): Promise<InvestigationResult> {
  const chatFn = ctx.chatFn ?? chat;
  const agent = `orchestrator:${utility}`;
  const step = (label: string, route: string, ms: number, detail?: Record<string, unknown>) => ctx.trace.add({ step: "orchestrator", agent, label, route, model: null, ms, detail });

  const refs = contract.intent.references as { bill_a?: string; bill_b?: string };
  const { rows } = await ctx.data.bills({ utility });
  const a = rows.find((x) => x.bill_id === refs.bill_a);
  const b = rows.find((x) => x.bill_id === refs.bill_b);
  if (!a || !b) throw new Error(`bills not found: ${refs.bill_a}, ${refs.bill_b}`);

  let started = Date.now();
  const inv = openInvestigation({ utility, contract, data: ctx.data, a, b, trace: ctx.trace, memory: ctx.memory });
  const { split, evidence } = await pairSplit(inv);
  const team = specialistsFor(utility);
  const file = await CaseFile.open({ caseId: contract.contractId, utility, causes: team.flatMap((s) => SPECIALISTS[s].causes(utility)), a, b, split, evidence });
  step(`Opened the case file: ${gbp(split.change)} split into ${Object.keys(split.parts).length} parts`, "world-model", Date.now() - started, { caseId: file.id });

  const system = systemPrompt(utility, team);
  const log: string[] = [];
  const timeline: TimelineEntry[] = [];
  const followedUp = new Set<SpecialistName>(); // each specialist gets at most one follow-up
  let rounds = 0;

  // One Ultra call: the plan (step 0) or a review. If the reply is unusable
  // twice, code decides: send everyone at the start, otherwise close.
  async function decide(n: number, carryover: string, last: boolean): Promise<Review> {
    const instruction =
      n === 0
        ? `This is the start: no specialist has reported yet. Give every specialist (${team.join(", ")}) a task. Set "done" to false.`
        : last
          ? `This is the final review; no more rounds are possible. Set "done" to true and sum up the case in "note".`
          : `Review the latest findings. Close the case, or ask follow-ups (${MAX_FOLLOW_UPS - (rounds - 1)} follow-up round${MAX_FOLLOW_UPS - (rounds - 1) === 1 ? "" : "s"} left).` +
            (followedUp.size ? ` Already had their one follow-up: ${[...followedUp].join(", ")}.` : "");
    const messages: Message[] = [
      { role: "system", content: system },
      {
        role: "user",
        content: `${file.promptContext()}\n\n${carryover ? `Carried over from earlier steps:\n${carryover}\n\n` : ""}${instruction}\nReply with only this JSON:\n{"done": false, "requests": [{"specialist": "${team[0]}", "task": "..."}], "note": "..."}`,
      },
    ];
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await chatFn({ agent, label: n === 0 ? "Plan the investigation" : last ? "Final review" : `Review round ${rounds}`, model: deepModel(), messages, maxTokens: 1200, trace: ctx.trace });
        const parsed = parseReport(res.text, Decision);
        if (parsed.ok) return { round: n + 1, ...parsed.value, by: "agent" };
        messages.push({ role: "assistant", content: res.text }, { role: "user", content: `That wasn't usable: ${parsed.error}. Reply with only the JSON object.` });
      } catch {
        break;
      }
    }
    return { round: n + 1, done: n > 0, requests: [], note: "", by: "code" };
  }

  const markovian = new Markovian({ chunkConfig: { maxChunks: MAX_FOLLOW_UPS + 2, chunkSize: 4000, carryoverTokens: 512 } });
  started = Date.now();
  const run = await markovian.run({
    goal: `Explain why the ${utility} bill changed from ${a.label} to ${b.label}`,
    reflect: false,
    stepFn: async ({ step: n, carryover }) => {
      const last = n === MAX_FOLLOW_UPS + 1;
      const review = await decide(n, carryover, last);
      const asked = new Map<SpecialistName, string>();
      for (const r of review.requests) {
        const name = r.specialist.toLowerCase().trim() as SpecialistName;
        if (team.includes(name) && !asked.has(name) && (n === 0 || !followedUp.has(name))) asked.set(name, r.task);
      }
      // Step 0 sends the whole team; a follow-up step sends whoever Ultra
      // asked, plus any specialist code found an unresolved issue with.
      type Task = { specialist: SpecialistName; task: string; by: "agent" | "code" };
      let tasks: Task[] = [];
      let sentBack: Issue[] = [];
      if (n === 0) tasks = team.map((s) => ({ specialist: s, task: asked.get(s) ?? "", by: review.by }));
      else if (!last) {
        tasks = review.done ? [] : [...asked].map(([specialist, task]) => ({ specialist, task, by: review.by }));
        sentBack = file.issues().filter((i) => team.includes(i.specialist as SpecialistName) && !followedUp.has(i.specialist as SpecialistName) && !tasks.some((t) => t.specialist === i.specialist));
        const bySpecialist = new Map<SpecialistName, Issue[]>();
        for (const i of sentBack) bySpecialist.set(i.specialist as SpecialistName, [...(bySpecialist.get(i.specialist as SpecialistName) ?? []), i]);
        for (const [specialist, issues] of bySpecialist) tasks.push({ specialist, task: issues.map((i) => issueTask(i, file)).join(" "), by: "code" });
      }
      const closing = n > 0 && tasks.length === 0;
      await file.recordReview({ ...review, done: closing, requests: tasks }, deepModel());

      const ultraAsked = tasks.filter((t) => t.by === "agent");
      const codeAsked = tasks.filter((t) => t.by === "code" && n > 0);
      if (n === 0) {
        timeline.push({ actor: review.by === "agent" ? ULTRA : CHECK, text: review.by === "agent" ? `Planned the investigation: a task for each of ${tasks.length} specialists.` : "The orchestrator's plan was unusable, so code sent every specialist its default task.", detail: tasks.map((t) => `${t.specialist}: ${t.task || "check your causes"}`) });
      } else {
        if (review.by === "agent" && (closing || ultraAsked.length || !codeAsked.length)) {
          timeline.push({ actor: ULTRA, text: closing ? `Closed the case. ${review.note}`.trim() : review.note || "Asked for follow-ups.", detail: ultraAsked.map((t) => `asked ${t.specialist}: ${t.task}`) });
        }
        if (codeAsked.length) {
          step(`Sent back to ${codeAsked.map((t) => t.specialist).join(", ")}: issues code found in their work`, "code", 0, { issues: sentBack.map((i) => i.text) });
          timeline.push({ actor: CHECK, text: review.done ? "The orchestrator was ready to close, but code found issues in the specialists' work and sent them back." : "Code also found issues in the specialists' work and sent them back.", detail: sentBack.map((i) => `${i.text}: sent back to ${i.specialist}`) });
        }
      }
      if (closing) {
        step(review.by === "agent" ? `Closed the case: ${review.note || "every part accounted for"}` : "Closed the case (code: no usable review)", "code", 0, { round: rounds });
        if (review.by !== "agent") timeline.push({ actor: CHECK, text: "The orchestrator's review was unusable, so code closed the case." });
        return { content: `${review.note}\n[TASK_COMPLETE]` };
      }

      rounds++;
      if (n > 0) tasks.forEach((t) => followedUp.add(t.specialist));
      step(`Round ${rounds}: ${tasks.map((t) => t.specialist).join(", ")}`, "code", 0, { tasks, by: review.by });
      const issuesBefore = file.issues();
      const results = await Promise.all(tasks.map((t) => runSpecialist(t.specialist, taskFor(file, t.specialist, t.task, n > 0), inv, chatFn)));
      for (const r of results) {
        // A follow-up usually re-tests one cause: keep the earlier findings
        // for causes the agent neither re-tested nor gave a verdict on.
        for (const f of r.findings) if (n === 0 || f.measured_by === "agent" || f.claimed !== null) await file.recordFinding(f, rounds);
        await file.recordFollowUp(r.specialist, r.follow_up, rounds);
      }
      const now = file.issues();
      const detail = [
        ...results.filter((r) => r.follow_up).map((r) => `${r.specialist} asks: ${r.follow_up}`),
        ...(n === 0
          ? now.map((i) => `${CHECK}: ${i.text}`)
          : issuesBefore.filter((i) => tasks.some((t) => t.specialist === i.specialist)).map((i) => (now.some((x) => x.cause === i.cause && x.kind === i.kind) ? `${i.specialist} still disagrees on ${i.cause}; the measurement stands` : `${i.specialist} resolved ${i.cause}: it now agrees with the measurement`))),
      ];
      const supported = file.findings().filter((f) => f.verdict === "supported").map((f) => CAUSE_NAMES[f.cause].toLowerCase());
      timeline.push({ actor: LIGHTNING, text: `Round ${rounds}: ${tasks.map((t) => t.specialist).join(", ")} reported back.${supported.length ? ` Supported so far: ${supported.join(", ")}.` : ""}`, detail });
      log.push(`round ${rounds} asked ${tasks.map((t) => t.specialist).join(", ")}`);
      return { content: `${review.note}\n[STATE_CHECKPOINT]\n${carryState(file, log)}` };
    },
  });
  step(`Markovian ran ${run.chunks.length} step${run.chunks.length === 1 ? "" : "s"} (${run.status})`, "markovian", Date.now() - started, { status: run.status, tokensSaved: run.totalTokensSaved, tokenLabel: run.tokenLabel });
  if (run.status === "errored") throw new Error(`investigation failed: ${run.error}`);

  const reviews = file.reviews();
  return {
    utility,
    contractId: contract.contractId,
    a,
    b,
    change: split.change,
    parts: split.parts,
    findings: file.findings(),
    measured: Object.fromEntries(inv.measured),
    unexplained: file.unexplained(),
    reviews,
    rounds,
    note: reviews.at(-1)?.note ?? "",
    evidence: inv.evidence.records,
    caseFile: file,
    markovian: { status: run.status, steps: run.chunks.length, tokensSaved: run.totalTokensSaved },
    timeline,
  };
}
