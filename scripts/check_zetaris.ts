// Checks the Zetaris views against the local SAMPLE files: the same bills,
// readings, tariffs and weather, and the same cause verdicts and £ split for
// every answer-key scenario. Run after npm run zetaris:setup -- --apply.
//
// Run: npm run zetaris:check

import { readFileSync } from "node:fs";
import { measure, type CauseId } from "../src/billmodel/causes.ts";
import { fitWeather, splitChange } from "../src/billmodel/decompose.ts";
import { localSource } from "../src/data/local.ts";
import type { DataSource, UBill } from "../src/data/types.ts";
import { zetarisSource } from "../src/data/zetaris.ts";

process.loadEnvFile(".env.local");

let problems = 0;
const say = (ok: boolean, what: string, detail = "") => {
  if (!ok) problems++;
  console.log(`${ok ? "OK  " : "DIFF"} ${what}${detail ? `: ${detail}` : ""}`);
};
const close = (a: number, b: number, tol = 0.005) => Math.abs(a - b) <= tol;

const [zb, lb] = await Promise.all([zetarisSource.bills(), localSource.bills()]);
say(zb.rows.length === lb.rows.length, `bills: ${zb.rows.length} from Zetaris, ${lb.rows.length} local`);
for (const l of lb.rows) {
  const z = zb.rows.find((x) => x.bill_id === l.bill_id);
  if (!z) { say(false, `bill ${l.bill_id}`, "missing in Zetaris"); continue; }
  const diffs = (Object.keys(l) as (keyof UBill)[]).filter((k) => (typeof l[k] === "number" ? !close(l[k] as number, z[k] as number) : JSON.stringify(l[k]) !== JSON.stringify(z[k])));
  if (diffs.length) say(false, `bill ${l.bill_id}`, diffs.map((k) => `${k} ${JSON.stringify(z[k])} vs ${JSON.stringify(l[k])}`).join(", "));
}

for (const u of ["electricity", "gas", "water"] as const) {
  const [zr, lr] = await Promise.all([zetarisSource.reads(u, "2025-01-01", "2026-12-31"), localSource.reads(u, "2025-01-01", "2026-12-31")]);
  say(zr.rows.length === lr.rows.length && zr.rows.every((r, i) => r.read_date === lr.rows[i].read_date && close(r.register, lr.rows[i].register)), `${u} readings: ${zr.rows.length} vs ${lr.rows.length}`);
  const [zt, lt] = await Promise.all([zetarisSource.tariffs(u, "2025-10-01", "2026-09-30"), localSource.tariffs(u, "2025-10-01", "2026-09-30")]);
  const key = (t: { kind: string; valid_from: string; valid_to: string | null; value: number }) => `${t.kind} ${t.valid_from} ${t.valid_to} ${t.value.toFixed(4)}`;
  const zs = zt.rows.map(key).sort(), ls = lt.rows.map(key).sort();
  say(JSON.stringify(zs) === JSON.stringify(ls), `${u} tariffs: ${zt.rows.length} vs ${lt.rows.length}`, JSON.stringify(zs) === JSON.stringify(ls) ? "" : `Zetaris ${zs.join(" | ")} ; local ${ls.join(" | ")}`);
}

const [zw, lw] = await Promise.all([zetarisSource.weather("2024-10-01", "2026-10-20"), localSource.weather("2024-10-01", "2026-10-20")]);
const worst = Math.max(...lw.rows.map((l) => { const z = zw.rows.find((x) => x.day === l.day); return z ? Math.abs(z.hdd - l.hdd) : 99; }));
say(zw.rows.length === lw.rows.length && worst <= 0.05, `weather: ${zw.rows.length} days vs ${lw.rows.length}, largest HDD difference ${worst.toFixed(2)}`);

// The bill model on both sources, scenario by scenario.
const { scenarios } = JSON.parse(readFileSync("eval/scenarios.json", "utf8")) as { scenarios: { id: string; bill_a: string; bill_b: string }[] };
async function model(src: DataSource, a_id: string, b_id: string) {
  const bills = (await src.bills()).rows;
  const weather = (await src.weather("2024-10-01", "2026-10-20")).rows;
  const a = bills.find((b) => b.bill_id === a_id)!;
  const b = bills.find((x) => x.bill_id === b_id)!;
  const before = bills.filter((x) => x.utility === a.utility && x.period_end < b.period_start).slice(-12);
  const s = splitChange(a, b, weather, fitWeather(before, weather, a));
  return { parts: s.parts, verdicts: (["C1", "C2", "C3", "C4", "C5", "C6", "C7"] as CauseId[]).map((c) => measure(c, s, a, b).passes) };
}
for (const sc of scenarios) {
  const [z, l] = await Promise.all([model(zetarisSource, sc.bill_a, sc.bill_b), model(localSource, sc.bill_a, sc.bill_b)]);
  const partDiff = Object.keys(l.parts).filter((k) => !close(z.parts[k as keyof typeof z.parts], l.parts[k as keyof typeof l.parts], 0.011));
  say(!partDiff.length && JSON.stringify(z.verdicts) === JSON.stringify(l.verdicts), `${sc.id}: £ split and verdicts`, partDiff.length ? `parts differ: ${partDiff.join(", ")}` : JSON.stringify(z.verdicts) === JSON.stringify(l.verdicts) ? "" : `verdicts ${JSON.stringify(z.verdicts)} vs ${JSON.stringify(l.verdicts)}`);
}

console.log(`\n${problems ? `${problems} difference(s).` : "Zetaris matches the local files."}`);
process.exit(problems ? 1 : 0);
