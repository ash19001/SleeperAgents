import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Bill } from "../lib/types.ts";
import { billMonths, resolvePair } from "./bills.ts";
import { parseIntake } from "./intake.ts";

const bills: Bill[] = JSON.parse(readFileSync("data/sample/preview_SAMPLE.json", "utf8")).bills;

describe("parseIntake", () => {
  it("reads a reply wrapped in a code fence", () => {
    const r = parseIntake('```json\n{"requests":[{"utility":"gas","period":"2026-01","direction":"up"}],"unclear":null}\n```');
    expect(r).toEqual({ ok: true, intake: { requests: [{ utility: "gas", period: "2026-01", direction: "up" }], unclear: null } });
  });

  it("keeps one request per utility", () => {
    const r = parseIntake('{"requests":[{"utility":"gas","period":null,"direction":"up"},{"utility":"gas","period":"2026-02","direction":"down"}],"unclear":null}');
    expect(r.ok && r.intake.requests).toEqual([{ utility: "gas", period: null, direction: "up" }]);
  });

  it.each([
    ['{"requests":[{"utility":"broadband","period":null,"direction":"up"}],"unclear":null}', "utility"],
    ['{"requests":[{"utility":"gas","period":"January","direction":"up"}],"unclear":null}', "period"],
    ["Sure! The user is asking about gas.", "no JSON"],
  ])("refuses %s", (text, error) => {
    const r = parseIntake(text);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(error);
  });
});

describe("resolvePair", () => {
  it("finds January's gas bill and the one before it", () => {
    const r = resolvePair(bills, "gas", "2026-01");
    expect(r.ok && [r.bill_a.bill_id, r.bill_b.bill_id]).toEqual(["GAS-2025-12", "GAS-2026-01"]);
  });

  it("matches either month of a two-month water bill", () => {
    for (const period of ["2026-06", "2026-07"]) {
      const r = resolvePair(bills, "water", period);
      expect(r.ok && r.bill_b.bill_id).toBe("WATER-2026-06");
    }
  });

  it("uses the latest bill when no month is given", () => {
    const r = resolvePair(bills, "electricity", null);
    expect(r.ok && r.bill_b.bill_id).toBe("ELEC-2026-09");
  });

  it("uses the same month in the bills' year when the year is wrong", () => {
    const r = resolvePair(bills, "electricity", "2025-04");
    expect(r.ok && r.bill_b.bill_id).toBe("ELEC-2026-04");
  });

  it("says when there's no bill or no earlier bill", () => {
    expect(resolvePair(bills.filter((b) => b.utility !== "water"), "water", "2026-01")).toMatchObject({ ok: false, reason: "no-bill" });
    expect(resolvePair(bills, "gas", "2025-10")).toMatchObject({ ok: false, reason: "first-bill" });
  });

  it("describes each utility's bill months", () => {
    expect(billMonths(bills).water).toEqual(["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
  });
});
