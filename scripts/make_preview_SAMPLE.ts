// Builds web/preview_SAMPLE.js: a made-up SAMPLE household plus hand-written
// preview answers, so the web page can be built before the agent exists.
// Every £ split is computed with the bill model in PLAN.md, so the parts add
// up to the penny. Real agent answers (eval/answers/) replace these later.
//
// Run: node scripts/make_preview_SAMPLE.ts

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

type Utility = "electricity" | "gas" | "water";

interface Bill {
  utility: Utility;
  bill_id: string;
  label: string;
  months: number[];
  period_start: string;
  period_end: string;
  days: number;
  units_true: number;
  units_billed: number;
  unit: string;
  read_type: "actual" | "estimated";
  energy_gbp: number;
  standing_gbp: number;
  adjustments_gbp: number;
  total_gbp: number;
  driver: number; // mean daily heating degree days, or mean daily max temperature for water
}

interface Period {
  from: Date;
  to: Date;
  days: number;
}

const DAY_MS = 86_400_000;
const round2 = (x: number) => Math.round(x * 100) / 100;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (date: string) => new Date(`${date}T00:00:00Z`);

function periods(start: string, dayCounts: number[]): Period[] {
  let from = utc(start);
  return dayCounts.map((days) => {
    const to = new Date(from.getTime() + (days - 1) * DAY_MS);
    const period = { from, to, days };
    from = new Date(to.getTime() + DAY_MS);
    return period;
  });
}

// Share of a period's days on or after `date`.
function shareFrom(p: Period, date: string): number {
  const d = utc(date);
  if (d <= p.from) return 1;
  if (d > p.to) return 0;
  return ((p.to.getTime() - d.getTime()) / DAY_MS + 1) / p.days;
}

// ---- Energy: monthly electricity and gas bills from supplier A -------------

const HEAT_PUMP_FROM = "2026-03-15";
const ENERGY_START = "2025-10-01";
const ENERGY_DAYS = [31, 30, 28, 35, 28, 31, 30, 31, 28, 31, 31, 30];
const ENERGY_MONTHS = ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03",
  "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
const HDD = [5.8, 8.9, 10.6, 12.9, 10.4, 8.7, 6.1, 3.4, 1.3, 0.6, 0.7, 2.6];

// Illustrative £ per unit and £ per day by quarter (Oct-Dec, Jan-Mar, Apr-Sep).
// Real Octopus rates replace these in Phase 4.
const TARIFF = {
  electricity: { unit: [0.2635, 0.2769, 0.2563], standing: [0.5368, 0.5475, 0.5115] },
  gas: { unit: [0.0629, 0.0593, 0.0605], standing: [0.3403, 0.3509, 0.3367] },
};
const quarter = (i: number) => (i < 3 ? 0 : i < 6 ? 1 : 2);
const GAS_CORRECTION: Record<string, number> = { "2025-11": -310, "2025-12": 310 };

function energyBills(utility: "electricity" | "gas"): Bill[] {
  return periods(ENERGY_START, ENERGY_DAYS).map((p, i) => {
    const month = ENERGY_MONTHS[i];
    const h = HDD[i];
    const pump = shareFrom(p, HEAT_PUMP_FROM);
    // Gas heats the home and water until the heat pump takes over both.
    const perDay = utility === "gas"
      ? (1 - pump) * (8 + 4.2 * h) + pump * 1.5
      : 7.4 + 0.12 * h + pump * (1.26 * h + 2.1);
    const units_true = Math.round(perDay * p.days);
    const correction = utility === "gas" ? GAS_CORRECTION[month] ?? 0 : 0;
    const units_billed = units_true + correction;
    const energy_gbp = round2(TARIFF[utility].unit[quarter(i)] * units_billed);
    const standing_gbp = round2(TARIFF[utility].standing[quarter(i)] * p.days);
    const adjustments_gbp = utility === "electricity" && month === "2026-06" ? -50 : 0;
    const monthNumber = Number(month.slice(5));
    return {
      utility,
      bill_id: `${utility === "gas" ? "GAS" : "ELEC"}-${month}`,
      label: utc(`${month}-01`).toLocaleString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).replace("Sept", "Sep"),
      months: [monthNumber],
      period_start: iso(p.from),
      period_end: iso(p.to),
      days: p.days,
      units_true,
      units_billed,
      unit: "kWh",
      read_type: correction < 0 ? "estimated" : "actual",
      energy_gbp,
      standing_gbp,
      adjustments_gbp,
      total_gbp: round2(energy_gbp + standing_gbp + adjustments_gbp),
      driver: h,
    };
  });
}

// ---- Water: bills every two months from Waterco ----------------------------

const LEAK_FROM = "2026-06-15";
const WATER_RISE_FROM = "2026-04-01";
const WATER_DAYS = [61, 62, 59, 61, 61, 61];
const WATER_IDS = ["2025-10", "2025-12", "2026-02", "2026-04", "2026-06", "2026-08"];
const WATER_LABELS = ["Oct–Nov 2025", "Dec 2025–Jan 2026", "Feb–Mar 2026", "Apr–May 2026", "Jun–Jul 2026", "Aug–Sep 2026"];
const WATER_MONTHS = [[10, 11], [12, 1], [2, 3], [4, 5], [6, 7], [8, 9]];
const MAX_TEMP = [12.5, 7.8, 9.6, 15.2, 21.4, 20.1];

function waterBills(): Bill[] {
  return periods(ENERGY_START, WATER_DAYS).map((p, i) => {
    const t = MAX_TEMP[i];
    const perDay = 0.3 + 0.006 * t + shareFrom(p, LEAK_FROM) * 0.16;
    const units_true = Math.round(perDay * p.days);
    const risen = p.from >= utc(WATER_RISE_FROM);
    const energy_gbp = round2((risen ? 4.35 : 4.03) * units_true);
    const standing_gbp = round2((risen ? 0.23 : 0.21) * p.days);
    return {
      utility: "water",
      bill_id: `WATER-${WATER_IDS[i]}`,
      label: WATER_LABELS[i],
      months: WATER_MONTHS[i],
      period_start: iso(p.from),
      period_end: iso(p.to),
      days: p.days,
      units_true,
      units_billed: units_true,
      unit: "m³",
      read_type: "actual",
      energy_gbp,
      standing_gbp,
      adjustments_gbp: 0,
      total_gbp: round2(energy_gbp + standing_gbp),
      driver: t,
    };
  });
}

const BILLS = [...energyBills("electricity"), ...energyBills("gas"), ...waterBills()];
const bill = (id: string) => {
  const found = BILLS.find((b) => b.bill_id === id);
  if (!found) throw new Error(`no bill ${id}`);
  return found;
};

// ---- The bill model (PLAN.md) ----------------------------------------------

function model(x: Bill) {
  return {
    d: x.days,
    q: x.units_true / x.days,
    Qt: x.units_true,
    e: x.units_billed - x.units_true,
    p: x.energy_gbp / x.units_billed,
    s: x.standing_gbp / x.days,
    a: x.adjustments_gbp,
    h: x.driver,
  };
}

function split(a: Bill, b: Bill, beta: number) {
  const A = model(a);
  const B = model(b);
  const usage = A.p * B.d * (B.q - A.q);
  const weather = A.p * B.d * beta * (B.h - A.h);
  const raw: Record<string, number> = {
    period: (B.d - A.d) * (A.p * A.q + A.s),
    weather,
    usage_other: usage - weather,
    unit_price: B.Qt * (B.p - A.p),
    standing: B.d * (B.s - A.s),
    estimate: B.p * B.e - A.p * A.e,
    oneoff: B.a - A.a,
  };
  const change = round2(b.total_gbp - a.total_gbp);
  const parts = Object.entries(raw).map(([id, v]) => ({ id, gbp: round2(v) }));
  // Rounding each part to pennies can leave a penny or two over; give it to the
  // largest calculated part. One-offs are exact pounds and pence, so never adjust them.
  const residual = round2(change - parts.reduce((t, x) => t + x.gbp, 0));
  if (Math.abs(residual) > 0.03) throw new Error(`split of ${b.bill_id} is off by ${residual}`);
  const largest = parts
    .filter((x) => x.id !== "oneoff")
    .reduce((m, x) => (Math.abs(x.gbp) > Math.abs(m.gbp) ? x : m));
  largest.gbp = round2(largest.gbp + residual);
  const total = round2(parts.reduce((t, x) => t + x.gbp, 0));
  if (total !== change) throw new Error(`split of ${b.bill_id} sums to ${total}, not ${change}`);
  const gbp = Object.fromEntries(parts.map((x) => [x.id, x.gbp]));
  // Daily use beyond the weather, in units per day, and as a share of the earlier bill's daily use.
  const otherPerDay = raw.usage_other / (A.p * B.d);
  return { change, gbp, A, B, otherPerDay, otherShare: otherPerDay / A.q };
}

// ---- Formatting -------------------------------------------------------------

const money = (x: number) => `£${Math.abs(x).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pence = (x: number) => `${(x * 100).toFixed(2)}p`;
const pct = (x: number) => (Math.abs(x) < 0.005 ? "less than 1%" : `${Math.round(Math.abs(x) * 100)}%`);
const one = (x: number) => x.toFixed(1);

// ---- Evidence: the read-only queries each answer cites -----------------------

const RUN_AT = "2026-10-24T18:00:00Z";
const list = (ids: string[]) => ids.map((id) => `'${id}'`).join(", ");

function evidence(id: string, title: string, sql: string, rows: number) {
  return { id, title, sql, rows, sha256: createHash("sha256").update(sql).digest("hex"), at: RUN_AT };
}

const sql = {
  bills: (u: Utility, ids: string[]) =>
    `SELECT bill_id, period_start, period_end, days, units_billed, unit,\n       energy_gbp, standing_gbp_per_day, adjustments_gbp, read_type, total_gbp\nFROM whybill.bills\nWHERE utility = '${u}'\n  AND bill_id IN (${list(ids)})\nORDER BY period_start`,
  reads: (u: Utility, from: string, to: string) =>
    `SELECT read_date, reading, unit, read_type\nFROM whybill.reads\nWHERE utility = '${u}'\n  AND read_date BETWEEN '${from}' AND '${to}'\nORDER BY read_date`,
  weather: (ids: string[], col: string) =>
    `SELECT b.bill_id, AVG(w.${col}) AS mean_${col}, COUNT(*) AS days\nFROM whybill.bills b\nJOIN whybill.weather_daily w\n  ON w.day BETWEEN b.period_start AND b.period_end\nWHERE b.bill_id IN (${list(ids)})\nGROUP BY b.bill_id`,
  tariffs: (u: Utility, from: string, to: string) => u === "water"
    ? `SELECT valid_from, valid_to, volume_gbp_per_m3, fixed_gbp_per_day\nFROM whybill.water_charges\nWHERE valid_from <= '${to}'\n  AND (valid_to IS NULL OR valid_to >= '${from}')\nORDER BY valid_from`
    : `SELECT valid_from, valid_to, unit_rate_p_inc_vat, standing_p_per_day\nFROM whybill.tariffs\nWHERE fuel = '${u}'\n  AND valid_from <= '${to}'\n  AND (valid_to IS NULL OR valid_to >= '${from}')\nORDER BY valid_from`,
  fit: (u: Utility, before: string, col: string) =>
    `SELECT b.bill_id, b.units_true / b.days AS units_per_day, AVG(w.${col}) AS mean_${col}\nFROM whybill.bills b\nJOIN whybill.weather_daily w\n  ON w.day BETWEEN b.period_start AND b.period_end\nWHERE b.utility = '${u}'\n  AND b.period_end < '${before}'\nGROUP BY b.bill_id, b.units_true, b.days\nORDER BY b.bill_id DESC\nLIMIT 12`,
  corrections: (u: Utility, ids: string[]) =>
    `SELECT bill_id, read_type, units_billed, units_true,\n       units_billed - units_true AS correction\nFROM whybill.bills\nWHERE utility = '${u}'\n  AND bill_id IN (${list(ids)})\nORDER BY period_start`,
  adjustments: (ids: string[]) =>
    `SELECT bill_id, adjustments_gbp, adjustment_note\nFROM whybill.bills\nWHERE bill_id IN (${list(ids)})\nORDER BY period_start`,
  perDay: (u: Utility, ids: string[]) =>
    `SELECT bill_id, units_true / days AS units_per_day\nFROM whybill.bills\nWHERE utility = '${u}'\n  AND bill_id IN (${list(ids)})\nORDER BY period_start`,
};

const TRACE = [
  { step: "understand", label: "Read the question", route: "nightshift", model: "nvidia/nemotron-3.5-lightning-30b-a3b", ms: 2400 },
  { step: "recall", label: "Recall household notes", route: "h-mem", model: null, ms: 35 },
  { step: "test", label: "Split the £ change and test the causes", route: "zetaris", model: null, ms: 1850 },
  { step: "write", label: "Write the explanation", route: "nightshift", model: "nvidia/nemotron-3-ultra-550b-a55b", ms: 9640 },
  { step: "verify", label: "Check every number and citation", route: "code", model: null, ms: 4 },
];

const fact = (id: string, value: string, ev: string[]) => ({ id, value, evidence: ev });

function components(gbp: Record<string, number>, ev: Record<string, string[]>) {
  return Object.keys(gbp).map((id) => ({ id, gbp: gbp[id], evidence: ev[id] }));
}

function bySize<T extends { effect_gbp: number }>(causes: T[]) {
  return [...causes].sort((x, y) => Math.abs(y.effect_gbp) - Math.abs(x.effect_gbp));
}

// ---- Answer 1: gas, January (up) ---------------------------------------------

function gasJanuary() {
  const a = bill("GAS-2025-12");
  const b = bill("GAS-2026-01");
  const { change, gbp, A, B, otherShare } = split(a, b, 4.2);
  const ids = [a.bill_id, b.bill_id];
  return {
    question: "Why did my gas bill go up in January?",
    utility: "gas", bill_a: a.bill_id, bill_b: b.bill_id,
    total_a: a.total_gbp, total_b: b.total_gbp, change_gbp: change,
    components: components(gbp, {
      period: ["E1"], weather: ["E3", "E5"], usage_other: ["E2", "E5"], unit_price: ["E1", "E4"],
      standing: ["E1", "E4"], estimate: ["E6"], oneoff: ["E7"],
    }),
    causes: [
      ...bySize([
        { id: "C3", verdict: "supported", effect_gbp: gbp.period, evidence: ["E1"], memory: [],
          detail: `January's bill covered ${b.days} days. December's covered ${a.days}.` },
        { id: "C6", verdict: "supported", effect_gbp: gbp.weather, evidence: ["E3", "E5"], memory: [],
          detail: `Heating degree days rose from ${one(A.h)} to ${one(B.h)} a day. Your gas use follows the cold closely (R² 0.96).` },
        { id: "C4", verdict: "supported", effect_gbp: gbp.estimate, evidence: ["E6", "E2"], memory: [],
          detail: "November's bill used an estimated reading that was 310 kWh too low. December's bill caught those units up, which made December look higher." },
        { id: "C1", verdict: "supported", effect_gbp: gbp.unit_price, evidence: ["E4", "E1"], memory: [],
          detail: `The unit rate fell from ${pence(TARIFF.gas.unit[0])} to ${pence(TARIFF.gas.unit[1])} per kWh on 1 January.` },
        { id: "C2", verdict: "supported", effect_gbp: gbp.standing, evidence: ["E4"], memory: [],
          detail: `The standing charge rose from ${pence(TARIFF.gas.standing[0])} to ${pence(TARIFF.gas.standing[1])} a day.` },
      ]),
      { id: "C5", verdict: "ruled_out", effect_gbp: 0, evidence: ["E7"], memory: [],
        detail: "Neither bill has a credit or a one-off charge." },
      { id: "C7", verdict: "ruled_out", effect_gbp: gbp.usage_other, evidence: ["E5", "E2"], memory: [],
        detail: `Once the weather is taken out, daily use changed by ${pct(otherShare)}.` },
      { id: "C9", verdict: "ruled_out", effect_gbp: 0, evidence: ["E8"], memory: [],
        detail: "Electricity use did not rise to match, so there is no sign of a switch to electric heating." },
    ],
    facts: [
      fact("F1", money(change), ["E1"]),
      fact("F2", money(a.total_gbp), ["E1"]),
      fact("F3", money(b.total_gbp), ["E1"]),
      fact("F4", `${b.days} days`, ["E1"]),
      fact("F5", `${a.days}`, ["E1"]),
      fact("F6", money(gbp.period), ["E1"]),
      fact("F7", money(gbp.weather), ["E3", "E5"]),
      fact("F8", money(gbp.estimate), ["E6"]),
      fact("F9", money(gbp.unit_price), ["E4"]),
    ],
    answer_markdown:
      "Your gas bill went up by {F1}, from {F2} to {F3}. Two things pushed it up. January's bill covered {F4} instead of {F5} [E1], which added {F6}, and January was colder, which added {F7} [E3][E5]. " +
      "Two things held it down. December's bill included a catch-up from November's estimated reading, so this change is {F8} smaller than it would otherwise be [E6]. The unit rate also fell, saving {F9} [E4]. " +
      "Once the weather is taken out, your underlying gas use did not change [E5].",
    next_steps: [
      { cause: "C4", action: "Send your supplier an actual meter reading each month, so your bills aren't based on estimates.", evidence: ["E6"] },
      { cause: "C1", action: "Compare fixed deals. Your unit rate changes with the price cap every three months.", evidence: ["E4"] },
      { cause: "C6", action: "Nothing to fix for the colder weather or the longer bill. Both even out over the year.", evidence: ["E3", "E1"] },
    ],
    evidence: [
      evidence("E1", "The two bills", sql.bills("gas", ids), 2),
      evidence("E2", "Meter readings", sql.reads("gas", "2025-10-01", b.period_end), 3),
      evidence("E3", "Weather in each bill period", sql.weather(ids, "hdd"), 2),
      evidence("E4", "Gas tariff history", sql.tariffs("gas", a.period_start, b.period_end), 2),
      evidence("E5", "Weather fit: daily gas use against cold days", sql.fit("gas", a.period_start, "hdd"), 12),
      evidence("E6", "Estimated reading and catch-up", sql.corrections("gas", ["GAS-2025-11", ...ids]), 3),
      evidence("E7", "Credits and one-off charges", sql.adjustments(ids), 2),
      evidence("E8", "Electricity use in the same periods", sql.perDay("electricity", ["ELEC-2025-12", "ELEC-2026-01"]), 2),
    ],
    memory: [],
    trace: TRACE,
  };
}

// ---- Answer 2: electricity, June (down) --------------------------------------

function electricityJune() {
  const a = bill("ELEC-2026-05");
  const b = bill("ELEC-2026-06");
  const { change, gbp, A, B, otherShare } = split(a, b, 1.38);
  const ids = [a.bill_id, b.bill_id];
  return {
    question: "Why was my electricity bill lower in June?",
    utility: "electricity", bill_a: a.bill_id, bill_b: b.bill_id,
    total_a: a.total_gbp, total_b: b.total_gbp, change_gbp: change,
    components: components(gbp, {
      period: ["E1"], weather: ["E3", "E5"], usage_other: ["E2", "E5"], unit_price: ["E1", "E4"],
      standing: ["E1", "E4"], estimate: ["E2"], oneoff: ["E7"],
    }),
    causes: [
      ...bySize([
        { id: "C5", verdict: "supported", effect_gbp: gbp.oneoff, evidence: ["E7"], memory: [],
          detail: "June's bill includes a £50.00 goodwill credit." },
        { id: "C6", verdict: "supported", effect_gbp: gbp.weather, evidence: ["E3", "E5"], memory: [],
          detail: `Heating degree days fell from ${one(A.h)} to ${one(B.h)} a day, so less electricity went on heating (R² 0.88).` },
        { id: "C3", verdict: "supported", effect_gbp: gbp.period, evidence: ["E1"], memory: [],
          detail: `June's bill covered ${b.days} days. May's covered ${a.days}.` },
      ]),
      { id: "C1", verdict: "ruled_out", effect_gbp: gbp.unit_price, evidence: ["E4"], memory: [],
        detail: `Both bills use the same unit rate, ${pence(TARIFF.electricity.unit[2])} per kWh.` },
      { id: "C2", verdict: "ruled_out", effect_gbp: gbp.standing, evidence: ["E4"], memory: [],
        detail: `Both bills use the same standing charge, ${pence(TARIFF.electricity.standing[2])} a day.` },
      { id: "C4", verdict: "ruled_out", effect_gbp: 0, evidence: ["E2"], memory: [],
        detail: "Both bills use actual meter readings." },
      { id: "C7", verdict: "ruled_out", effect_gbp: gbp.usage_other, evidence: ["E5", "E2"], memory: [],
        detail: `Once the weather is taken out, daily use changed by ${pct(otherShare)}.` },
      { id: "C9", verdict: "ruled_out", effect_gbp: 0, evidence: ["E8"], memory: [],
        detail: "Gas use did not change to suggest a switch between fuels." },
    ],
    facts: [
      fact("F1", money(change), ["E1"]),
      fact("F2", money(a.total_gbp), ["E1"]),
      fact("F3", money(b.total_gbp), ["E1"]),
      fact("F4", money(gbp.oneoff), ["E7"]),
      fact("F5", money(gbp.weather), ["E3", "E5"]),
      fact("F6", `${b.days} days`, ["E1"]),
      fact("F7", `${a.days}`, ["E1"]),
      fact("F8", money(gbp.period), ["E1"]),
    ],
    answer_markdown:
      "Your electricity bill went down by {F1}, from {F2} to {F3}. The biggest reason is a goodwill credit of {F4} on June's bill [E7]. " +
      "Warmer weather cut the electricity used for heating, which saved {F5} [E3][E5]. June's bill was also shorter, {F6} instead of {F7}, which saved {F8} [E1]. " +
      "Your prices did not change [E4].",
    next_steps: [
      { cause: "C5", action: "Nothing to do. The credit is already on this bill, so expect July's bill to be higher without it.", evidence: ["E7"] },
      { cause: "C6", action: "Nothing to fix for the weather or the shorter bill. Both even out over the year.", evidence: ["E3", "E1"] },
    ],
    evidence: [
      evidence("E1", "The two bills", sql.bills("electricity", ids), 2),
      evidence("E2", "Meter readings", sql.reads("electricity", a.period_start, b.period_end), 3),
      evidence("E3", "Weather in each bill period", sql.weather(ids, "hdd"), 2),
      evidence("E4", "Electricity tariff history", sql.tariffs("electricity", a.period_start, b.period_end), 1),
      evidence("E5", "Weather fit: daily electricity use against cold days", sql.fit("electricity", a.period_start, "hdd"), 12),
      evidence("E7", "Credits and one-off charges", sql.adjustments(ids), 2),
      evidence("E8", "Gas use in the same periods", sql.perDay("gas", ["GAS-2026-05", "GAS-2026-06"]), 2),
    ],
    memory: [],
    trace: TRACE,
  };
}

// ---- Answer 3: electricity, April, with and without the heat pump note --------

function electricityApril(withNote: boolean) {
  const a = bill("ELEC-2026-03");
  const b = bill("ELEC-2026-04");
  const { change, gbp, A, B, otherPerDay, otherShare } = split(a, b, 0.12);
  const ids = [a.bill_id, b.bill_id];
  const gasA = bill("GAS-2026-03");
  const gasB = bill("GAS-2026-04");
  const gasFall = 1 - (gasB.units_true / gasB.days) / (gasA.units_true / gasA.days);
  const memory = withNote ? ["M1"] : [];
  const facts = [
    fact("F1", money(change), ["E1"]),
    fact("F2", money(a.total_gbp), ["E1"]),
    fact("F3", money(b.total_gbp), ["E1"]),
    fact("F4", `${one(B.q - A.q)} kWh`, ["E2"]),
    fact("F5", money(gbp.usage_other), ["E2", "E5"]),
    fact("F6", money(gbp.unit_price), ["E4"]),
    fact("F7", money(gbp.period), ["E1"]),
  ];
  if (withNote) facts.push(fact("F8", "15 March", ["M1"]));
  return {
    question: "Why did my electricity bill change in April?",
    utility: "electricity", bill_a: a.bill_id, bill_b: b.bill_id,
    total_a: a.total_gbp, total_b: b.total_gbp, change_gbp: change,
    components: components(gbp, {
      period: ["E1"], weather: ["E3", "E5"], usage_other: ["E2", "E5"], unit_price: ["E1", "E4"],
      standing: ["E1", "E4"], estimate: ["E2"], oneoff: ["E7"],
    }),
    causes: [
      ...bySize([
        { id: "C7", verdict: "supported", effect_gbp: gbp.usage_other, evidence: ["E2", "E5"], memory,
          detail: `Once the weather is taken out, you used ${one(otherPerDay)} kWh a day more (${pct(otherShare)}). ` +
            (withNote ? "Your note says a heat pump was installed on 15 March, so April is its first full month." : "No household note explains this.") },
        { id: "C9", verdict: "supported", effect_gbp: 0, evidence: ["E8"], memory,
          detail: `Gas use per day fell ${pct(gasFall)} over the same period while electricity rose.` +
            (withNote ? " Your note confirms a switch to a heat pump." : " This usually means heating moved from gas to electric.") },
        { id: "C1", verdict: "supported", effect_gbp: gbp.unit_price, evidence: ["E4", "E1"], memory: [],
          detail: `The unit rate fell from ${pence(TARIFF.electricity.unit[1])} to ${pence(TARIFF.electricity.unit[2])} per kWh on 1 April.` },
        { id: "C3", verdict: "supported", effect_gbp: gbp.period, evidence: ["E1"], memory: [],
          detail: `April's bill covered ${b.days} days. March's covered ${a.days}.` },
        { id: "C2", verdict: "supported", effect_gbp: gbp.standing, evidence: ["E4"], memory: [],
          detail: `The standing charge fell from ${pence(TARIFF.electricity.standing[1])} to ${pence(TARIFF.electricity.standing[2])} a day.` },
      ]),
      { id: "C6", verdict: "ruled_out", effect_gbp: gbp.weather, evidence: ["E3", "E5"], memory: [],
        detail: `April was warmer (heating degree days fell from ${one(A.h)} to ${one(B.h)}), which would lower your use, not raise it.` },
      { id: "C4", verdict: "ruled_out", effect_gbp: 0, evidence: ["E2"], memory: [],
        detail: "Both bills use actual meter readings." },
      { id: "C5", verdict: "ruled_out", effect_gbp: 0, evidence: ["E7"], memory: [],
        detail: "Neither bill has a credit or a one-off charge." },
    ],
    facts,
    answer_markdown: withNote
      ? "Your electricity bill fell by {F1}, from {F2} to {F3}, but that hides a big change. You used {F4} more electricity a day than in March, even though April was warmer [E2][E5]. Use beyond what the weather explains added {F5}. " +
        "Your heat pump, installed on {F8} [M1], explains it: April is its first full month, and your gas use fell sharply at the same time [E8]. " +
        "A lower unit rate saved {F6} [E4] and one fewer day saved {F7} [E1]."
      : "Your electricity bill fell by {F1}, from {F2} to {F3}, but that hides a big change. You used {F4} more electricity a day than in March, even though April was warmer [E2][E5]. Use beyond what the weather explains added {F5}. " +
        "Your gas use fell sharply at the same time [E8], which usually means heating has moved from gas to electricity. " +
        "A lower unit rate saved {F6} [E4] and one fewer day saved {F7} [E1]. None of your household notes explains the change, so add one if something changed at home.",
    next_steps: [
      withNote
        ? { cause: "C9", action: "You now heat with electricity, so look at tariffs designed for heat pumps.", evidence: ["E8", "M1"] }
        : { cause: "C7", action: "Add a household note if something changed at home, such as a heat pump, an electric car or someone working from home.", evidence: ["E2"] },
      { cause: "C1", action: "Compare fixed deals. Your unit rate changes with the price cap every three months.", evidence: ["E4"] },
    ],
    evidence: [
      evidence("E1", "The two bills", sql.bills("electricity", ids), 2),
      evidence("E2", "Meter readings", sql.reads("electricity", a.period_start, b.period_end), 3),
      evidence("E3", "Weather in each bill period", sql.weather(ids, "hdd"), 2),
      evidence("E4", "Electricity tariff history", sql.tariffs("electricity", a.period_start, b.period_end), 2),
      evidence("E5", "Weather fit: daily electricity use against cold days", sql.fit("electricity", a.period_start, "hdd"), 12),
      evidence("E7", "Credits and one-off charges", sql.adjustments(ids), 2),
      evidence("E8", "Gas use in the same periods", sql.perDay("gas", [gasA.bill_id, gasB.bill_id]), 2),
    ],
    memory: [],
    trace: TRACE,
  };
}

// ---- Answer 4: water, June and July (up, possible leak) -----------------------

function waterSummer() {
  const a = bill("WATER-2026-04");
  const b = bill("WATER-2026-06");
  const { change, gbp, A, B, otherPerDay, otherShare } = split(a, b, 0.006);
  const ids = [a.bill_id, b.bill_id];
  return {
    question: "Why did my water bill go up in June and July?",
    utility: "water", bill_a: a.bill_id, bill_b: b.bill_id,
    total_a: a.total_gbp, total_b: b.total_gbp, change_gbp: change,
    components: components(gbp, {
      period: ["E1"], weather: ["E3", "E5"], usage_other: ["E2", "E5"], unit_price: ["E1", "E4"],
      standing: ["E1", "E4"], estimate: ["E2"], oneoff: ["E7"],
    }),
    causes: [
      ...bySize([
        { id: "C8", verdict: "supported", effect_gbp: gbp.usage_other, evidence: ["E2", "E5"], memory: [],
          detail: `Once the weather is taken out, you used ${(otherPerDay * 1000).toFixed(0)} litres a day more (${pct(otherShare)}). No household note explains it.` },
        { id: "C6", verdict: "supported", effect_gbp: gbp.weather, evidence: ["E3", "E5"], memory: [],
          detail: `A hot, dry summer: the average daily high rose from ${one(A.h)} °C to ${one(B.h)} °C (R² 0.71).` },
      ]),
      { id: "C1", verdict: "ruled_out", effect_gbp: gbp.unit_price, evidence: ["E4"], memory: [],
        detail: "Both bills use the same charge, £4.35 per m³. The April rise was already in the last bill." },
      { id: "C2", verdict: "ruled_out", effect_gbp: gbp.standing, evidence: ["E4"], memory: [],
        detail: "Both bills use the same fixed charge, 23p a day." },
      { id: "C3", verdict: "ruled_out", effect_gbp: gbp.period, evidence: ["E1"], memory: [],
        detail: `Both bills cover ${b.days} days.` },
      { id: "C4", verdict: "ruled_out", effect_gbp: 0, evidence: ["E2"], memory: [],
        detail: "Both bills use actual meter readings." },
      { id: "C5", verdict: "ruled_out", effect_gbp: 0, evidence: ["E7"], memory: [],
        detail: "Neither bill has a one-off charge." },
    ],
    facts: [
      fact("F1", money(change), ["E1"]),
      fact("F2", money(a.total_gbp), ["E1"]),
      fact("F3", money(b.total_gbp), ["E1"]),
      fact("F4", `${b.units_true - a.units_true} m³`, ["E2"]),
      fact("F5", money(gbp.weather), ["E3", "E5"]),
      fact("F6", money(gbp.usage_other), ["E2", "E5"]),
    ],
    answer_markdown:
      "Your water bill went up by {F1}, from {F2} to {F3}, because you used {F4} more water [E1][E2]. Hot, dry weather explains {F5} of that [E3][E5]. " +
      "The other {F6} is not explained by the weather or by any household note. Extra use that appears suddenly and stays high can be a leak, so check your meter [E2].",
    next_steps: [
      { cause: "C8", action: "Turn off every tap and appliance, then read your water meter twice, 30 minutes apart. If the number moves, you may have a leak: call your water company.", evidence: ["E2"] },
      { cause: "C6", action: "Nothing to fix for the weather. Summer use usually falls back in autumn.", evidence: ["E3"] },
    ],
    evidence: [
      evidence("E1", "The two bills", sql.bills("water", ids), 2),
      evidence("E2", "Meter readings", sql.reads("water", a.period_start, b.period_end), 3),
      evidence("E3", "Weather in each bill period", sql.weather(ids, "tmax"), 2),
      evidence("E4", "Water charges", sql.tariffs("water", a.period_start, b.period_end), 1),
      evidence("E5", "Weather fit: daily water use against hot days", sql.fit("water", a.period_start, "tmax"), 6),
      evidence("E7", "Credits and one-off charges", sql.adjustments(ids), 2),
    ],
    memory: [],
    trace: TRACE,
  };
}

// ---- Write the file ----------------------------------------------------------

// Made by scripts/lookup_area.ts from the postcode district.
const household = JSON.parse(readFileSync(new URL("../data/sample/household_SAMPLE.json", import.meta.url), "utf8"));

const preview = {
  note: "SAMPLE data. Made-up household; preview answers are hand-written to show the page, not produced by the agent.",
  household,
  bills: BILLS.map(({ units_true, energy_gbp, standing_gbp, driver, ...rest }) => rest),
  answers: {
    "GAS-2026-01": gasJanuary(),
    "ELEC-2026-06": electricityJune(),
    "ELEC-2026-04": { variants: { no_note: electricityApril(false), heat_pump_note: electricityApril(true) } },
    "WATER-2026-06": waterSummer(),
  },
  examples: [
    "Why did my gas bill go up in January?",
    "Why was my electricity bill lower in June?",
    "Why did my water bill go up in June and July?",
    "Why did my electricity bill change in April?",
  ],
  suggested_note: "We installed a heat pump on 15 March 2026",
};

const out = `// SAMPLE data, generated by scripts/make_preview_SAMPLE.ts. Do not edit by hand.\n// ${preview.note}\nwindow.PREVIEW_SAMPLE = ${JSON.stringify(preview, null, 1)};\n`;
writeFileSync(new URL("../web/preview_SAMPLE.js", import.meta.url), out);

for (const [id, entry] of Object.entries(preview.answers)) {
  const answers = "variants" in entry ? Object.values(entry.variants) : [entry];
  for (const ans of answers) {
    const parts = ans.components.map((c) => `${c.id} ${c.gbp}`).join(", ");
    console.log(`${id}: change ${ans.change_gbp} = ${parts}`);
  }
}
