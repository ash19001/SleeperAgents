// What one utility's investigation shares between its orchestrator,
// specialists and tools: the signed contract, the bill pair, the data
// source, the evidence log, and the measurements made so far. Reads and the
// £ split are worked out once and reused.

import { measure, type CauseId, type Measurement } from "../billmodel/causes.ts";
import { fitWeather, splitChange, type Split } from "../billmodel/decompose.ts";
import type { DataSource, EvidenceRecord, UBill, WeatherDay } from "../data/types.ts";
import type { Note, Utility } from "../lib/types.ts";
import type { ExecutionContract } from "../scout/types.ts";
import type { Trace } from "./trace.ts";

// Numbers the evidence each investigation cites: E1, E2, … in first-use order.
export class EvidenceLog {
  readonly records: EvidenceRecord[] = [];

  add(record: EvidenceRecord): string {
    const same = this.records.find((r) => r.sha256 === record.sha256 && r.title === record.title);
    if (same) return same.id;
    const id = `E${this.records.length + 1}`;
    this.records.push({ ...record, id });
    return id;
  }
}

export interface NotesMemory {
  recall(query: string, opts: { utility: Utility; from: string; to: string }): Promise<Note[]>;
}

export interface MeasuredCause extends Measurement {
  evidence: string[];
  memory: string[];
}

export interface Investigation {
  utility: Utility;
  contract: ExecutionContract;
  data: DataSource;
  a: UBill;
  b: UBill;
  evidence: EvidenceLog;
  trace: Trace;
  memory?: NotesMemory;
  measured: Map<CauseId, MeasuredCause>;
  cache: Map<string, Promise<unknown>>;
}

export function openInvestigation(fields: Omit<Investigation, "evidence" | "measured" | "cache">): Investigation {
  return { ...fields, evidence: new EvidenceLog(), measured: new Map(), cache: new Map() };
}

const dayBefore = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

function once<T>(inv: Investigation, key: string, make: () => Promise<T>): Promise<T> {
  if (!inv.cache.has(key)) inv.cache.set(key, make());
  return inv.cache.get(key) as Promise<T>;
}

// All bills for a utility, logged once as evidence.
export const allBills = (inv: Investigation, utility: Utility = inv.utility) =>
  once(inv, `bills:${utility}`, async () => {
    const read = await inv.data.bills({ utility });
    return { rows: read.rows, evidenceId: inv.evidence.add({ ...read.evidence, title: `${utility === "gas" ? "Gas" : utility === "water" ? "Water" : "Electricity"} bills` }) };
  });

export const weatherDays = (inv: Investigation) =>
  once(inv, "weather", async () => {
    const read = await inv.data.weather("2024-10-01", inv.b.period_end);
    return { rows: read.rows as WeatherDay[], evidenceId: inv.evidence.add({ ...read.evidence, title: "Daily weather" }) };
  });

export const meterReads = (inv: Investigation, utility: Utility = inv.utility) =>
  once(inv, `reads:${utility}`, async () => {
    const read = await inv.data.reads(utility, dayBefore(inv.a.period_start), inv.b.period_end);
    return { rows: read.rows, evidenceId: inv.evidence.add({ ...read.evidence, title: `${utility === "gas" ? "Gas" : utility === "water" ? "Water" : "Electricity"} meter readings` }) };
  });

export const tariffRates = (inv: Investigation) =>
  once(inv, "tariffs", async () => {
    const read = await inv.data.tariffs(inv.utility, inv.a.period_start, inv.b.period_end);
    return { rows: read.rows, evidenceId: inv.evidence.add(read.evidence) };
  });

// The £ split for a pair of the same utility, with the weather fit over the
// bills before the later one (up to 12), checked against the earlier one.
async function splitPair(inv: Investigation, a: UBill, b: UBill): Promise<{ split: Split; evidence: string[] }> {
  const [bills, weather] = await Promise.all([allBills(inv, a.utility), weatherDays(inv)]);
  const before = bills.rows.filter((x) => x.utility === a.utility && x.period_end < b.period_start).slice(-12);
  return { split: splitChange(a, b, weather.rows, fitWeather(before, weather.rows, a)), evidence: [bills.evidenceId, weather.evidenceId] };
}

export const pairSplit = (inv: Investigation) => once(inv, "split", () => splitPair(inv, inv.a, inv.b));

// The same months for the other fuel, for the fuel-switch test.
export const otherFuelSplit = (inv: Investigation) =>
  once(inv, "split:other", async () => {
    if (inv.utility === "water") return null;
    const other: Utility = inv.utility === "gas" ? "electricity" : "gas";
    const bills = (await allBills(inv, other)).rows;
    const oa = bills.find((x) => x.period_start === inv.a.period_start);
    const ob = bills.find((x) => x.period_start === inv.b.period_start);
    return oa && ob ? splitPair(inv, oa, ob) : null;
  });

// The pair before this one, for "two bills running".
export const previousSplit = (inv: Investigation) =>
  once(inv, "split:previous", async () => {
    const bills = (await allBills(inv)).rows;
    const earlier = bills.filter((x) => x.period_end < inv.a.period_start).at(-1);
    return earlier ? splitPair(inv, earlier, inv.a) : null;
  });

// Runs a cause test in code and records it; the checker trusts only these.
export async function testCause(inv: Investigation, cause: CauseId, notes: string[] = []): Promise<MeasuredCause> {
  const { split, evidence } = await pairSplit(inv);
  const ids = [...evidence];
  const extra: Parameters<typeof measure>[4] = { noteExplains: notes.length > 0 };
  if (cause === "C9") {
    const other = await otherFuelSplit(inv);
    extra.otherUtility = other?.split ?? null;
    if (other) ids.push(...other.evidence);
  }
  if (cause === "C8") {
    const prev = await previousSplit(inv);
    extra.previous = prev?.split ?? null;
  }
  if (cause === "C1" || cause === "C2") ids.push((await tariffRates(inv)).evidenceId);
  if (["C4", "C7", "C8", "C9"].includes(cause)) ids.push((await meterReads(inv)).evidenceId);
  const result: MeasuredCause = { ...measure(cause, split, inv.a, inv.b, extra), evidence: [...new Set(ids)], memory: notes };
  inv.measured.set(cause, result);
  return result;
}
