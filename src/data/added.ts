// Bills the household adds when the one they asked about is missing. Each is
// checked (its charges must add up to its total, it must come after the
// latest bill), turned into its supplier's own record format, and kept in
// .household/added.json (gitignored). The supplier feeds serve them with the
// SAMPLE records, so Zetaris and the local source both see them; then
// Zetaris's cached copies are refreshed.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import type { Utility } from "../lib/types.ts";
import type { FEEDS } from "./feeds.ts";

type Feed = keyof typeof FEEDS;
type SupplierFeed = Exclude<Feed, "water-charges">;
type Added = Partial<Record<Feed, Record<string, unknown>[]>>;

const file = () => resolve(process.env.HOUSEHOLD_PATH || ".household", "added.json");

export function addedRecords(feed: Feed): Record<string, unknown>[] {
  return existsSync(file()) ? ((JSON.parse(readFileSync(file(), "utf8")) as Added)[feed] ?? []) : [];
}

function save(feed: Feed, records: Record<string, unknown>[]) {
  const all: Added = existsSync(file()) ? JSON.parse(readFileSync(file(), "utf8")) : {};
  all[feed] = [...(all[feed] ?? []), ...records];
  mkdirSync(join(file(), ".."), { recursive: true });
  writeFileSync(file(), `${JSON.stringify(all, null, 2)}\n`);
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "a date as YYYY-MM-DD");
const money = z.number().finite();

export const EnergyBillInput = z.object({
  utility: z.enum(["electricity", "gas"]),
  period_from: date,
  period_to: date,
  read_type: z.enum(["actual", "estimated"]),
  opening_read: z.number().nonnegative(),
  closing_read: z.number().nonnegative(),
  energy_gbp: money.nonnegative(),
  standing_gbp: money.nonnegative(),
  adjustment_gbp: money.default(0),
  adjustment_note: z.string().max(80).default(""),
  total_gbp: money,
});

export const WaterBillInput = z.object({
  utility: z.literal("water"),
  period_from: date,
  period_to: date,
  read_type: z.enum(["actual", "estimated"]),
  opening_read: z.number().nonnegative(), // m³
  closing_read: z.number().nonnegative(),
  water_gbp: money.nonnegative(),
  sewerage_gbp: money.nonnegative(),
  water_standing_gbp: money.nonnegative(),
  sewerage_standing_gbp: money.nonnegative(),
  total_gbp: money,
});

export const BillInput = z.discriminatedUnion("utility", [EnergyBillInput.extend({ utility: z.literal("electricity") }), EnergyBillInput.extend({ utility: z.literal("gas") }), WaterBillInput]);
export type BillInput = z.infer<typeof BillInput>;

const pence = (gbp: number) => Math.round(gbp * 100);
const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
const nextDay = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
const midMonth = (from: string, to: string) => new Date((Date.parse(from) + Date.parse(to)) / 2).toISOString().slice(0, 7).replace("-", "");

// The utility's latest bill in its supplier's format, from the feeds as served.
function latest(utility: Utility, records: (feed: Feed) => Record<string, unknown>[]) {
  if (utility === "water") {
    const r = records("waterco-bills").sort((a, b) => String(a.to).localeCompare(String(b.to))).at(-1)!;
    return { period_to: String(r.to), closing_read: Number(r.currentReadingLitres) / 1000, record: r };
  }
  const fuel = utility === "gas" ? "GAS" : "ELEC";
  const r = records("supplier-a-bills").filter((b) => b.fuel === fuel).sort((a, b) => String(a.period_to).localeCompare(String(b.period_to))).at(-1)!;
  return { period_to: String(r.period_to), closing_read: Number(r.closing_read_kwh), record: r };
}

const round2 = (x: number) => Math.round(x * 100) / 100;

// What the form starts with: the period after the latest bill and its
// closing reading, plus example figures for trying it out: the latest
// bill's daily use (a third more for energy, as heating starts) at its rates,
// with charges that add up to the total.
export function nextBillDraft(utility: Utility, records: (feed: Feed) => Record<string, unknown>[]) {
  const last = latest(utility, records);
  const from = nextDay(last.period_to);
  const [y, m] = from.split("-").map(Number);
  const months = utility === "water" ? 2 : 1;
  const to = new Date(Date.UTC(y, m - 1 + months, 0)).toISOString().slice(0, 10);
  const d = days(from, to);
  const r = last.record;
  let example: Record<string, number>;
  if (utility === "water") {
    const usedM3 = Number(r.usedLitres) / 1000;
    const lastDays = days(String(r.from), String(r.to));
    const units = Math.round((usedM3 / lastDays) * d * 10) / 10;
    const water_gbp = round2((Number(r.waterChargePounds) / usedM3) * units);
    const sewerage_gbp = round2((Number(r.sewerageChargePounds) / usedM3) * units);
    const water_standing_gbp = round2((Number(r.waterStandingPounds) / lastDays) * d);
    const sewerage_standing_gbp = round2((Number(r.sewerageStandingPounds) / lastDays) * d);
    example = { closing_read: round2(last.closing_read + units), water_gbp, sewerage_gbp, water_standing_gbp, sewerage_standing_gbp, total_gbp: round2(water_gbp + sewerage_gbp + water_standing_gbp + sewerage_standing_gbp) };
  } else {
    const units = Math.round((Number(r.billed_kwh) / Number(r.standing_days)) * d * 1.3);
    const energy_gbp = round2((units * Number(r.avg_unit_rate_pence)) / 100);
    const standing_gbp = round2((Number(r.standing_charge_pence) / Number(r.standing_days) / 100) * d);
    example = { closing_read: last.closing_read + units, energy_gbp, standing_gbp, adjustment_gbp: 0, total_gbp: round2(energy_gbp + standing_gbp) };
  }
  return { utility, period_from: from, period_to: to, opening_read: last.closing_read, unit: utility === "water" ? "m³" : "kWh", latest_period_to: last.period_to, example };
}

// Checks a bill, turns it into its supplier's records, and saves them.
// Returns the bill id and the feeds that changed (for the Zetaris refresh).
export function addBill(input: BillInput, records: (feed: Feed) => Record<string, unknown>[]): { bill_id: string; feeds: SupplierFeed[] } {
  const problems: string[] = [];
  const last = latest(input.utility, records);
  const d = days(input.period_from, input.period_to);
  if (input.period_from <= last.period_to) problems.push(`The bill must start after the latest ${input.utility} bill, which ends on ${last.period_to}.`);
  if (d < 1 || d > 70) problems.push("The bill must cover between 1 and 70 days.");
  if (input.closing_read < input.opening_read) problems.push("The closing reading can't be lower than the opening reading.");
  const parts = input.utility === "water" ? input.water_gbp + input.sewerage_gbp + input.water_standing_gbp + input.sewerage_standing_gbp : input.energy_gbp + input.standing_gbp + input.adjustment_gbp;
  if (Math.abs(pence(parts) - pence(input.total_gbp)) > 1) problems.push(`The charges add up to £${parts.toFixed(2)}, not the total of £${input.total_gbp.toFixed(2)}.`);
  if (problems.length) throw new BillError(problems);

  if (input.utility === "water") {
    const bill_id = `WC-${input.period_from.slice(0, 4)}${input.period_from.slice(5, 7)}`;
    if (records("waterco-bills").some((b) => b.billNumber === bill_id)) throw new BillError([`There's already a water bill ${bill_id}.`]);
    const [prev, cur] = [Math.round(input.opening_read * 1000), Math.round(input.closing_read * 1000)];
    save("waterco-bills", [
      {
        billNumber: bill_id,
        customerRef: last.record.customerRef,
        from: input.period_from,
        to: input.period_to,
        readingStatus: input.read_type === "estimated" ? "Estimated" : "Actual",
        previousReadingLitres: prev,
        currentReadingLitres: cur,
        usedLitres: cur - prev,
        waterChargePounds: input.water_gbp,
        sewerageChargePounds: input.sewerage_gbp,
        waterStandingPounds: input.water_standing_gbp,
        sewerageStandingPounds: input.sewerage_standing_gbp,
        totalPounds: input.total_gbp,
      },
    ]);
    return { bill_id, feeds: ["waterco-bills"] };
  }

  const fuel = input.utility === "gas" ? "GAS" : "ELEC";
  const bill_id = `A-${fuel[0]}-${midMonth(input.period_from, input.period_to)}`;
  if (records("supplier-a-bills").some((b) => b.bill_ref === bill_id)) throw new BillError([`There's already a bill ${bill_id}.`]);
  const [open, close] = [Math.round(input.opening_read), Math.round(input.closing_read)];
  const adjustments = input.adjustment_gbp ? [{ amount_pence: pence(input.adjustment_gbp), description: input.adjustment_note || (input.adjustment_gbp < 0 ? "CREDIT" : "CHARGE") }] : [];
  save("supplier-a-bills", [
    {
      account: last.record.account,
      bill_ref: bill_id,
      fuel,
      period_from: input.period_from,
      period_to: input.period_to,
      read_flag: input.read_type === "estimated" ? "E" : "A",
      opening_read_kwh: open,
      closing_read_kwh: close,
      billed_kwh: close - open,
      avg_unit_rate_pence: close > open ? Math.round((pence(input.energy_gbp) / (close - open)) * 10_000) / 10_000 : 0,
      energy_charge_pence: pence(input.energy_gbp),
      standing_days: d,
      standing_charge_pence: pence(input.standing_gbp),
      adjustments,
      total_pence: pence(input.total_gbp),
    },
  ]);
  // An actual closing reading is a meter reading too, so the next bill's true units can be worked out.
  if (input.read_type === "actual") {
    save("supplier-a-reads", [{ fuel: input.utility === "gas" ? "GAS" : "ELECTRICITY", read_date: input.period_to, register_kwh: close, source: "CUSTOMER" }]);
    return { bill_id, feeds: ["supplier-a-bills", "supplier-a-reads"] };
  }
  return { bill_id, feeds: ["supplier-a-bills"] };
}

export class BillError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(problems.join(" "));
    this.problems = problems;
  }
}
