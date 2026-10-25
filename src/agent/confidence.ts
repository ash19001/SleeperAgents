// How sure an answer is, and what it can't tell you, worked out in code from
// the investigation, not by a model: how much of the bill's movement the
// supported causes explain, whether past bills predict this household's use
// from the weather, estimated readings, and anything left unexplained.

import type { CauseId } from "../billmodel/causes.ts";
import type { PartId } from "../billmodel/decompose.ts";
import { CAUSE_NAMES, PART_NAMES } from "../lib/labels.ts";
import type { Assessment } from "../lib/types.ts";
import { PART_CAUSES } from "../memory/casefile.ts";
import type { InvestigationResult } from "./orchestrators/investigate.ts";

const pounds = (x: number) => `£${Math.abs(x).toFixed(2)}`;
const BARELY_CHANGED_GBP = 2;

export function assess(r: InvestigationResult): Assessment {
  const found = new Map(r.findings.map((f) => [f.cause, f]));
  const supported = (c: CauseId) => found.get(c)?.verdict === "supported";
  const parts = Object.keys(r.parts) as PartId[];
  const size = (ps: PartId[]) => ps.reduce((t, p) => t + Math.abs(r.parts[p]), 0);
  const total = size(parts);
  const explained = size(parts.filter((p) => PART_CAUSES[p].some(supported)));
  const open = size(r.unexplained);
  const pct = total ? Math.round((explained / total) * 100) : 100;
  const reasons: string[] = [];
  const limitations: string[] = [];

  // The weather fit: trusted, broken by a change in the household, or missing.
  const fit = r.measured.C6?.detail ?? {};
  const fitTrusted = fit.r2 !== undefined;
  const weatherMixedIn = !fitTrusted && Math.abs(r.parts.usage_other) >= 1;
  if (fitTrusted) reasons.push(`Past bills predict your use from the weather well (R² ${Number(fit.r2).toFixed(2)} over ${fit.fit_bills} bills), so the weather's share is measured, not guessed.`);
  else if (String(fit.reason ?? "").startsWith("not enough")) limitations.push("There aren't enough earlier bills to separate the weather from your own use, so the two are counted together.");
  else limitations.push("Your use no longer follows its old pattern (a heat pump, say), so past bills can't estimate the weather's effect; any weather effect sits in “use beyond the weather”.");

  // Estimated readings that nothing has corrected yet.
  const estimated = [r.a, r.b].filter((b) => b.read_type === "estimated");
  if (!estimated.length) reasons.push("Both bills used actual meter readings.");
  if (r.b.read_type === "estimated") limitations.push(`The ${r.b.label} bill used an estimated reading; the next actual reading may correct it.`);
  if (r.a.read_type === "estimated" && !supported("C4")) limitations.push(`The ${r.a.label} bill used an estimated reading, which may make the comparison less fair.`);

  for (const p of r.unexplained) {
    const why = PART_CAUSES[p].map((c) => r.measured[c]?.detail.reason).find(Boolean);
    limitations.push(`${PART_NAMES[p]} (${pounds(r.parts[p])}) can't be explained yet: ${why ?? "there isn't enough data"}.`);
  }
  if (supported("C7") && !supported("C8") && !supported("C9") && !found.get("C7")?.memory.length) {
    limitations.push("The readings show your use changed beyond the weather, but not why. A household note (a new appliance, someone at home more) lets the agents link it.");
  }
  if (supported("C8")) limitations.push("A possible leak is a pattern in the readings, not a confirmed fault. The meter check in “What to do next” confirms it.");
  for (const f of r.findings.filter((x) => x.overridden)) {
    limitations.push(`The ${f.specialist} specialist disagreed with the measurement for ${CAUSE_NAMES[f.cause].toLowerCase()}; the measurement was used.`);
  }
  limitations.push("It explains the change between these two bills from their own data. It doesn't check the bill is correct or compare tariffs.");

  if (total < BARELY_CHANGED_GBP) {
    reasons.unshift(`The bill barely moved (${pounds(r.change)}), and every cause was checked.`);
    return { level: "high", explained_pct: pct, reasons, limitations };
  }
  reasons.unshift(`${pct}% of the movement in the bill is explained by causes that passed their tests.`);
  const level = pct < 70 || open >= 0.25 * total ? "low" : pct >= 90 && !open && !weatherMixedIn && r.b.read_type !== "estimated" ? "high" : "medium";
  return { level, explained_pct: pct, reasons, limitations };
}
