import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { localSource } from "../data/local.ts";
import type { UBill } from "../data/types.ts";
import { measure, type CauseId } from "./causes.ts";
import { fitWeather, splitChange } from "./decompose.ts";

const { rows: bills } = await localSource.bills();
const { rows: weather } = await localSource.weather("2024-10-01", "2026-10-20");
const byUtility = (u: string) => bills.filter((b) => b.utility === u);
const bill = (id: string) => bills.find((b) => b.bill_id === id)!;
const before = (b: UBill) => bills.filter((x) => x.utility === b.utility && x.period_end < b.period_start);
const splitBills = (A: UBill, B: UBill) => splitChange(A, B, weather, fitWeather(before(B).slice(-12), weather, A));
const split = (a: string, b: string) => splitBills(bill(a), bill(b));

describe("local SAMPLE data", () => {
  it("unifies three supplier files into one shape", () => {
    expect(byUtility("electricity")).toHaveLength(12);
    expect(byUtility("gas")).toHaveLength(12);
    expect(byUtility("water")).toHaveLength(6);
    for (const b of bills) expect(b.energy_gbp + b.standing_gbp + b.adjustments_gbp).toBeCloseTo(b.total_gbp, 2);
  });

  it("names bills by month and keeps true units from the meter readings", () => {
    expect(bill("A-G-202601")).toMatchObject({ label: "Jan 2026", days: 35, read_type: "actual" });
    expect(bill("WC-202606")).toMatchObject({ label: "Jun–Jul 2026", months: [6, 7], unit: "m³" });
    const nov = bill("A-G-202511");
    expect(nov.read_type).toBe("estimated");
    expect(nov.units_true).toBeGreaterThan(nov.units_billed);
  });
});

describe("splitChange", () => {
  it("splits every consecutive bill pair to the penny", () => {
    let pairs = 0;
    for (const u of ["electricity", "gas", "water"]) {
      const list = byUtility(u);
      for (let i = 1; i < list.length; i++) {
        const s = splitBills(list[i - 1], list[i]);
        const sum = Object.values(s.parts).reduce((t, x) => t + Math.round(x * 100), 0);
        expect(sum).toBe(Math.round(s.change * 100));
        pairs++;
      }
    }
    expect(pairs).toBe(27);
  });
});

describe("cause measurements on the planted events", () => {
  it("January gas: longer bill, colder, December's catch-up, price fell", () => {
    const s = split("A-G-202512", "A-G-202601");
    const [a, b] = [bill("A-G-202512"), bill("A-G-202601")];
    expect(measure("C3", s, a, b).passes).toBe(true);
    expect(measure("C4", s, a, b).passes).toBe(true);
    expect(measure("C1", s, a, b)).toMatchObject({ passes: true });
    expect(measure("C1", s, a, b).value!).toBeLessThan(0);
    expect(measure("C5", s, a, b).passes).toBe(false);
  });

  it("June electricity: the £50 credit and a shorter bill", () => {
    const s = split("A-E-202605", "A-E-202606");
    const [a, b] = [bill("A-E-202605"), bill("A-E-202606")];
    expect(measure("C5", s, a, b)).toMatchObject({ passes: true, effect_gbp: -50 });
    expect(measure("C3", s, a, b).passes).toBe(true);
    expect(measure("C1", s, a, b).passes).toBe(false);
  });

  it("the control pair passes nothing that can be measured", () => {
    const s = split("A-G-202607", "A-G-202608");
    const [a, b] = [bill("A-G-202607"), bill("A-G-202608")];
    for (const c of ["C1", "C2", "C3", "C4", "C5", "C7"] as const) expect([c, measure(c, s, a, b).passes]).toEqual([c, false]);
  });

  it("doesn't trust a weather fit that spans the heat pump", () => {
    const s = split("A-G-202607", "A-G-202608");
    expect(s.fit?.reliable).toBe(false);
    expect(s.parts.weather).toBe(0);
  });
});

describe("the answer key", () => {
  const { scenarios } = JSON.parse(readFileSync("eval/scenarios.json", "utf8")) as {
    scenarios: { id: string; utility: string; bill_a: string; bill_b: string; must_support: CauseId[]; must_rule_out: CauseId[] }[];
  };

  // The same pair for the other fuel, for the fuel-switch test.
  const otherSplit = (a: UBill, b: UBill) => {
    if (a.utility === "water") return null;
    const other = a.utility === "gas" ? "electricity" : "gas";
    const oa = bills.find((x) => x.utility === other && x.period_start === a.period_start);
    const ob = bills.find((x) => x.utility === other && x.period_start === b.period_start);
    return oa && ob ? splitBills(oa, ob) : null;
  };

  it.each(scenarios.map((s) => [s.id, s]))("%s matches the cause tests", (_id, sc) => {
    const [a, b] = [bill(sc.bill_a), bill(sc.bill_b)];
    const s = splitBills(a, b);
    const earlier = before(a).at(-1);
    const extra = { otherUtility: otherSplit(a, b), previous: earlier ? splitBills(earlier, a) : null };
    for (const c of sc.must_support) expect([c, measure(c, s, a, b, extra).passes]).toEqual([c, true]);
    for (const c of sc.must_rule_out) expect([c, measure(c, s, a, b, extra).passes ?? false]).toEqual([c, false]);
  });
});
