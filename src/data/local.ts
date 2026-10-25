// Local SAMPLE data source: reads the supplier files in data/sample/ and the
// reference files in data/reference/, and unifies them into the shapes in
// types.ts (pence to pounds, litres to m³, read flags to actual/estimated),
// as the Zetaris views will. Used until the data is registered in Zetaris;
// every read says so in its evidence.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Utility } from "../lib/types.ts";
import type { DataSource, EvidenceRecord, MeterRead, Read, TariffRate, UBill, WeatherDay } from "./types.ts";

const FILES = {
  energy: "data/sample/supplierA_energy_bills_SAMPLE.json",
  reads: "data/sample/supplierA_meter_reads_SAMPLE.json",
  water: "data/sample/waterco_bills_SAMPLE.json",
  tariffs: "data/reference/octopus_tariffs.csv",
  waterCharges: "data/reference/water_charges_SAMPLE.csv",
  weather: "data/reference/weather_daily.csv",
};

// The three supplier formats, as generate_sample.ts writes them.
interface RawEnergyBill {
  fuel: "GAS" | "ELEC";
  bill_ref: string;
  period_from: string;
  period_to: string;
  read_flag: "A" | "E";
  billed_kwh: number;
  energy_charge_pence: number;
  standing_days: number;
  standing_charge_pence: number;
  adjustments: { amount_pence: number; description: string }[];
  total_pence: number;
}
interface RawRead {
  fuel: "GAS" | "ELEC";
  read_date: string;
  register_kwh: number;
  source: string;
}
interface RawWaterBill {
  billNumber: string;
  from: string;
  to: string;
  readingStatus: "Actual" | "Estimated";
  usedLitres: number;
  currentReadingLitres: number;
  waterChargePounds: number;
  sewerageChargePounds: number;
  waterStandingPounds: number;
  sewerageStandingPounds: number;
  totalPounds: number;
}

const json = <T>(path: string) => JSON.parse(readFileSync(resolve(path), "utf8")).records as T[];
const csv = (path: string) => {
  const [head, ...lines] = readFileSync(resolve(path), "utf8").trim().split("\n");
  const keys = head.split(",");
  return lines.map((l) => Object.fromEntries(l.split(",").map((v, i) => [keys[i], v])));
};
const round2 = (x: number) => Math.round(x * 100) / 100;
const ukDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const MONTH = (m: number) => new Date(Date.UTC(2000, m - 1, 1)).toLocaleString("en-GB", { month: "short", timeZone: "UTC" }).replace("Sept", "Sep");

function label(from: string, to: string, twoMonthly: boolean): { label: string; months: number[] } {
  const [fy, fm] = [Number(from.slice(0, 4)), Number(from.slice(5, 7))];
  const [ty, tm] = [Number(to.slice(0, 4)), Number(to.slice(5, 7))];
  if (!twoMonthly) {
    // A monthly bill is named after the month most of it falls in.
    const mid = new Date((Date.parse(from) + Date.parse(to)) / 2).toISOString();
    const [my, mm] = [Number(mid.slice(0, 4)), Number(mid.slice(5, 7))];
    return { label: `${MONTH(mm)} ${my}`, months: [mm] };
  }
  return { label: fy === ty ? `${MONTH(fm)}–${MONTH(tm)} ${ty}` : `${MONTH(fm)} ${fy}–${MONTH(tm)} ${ty}`, months: [fm, tm] };
}

let cache: { bills: UBill[]; reads: MeterRead[]; tariffs: TariffRate[]; weather: WeatherDay[] } | null = null;

function load() {
  if (cache) return cache;
  const reads: MeterRead[] = json<RawRead>(FILES.reads).map((r) => ({
    utility: r.fuel === "GAS" ? "gas" : "electricity",
    read_date: r.read_date,
    register: r.register_kwh,
    unit: "kWh",
    source: r.source,
  }));
  const registerOn = (utility: Utility, day: string) => reads.find((r) => r.utility === utility && r.read_date === day)?.register;
  const dayBefore = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

  const energy: UBill[] = json<RawEnergyBill>(FILES.energy).map((b) => {
    const utility: Utility = b.fuel === "GAS" ? "gas" : "electricity";
    const start = registerOn(utility, dayBefore(b.period_from));
    const end = registerOn(utility, b.period_to);
    const adjustments = b.adjustments ?? [];
    return {
      utility,
      supplier: "Supplier A",
      bill_id: b.bill_ref,
      ...label(b.period_from, b.period_to, false),
      period_start: b.period_from,
      period_end: b.period_to,
      days: b.standing_days,
      units_billed: b.billed_kwh,
      units_true: start !== undefined && end !== undefined ? end - start : b.billed_kwh,
      unit: "kWh",
      read_type: b.read_flag === "E" ? "estimated" : "actual",
      energy_gbp: b.energy_charge_pence / 100,
      standing_gbp: b.standing_charge_pence / 100,
      standing_gbp_per_day: b.standing_charge_pence / 100 / b.standing_days,
      adjustments_gbp: adjustments.reduce((t, a) => t + a.amount_pence, 0) / 100,
      adjustment_note: adjustments.map((a) => a.description).join("; "),
      total_gbp: b.total_pence / 100,
    };
  });

  const water: UBill[] = json<RawWaterBill>(FILES.water).map((b) => {
    const days = Math.round((Date.parse(b.to) - Date.parse(b.from)) / 86_400_000) + 1;
    const standing = round2(b.waterStandingPounds + b.sewerageStandingPounds);
    return {
      utility: "water",
      supplier: "Waterco",
      bill_id: b.billNumber,
      ...label(b.from, b.to, true),
      period_start: b.from,
      period_end: b.to,
      days,
      units_billed: b.usedLitres / 1000,
      units_true: b.usedLitres / 1000,
      unit: "m³",
      read_type: b.readingStatus === "Estimated" ? "estimated" : "actual",
      energy_gbp: round2(b.waterChargePounds + b.sewerageChargePounds),
      standing_gbp: standing,
      standing_gbp_per_day: standing / days,
      adjustments_gbp: 0,
      adjustment_note: "",
      total_gbp: b.totalPounds,
    };
  });
  // Water has no separate readings file: its bills carry actual register readings.
  for (const b of json<RawWaterBill>(FILES.water)) reads.push({ utility: "water", read_date: b.to, register: b.currentReadingLitres / 1000, unit: "m³", source: "BILL" });

  const tariffs: TariffRate[] = csv(FILES.tariffs).map((t) => ({
    utility: t.fuel as Utility,
    kind: t.kind === "unit_rate" ? "unit" : "standing",
    valid_from: ukDate(t.valid_from),
    valid_to: t.valid_to ? ukDate(t.valid_to) : null,
    value: Number(t.value_inc_vat_pence),
    unit: t.kind === "unit_rate" ? "p/kWh" : "p/day",
  }));
  for (const c of csv(FILES.waterCharges)) {
    const to = new Date(Date.parse(`${c.valid_to}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    tariffs.push({ utility: "water", kind: "unit", valid_from: c.valid_from, valid_to: to, value: round2(Number(c.water_gbp_per_m3) + Number(c.sewerage_gbp_per_m3)), unit: "£/m³" });
    tariffs.push({ utility: "water", kind: "standing", valid_from: c.valid_from, valid_to: to, value: round2(Number(c.water_fixed_gbp_per_year) + Number(c.sewerage_fixed_gbp_per_year)), unit: "£/year" });
  }

  const weather: WeatherDay[] = csv(FILES.weather).map((w) => ({ day: w.day, tmean_c: Number(w.tmean_c), tmax_c: Number(w.tmax_c), rain_mm: Number(w.rain_mm), hdd: Number(w.hdd) }));
  const bills = [...energy, ...water].sort((a, b) => a.utility.localeCompare(b.utility) || a.period_start.localeCompare(b.period_start));
  cache = { bills, reads, tariffs, weather };
  return cache;
}

function evidence(title: string, description: string, rows: unknown[]): EvidenceRecord {
  return {
    id: "",
    title,
    source: "local-sample",
    sql: `-- Read from a local SAMPLE file; the same read becomes a Zetaris query once the data is registered.\n${description}`,
    rows: rows.length,
    sha256: createHash("sha256").update(JSON.stringify(rows)).digest("hex"),
    at: new Date().toISOString(),
  };
}

export const localSource: DataSource = {
  name: "local-sample",

  async bills(filter = {}): Promise<Read<UBill>> {
    const rows = load().bills.filter((b) => (!filter.utility || b.utility === filter.utility) && (!filter.ids || filter.ids.includes(b.bill_id)));
    const where = [filter.utility && `utility = '${filter.utility}'`, filter.ids && `bill_id IN (${filter.ids.map((i) => `'${i}'`).join(", ")})`].filter(Boolean).join(" AND ");
    return { rows, evidence: evidence("Bills", `bills from ${FILES.energy} and ${FILES.water}${where ? `\nwhere ${where}` : ""}`, rows) };
  },

  async reads(utility, from, to): Promise<Read<MeterRead>> {
    const rows = load().reads.filter((r) => r.utility === utility && r.read_date >= from && r.read_date <= to).sort((a, b) => a.read_date.localeCompare(b.read_date));
    const file = utility === "water" ? FILES.water : FILES.reads;
    return { rows, evidence: evidence("Meter readings", `meter readings from ${file}\nwhere utility = '${utility}' and read_date between '${from}' and '${to}'`, rows) };
  },

  async tariffs(utility, from, to): Promise<Read<TariffRate>> {
    const rows = load().tariffs.filter((t) => t.utility === utility && t.valid_from <= to && (!t.valid_to || t.valid_to > from));
    const file = utility === "water" ? FILES.waterCharges : FILES.tariffs;
    return { rows, evidence: evidence(utility === "water" ? "Water charges" : `${utility === "gas" ? "Gas" : "Electricity"} tariff`, `rates from ${file}\nwhere utility = '${utility}' and the rate overlaps ${from} to ${to}`, rows) };
  },

  async weather(from, to): Promise<Read<WeatherDay>> {
    const rows = load().weather.filter((w) => w.day >= from && w.day <= to);
    return { rows, evidence: evidence("Daily weather", `daily weather from ${FILES.weather}\nwhere day between '${from}' and '${to}'`, rows) };
  },
};
