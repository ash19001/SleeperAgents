// Generates the SAMPLE household's bills and meter readings, Oct 2025 to Sep
// 2026: daily use from the real Manchester weather, priced with the real
// Octopus tariffs, plus the eight planted events in PLAN.md. Deterministic
// (fixed seed). The three supplier files deliberately use different shapes,
// as real suppliers do; the data layer and Zetaris views unify them.
//
// Writes data/sample/*_SAMPLE.{json,csv}, data/reference/water_charges_SAMPLE.csv
// and the answer key eval/scenarios.json.
//
// Run: node scripts/generate_sample.ts (after fetch_tariffs.ts and fetch_weather.ts)

import { readFileSync, writeFileSync } from "node:fs";

// ---- Inputs ------------------------------------------------------------------

const csv = (path: string) => {
  const [head, ...lines] = readFileSync(path, "utf8").trim().split("\n");
  const keys = head.split(",");
  return lines.map((l) => Object.fromEntries(l.split(",").map((v, i) => [keys[i], v])));
};

const weather = new Map(csv("data/reference/weather_daily.csv").map((r) => [r.day, { hdd: Number(r.hdd), tmax: Number(r.tmax_c), rain: Number(r.rain_mm) }]));
const tariffs = csv("data/reference/octopus_tariffs.csv");

// UK local date of an instant: the tariff boundaries are at UK midnight.
const ukDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/London" });

function rateOn(fuel: string, kind: string, day: string): number {
  const r = tariffs.find((t) => t.fuel === fuel && t.kind === kind && ukDate(t.valid_from) <= day && (!t.valid_to || day < ukDate(t.valid_to)));
  if (!r) throw new Error(`no ${fuel} ${kind} for ${day}`);
  return Number(r.value_inc_vat_pence);
}

// Illustrative water and sewerage charges in the style of United Utilities,
// rising on 1 April. Not real published rates.
const WATER_CHARGES = [
  { valid_from: "2025-04-01", valid_to: "2026-03-31", water_gbp_per_m3: 2.04, sewerage_gbp_per_m3: 2.11, water_fixed_gbp_per_year: 44.0, sewerage_fixed_gbp_per_year: 58.0 },
  { valid_from: "2026-04-01", valid_to: "2027-03-31", water_gbp_per_m3: 2.21, sewerage_gbp_per_m3: 2.27, water_fixed_gbp_per_year: 47.5, sewerage_fixed_gbp_per_year: 62.5 },
];
const waterChargeOn = (day: string) => WATER_CHARGES.find((c) => c.valid_from <= day && day <= c.valid_to)!;

// ---- Household model -----------------------------------------------------------

// mulberry32: small, fast, deterministic.
function prng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = prng(20261025);
const noise = (spread: number) => 1 + (rand() * 2 - 1) * spread;

const HEAT_PUMP_FROM = "2026-03-15";
const LEAK_FROM = "2026-06-15";

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const daysFrom = (start: string, end: string) => {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
};

const ALL_DAYS = daysFrom("2024-10-01", "2026-09-30");
const use = { electricity: new Map<string, number>(), gas: new Map<string, number>(), water: new Map<string, number>() };
for (const day of ALL_DAYS) {
  const w = weather.get(day)!;
  const pump = day >= HEAT_PUMP_FROM;
  // Gas heats the home and its hot water until the heat pump takes over both.
  use.gas.set(day, (pump ? 1.5 : 9 + 4.0 * w.hdd) * noise(0.06));
  // Heat pump: the gas heat (90% boiler efficiency) delivered at a COP of 3, plus hot water.
  use.electricity.set(day, (7.5 + 0.15 * w.hdd + (pump ? 1.2 * w.hdd + 2.4 : 0)) * noise(0.06));
  // Water: base use, garden watering on warm dry days, and a hidden leak from mid-June.
  const watering = 0.02 * Math.max(0, w.tmax - 15) + (w.rain < 0.5 && w.tmax > 18 ? 0.05 : 0);
  use.water.set(day, (0.3 + watering) * noise(0.05) + (day >= LEAK_FROM ? 0.15 : 0));
}

// ---- Bill periods (planted irregular lengths) ---------------------------------

const ENERGY_PERIODS: [string, string, string][] = [
  ["2025-10", "2025-10-01", "2025-10-31"],
  ["2025-11", "2025-11-01", "2025-11-30"],
  ["2025-12", "2025-12-01", "2025-12-28"], // 28 days
  ["2026-01", "2025-12-29", "2026-02-01"], // 35 days, the coldest month
  ["2026-02", "2026-02-02", "2026-03-01"],
  ["2026-03", "2026-03-02", "2026-04-01"],
  ["2026-04", "2026-04-02", "2026-05-01"],
  ["2026-05", "2026-05-02", "2026-06-01"],
  ["2026-06", "2026-06-02", "2026-06-29"], // 28 days, 3 fewer than May
  ["2026-07", "2026-06-30", "2026-07-31"],
  ["2026-08", "2026-08-01", "2026-08-31"],
  ["2026-09", "2026-09-01", "2026-09-30"],
];
const WATER_PERIODS: [string, string, string][] = [
  ["2025-10", "2025-10-01", "2025-11-30"],
  ["2025-12", "2025-12-01", "2026-01-31"],
  ["2026-02", "2026-02-01", "2026-03-31"],
  ["2026-04", "2026-04-01", "2026-05-31"],
  ["2026-06", "2026-06-01", "2026-07-31"],
  ["2026-08", "2026-08-01", "2026-09-30"],
];

// ---- Supplier A: electricity and gas (pence, kWh, read flags A/E) --------------

const ESTIMATE_SHORTFALL = 0.15; // the November gas estimate is 15% low; December catches it up
const register = { electricity: 18_420, gas: 31_870 }; // kWh on the meters on 1 Oct 2025

const energyBills: Record<string, unknown>[] = [];
const reads: Record<string, unknown>[] = [];
let gasCatchUp = 0;

for (const fuel of ["electricity", "gas"] as const) {
  reads.push({ fuel: fuel.toUpperCase(), read_date: "2025-09-30", register_kwh: register[fuel], source: "SMART" });
  for (const [month, from, to] of ENERGY_PERIODS) {
    const days = daysFrom(from, to);
    const trueKwh = days.reduce((t, d) => t + use[fuel].get(d)!, 0);
    const trueRounded = Math.round(trueKwh);
    // Price each day at that day's rate, so bills that span a price change blend the two.
    const energyTrue = days.reduce((t, d) => t + use[fuel].get(d)! * rateOn(fuel, "unit_rate", d), 0);
    const avgRate = energyTrue / trueKwh;
    let billedKwh = trueRounded;
    let readType = "A";
    if (fuel === "gas" && month === "2025-11") {
      billedKwh = Math.round(trueRounded * (1 - ESTIMATE_SHORTFALL));
      gasCatchUp = trueRounded - billedKwh;
      readType = "E";
    }
    if (fuel === "gas" && month === "2025-12") billedKwh = trueRounded + gasCatchUp;
    const energyPence = Math.round(billedKwh * avgRate);
    const standingDaily = days.map((d) => rateOn(fuel, "standing_charge", d));
    const standingPence = Math.round(standingDaily.reduce((t, x) => t + x, 0));
    const adjustments = fuel === "electricity" && month === "2026-06" ? [{ type: "GOODWILL_CREDIT", description: "Goodwill credit for a delayed reply", amount_pence: -5000 }] : [];
    const opening = register[fuel];
    register[fuel] += trueRounded;
    energyBills.push({
      account: "SAMPLE-A-0001",
      bill_ref: `A-${fuel === "gas" ? "G" : "E"}-${month.replace("-", "")}`,
      fuel: fuel === "gas" ? "GAS" : "ELEC",
      period_from: from,
      period_to: to,
      read_flag: readType,
      opening_read_kwh: readType === "E" ? null : opening,
      closing_read_kwh: readType === "E" ? null : register[fuel],
      billed_kwh: billedKwh,
      avg_unit_rate_pence: Math.round(avgRate * 10_000) / 10_000,
      energy_charge_pence: energyPence,
      standing_days: days.length,
      standing_charge_pence: standingPence,
      adjustments,
      total_pence: energyPence + standingPence + adjustments.reduce((t, a) => t + a.amount_pence, 0),
    });
    reads.push({ fuel: fuel.toUpperCase(), read_date: to, register_kwh: register[fuel], source: "SMART" });
  }
}

// ---- Waterco: two-monthly, litres and pounds, separate sewerage lines ---------

const waterBills: Record<string, unknown>[] = [];
let waterRegisterLitres = 412_300;
for (const [month, from, to] of WATER_PERIODS) {
  const days = daysFrom(from, to);
  const usedLitres = Math.round(days.reduce((t, d) => t + use.water.get(d)!, 0) * 1000);
  const m3 = usedLitres / 1000;
  const c = waterChargeOn(from);
  const water = Math.round(m3 * c.water_gbp_per_m3 * 100) / 100;
  const sewerage = Math.round(m3 * c.sewerage_gbp_per_m3 * 100) / 100;
  const waterFixed = Math.round(days.reduce((t, d) => t + waterChargeOn(d).water_fixed_gbp_per_year / 365, 0) * 100) / 100;
  const sewerageFixed = Math.round(days.reduce((t, d) => t + waterChargeOn(d).sewerage_fixed_gbp_per_year / 365, 0) * 100) / 100;
  const previous = waterRegisterLitres;
  waterRegisterLitres += usedLitres;
  waterBills.push({
    billNumber: `WC-${month.replace("-", "")}`,
    customerRef: "SAMPLE-W-7731",
    from,
    to,
    readingStatus: "Actual",
    previousReadingLitres: previous,
    currentReadingLitres: waterRegisterLitres,
    usedLitres,
    waterChargePounds: water,
    sewerageChargePounds: sewerage,
    waterStandingPounds: waterFixed,
    sewerageStandingPounds: sewerageFixed,
    totalPounds: Math.round((water + sewerage + waterFixed + sewerageFixed) * 100) / 100,
  });
}

// ---- Write -----------------------------------------------------------------------

function toCsv(rows: Record<string, unknown>[]): string {
  const keys = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `${keys.join(",")}\n${rows.map((r) => keys.map((k) => cell(r[k])).join(",")).join("\n")}\n`;
}

const NOTE = "SAMPLE data: a made-up household, priced with real Octopus tariffs (region G) and real Manchester weather. Not a real account.";
const write = (name: string, rows: Record<string, unknown>[]) => {
  writeFileSync(`data/sample/${name}.json`, `${JSON.stringify({ note: NOTE, records: rows }, null, 1)}\n`);
  writeFileSync(`data/sample/${name}.csv`, toCsv(rows));
};
write("supplierA_energy_bills_SAMPLE", energyBills);
write("supplierA_meter_reads_SAMPLE", reads);
write("waterco_bills_SAMPLE", waterBills);
writeFileSync("data/reference/water_charges_SAMPLE.csv", toCsv(WATER_CHARGES));

// The answer key: for each planted event, the bill pair and the causes that
// must come out supported or ruled out. Causes not listed aren't scored.
const scenarios = [
  { id: "gas-estimate", event: 1, utility: "gas", bill_a: "A-G-202510", bill_b: "A-G-202511", must_support: ["C4"], must_rule_out: ["C5", "C9"], note: "November used an estimate 15% low" },
  { id: "gas-catch-up", event: 1, utility: "gas", bill_a: "A-G-202511", bill_b: "A-G-202512", must_support: ["C4"], must_rule_out: ["C5", "C9"], note: "December catches up November's estimate" },
  { id: "gas-january", event: 2, utility: "gas", bill_a: "A-G-202512", bill_b: "A-G-202601", must_support: ["C3", "C6", "C4", "C1"], must_rule_out: ["C5", "C9"], note: "35 days after 28, coldest month, December's catch-up, unit rate down on 1 Jan" },
  { id: "elec-january", event: 2, utility: "electricity", bill_a: "A-E-202512", bill_b: "A-E-202601", must_support: ["C3", "C1"], must_rule_out: ["C4", "C5", "C9"], note: "35 days after 28, unit rate up on 1 Jan" },
  { id: "elec-april", event: 4, utility: "electricity", bill_a: "A-E-202603", bill_b: "A-E-202604", must_support: ["C7", "C9", "C1"], must_rule_out: ["C4", "C5"], note: "Heat pump from 15 March: electricity up beyond weather, gas down; unit rate down on 1 Apr" },
  { id: "gas-april", event: 4, utility: "gas", bill_a: "A-G-202603", bill_b: "A-G-202604", must_support: ["C7", "C9"], must_rule_out: ["C4", "C5"], note: "Heat pump from 15 March: gas falls beyond weather" },
  { id: "elec-june", event: 5, utility: "electricity", bill_a: "A-E-202605", bill_b: "A-E-202606", must_support: ["C5", "C3"], must_rule_out: ["C1", "C2", "C4", "C9"], note: "£50 goodwill credit, 28 days after 31" },
  { id: "water-april-rise", event: 6, utility: "water", bill_a: "WC-202602", bill_b: "WC-202604", must_support: ["C1"], must_rule_out: ["C4", "C5"], note: "Charges rise on 1 April" },
  { id: "water-summer-leak", event: 7, utility: "water", bill_a: "WC-202604", bill_b: "WC-202606", must_support: ["C6", "C8"], must_rule_out: ["C1", "C4", "C5"], note: "Hot, dry July and a hidden leak from 15 June" },
  { id: "water-leak-continues", event: 7, utility: "water", bill_a: "WC-202606", bill_b: "WC-202608", must_support: ["C8"], must_rule_out: ["C1", "C4", "C5"], note: "The leak is still running" },
  { id: "control", event: 8, utility: "gas", bill_a: "A-G-202607", bill_b: "A-G-202608", must_support: [], must_rule_out: ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9"], note: "Same tariff quarter, 32 vs 31 days, gas for cooking only: nothing should be supported" },
];
writeFileSync("eval/scenarios.json", `${JSON.stringify({ note: `${NOTE} Event 3 (real tariff changes) shows up as C1 and C2 in the pairs that span 1 Jan, 1 Apr and 1 Jul.`, scenarios }, null, 2)}\n`);

const summary = (rows: Record<string, unknown>[], key: string, total: string, scale = 1) =>
  rows.map((r) => `${r[key]} £${(Number(r[total]) / scale).toFixed(2)}`).join("  ");
console.log("Gas:  ", summary(energyBills.filter((b) => b.fuel === "GAS"), "bill_ref", "total_pence", 100));
console.log("Elec: ", summary(energyBills.filter((b) => b.fuel === "ELEC"), "bill_ref", "total_pence", 100));
console.log("Water:", summary(waterBills, "billNumber", "totalPounds"));
console.log(`Wrote ${energyBills.length} energy bills, ${reads.length} meter reads, ${waterBills.length} water bills and ${scenarios.length} scenarios.`);
