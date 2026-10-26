import type { Bill } from "./types";

// Pounds and pence, with a true minus sign; `signed` adds "+" to increases.
export function money(x: number, signed = false): string {
  const pennies = Math.round(x * 100);
  if (pennies === 0) return "£0.00";
  const abs = (Math.abs(pennies) / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${pennies < 0 ? "−" : signed ? "+" : ""}£${abs}`;
}

// Dates are built from numbers, not a locale's whole format: the server's and
// the browser's ICU versions differ ("Sept", ", " or " at " before the time),
// and a mismatch breaks hydration.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "26 Oct 2026", from the date part of an ISO string.
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

// "26 Oct 2026, 15:22", UK time.
const UK = new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/London" });

export function fmtDateTime(iso: string): string {
  const p = Object.fromEntries(UK.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${Number(p.day)} ${MONTHS[Number(p.month) - 1]} ${p.year}, ${p.hour}:${p.minute}`;
}

export const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`);

export const fmtUnits = (n: number, unit: string) => `${n.toLocaleString("en-GB")} ${unit}`;

// "Jan" for monthly bills, "Jun–Jul" for water bills.
export const shortLabel = (bill: Bill) => (bill.utility === "water" ? bill.label.replace(/ \d{4}/g, "") : bill.label.slice(0, 3));
