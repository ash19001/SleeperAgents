// Registers the household's data in Zetaris from zetaris/whybill_create.sql
// (or removes it with --drop). A dry run by default: lists each statement and
// checks that Zetaris and the app's SAMPLE feeds are reachable, creating
// nothing. With --apply it runs the statements one at a time and stops at the
// first error; --from=N resumes at statement N.
//
// Run: npm run zetaris:setup [-- --apply] [-- --drop] [-- --from=N]

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

process.loadEnvFile(".env.local");

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const file = args.includes("--drop") ? "zetaris/whybill_drop.sql" : "zetaris/whybill_create.sql";
const from = Number(args.find((a) => a.startsWith("--from="))?.slice(7) ?? 1);
const base = (process.env.ZETARIS_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

// Statements end with ";" at the end of a line; "--" lines are comments.
const statements = readFileSync(file, "utf8")
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n")
  .split(/;\s*(?:\n|$)/)
  .map((s) => s.trim())
  .filter(Boolean);

async function run(sql: string): Promise<{ ok: boolean; status: number; text: string; ms: number }> {
  const started = Date.now();
  const res = await fetch(`${base}/api/proxy/sql-editor/sqls/run-query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.ZETARIS_API_KEY}`, "X-Org-ID": String(process.env.ZETARIS_ORG_ID), "X-Request-ID": randomUUID(), "Content-Type": "application/json" },
    body: JSON.stringify({ sql, limit: 100 }),
    signal: AbortSignal.timeout(180_000),
  });
  return { ok: res.ok, status: res.status, text: (await res.text()).slice(0, 400), ms: Date.now() - started };
}

const first = (s: string) => s.split("\n")[0].slice(0, 110);
console.log(`${file}: ${statements.length} statements${apply ? "" : " (dry run: nothing is created)"}\n`);

// Checks before anything runs.
const ping = await run("SELECT 1 AS one");
console.log(`Zetaris at ${base}: ${ping.ok ? `reachable (${ping.ms} ms)` : `NOT reachable: ${ping.status} ${ping.text}`}`);
if (!file.includes("drop")) {
  for (const feed of ["supplier-a-bills", "supplier-a-reads", "waterco-bills", "water-charges"]) {
    const res = await fetch(`http://localhost:5175/api/data/${feed}`).catch(() => null);
    const n = res?.ok ? ((await res.json()) as { records: unknown[] }).records.length : null;
    console.log(`App feed ${feed}: ${n === null ? "NOT reachable on port 5175" : `${n} records`}`);
  }
}
console.log("");

statements.forEach((s, i) => console.log(`${String(i + 1).padStart(2)}. ${first(s)}${i + 1 < from ? "  (skipped: --from)" : ""}`));
if (!apply) {
  console.log("\nDry run only. Run with --apply to create these in Zetaris.");
  process.exit(0);
}
if (!ping.ok) process.exit(1);

console.log("");
for (const [i, sql] of statements.entries()) {
  if (i + 1 < from) continue;
  const r = await run(sql);
  console.log(`${String(i + 1).padStart(2)}. ${r.ok ? "OK  " : "FAIL"} ${(r.ms / 1000).toFixed(1)} s  ${first(sql)}`);
  if (!r.ok) {
    console.log(`    ${r.status} ${r.text}`);
    console.log(`\nStopped. Fix the statement, then resume with --apply --from=${i + 1}.`);
    process.exit(1);
  }
}
console.log("\nDone.");
