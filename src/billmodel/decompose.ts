// The bill model (PLAN.md): every metered bill is p × (Qt + e) + s × d + a, so
// the change between two bills splits into six exact £ parts that add up to
// the penny. Plus the weather fit, q = α + β × h, over the bills before.

import type { UBill, WeatherDay } from "../data/types.ts";

export interface BillTerms {
  d: number; // days
  q: number; // true units per day
  Qt: number; // true units
  e: number; // billed minus true units (non-zero after an estimate)
  p: number; // £ per billed unit (energy charge ÷ billed units)
  s: number; // standing charge, £ a day
  a: number; // one-offs minus credits, £
  h: number; // mean daily weather driver: heating degree days, or max °C for water
}

export interface WeatherFit {
  alpha: number;
  beta: number; // units per day for each unit of the weather driver
  r2: number;
  n: number; // bills used
  driver: "hdd" | "tmax_c";
  // Whether the fit predicts the earlier bill of the pair to within 30%. If it
  // doesn't, the household's pattern has changed (a heat pump, say), so the
  // fit mixes two regimes and its weather estimate isn't used.
  reliable: boolean;
  miss_pct: number | null;
}

export const FIT_MAX_MISS_PCT = 30;

export type PartId = "period" | "weather" | "usage_other" | "unit_price" | "standing" | "estimate" | "oneoff";

export interface Split {
  change: number; // £, B − A
  parts: Record<PartId, number>; // £, sum to change exactly
  A: BillTerms;
  B: BillTerms;
  fit: WeatherFit | null;
  usagePerDay: number; // qB − qA
  weatherPerDay: number; // β × (hB − hA)
  otherPerDay: number; // the rest
}

const round2 = (x: number) => Math.round(x * 100) / 100;

export const driverFor = (bill: UBill) => (bill.utility === "water" ? "tmax_c" : "hdd") as WeatherFit["driver"];

// Mean daily weather driver over a bill's days.
export function meanDriver(bill: UBill, weather: WeatherDay[]): number {
  const days = weather.filter((w) => w.day >= bill.period_start && w.day <= bill.period_end);
  if (!days.length) return 0;
  const key = driverFor(bill);
  return days.reduce((t, w) => t + w[key], 0) / days.length;
}

export function terms(bill: UBill, weather: WeatherDay[]): BillTerms {
  return {
    d: bill.days,
    q: bill.units_true / bill.days,
    Qt: bill.units_true,
    e: bill.units_billed - bill.units_true,
    p: bill.units_billed ? bill.energy_gbp / bill.units_billed : 0,
    s: bill.standing_gbp_per_day,
    a: bill.adjustments_gbp,
    h: meanDriver(bill, weather),
  };
}

// Least squares of daily use against the weather driver over the given bills
// (the bills before the later one, so including the earlier). `check` is the
// earlier bill of the pair: the fit must predict it to within 30%.
export function fitWeather(bills: UBill[], weather: WeatherDay[], check?: UBill, minPoints = 3): WeatherFit | null {
  if (bills.length < minPoints) return null;
  const pts = bills.map((b) => ({ x: meanDriver(b, weather), y: b.units_true / b.days }));
  const n = pts.length;
  const mx = pts.reduce((t, p) => t + p.x, 0) / n;
  const my = pts.reduce((t, p) => t + p.y, 0) / n;
  const sxx = pts.reduce((t, p) => t + (p.x - mx) ** 2, 0);
  if (sxx === 0) return null;
  const beta = pts.reduce((t, p) => t + (p.x - mx) * (p.y - my), 0) / sxx;
  const alpha = my - beta * mx;
  const ssTot = pts.reduce((t, p) => t + (p.y - my) ** 2, 0);
  const ssRes = pts.reduce((t, p) => t + (p.y - (alpha + beta * p.x)) ** 2, 0);
  let miss: number | null = null;
  if (check) {
    const actual = check.units_true / check.days;
    miss = actual ? (Math.abs(alpha + beta * meanDriver(check, weather) - actual) / actual) * 100 : null;
  }
  return { alpha, beta, r2: ssTot ? 1 - ssRes / ssTot : 0, n, driver: driverFor(bills[0]), reliable: miss === null || miss <= FIT_MAX_MISS_PCT, miss_pct: miss };
}

export function splitChange(a: UBill, b: UBill, weather: WeatherDay[], fit: WeatherFit | null): Split {
  const A = terms(a, weather);
  const B = terms(b, weather);
  const beta = fit?.reliable ? fit.beta : 0;
  const usage = A.p * B.d * (B.q - A.q);
  const weatherPart = A.p * B.d * beta * (B.h - A.h);
  const raw: Record<PartId, number> = {
    period: (B.d - A.d) * (A.p * A.q + A.s),
    weather: weatherPart,
    usage_other: usage - weatherPart,
    unit_price: B.Qt * (B.p - A.p),
    standing: B.d * (B.s - A.s),
    estimate: B.p * B.e - A.p * A.e,
    oneoff: B.a - A.a,
  };
  const change = round2(b.total_gbp - a.total_gbp);
  const parts = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, round2(v)])) as Record<PartId, number>;
  // Rounding each part can leave a penny or two over; it goes to the largest
  // calculated part, never to a one-off, which is exact.
  const residual = round2(change - Object.values(parts).reduce((t, x) => t + x, 0));
  if (Math.abs(residual) > 0.05) throw new Error(`split of ${b.bill_id} is off by £${residual}`);
  const largest = (Object.keys(parts) as PartId[]).filter((k) => k !== "oneoff").reduce((m, k) => (Math.abs(parts[k]) > Math.abs(parts[m]) ? k : m));
  parts[largest] = round2(parts[largest] + residual);
  return {
    change,
    parts,
    A,
    B,
    fit,
    usagePerDay: B.q - A.q,
    weatherPerDay: beta * (B.h - A.h),
    otherPerDay: B.q - A.q - beta * (B.h - A.h),
  };
}
