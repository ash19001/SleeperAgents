// The measurement behind each cause test, in code. Specialists call these
// through their tools and the checker re-runs them, so a cause is only ever
// "supported" when its measurement passes the threshold in thresholds.ts.

import type { UBill } from "../data/types.ts";
import type { Split } from "./decompose.ts";
import { THRESHOLDS as T } from "./thresholds.ts";

export type CauseId = "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7" | "C8" | "C9";

export interface Measurement {
  cause: CauseId;
  passes: boolean | null; // null: not enough data to decide
  value: number | null;
  threshold: string;
  effect_gbp: number;
  detail: Record<string, number | string | boolean | null>;
}

const pct = (from: number, to: number) => (from ? ((to - from) / Math.abs(from)) * 100 : 0);
const r = (x: number, dp = 2) => Math.round(x * 10 ** dp) / 10 ** dp;

export function measure(
  cause: CauseId,
  s: Split,
  a: UBill,
  b: UBill,
  extra: { otherUtility?: Split | null; previous?: Split | null; noteExplains?: boolean } = {},
): Measurement {
  const { A, B, parts } = s;
  switch (cause) {
    case "C1": {
      const change = pct(A.p, B.p);
      return { cause, value: r(change), passes: Math.abs(change) >= T.C1_unit_price_change_pct, threshold: `|change| ≥ ${T.C1_unit_price_change_pct}%`, effect_gbp: parts.unit_price, detail: { price_a: r(A.p, 4), price_b: r(B.p, 4) } };
    }
    case "C2": {
      const diff = (B.s - A.s) * 100;
      return { cause, value: r(diff), passes: Math.abs(diff) >= T.C2_standing_change_p_per_day, threshold: `|change| ≥ ${T.C2_standing_change_p_per_day}p a day`, effect_gbp: parts.standing, detail: { standing_a_p: r(A.s * 100), standing_b_p: r(B.s * 100) } };
    }
    case "C3": {
      const diff = B.d - A.d;
      return { cause, value: diff, passes: Math.abs(diff) >= T.C3_period_change_days, threshold: `|change| ≥ ${T.C3_period_change_days} days`, effect_gbp: parts.period, detail: { days_a: A.d, days_b: B.d } };
    }
    case "C4": {
      const share = Math.max(Math.abs(A.e) / (a.units_billed || 1), Math.abs(B.e) / (b.units_billed || 1)) * 100;
      const estimated = a.read_type === "estimated" || b.read_type === "estimated" || A.e !== 0 || B.e !== 0;
      return { cause, value: r(share), passes: estimated && share > T.C4_estimate_share_pct, threshold: `an estimate moved billed units by > ${T.C4_estimate_share_pct}%`, effect_gbp: parts.estimate, detail: { correction_a: A.e, correction_b: B.e, read_a: a.read_type, read_b: b.read_type } };
    }
    case "C5":
      return { cause, value: r(B.a - A.a), passes: B.a !== A.a, threshold: "one-offs differ", effect_gbp: parts.oneoff, detail: { oneoff_a: A.a, oneoff_b: B.a, note_b: b.adjustment_note } };
    case "C6": {
      if (!s.fit) return { cause, value: null, passes: null, threshold: `weather ≥ ${T.C6_weather_share_pct}% of the use change, R² ≥ ${T.C6_min_r2}`, effect_gbp: parts.weather, detail: { reason: "not enough earlier bills to fit use against the weather" } };
      if (!s.fit.reliable) return { cause, value: null, passes: null, threshold: `weather ≥ ${T.C6_weather_share_pct}% of the use change, R² ≥ ${T.C6_min_r2}`, effect_gbp: parts.weather, detail: { reason: "the household's pattern changed, so the weather fit doesn't predict the earlier bill", miss_pct: r(s.fit.miss_pct ?? 0) } };
      const share = s.usagePerDay ? (s.weatherPerDay / s.usagePerDay) * 100 : 0;
      const passes = s.fit.r2 >= T.C6_min_r2 && share >= T.C6_weather_share_pct;
      return { cause, value: r(share), passes, threshold: `weather ≥ ${T.C6_weather_share_pct}% of the use change, same direction, R² ≥ ${T.C6_min_r2}`, effect_gbp: parts.weather, detail: { r2: r(s.fit.r2), beta: r(s.fit.beta, 3), driver_a: r(A.h), driver_b: r(B.h), fit_bills: s.fit.n } };
    }
    case "C7": {
      const change = A.q ? (s.otherPerDay / A.q) * 100 : 0;
      return { cause, value: r(change), passes: Math.abs(change) >= T.C7_other_change_pct, threshold: `use beyond the weather moves daily use by ≥ ${T.C7_other_change_pct}%`, effect_gbp: parts.usage_other, detail: { other_per_day: r(s.otherPerDay, 3), daily_use_a: r(A.q, 3), fitted: Boolean(s.fit) } };
    }
    case "C8": {
      // A leak shows as a rise beyond the weather that stays: up this time, or
      // up last time and not back down this time ("two bills running").
      const change = A.q ? (s.otherPerDay / A.q) * 100 : 0;
      const before = extra.previous && extra.previous.A.q ? (extra.previous.otherPerDay / extra.previous.A.q) * 100 : null;
      const sustained = change >= T.C8_other_rise_pct || (before !== null && before >= T.C8_other_rise_pct && change > -T.C8_other_rise_pct / 3);
      const passes = b.utility === "water" && sustained && !extra.noteExplains;
      return { cause, value: r(change), passes, threshold: `water use beyond the weather up ≥ ${T.C8_other_rise_pct}% and staying up, with no note to explain it`, effect_gbp: parts.usage_other, detail: { litres_per_day_extra: r(s.otherPerDay * 1000, 0), previous_rise_pct: before === null ? null : r(before), note_explains: Boolean(extra.noteExplains) } };
    }
    case "C9": {
      const other = extra.otherUtility;
      if (!other) return { cause, value: null, passes: extra.noteExplains ? true : null, threshold: "gas falls and electricity rises beyond the weather, or a note says so", effect_gbp: 0, detail: { reason: "other utility not compared" } };
      const mine = s.A.q ? (s.otherPerDay / s.A.q) * 100 : 0;
      const theirs = other.A.q ? (other.otherPerDay / other.A.q) * 100 : 0;
      const [gas, elec] = b.utility === "gas" ? [mine, theirs] : [theirs, mine];
      const passes = (gas <= -T.C7_other_change_pct && elec >= T.C7_other_change_pct) || Boolean(extra.noteExplains);
      return { cause, value: r(gas), passes, threshold: "gas falls and electricity rises beyond the weather, or a note says so", effect_gbp: 0, detail: { gas_change_beyond_weather_pct: r(gas), electricity_change_beyond_weather_pct: r(elec) } };
    }
  }
}
