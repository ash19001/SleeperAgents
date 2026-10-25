// The facts table: every number an answer may show, worked out in code from
// the investigation, each with the evidence it came from. The writer refers
// to them only as {F1}, {F2}, … and never writes a number itself, so every
// figure on the page traces back to a measurement. Parts get a fact only
// when a supported cause explains them, so the writer can't give a £ figure
// for a cause that was ruled out.

import type { CauseId } from "../billmodel/causes.ts";
import type { PartId } from "../billmodel/decompose.ts";
import { CAUSE_NAMES, PART_NAMES } from "../lib/labels.ts";
import type { Cause, Fact, NextStep, Part } from "../lib/types.ts";
import { PART_CAUSES } from "../memory/casefile.ts";
import type { InvestigationResult } from "./orchestrators/investigate.ts";

export interface AnswerFact extends Fact {
  key: string; // what it is: "change", "part:weather", "C1:price_a", …
  meaning: string; // for the writer's prompt
  cause?: CauseId; // set when the fact belongs to a supported cause
  required?: boolean; // the text must use it: a supported part over £1
}

export const MATERIAL_GBP = 1;
const pounds = (x: number) => `£${Math.abs(x).toFixed(2)}`;
const pct = (x: number) => `${Math.abs(x) < 10 ? Math.abs(x).toFixed(1) : Math.round(Math.abs(x))}%`;
const uniq = (xs: string[]) => [...new Set(xs)];

function price(p: number, unit: string): string {
  return unit === "kWh" ? `${(p * 100).toFixed(2)}p per kWh` : `£${p.toFixed(2)} per ${unit}`;
}

export interface FactsTable {
  facts: AnswerFact[];
  byKey: Map<string, AnswerFact>;
}

export function buildFacts(r: InvestigationResult): FactsTable {
  const facts: AnswerFact[] = [];
  const add = (key: string, value: string, evidence: string[], meaning: string, extra: Partial<AnswerFact> = {}) => {
    const fact: AnswerFact = { id: `F${facts.length + 1}`, key, value, evidence: uniq(evidence), meaning, ...extra };
    facts.push(fact);
    return fact;
  };
  const billEvidence = r.evidence.filter((e) => e.title.endsWith(" bills")).map((e) => e.id);
  const found = new Map(r.findings.map((f) => [f.cause, f]));
  const supported = (c: CauseId) => found.get(c)?.verdict === "supported";

  add("change", pounds(r.change), billEvidence, `how much the bill went ${r.change >= 0 ? "up" : "down"}`, { required: true });
  add("total_a", pounds(r.a.total_gbp), billEvidence, `the earlier bill's total (${r.a.label})`, { required: true });
  add("total_b", pounds(r.b.total_gbp), billEvidence, `the later bill's total (${r.b.label})`, { required: true });

  // Parts explained by a supported cause, biggest first.
  const parts = (Object.keys(r.parts) as PartId[]).filter((p) => Math.round(r.parts[p] * 100) !== 0 && PART_CAUSES[p].some(supported));
  parts.sort((x, y) => Math.abs(r.parts[y]) - Math.abs(r.parts[x]));
  for (const p of parts) {
    const causes = PART_CAUSES[p].filter(supported);
    const evidence = causes.flatMap((c) => found.get(c)!.evidence);
    add(`part:${p}`, pounds(r.parts[p]), evidence, `${PART_NAMES[p]}: ${r.parts[p] >= 0 ? "added to" : "took off"} the bill (explained by ${causes.map((c) => `${c} ${CAUSE_NAMES[c]}`).join(" and ")})`, {
      cause: causes[0],
      required: Math.abs(r.parts[p]) >= MATERIAL_GBP,
    });
  }

  // The measured values behind each supported cause.
  for (const f of r.findings.filter((x) => x.verdict === "supported")) {
    const d = r.measured[f.cause]?.detail ?? {};
    const ev = f.evidence;
    const num = (k: string) => Number(d[k]);
    switch (f.cause) {
      case "C1":
        add("C1:price_a", price(num("price_a"), r.a.unit), ev, "the earlier unit rate", { cause: "C1" });
        add("C1:price_b", price(num("price_b"), r.b.unit), ev, "the later unit rate", { cause: "C1" });
        break;
      case "C2":
        add("C2:standing_a", `${num("standing_a_p").toFixed(2)}p a day`, ev, "the earlier standing charge", { cause: "C2" });
        add("C2:standing_b", `${num("standing_b_p").toFixed(2)}p a day`, ev, "the later standing charge", { cause: "C2" });
        break;
      case "C3":
        add("C3:days_a", `${num("days_a")} days`, ev, "days on the earlier bill", { cause: "C3" });
        add("C3:days_b", `${num("days_b")} days`, ev, "days on the later bill", { cause: "C3" });
        break;
      case "C4":
        add("C4:share", pct(f.value ?? 0), ev, "how far an estimated reading moved the billed units", { cause: "C4" });
        break;
      case "C6":
        if (r.utility === "water") {
          add("C6:driver_a", `${num("driver_a").toFixed(1)}°C`, ev, "the earlier bill's average daily high", { cause: "C6" });
          add("C6:driver_b", `${num("driver_b").toFixed(1)}°C`, ev, "the later bill's average daily high", { cause: "C6" });
        }
        break;
      case "C7":
        add("C7:change", pct(f.value ?? 0), ev, `how much daily use changed beyond the weather (${(f.value ?? 0) >= 0 ? "up" : "down"})`, { cause: "C7" });
        break;
      case "C8":
        add("C8:litres", `${Math.abs(num("litres_per_day_extra"))} litres a day`, ev, "extra water a day beyond the weather", { cause: "C8" });
        break;
      case "C9":
        if (d.gas_change_beyond_weather_pct !== undefined) {
          add("C9:gas", pct(num("gas_change_beyond_weather_pct")), ev, "how much gas use fell beyond the weather", { cause: "C9" });
          add("C9:electricity", pct(num("electricity_change_beyond_weather_pct")), ev, "how much electricity use rose beyond the weather", { cause: "C9" });
        }
        break;
    }
  }
  return { facts, byKey: new Map(facts.map((f) => [f.key, f])) };
}

// One plain line per cause, from its measurement, for the causes table.
export function causeDetail(r: InvestigationResult, cause: CauseId): string {
  const f = r.findings.find((x) => x.cause === cause);
  const d = r.measured[cause]?.detail ?? {};
  const num = (k: string) => Number(d[k]);
  const yes = f?.verdict === "supported";
  if (f?.verdict === "inconclusive") return `Not enough data to decide${d.reason ? `: ${d.reason}` : ""}.`;
  switch (cause) {
    case "C1":
      return `The unit rate went from ${price(num("price_a"), r.a.unit)} to ${price(num("price_b"), r.b.unit)}${yes ? "" : ", too small a change to count"}.`;
    case "C2":
      return `The standing charge went from ${num("standing_a_p").toFixed(2)}p to ${num("standing_b_p").toFixed(2)}p a day${yes ? "" : ", too small a change to count"}.`;
    case "C3":
      return `The later bill covered ${num("days_b")} days; the earlier one covered ${num("days_a")}.`;
    case "C4":
      return yes ? `An estimated reading moved the billed units by ${pct(f?.value ?? 0)}.` : "No estimated reading moved the billed units enough to matter.";
    case "C5":
      return yes ? `The later bill has ${d.note_b ? `a ${String(d.note_b).toLowerCase().replace(/_/g, " ")} of ` : ""}${pounds(num("oneoff_b") - num("oneoff_a"))} in credits or one-off charges that the earlier one didn't.` : "Neither bill has a different credit or one-off charge.";
    case "C6":
      return yes ? `The weather explains ${pct(f?.value ?? 0)} of the change in daily use (fit R² ${num("r2").toFixed(2)} over ${num("fit_bills")} bills).` : `The weather explains only ${pct(f?.value ?? 0)} of the change in daily use.`;
    case "C7":
      return `Beyond the weather, daily use changed by ${pct(f?.value ?? 0)}${yes ? "" : ", under the 10% that counts"}.`;
    case "C8":
      return yes ? `Water use beyond the weather is up about ${Math.abs(num("litres_per_day_extra"))} litres a day and staying up, with no household note to explain it.` : "Water use beyond the weather isn't up and staying up.";
    case "C9":
      return d.gas_change_beyond_weather_pct === undefined
        ? "Gas and electricity weren't compared."
        : `Beyond the weather, gas use changed by ${num("gas_change_beyond_weather_pct") >= 0 ? "+" : "−"}${pct(num("gas_change_beyond_weather_pct"))} and electricity by ${num("electricity_change_beyond_weather_pct") >= 0 ? "+" : "−"}${pct(num("electricity_change_beyond_weather_pct"))}${yes ? ": a switch from gas to electric heating" : ""}.`;
  }
}

export function causesTable(r: InvestigationResult): Cause[] {
  return r.findings.map((f) => ({ id: f.cause, verdict: f.verdict, effect_gbp: f.effect_gbp, evidence: f.evidence, memory: f.memory, detail: causeDetail(r, f.cause) }));
}

export function components(r: InvestigationResult): Part[] {
  const found = new Map(r.findings.map((f) => [f.cause, f]));
  return (Object.keys(r.parts) as PartId[]).map((p) => ({ id: p, gbp: r.parts[p], evidence: uniq(PART_CAUSES[p].flatMap((c) => found.get(c)?.evidence ?? [])) }));
}

// Next steps from a fixed map, for supported causes only.
const NEXT: Partial<Record<CauseId, string>> = {
  C4: "Send your supplier an actual meter reading each month, so your bills aren't based on estimates.",
  C1: "Compare fixed deals. Your unit rate changes with the price cap every three months.",
  C8: "Turn off every tap and appliance, then read your water meter twice, 30 minutes apart. If the number moves, you may have a leak: call your water company.",
  C9: "You now heat with electricity, so look at tariffs designed for heat pumps.",
  C7: "Add a household note if something changed at home, such as a new appliance or someone working from home.",
  C5: "Nothing to do. The credit or charge is already on this bill, so expect the next bill to change back.",
  C6: "Nothing to fix for the weather or the length of the bill. Both even out over the year.",
};

export function nextSteps(r: InvestigationResult): NextStep[] {
  const found = new Map(r.findings.map((f) => [f.cause, f]));
  const steps: NextStep[] = [];
  for (const cause of ["C8", "C4", "C9", "C7", "C1", "C5", "C6"] as CauseId[]) {
    const f = found.get(cause);
    if (f?.verdict !== "supported" || !NEXT[cause]) continue;
    if (cause === "C7" && (found.get("C8")?.verdict === "supported" || found.get("C9")?.verdict === "supported")) continue;
    steps.push({ cause, action: NEXT[cause]!, evidence: f.evidence });
  }
  return steps;
}
