import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolvePair } from "../agent/bills.ts";
import { addBill, addedRecords, BillError, nextBillDraft } from "./added.ts";
import { feedRecords } from "./feeds.ts";
import { localSource, resetLocalCache } from "./local.ts";

let dir = "";
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "household-"));
  process.env.HOUSEHOLD_PATH = dir;
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.HOUSEHOLD_PATH;
  resetLocalCache();
});

const bills = async () => {
  resetLocalCache();
  return (await localSource.bills()).rows;
};

describe("adding a missing bill", () => {
  it("knows a month after the latest bill is missing", async () => {
    const pair = resolvePair(await bills(), "gas", "2026-10");
    expect(pair).toMatchObject({ ok: false, reason: "missing", utility: "gas", period: "2026-10", latest: { bill_id: "A-G-202609" } });
    // An earlier month with no bill still falls back to the same month in another year.
    expect(resolvePair(await bills(), "gas", "2025-04")).toMatchObject({ ok: true, bill_b: { bill_id: "A-G-202604" } });
  });

  it("starts the form after the latest bill, from its closing reading", () => {
    const draft = nextBillDraft("gas", feedRecords);
    const sep = feedRecords("supplier-a-bills").find((b) => b.bill_ref === "A-G-202609")!;
    expect(draft).toMatchObject({ period_from: "2026-10-01", period_to: "2026-10-31", opening_read: sep.closing_read_kwh, unit: "kWh" });
    expect(nextBillDraft("water", feedRecords)).toMatchObject({ period_from: "2026-10-01", period_to: "2026-11-30", unit: "m³" });
  });

  it("refuses a bill whose charges don't add up, or that overlaps the latest one", () => {
    const draft = nextBillDraft("gas", feedRecords);
    const base = { utility: "gas" as const, period_from: draft.period_from, period_to: draft.period_to, read_type: "actual" as const, opening_read: draft.opening_read, closing_read: draft.opening_read + 400, energy_gbp: 23.72, standing_gbp: 10.49, adjustment_gbp: 0, adjustment_note: "", total_gbp: 40 };
    expect(() => addBill(base, feedRecords)).toThrow(BillError);
    expect(() => addBill(base, feedRecords)).toThrow("The charges add up to £34.21, not the total of £40.00.");
    expect(() => addBill({ ...base, total_gbp: 34.21, period_from: "2026-09-15" }, feedRecords)).toThrow("must start after the latest gas bill, which ends on 2026-09-30");
    expect(() => addBill({ ...base, total_gbp: 34.21, closing_read: draft.opening_read - 1 }, feedRecords)).toThrow("closing reading can't be lower");
    expect(addedRecords("supplier-a-bills")).toEqual([]);
  });

  it("saves it in the supplier's format, so the agents see it like any other bill", async () => {
    const draft = nextBillDraft("gas", feedRecords);
    const added = addBill({ utility: "gas", period_from: draft.period_from, period_to: draft.period_to, read_type: "actual", opening_read: draft.opening_read, closing_read: draft.opening_read + 400, energy_gbp: 23.72, standing_gbp: 10.49, adjustment_gbp: 0, adjustment_note: "", total_gbp: 34.21 }, feedRecords);
    expect(added).toEqual({ bill_id: "A-G-202610", feeds: ["supplier-a-bills", "supplier-a-reads"] });
    expect(addedRecords("supplier-a-bills")[0]).toMatchObject({ bill_ref: "A-G-202610", fuel: "GAS", read_flag: "A", billed_kwh: 400, energy_charge_pence: 2372, standing_days: 31, total_pence: 3421, adjustments: [] });
    const oct = (await bills()).find((b) => b.bill_id === "A-G-202610")!;
    expect(oct).toMatchObject({ label: "Oct 2026", units_billed: 400, units_true: 400, total_gbp: 34.21, read_type: "actual" });
    expect(resolvePair(await bills(), "gas", "2026-10")).toMatchObject({ ok: true, bill_a: { bill_id: "A-G-202609" }, bill_b: { bill_id: "A-G-202610" } });
    expect(() => addBill({ utility: "gas", period_from: "2026-11-01", period_to: "2026-11-30", read_type: "estimated", opening_read: 1, closing_read: 2, energy_gbp: 1, standing_gbp: 1, adjustment_gbp: 0, adjustment_note: "", total_gbp: 2 }, feedRecords)).not.toThrow();
    expect(addedRecords("supplier-a-reads")).toHaveLength(1); // the estimated bill adds no reading
  });

  it("adds a water bill in the water company's format", async () => {
    const draft = nextBillDraft("water", feedRecords);
    const added = addBill({ utility: "water", period_from: draft.period_from, period_to: draft.period_to, read_type: "actual", opening_read: draft.opening_read, closing_read: draft.opening_read + 30, water_gbp: 66.3, sewerage_gbp: 68.1, water_standing_gbp: 7.81, sewerage_standing_gbp: 10.27, total_gbp: 152.48 }, feedRecords);
    expect(added).toEqual({ bill_id: "WC-202610", feeds: ["waterco-bills"] });
    const bill = (await bills()).find((b) => b.bill_id === "WC-202610")!;
    expect(bill).toMatchObject({ label: "Oct–Nov 2026", units_billed: 30, days: 61, total_gbp: 152.48 });
  });
});
