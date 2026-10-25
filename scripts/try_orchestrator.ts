// Runs the real orchestrator (Nemotron Ultra, Markovian rounds, World Model
// case file) and its specialists on answer-key scenarios, and compares the
// case file's findings with eval/scenarios.json.
//
// Run: node --experimental-transform-types --no-warnings scripts/try_orchestrator.ts [scenario ids...]
// (npm run try:orchestrator -- [ids]). The flag is needed because the
// Meterless engines use TypeScript syntax Node can't strip.

import { readFileSync } from "node:fs";
import { investigate } from "../src/agent/orchestrators/investigate.ts";
import { createScout } from "../src/agent/scout.ts";
import { Trace } from "../src/agent/trace.ts";
import { localSource } from "../src/data/local.ts";

process.loadEnvFile(".env.local");

const INTENT = { electricity: "bill.explain.electricity", gas: "bill.explain.gas", water: "bill.explain.water" } as const;
const { scenarios } = JSON.parse(readFileSync("eval/scenarios.json", "utf8"));
const wanted = process.argv.slice(2);
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
    const r = await investigate(decision.executionContract!, sc.utility, { trace, data: localSource });
    const models = trace.steps.filter((s) => s.route === "nightshift" || s.route === "nvidia-direct");
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
  } catch (err) {
    console.log(`\n${sc.id}: FAILED ${(err as Error).message}`);
  }
}
console.log(`\nAnswer key: ${keyOk}/${keyTotal}.`);
