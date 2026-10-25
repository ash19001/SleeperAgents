// Turns "gas, 2026-01" into the bill pair an orchestrator explains: the bill
// covering that month and the one before it. No month means the latest bill.

import type { Bill, Utility } from "../lib/types.ts";

export type PairResult =
  | { ok: true; bill_a: Bill; bill_b: Bill }
  | { ok: false; reason: "no-bill" | "first-bill"; utility: Utility; period: string | null };

const byStart = (a: Bill, b: Bill) => a.period_start.localeCompare(b.period_start);

function coversMonth(bill: Bill, period: string): boolean {
  const [year, month] = period.split("-").map(Number);
  const first = `${period}-01`;
  const last = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return bill.months.includes(month) && bill.period_start <= last && bill.period_end >= first;
}

// If no bill covers the month asked for, the same month in another year is
// almost always what was meant ("April" with bills from Oct 2025 to Sep 2026),
// so try that, latest first.
export function resolvePair(bills: Bill[], utility: Utility, period: string | null): PairResult {
  const mine = bills.filter((b) => b.utility === utility).sort(byStart);
  let index = mine.length - 1;
  if (period) {
    index = mine.findIndex((b) => coversMonth(b, period));
    if (index < 0) {
      const month = Number(period.slice(5));
      index = mine.findLastIndex((b) => b.months.includes(month));
    }
  }
  if (index < 0) return { ok: false, reason: "no-bill", utility, period };
  if (index === 0) return { ok: false, reason: "first-bill", utility, period };
  return { ok: true, bill_a: mine[index - 1], bill_b: mine[index] };
}

// The YYYY-MM months each utility has bills for, for the intake agent.
export function billMonths(bills: Bill[]): Record<Utility, string[]> {
  const months = (u: Utility) => {
    const out = new Set<string>();
    for (const b of bills.filter((x) => x.utility === u).sort(byStart)) {
      const year = Number(b.period_end.slice(0, 4));
      const endMonth = Number(b.period_end.slice(5, 7));
      // A bill's months can straddle a year end (Dec 2025 to Jan 2026).
      for (const m of b.months) out.add(`${m > endMonth ? year - 1 : year}-${String(m).padStart(2, "0")}`);
    }
    return [...out];
  };
  return { electricity: months("electricity"), gas: months("gas"), water: months("water") };
}
