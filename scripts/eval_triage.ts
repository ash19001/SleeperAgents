// Runs every question in eval/triage_cases.json through the real triage
// (Nemotron Lightning via Nightshift for the intake agent) and scores the
// results. Writes eval/triage_results.md. Run: npm run eval:triage

import { readFileSync, writeFileSync } from "node:fs";
import { createScout } from "../src/agent/scout.ts";
import { triage } from "../src/agent/triage.ts";
import type { AskResult, Bill } from "../src/lib/types.ts";

process.loadEnvFile(".env.local");

interface Case {
  id: string;
  question: string;
  kind?: string;
  kinds?: string[];
  bills?: Record<string, string>;
  direction?: string;
  redactions?: string[];
}

const { cases } = JSON.parse(readFileSync("eval/triage_cases.json", "utf8")) as { cases: Case[] };
const bills: Bill[] = JSON.parse(readFileSync("data/sample/preview_SAMPLE.json", "utf8")).bills;
// Contracts here are only checked inside this run, so a throwaway secret is enough.
const scout = createScout({ secret: process.env.SCOUT_SECRET || "eval-only-secret" });

function score(c: Case, r: AskResult): string[] {
  const problems: string[] = [];
  const kinds = c.kinds ?? [c.kind!];
  if (!kinds.includes(r.kind)) return [`got ${r.kind}, expected ${kinds.join(" or ")}`];
  if (r.kind !== "triage") return problems;
  if (c.bills) {
    const got = Object.fromEntries(r.requests.map((q) => [q.utility, q.bill_b]));
    if (JSON.stringify(Object.keys(got).sort()) !== JSON.stringify(Object.keys(c.bills).sort())) problems.push(`utilities ${Object.keys(got).join(", ")}`);
    for (const [u, b] of Object.entries(c.bills)) if (got[u] && got[u] !== b) problems.push(`${u} bill ${got[u]}, expected ${b}`);
  }
  if (c.direction && r.requests.some((q) => q.direction !== c.direction)) problems.push(`direction ${r.requests.map((q) => q.direction).join(",")}`);
  if (c.redactions && JSON.stringify(r.redactions.sort()) !== JSON.stringify([...c.redactions].sort())) problems.push(`redactions ${r.redactions.join(",")}`);
  if (r.requests.some((q) => q.orchestrator.status !== "placeholder")) problems.push("an orchestrator refused its contract");
  return problems;
}

const rows: { c: Case; r: AskResult; problems: string[]; ms: number }[] = [];
const queue = [...cases];
await Promise.all(
  Array.from({ length: 5 }, async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      const started = Date.now();
      const r = await triage(c.question, { bills, scout, user: { id: `eval-${c.id}`, role: "household" } });
      rows.push({ c, r, problems: score(c, r), ms: Date.now() - started });
    }
  }),
);
rows.sort((a, b) => cases.indexOf(a.c) - cases.indexOf(b.c));

const passed = rows.filter((x) => !x.problems.length).length;
const pct = Math.round((passed / rows.length) * 100);
const intakeCalls = rows.flatMap((x) => ("trace" in x.r ? x.r.trace ?? [] : []).filter((s) => s.agent === "intake"));
const viaNightshift = intakeCalls.filter((s) => s.route === "nightshift" && s.receipt).length;

const describe = (r: AskResult) =>
  r.kind === "triage" ? `triage (${r.source}): ${r.requests.map((q) => `${q.utility} ${q.bill_b} ${q.direction}`).join("; ")}` : r.kind;
const lines = [
  "# Triage evaluation",
  "",
  `Run ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC with the live intake agent (Nemotron 3.5 Lightning via Meterless Nightshift). SAMPLE bills.`,
  "",
  `**${passed} of ${rows.length} passed (${pct}%).** Intake calls: ${intakeCalls.length}, ${viaNightshift} through Nightshift with a receipt. Median time per question: ${rows.map((x) => x.ms).sort((a, b) => a - b)[Math.floor(rows.length / 2)]} ms.`,
  "",
  "| Case | Question | Result | Time | Pass |",
  "| --- | --- | --- | --- | --- |",
  ...rows.map((x) => `| ${x.c.id} | ${x.c.question.replace(/\|/g, "\\|")} | ${describe(x.r)}${x.problems.length ? ` (${x.problems.join("; ")})` : ""} | ${x.ms} ms | ${x.problems.length ? "no" : "yes"} |`),
  "",
];
writeFileSync("eval/triage_results.md", lines.join("\n"));
for (const x of rows) console.log(`${x.problems.length ? "FAIL" : "PASS"} ${x.c.id}: ${describe(x.r)}${x.problems.length ? `  <- ${x.problems.join("; ")}` : ""}`);
console.log(`\n${passed}/${rows.length} passed (${pct}%). Intake: ${viaNightshift}/${intakeCalls.length} calls via Nightshift with receipts. Written to eval/triage_results.md`);
process.exitCode = pct >= 90 ? 0 : 1;
