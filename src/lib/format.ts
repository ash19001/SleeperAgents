import type { Bill } from "./types";

// Pounds and pence, with a true minus sign; `signed` adds "+" to increases.
export function money(x: number, signed = false): string {
  const pennies = Math.round(x * 100);
  if (pennies === 0) return "£0.00";
  const abs = (Math.abs(pennies) / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${pennies < 0 ? "−" : signed ? "+" : ""}£${abs}`;
}

export function fmtDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`)
    .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .replace("Sept", "Sep");
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
  }).replace("Sept", "Sep");
}

export const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`);

export const fmtUnits = (n: number, unit: string) => `${n.toLocaleString("en-GB")} ${unit}`;

// "Jan" for monthly bills, "Jun–Jul" for water bills.
export const shortLabel = (bill: Bill) => (bill.utility === "water" ? bill.label.replace(/ \d{4}/g, "") : bill.label.slice(0, 3));
