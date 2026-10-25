// The tools agents can call. Each has a zod input schema (sent to the model
// as JSON Schema), the contract capabilities it needs, and a run() that reads
// through the investigation's data source and cites what it read as E#.
// Every tool is read-only except recall_notes' audit trail inside H-MEM.

import { z } from "zod";
import type { CauseId } from "../../billmodel/causes.ts";
import type { ToolSpec } from "../llm.ts";
import { allBills, meterReads, pairSplit, tariffRates, testCause, weatherDays, type Investigation } from "../investigation.ts";

export interface Tool {
  name: string;
  description: string;
  needs: (inv: Investigation) => string[]; // contract capabilities required
  input: z.ZodType;
  run: (input: unknown, inv: Investigation) => Promise<unknown>;
}

const r = (x: number, dp = 2) => Math.round(x * 10 ** dp) / 10 ** dp;
const NO_INPUT = z.object({});

const billView = (b: Investigation["a"]) => ({
  bill_id: b.bill_id,
  label: b.label,
  period: `${b.period_start} to ${b.period_end}`,
  days: b.days,
  units_billed: b.units_billed,
  units_true: b.units_true,
  unit: b.unit,
  read_type: b.read_type,
  energy_gbp: b.energy_gbp,
  standing_gbp: b.standing_gbp,
  adjustments_gbp: b.adjustments_gbp,
  adjustment_note: b.adjustment_note || null,
  total_gbp: b.total_gbp,
});

export const getBills: Tool = {
  name: "get_bills",
  description: "The two bills being compared (earlier, then later): dates, days, units billed and true units from the meter, charges, one-offs, and whether the reading was actual or estimated.",
  needs: () => ["bills.read"],
  input: NO_INPUT,
  run: async (_input, inv) => {
    const { evidenceId } = await allBills(inv);
    return { evidence: evidenceId, earlier: billView(inv.a), later: billView(inv.b) };
  },
};

export const getMeterReadings: Tool = {
  name: "get_meter_readings",
  description: "Meter register readings from the start of the earlier bill to the end of the later one.",
  needs: () => ["reads.read"],
  input: NO_INPUT,
  run: async (_input, inv) => {
    const { rows, evidenceId } = await meterReads(inv);
    return { evidence: evidenceId, readings: rows.map((x) => ({ date: x.read_date, register: x.register, unit: x.unit, source: x.source })) };
  },
};

export const getTariff: Tool = {
  name: "get_tariff",
  description: "The published unit rates and standing (or fixed) charges that applied across the two bills, with the dates each changed.",
  needs: (inv) => [inv.utility === "water" ? "water_charges.read" : "tariffs.read"],
  input: NO_INPUT,
  run: async (_input, inv) => {
    const { rows, evidenceId } = await tariffRates(inv);
    return { evidence: evidenceId, rates: rows.map((t) => ({ kind: t.kind, from: t.valid_from, to: t.valid_to, value: r(t.value, 4), unit: t.unit })) };
  },
};

export const getWeather: Tool = {
  name: "get_weather",
  description: "The weather in each bill's period: mean heating degree days a day (cold) and mean daily maximum temperature (heat), plus total rain.",
  needs: () => ["weather.read"],
  input: NO_INPUT,
  run: async (_input, inv) => {
    const { rows, evidenceId } = await weatherDays(inv);
    const period = (b: Investigation["a"]) => {
      const days = rows.filter((w) => w.day >= b.period_start && w.day <= b.period_end);
      const mean = (k: "hdd" | "tmax_c") => r(days.reduce((t, w) => t + w[k], 0) / (days.length || 1));
      return { bill_id: b.bill_id, days: days.length, mean_hdd: mean("hdd"), mean_max_c: mean("tmax_c"), rain_mm: r(days.reduce((t, w) => t + w.rain_mm, 0), 1) };
    };
    return { evidence: evidenceId, earlier: period(inv.a), later: period(inv.b) };
  },
};

export const getSplit: Tool = {
  name: "get_split",
  description: "The exact £ split of the change between the two bills: period length, weather, use beyond the weather, unit price, standing charge, estimated reading, and one-offs. The parts add up to the change.",
  needs: () => ["bills.read", "weather.read"],
  input: NO_INPUT,
  run: async (_input, inv) => {
    const { split, evidence } = await pairSplit(inv);
    return {
      evidence,
      change_gbp: split.change,
      parts_gbp: split.parts,
      weather_fit: split.fit ? { beta: r(split.fit.beta, 3), r2: r(split.fit.r2), bills: split.fit.n, trusted: split.fit.reliable } : null,
    };
  },
};

// test_cause is built per specialist, limited to the causes it owns.
export function testCauseTool(causes: CauseId[]): Tool {
  return {
    name: "test_cause",
    description:
      `Measure one possible cause against its threshold, in code. Returns whether it passes, the measured value, the threshold, its £ effect and the evidence. ` +
      `Causes you can test: ${causes.join(", ")}. If a household note explains a change, pass its id (M#) in notes.`,
    needs: () => ["bills.read"],
    input: z.object({
      cause: z.enum(causes as [CauseId, ...CauseId[]]),
      notes: z.array(z.string().regex(/^M\d+$/)).optional().describe("Household note ids (M#) that explain the change, if any"),
    }),
    run: async (input, inv) => {
      const { cause, notes = [] } = input as { cause: CauseId; notes?: string[] };
      const m = await testCause(inv, cause, notes);
      return { cause, passes: m.passes, value: m.value, threshold: m.threshold, effect_gbp: m.effect_gbp, detail: m.detail, evidence: m.evidence };
    },
  };
}

export const recallNotes: Tool = {
  name: "recall_notes",
  description: "Search the household's notes (things the bills can't show, like a new appliance or a heat pump) for anything relevant to these bills.",
  needs: () => ["memory.recall"],
  input: z.object({ query: z.string().min(2).max(200).describe("What to look for, e.g. 'heat pump' or 'new appliance'") }),
  run: async (input, inv) => {
    const { query } = input as { query: string };
    if (!inv.memory) return { notes: [], note: "Household memory isn't connected." };
    const notes = await inv.memory.recall(query, { utility: inv.utility, from: inv.a.period_start, to: inv.b.period_end });
    return { notes: notes.map((n) => ({ id: n.id, text: n.text, added: n.created })) };
  },
};

export function toSpec(tool: Tool): ToolSpec {
  const parameters = z.toJSONSchema(tool.input) as Record<string, unknown>;
  delete parameters.$schema;
  return { type: "function", function: { name: tool.name, description: tool.description, parameters } };
}
