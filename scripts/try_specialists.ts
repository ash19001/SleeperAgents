// Runs the real specialists (Nemotron Lightning via Nightshift) on answer-key
// scenarios and compares their settled verdicts with eval/scenarios.json.
// Also reports how often each agent's own verdict matched the measurement.
//
// Run: node scripts/try_specialists.ts [scenario ids...]

import { readFileSync } from "node:fs";
import { openInvestigation } from "../src/agent/investigation.ts";
import { createScout } from "../src/agent/scout.ts";
import { runSpecialist, specialistsFor } from "../src/agent/specialists.ts";
import { Trace } from "../src/agent/trace.ts";
import { localSource } from "../src/data/local.ts";

process.loadEnvFile(".env.local");

const INTENT = { electricity: "bill.explain.electricity", gas: "bill.explain.gas", water: "bill.explain.water" } as const;
const { scenarios } = JSON.parse(readFileSync("eval/scenarios.json", "utf8"));
const wanted = process.argv.slice(2);
const chosen = wanted.length ? scenarios.filter((s: { id: string }) => wanted.includes(s.id)) : scenarios;
const scout = createScout();
const { rows: bills } = await localSource.bills();

let agree = 0, overridden = 0, byCode = 0, keyOk = 0, keyTotal = 0, calls = 0;
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
  const contract = decision.executionContract!;
  const trace = new Trace();
  const inv = openInvestigation({ utility: sc.utility, contract, data: localSource, a, b, trace });
  const started = Date.now();
  const results = await Promise.all(specialistsFor(sc.utility).map((s) => runSpecialist(s, "Check your causes for why this bill changed.", inv)));
  const ms = Date.now() - started;
  const modelCalls = trace.steps.filter((s) => s.route === "nightshift" || s.route === "nvidia-direct").length;
  calls += modelCalls;
  console.log(`\n${sc.id} (${a.label} → ${b.label}, ${sc.utility}): ${ms} ms, ${modelCalls} model calls, ${trace.steps.filter((s) => s.step === "tool").length} tool calls, ${inv.evidence.records.length} evidence`);
  for (const r of results) {
    if (r.error) console.log(`   ${r.specialist}: ${r.error}`);
    for (const f of r.findings) {
      const expect = sc.must_support.includes(f.cause) ? "supported" : sc.must_rule_out.includes(f.cause) ? "not supported" : "";
      const ok = expect === "" ? null : expect === "supported" ? f.verdict === "supported" : f.verdict !== "supported";
      if (ok !== null) { keyTotal++; if (ok) keyOk++; }
      if (f.measured_by === "code") byCode++; else if (f.overridden) overridden++; else agree++;
      console.log(`   ${f.cause} ${f.verdict.padEnd(12)} ${String(f.effect_gbp).padStart(8)}  ${f.measured_by === "code" ? "[tested by code]" : f.overridden ? "[agent overruled]" : "[agent agreed]  "} ${ok === null ? "" : ok ? "✓ key" : "✗ key"}  ${f.evidence.join(",")}  ${f.reasoning.slice(0, 90)}`);
    }
    if (r.follow_up) console.log(`   ${r.specialist} follow-up: ${r.follow_up.slice(0, 120)}`);
  }
}
console.log(`\nAnswer key: ${keyOk}/${keyTotal}. Agent verdicts: ${agree} agreed with the measurement, ${overridden} overruled, ${byCode} not tested by the agent. ${calls} model calls.`);
