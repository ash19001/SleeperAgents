// The investigation a utility's orchestrator runs once its contract checks
// out. Nemotron Ultra leads it, and Meterless Markovian runs the rounds:
// each step, Ultra reads the case file (World Model) and the state carried
// over from earlier steps, then hands out tasks or closes the case; code
// runs the specialists it asked for in parallel and writes their findings
// to the case file. Step 1 always sends every specialist; at most two
// follow-up rounds come after. Code, not Ultra, decides every verdict and £.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Markovian } from "#meterless/markovian";
import { z } from "zod";
import type { PartId } from "../../billmodel/decompose.ts";
import type { DataSource, EvidenceRecord, UBill } from "../../data/types.ts";
import { CAUSE_NAMES, PART_NAMES } from "../../lib/labels.ts";
import type { Utility } from "../../lib/types.ts";
import { CaseFile, type CaseFinding, type Review } from "../../memory/casefile.ts";
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
      // Step 0 sends the whole team; a follow-up step sends whoever Ultra asked.
      const tasks = n === 0 ? team.map((s) => ({ specialist: s, task: asked.get(s) ?? "" })) : review.done || last ? [] : [...asked].map(([specialist, task]) => ({ specialist, task }));
      const closing = n > 0 && tasks.length === 0;
      await file.recordReview({ ...review, done: closing, requests: tasks }, deepModel());
      if (closing) {
        step(review.by === "agent" ? `Closed the case: ${review.note || "every part accounted for"}` : "Closed the case (code: no usable review)", "code", 0, { round: rounds });
        return { content: `${review.note}\n[TASK_COMPLETE]` };
      }

      rounds++;
      if (n > 0) tasks.forEach((t) => followedUp.add(t.specialist));
      step(`Round ${rounds}: ${tasks.map((t) => t.specialist).join(", ")}`, "code", 0, { tasks, by: review.by });
      const results = await Promise.all(tasks.map((t) => runSpecialist(t.specialist, taskFor(file, t.specialist, t.task, n > 0), inv, chatFn)));
      for (const r of results) {
        for (const f of r.findings) await file.recordFinding(f, rounds);
        await file.recordFollowUp(r.specialist, r.follow_up, rounds);
      }
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
  };
}
