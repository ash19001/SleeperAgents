// A/B test: the orchestrator (Nemotron Ultra) with its reasoning off and on,
// on the same questions. Each question runs in both conditions back to back,
// alternating which goes first, so both see the same NVIDIA rate-limit
// conditions. Everything is scored in code:
// - the answer key (cause verdicts), which code decides in both conditions;
// - issues in the specialists' work the orchestrator sent back itself, and
//   the ones code had to send back after it tried to close;
// - follow-ups that changed a finding (a verdict, a linked note, a test run);
// - £ figures in the orchestrator's notes that match the bill's split;
// - closing notes that cover every part of the change over £1;
// - plan tasks that name a £ figure or a cause;
// - time, model calls, the orchestrator's time per call without rate-limit
//   waits, and its reasoning length.
// Writes eval/thinking/<id>-<off|on>.json and eval/thinking_results.md.
//
// Run: npm run eval:thinking [-- question ids...]

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CauseId } from "../src/billmodel/causes.ts";
import type { PartId } from "../src/billmodel/decompose.ts";
import type { InvestigationResult } from "../src/agent/orchestrators/investigate.ts";
import { answerQuestion } from "../src/agent/pipeline.ts";
import { dataSource } from "../src/data/index.ts";
import type { Answer, TraceStep } from "../src/lib/types.ts";
import { PART_CAUSES } from "../src/memory/casefile.ts";
import { HouseholdMemory } from "../src/memory/hmem.ts";

process.loadEnvFile(".env.local");

const NOTE = "We installed a heat pump on 15 March 2026";
const PROMPTS = [
  { id: "gas-january", question: "Why did my gas bill go up in January?", keys: ["gas-january"] },
  { id: "gas-estimate", question: "Why did my gas bill change in Nov 2025?", keys: ["gas-estimate"] },
  { id: "gas-catch-up", question: "Why did my gas bill change in Dec 2025?", keys: ["gas-catch-up"] },
  { id: "elec-april", question: "Why did my electricity bill change in April?", keys: ["elec-april"] },
  { id: "elec-april-note", question: "Why did my electricity bill change in April?", notes: [NOTE], keys: ["elec-april"] },
  { id: "elec-june", question: "Why was my electricity bill lower in June?", keys: ["elec-june"] },
  { id: "water-april-rise", question: "Why did my water bill change in Apr–May 2026?", keys: ["water-april-rise"] },
  { id: "water-summer-leak", question: "Why did my water bill go up in June and July?", keys: ["water-summer-leak"] },
  { id: "water-leak-continues", question: "Why did my water bill change in Aug–Sep 2026?", keys: ["water-leak-continues"] },
  { id: "control", question: "Why did my gas bill change in Aug 2026?", keys: ["control"] },
  { id: "energy-april", question: "Why did my energy bills change in April?", keys: ["elec-april", "gas-april"] },
];

type Scenario = { id: string; utility: string; must_support: string[]; must_rule_out: string[] };
const { scenarios } = JSON.parse(readFileSync("eval/scenarios.json", "utf8")) as { scenarios: Scenario[] };
const wanted = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const source = await dataSource();
const { rows } = await source.bills();
const bills = rows.map(({ units_true: _u, energy_gbp: _e, standing_gbp: _s, standing_gbp_per_day: _d, supplier: _p, adjustment_note: _n, ...b }) => b);
mkdirSync("eval/thinking", { recursive: true });

const memory = (notes: string[] = []) => {
  const m = new HouseholdMemory({ persistDir: mkdtempSync(join(tmpdir(), "whybill-exp-")) });
  for (const n of notes) m.addNote(n);
  return m;
};
const near = (x: number, known: number[]) => known.some((k) => Math.abs(Math.abs(x) - Math.abs(k)) <= 0.011);
const amounts = (text: string) => [...text.matchAll(/£\s?(\d+(?:,\d{3})*(?:\.\d{1,2})?)/g)].map((m) => Number(m[1].replace(/,/g, "")));

interface Metrics {
  keyOk: number;
  keyTotal: number;
  elapsedS: number;
  waitedS: number;
  modelCalls: number;
  failedCalls: number;
  orchCalls: number;
  orchActiveS: number;
  orchTokens: number;
  reasoningChars: number;
  rounds: number;
  issuesSeen: number;
  issuesCaughtByOrchestrator: number;
  issuesSentBackByCode: number;
  followUpsByOrchestrator: number;
  followUpsByCode: number;
  productiveByOrchestrator: number;
  productiveByCode: number;
  noteAmounts: number;
  noteAmountsRight: number;
  closingParts: number;
  closingPartsMentioned: number;
  planTasks: number;
  planTasksSpecific: number;
  checked: string;
  memoriesInjected: number;
}

function score(invs: InvestigationResult[], answers: Answer[], trace: TraceStep[], keys: string[], elapsed: number): Metrics {
  const m: Metrics = { keyOk: 0, keyTotal: 0, elapsedS: elapsed / 1000, waitedS: 0, modelCalls: 0, failedCalls: 0, orchCalls: 0, orchActiveS: 0, orchTokens: 0, reasoningChars: 0, rounds: 0, issuesSeen: 0, issuesCaughtByOrchestrator: 0, issuesSentBackByCode: 0, followUpsByOrchestrator: 0, followUpsByCode: 0, productiveByOrchestrator: 0, productiveByCode: 0, noteAmounts: 0, noteAmountsRight: 0, closingParts: 0, closingPartsMentioned: 0, planTasks: 0, planTasksSpecific: 0, checked: answers.map((a) => a.checked?.by ?? "?").join(","), memoriesInjected: 0 };

  for (const key of keys) {
    const sc = scenarios.find((s) => s.id === key)!;
    const a = answers.find((x) => x.utility === sc.utility);
    const verdict = new Map(a?.causes.map((c) => [c.id, c.verdict]) ?? []);
    m.keyTotal += sc.must_support.length + sc.must_rule_out.length;
    m.keyOk += sc.must_support.filter((c) => verdict.get(c) === "supported").length + sc.must_rule_out.filter((c) => a && verdict.get(c) !== "supported").length;
  }

  for (const s of trace.filter((x) => x.route === "nightshift" && x.model)) {
    m.modelCalls++;
    if (s.label?.endsWith("(failed)")) m.failedCalls++;
    m.waitedS += Number(s.detail?.waitedMs ?? 0) / 1000;
    m.memoriesInjected += Number(s.detail?.memories ?? 0);
    if (s.agent?.startsWith("orchestrator:")) {
      m.orchCalls++;
      m.orchActiveS += Math.max(0, s.ms - Number(s.detail?.waitedMs ?? 0)) / 1000;
      m.orchTokens += Number(s.detail?.tokens ?? 0);
      m.reasoningChars += Number(s.detail?.reasoning_chars ?? 0);
    }
  }

  for (const inv of invs) {
    m.rounds += inv.rounds;
    const known = [inv.change, inv.a.total_gbp, inv.b.total_gbp, ...Object.values(inv.parts), ...inv.findings.map((f) => f.effect_gbp)];
    const plan = inv.reviews[0];
    if (plan?.by === "agent") {
      m.planTasks += plan.requests.length;
      m.planTasksSpecific += plan.requests.filter((q) => /£\s?\d|\bC\d\b/.test(q.task)).length;
    }
    // Which specialist round each review's tasks ran in.
    let round = 0;
    for (const [i, r] of inv.reviews.entries()) {
      if (r.by === "agent" && r.note) {
        const found = amounts(r.note);
        m.noteAmounts += found.length;
        m.noteAmountsRight += found.filter((x) => near(x, known)).length;
      }
      const ran = !r.done && r.requests.length > 0;
      if (ran) round++;
      if (i === 0) continue;
      const issues = r.issues ?? [];
      const byAgent = r.requests.filter((q) => (q.by ?? r.by) === "agent").map((q) => q.specialist);
      const byCode = r.requests.filter((q) => q.by === "code").map((q) => q.specialist);
      m.issuesSeen += issues.length;
      m.issuesCaughtByOrchestrator += issues.filter((x) => byAgent.includes(x.specialist)).length;
      m.issuesSentBackByCode += issues.filter((x) => byCode.includes(x.specialist)).length;
      if (!ran) continue;
      for (const q of r.requests) {
        const mine = inv.findings.filter((f) => f.specialist === q.specialist).map((f) => f.cause);
        const changed = mine.some((cause: CauseId) => {
          const history = inv.caseFile.history(cause).map((f) => f.value as { round: number; verdict: string; memory: string[]; measured_by: string; overridden: boolean });
          const now = history.find((h) => h.round === round);
          const before = history.filter((h) => h.round < round).at(-1);
          return Boolean(now && before && (now.verdict !== before.verdict || now.memory.join() !== before.memory.join() || now.measured_by !== before.measured_by || now.overridden !== before.overridden));
        });
        if ((q.by ?? r.by) === "code") {
          m.followUpsByCode++;
          if (changed) m.productiveByCode++;
        } else {
          m.followUpsByOrchestrator++;
          if (changed) m.productiveByOrchestrator++;
        }
      }
    }
    const closing = inv.reviews.at(-1);
    if (closing?.done && closing.by === "agent") {
      const supported = new Set(inv.findings.filter((f) => f.verdict === "supported").map((f) => f.cause));
      const material = (Object.keys(inv.parts) as PartId[]).filter((p) => Math.abs(inv.parts[p]) >= 1 && PART_CAUSES[p].some((c) => supported.has(c)));
      m.closingParts += material.length;
      m.closingPartsMentioned += material.filter((p) => near(inv.parts[p], amounts(closing.note))).length;
    }
  }
  return m;
}

const results: { id: string; thinking: boolean; m: Metrics }[] = [];
const prompts = PROMPTS.filter((p) => !wanted.length || wanted.includes(p.id));
for (const [i, p] of prompts.entries()) {
  for (const thinking of i % 2 === 0 ? [false, true] : [true, false]) {
    process.env.ORCHESTRATOR_THINKING = String(thinking);
    const invs: InvestigationResult[] = [];
    const started = Date.now();
    const result = await answerQuestion(p.question, { bills, data: source, memory: memory(p.notes), user: { id: `exp-${p.id}-${thinking}-${started}`, role: "household" }, onInvestigation: (r) => invs.push(r) });
    const answers: Answer[] = result.kind === "answer" ? [result.answer] : result.kind === "answers" ? result.answers : [];
    const trace = (result.kind === "answer" ? result.answer.trace : "trace" in result ? result.trace : []) ?? [];
    const elapsed = Date.now() - started;
    const m = score(invs, answers, trace, p.keys, elapsed);
    results.push({ id: p.id, thinking, m });
    writeFileSync(
      `eval/thinking/${p.id}-${thinking ? "on" : "off"}.json`,
      `${JSON.stringify({ question: p.question, notes: p.notes ?? [], thinking, kind: result.kind, metrics: m, reviews: invs.map((inv) => ({ utility: inv.utility, reviews: inv.reviews })), timeline: answers.map((a) => a.timeline), answers: answers.map((a) => a.answer_markdown.replace(/\{(F\d+)\}/g, (x, id) => a.facts.find((f) => f.id === id)?.value ?? x)) }, null, 2)}\n`,
    );
    console.log(`${p.id.padEnd(22)} ${thinking ? "on " : "off"} key ${m.keyOk}/${m.keyTotal}  ${m.elapsedS.toFixed(0)} s (waits ${m.waitedS.toFixed(0)} s)  calls ${m.modelCalls}${m.failedCalls ? ` (${m.failedCalls} failed)` : ""}  rounds ${m.rounds}  issues ${m.issuesSeen}: orch ${m.issuesCaughtByOrchestrator}, code ${m.issuesSentBackByCode}  follow-ups orch ${m.productiveByOrchestrator}/${m.followUpsByOrchestrator} useful, code ${m.productiveByCode}/${m.followUpsByCode}  £ in notes ${m.noteAmountsRight}/${m.noteAmounts}  closing ${m.closingPartsMentioned}/${m.closingParts}  plan ${m.planTasksSpecific}/${m.planTasks}  orch ${m.orchCalls} calls ${m.orchActiveS.toFixed(1)} s ${m.orchTokens} tokens`);
  }
}

// Totals per condition.
const sum = (thinking: boolean, k: keyof Metrics) => results.filter((r) => r.thinking === thinking).reduce((t, r) => t + Number(r.m[k]), 0);
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}% (${a}/${b})` : "–");
const row = (label: string, f: (t: boolean) => string) => `| ${label} | ${f(false)} | ${f(true)} |`;
const n = (t: boolean) => results.filter((r) => r.thinking === t).length || 1;
const md = [
  "# Orchestrator reasoning: off against on",
  "",
  `Run ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC through Zetaris and Meterless Nightshift. ${prompts.length} questions, each answered with the orchestrator's (Nemotron 3 Ultra) reasoning off and on, back to back, alternating which went first. Nothing else changed: specialists, writer and code are the same in both. Script: \`scripts/experiment_thinking.ts\`; full runs in \`eval/thinking/\`.`,
  "",
  "| Measure | Reasoning off | Reasoning on |",
  "| --- | --- | --- |",
  row("Answer key (decided in code)", (t) => pct(sum(t, "keyOk"), sum(t, "keyTotal"))),
  row("Issues in specialists' work the orchestrator sent back itself", (t) => pct(sum(t, "issuesCaughtByOrchestrator"), sum(t, "issuesSeen"))),
  row("Issues code had to send back after it tried to close", (t) => String(sum(t, "issuesSentBackByCode"))),
  row("Follow-ups the orchestrator asked for", (t) => String(sum(t, "followUpsByOrchestrator"))),
  row("…that changed a finding", (t) => pct(sum(t, "productiveByOrchestrator"), sum(t, "followUpsByOrchestrator"))),
  row("£ figures in its notes that match the split", (t) => pct(sum(t, "noteAmountsRight"), sum(t, "noteAmounts"))),
  row("Parts over £1 its closing notes cover", (t) => pct(sum(t, "closingPartsMentioned"), sum(t, "closingParts"))),
  row("Plan tasks naming a £ figure or a cause", (t) => pct(sum(t, "planTasksSpecific"), sum(t, "planTasks"))),
  row("Orchestrator time per call, without rate-limit waits", (t) => `${(sum(t, "orchActiveS") / (sum(t, "orchCalls") || 1)).toFixed(1)} s`),
  row("Orchestrator output per call (reasoning included)", (t) => `${Math.round(sum(t, "orchTokens") / (sum(t, "orchCalls") || 1))} tokens`),
  row("Specialist rounds per question", (t) => (sum(t, "rounds") / n(t)).toFixed(1)),
  row("Model calls per question", (t) => (sum(t, "modelCalls") / n(t)).toFixed(1)),
  row("Time per question (including rate-limit waits)", (t) => `${Math.round(sum(t, "elapsedS") / n(t))} s`),
  row("Nightshift memories injected into prompts", (t) => String(sum(t, "memoriesInjected"))),
  "",
  "## Per question",
  "",
  "| Question | Reasoning | Key | Issues caught by orchestrator / by code | Orchestrator follow-ups (useful) | £ in notes right | Closing covers | Time |",
  "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ...results.map((r) => `| ${r.id} | ${r.thinking ? "on" : "off"} | ${r.m.keyOk}/${r.m.keyTotal} | ${r.m.issuesCaughtByOrchestrator} / ${r.m.issuesSentBackByCode} | ${r.m.followUpsByOrchestrator} (${r.m.productiveByOrchestrator}) | ${r.m.noteAmountsRight}/${r.m.noteAmounts} | ${r.m.closingPartsMentioned}/${r.m.closingParts} | ${Math.round(r.m.elapsedS)} s |`),
  "",
];
writeFileSync("eval/thinking_results.md", md.join("\n"));
console.log(`\n${md.slice(4, 18).join("\n")}`);
