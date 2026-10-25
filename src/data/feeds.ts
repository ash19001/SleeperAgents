// The SAMPLE supplier feeds as the app serves them to Zetaris: each supplier
// file's records unchanged, in its own format, so Zetaris's views do the
// unifying. CSV files become one object per row.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const FEEDS = {
  "supplier-a-bills": "data/sample/supplierA_energy_bills_SAMPLE.json",
  "supplier-a-reads": "data/sample/supplierA_meter_reads_SAMPLE.json",
  "waterco-bills": "data/sample/waterco_bills_SAMPLE.json",
  "water-charges": "data/reference/water_charges_SAMPLE.csv",
} as const;

export function feedRecords(name: keyof typeof FEEDS): Record<string, unknown>[] {
  const text = readFileSync(resolve(FEEDS[name]), "utf8");
  if (FEEDS[name].endsWith(".json")) return JSON.parse(text).records;
  const [head, ...lines] = text.trim().split("\n");
  const keys = head.split(",");
  return lines.map((l) => Object.fromEntries(l.split(",").map((v, i) => [keys[i], /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v])));
}
