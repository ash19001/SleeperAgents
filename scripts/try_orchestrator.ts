// Runs the real orchestrator (Nemotron Ultra, Markovian rounds, World Model
// case file) and its specialists on answer-key scenarios, compares the case
// file's findings with eval/scenarios.json, then writes and checks each
// answer. With --combine, also writes the summary across the scenarios;
// with --note="…" (repeatable), the household memory (H-MEM) holds that note.
//
// Run: node --experimental-transform-types --no-warnings scripts/try_orchestrator.ts [--combine] [--note="…"] [scenario ids...]
// (npm run try:orchestrator -- [ids]). The flag is needed because the
// Meterless engines use TypeScript syntax Node can't strip.

import { readFileSync } from "node:fs";
import { composeAnswer } from "../src/agent/answer.ts";
import { combine } from "../src/agent/combiner.ts";
import { investigate } from "../src/agent/orchestrators/investigate.ts";
import { createScout } from "../src/agent/scout.ts";
import { Trace } from "../src/agent/trace.ts";
import { localSource } from "../src/data/local.ts";
import type { Answer, Fact } from "../src/lib/types.ts";
import { HouseholdMemory } from "../src/memory/hmem.ts";

process.loadEnvFile(".env.local");

const INTENT = { electricity: "bill.explain.electricity", gas: "bill.explain.gas", water: "bill.explain.water" } as const;
const { scenarios } = JSON.parse(readFileSync("eval/scenarios.json", "utf8"));
const args = process.argv.slice(2);
const combineAll = args.includes("--combine");
const wanted = args.filter((x) => !x.startsWith("--"));
const fill = (text: string, facts: Fact[]) => text.replace(/\{(F\d+)\}/g, (m, id) => facts.find((f) => f.id === id)?.value ?? m);
const answers: Answer[] = [];
const memory = new HouseholdMemory();
for (const a of args.filter((x) => x.startsWith("--note="))) console.log(`Note ${memory.addNote(a.slice(7)).id}: ${a.slice(7)}`);
const chosen = wanted.length ? scenarios.filter((s: { id: string }) => wanted.includes(s.id)) : scenarios;
const scout = createScout();
const { rows: bills } = await localSource.bills();

let keyOk = 0, keyTotal = 0;
for (const sc of chosen) {
  const a = bills.find((b) => b.bill_id === sc.bill_a)!;
  const b = bills.find((b) => b.bill_id === sc.bill_b)!;
  const intent = INTENT[sc.utility as keyof typeof INTENT];
  const decision = await scout.decide({
    prompt: `Why did my ${sc.utility} bill change in ${b.label}?`,
    user: { id: "trial", role: "household" },
    surface: "web",
    context: { semantic: { [intent]: 1 }, references: { bill_a: a.bill_id, bill_b: b.bill_id }, task: "orchestrate" },
  });
  const trace = new Trace();
  const started = Date.now();
  try {
    const r = await investigate(decision.executionContract!, sc.utility, { trace, data: localSource, memory });
    const models = trace.steps.filter((s) => s.route === "nightshift");
    const ultra = models.filter((s) => s.agent?.startsWith("orchestrator:"));
    console.log(`\n${sc.id} (${a.label} → ${b.label}, ${sc.utility}): ${Date.now() - started} ms, ${r.rounds} round(s), Markovian ${r.markovian.steps} steps (${r.markovian.status}), ${models.length} model calls (${ultra.length} Ultra), ${models.filter((s) => s.receipt).length} receipts`);
    for (const v of r.reviews) console.log(`   review ${v.round} [${v.by}] ${v.done ? "done" : `asks ${v.requests.map((q) => `${q.specialist}: "${q.task.slice(0, 70)}"`).join("; ")}`}  — ${v.note.slice(0, 120)}`);
    for (const f of r.findings) {
      const expect = sc.must_support.includes(f.cause) ? "supported" : sc.must_rule_out.includes(f.cause) ? "not supported" : "";
      const ok = expect === "" ? null : expect === "supported" ? f.verdict === "supported" : f.verdict !== "supported";
      if (ok !== null) { keyTotal++; if (ok) keyOk++; }
      console.log(`   ${f.cause} ${f.verdict.padEnd(12)} ${String(f.effect_gbp).padStart(8)}  r${f.round} ${f.specialist.padEnd(8)} ${ok === null ? "     " : ok ? "✓ key" : "✗ key"}  ${f.reasoning.slice(0, 80)}`);
    }
    if (r.unexplained.length) console.log(`   unexplained parts: ${r.unexplained.join(", ")}`);
    console.log(`   case file: ${r.caseFile.audit().length} audit entries, ${r.evidence.length} evidence records`);
    const t = Date.now();
    const answer = await composeAnswer(`Why did my ${sc.utility} bill change in ${b.label}?`, r, { trace, notes: memory.notes() });
    answers.push(answer);
    console.log(`   answer (${answer.checked.by}, ${Date.now() - t} ms${answer.checked.problems.length ? `; checker: ${answer.checked.problems.map((p) => p.join(" | ")).join(" || ")}` : ""}):\n   ${fill(answer.answer_markdown, answer.facts)}`);
    console.log(`   next steps: ${answer.next_steps.map((n) => n.cause).join(", ") || "none"}; notes cited: ${answer.memory.map((n) => n.id).join(", ") || "none"}`);
    memory.saveFindings(answer);
  } catch (err) {
    console.log(`\n${sc.id}: FAILED ${(err as Error).message}`);
  }
}
if (combineAll && answers.length > 1) {
  const c = await combine("Why did my bills change?", answers, { trace: new Trace() });
  console.log(`\nSummary (${c.by}): ${fill(c.summary_markdown, c.summary_facts)}`);
}
console.log(`\nH-MEM ledger: ${Object.entries(memory.hmem.ledger.stats()).map(([k, v]) => `${k} ${v}`).join(", ")}`);
console.log(`Answer key: ${keyOk}/${keyTotal}.`);
