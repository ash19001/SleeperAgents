// Scores the whole pipeline (intake, Scout, orchestrators, specialists,
// writer, checker) against the answer key, asking each scenario the way the
// page does when its bar is clicked. Also asks the page's example questions,
// April electricity with the heat pump note, and "energy bills in April",
// and records every answer in eval/answers/ for replay mode.
//
// Reads through Zetaris when its views answer (src/data/index.ts).
//
// Run: npm run eval:answers [-- scenario ids...]   (results: eval/answers_results.md)
//      npm run eval:answers -- --demo   (only the page's examples, the note and "energy", for replay)

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { answerQuestion } from "../src/agent/pipeline.ts";
import { dataSource } from "../src/data/index.ts";
import { saveReplay } from "../src/lib/replay.ts";
import type { Answer, AskResult } from "../src/lib/types.ts";
import { HouseholdMemory } from "../src/memory/hmem.ts";

process.loadEnvFile(".env.local");

type Scenario = { id: string; utility: string; bill_a: string; bill_b: string; must_support: string[]; must_rule_out: string[] };
const { scenarios } = JSON.parse(readFileSync("eval/scenarios.json", "utf8")) as { scenarios: Scenario[] };
const { examples, suggested_note: NOTE } = JSON.parse(readFileSync("data/sample/preview_SAMPLE.json", "utf8")) as { examples: string[]; suggested_note: string };
const demo = process.argv.includes("--demo");
const wanted = process.argv.slice(2).filter((a) => !a.startsWith("--"));
// Zetaris when its views answer, otherwise the local files (the results say which).
const source = await dataSource();
const { rows: allBills } = await source.bills();
const bills = allBills.map(({ units_true: _u, energy_gbp: _e, standing_gbp: _s, standing_gbp_per_day: _d, supplier: _p, adjustment_note: _n, ...b }) => b);
const NAME: Record<string, string> = { electricity: "electricity", gas: "gas", water: "water" };

// Fresh, empty household memory for each run, so notes don't leak between questions.
const memory = (notes: string[] = []) => {
  const m = new HouseholdMemory({ persistDir: mkdtempSync(join(tmpdir(), "whybill-eval-")) });
  for (const n of notes) m.addNote(n);
  return m;
};

interface Row { name: string; question: string; kind: string; pair: string; key: string; checked: string; ms: number; calls: number; receipts: number; notes: string }
const rows: Row[] = [];

async function run(name: string, question: string, opts: { notes?: string[]; scenario?: Scenario } = {}): Promise<AskResult> {
  const mem = memory(opts.notes);
  const started = Date.now();
  const result = await answerQuestion(question, { bills, data: source, memory: mem, user: { id: `eval-${name}`, role: "household" } });
  const ms = Date.now() - started;
  saveReplay(question, mem.notes(), result);
  const answers: Answer[] = result.kind === "answer" ? [result.answer] : result.kind === "answers" ? result.answers : [];
  const trace = result.kind === "answer" ? result.answer.trace : "trace" in result ? (result.trace ?? []) : [];
  const models = trace.filter((s) => s.route === "nightshift");
  let key = "";
  let pair = answers.map((a) => `${a.bill_a}→${a.bill_b}`).join(", ");
  if (opts.scenario) {
    const sc = opts.scenario;
    const a = answers.find((x) => x.utility === sc.utility);
    if (!a) key = "no answer";
    else {
      const verdict = new Map(a.causes.map((c) => [c.id, c.verdict]));
      const misses = [
        ...sc.must_support.filter((c) => verdict.get(c) !== "supported").map((c) => `${c} not supported`),
        ...sc.must_rule_out.filter((c) => verdict.get(c) === "supported").map((c) => `${c} supported`),
      ];
      const pairOk = a.bill_a === sc.bill_a && a.bill_b === sc.bill_b;
      if (!pairOk) pair += ` (expected ${sc.bill_a}→${sc.bill_b})`;
      const total = sc.must_support.length + sc.must_rule_out.length;
      key = `${total - misses.length}/${total}${misses.length ? ` (${misses.join(", ")})` : ""}`;
    }
  }
  const row: Row = {
    name,
    question,
    kind: result.kind,
    pair,
    key,
    checked: answers.map((a) => a.checked?.by ?? "?").join(", "),
    ms,
    calls: models.length,
    receipts: models.filter((s) => s.receipt).length,
    notes: answers.flatMap((a) => a.memory.map((n) => n.id)).join(", "),
  };
  rows.push(row);
  console.log(`${name.padEnd(20)} ${row.kind.padEnd(8)} ${row.key.padEnd(14)} checked ${row.checked.padEnd(16)} ${(ms / 1000).toFixed(1)} s, ${row.calls} calls, ${row.receipts} receipts${row.notes ? `, cites ${row.notes}` : ""}`);
  return result;
}

for (const sc of demo ? [] : scenarios.filter((s) => !wanted.length || wanted.includes(s.id))) {
  const b = allBills.find((x) => x.bill_id === sc.bill_b)!;
  await run(sc.id, `Why did my ${NAME[sc.utility]} bill change in ${b.label}?`, { scenario: sc });
}
if (!wanted.length) {
  for (const q of examples) await run(`example`, q);
  await run("april-with-note", "Why did my electricity bill change in April?", { notes: [NOTE], scenario: scenarios.find((s) => s.id === "elec-april") });
  await run("energy-april", "Why did my energy bills change in April?");
}

const scored = rows.filter((r) => r.key && r.key !== "no answer");
const [ok, total] = scored.reduce(([o, t], r) => { const [a, b] = r.key.split(" ")[0].split("/").map(Number); return [o + a, t + b]; }, [0, 0]);
const md = [
  "# Answer evaluation",
  "",
  `Run ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC with the whole pipeline (Nemotron via Meterless Nightshift), reading the data ${source.name === "zetaris" ? "through Zetaris" : "from the local SAMPLE files"}. Each scenario is asked the way the page asks when its bar is clicked. Answer key: eval/scenarios.json.`,
  "",
  `**Answer key: ${ok} of ${total} checks.** Checker: ${rows.flatMap((r) => r.checked.split(", ")).filter((c) => c === "writer").length} answers passed on the first draft, ${rows.flatMap((r) => r.checked.split(", ")).filter((c) => c === "rewrite").length} after one rewrite, ${rows.flatMap((r) => r.checked.split(", ")).filter((c) => c === "template").length} fell back to the template.`,
  "",
  "| Run | Question | Result | Bills | Answer key | Checked | Time | Model calls | Receipts | Notes cited |",
  "|---|---|---|---|---|---|---|---|---|---|",
  ...rows.map((r) => `| ${r.name} | ${r.question} | ${r.kind} | ${r.pair} | ${r.key || "–"} | ${r.checked} | ${(r.ms / 1000).toFixed(1)} s | ${r.calls} | ${r.receipts} | ${r.notes || "–"} |`),
  "",
];
if (!demo) writeFileSync("eval/answers_results.md", md.join("\n"));
console.log(`\nAnswer key: ${ok}/${total}. Written to eval/answers_results.md; recordings in eval/answers/.`);
