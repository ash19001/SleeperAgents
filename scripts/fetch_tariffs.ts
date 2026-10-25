// Fetches real Octopus Energy prices for the SAMPLE household: the Flexible
// Octopus tariff (VAR-22-11-01), price region from household_SAMPLE.json,
// direct debit, unit rates and standing charges for electricity and gas.
// Public API, no key. Saves the raw responses and one CSV to data/reference/.
//
// Run: node scripts/fetch_tariffs.ts

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const PRODUCT = "VAR-22-11-01";
const FROM = "2025-09-01T00:00:00Z";
const TO = "2026-10-21T00:00:00Z";
const API = "https://api.octopus.energy/v1/products";

const household = JSON.parse(readFileSync("data/sample/household_SAMPLE.json", "utf8"));
const region: string = household.price_region.code;

interface Rate {
  value_inc_vat: number;
  valid_from: string;
  valid_to: string | null;
  payment_method: string | null;
}

async function fetchAll(url: string): Promise<Rate[]> {
  const out: Rate[] = [];
  for (let next: string | null = url; next; ) {
    const res = await fetch(next, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`${next} answered ${res.status}`);
    const page = (await res.json()) as { results: Rate[]; next: string | null };
    out.push(...page.results);
    next = page.next;
  }
  return out;
}

const series = [
  { fuel: "electricity", kind: "unit_rate", path: `electricity-tariffs/E-1R-${PRODUCT}-${region}/standard-unit-rates` },
  { fuel: "electricity", kind: "standing_charge", path: `electricity-tariffs/E-1R-${PRODUCT}-${region}/standing-charges` },
  { fuel: "gas", kind: "unit_rate", path: `gas-tariffs/G-1R-${PRODUCT}-${region}/standard-unit-rates` },
  { fuel: "gas", kind: "standing_charge", path: `gas-tariffs/G-1R-${PRODUCT}-${region}/standing-charges` },
];

mkdirSync("data/reference", { recursive: true });
const raw: Record<string, Rate[]> = {};
const rows: string[] = ["fuel,kind,valid_from,valid_to,value_inc_vat_pence,unit,payment_method,product,region"];
for (const s of series) {
  const url = `${API}/${PRODUCT}/${s.path}/?period_from=${FROM}&period_to=${TO}&page_size=100`;
  const rates = (await fetchAll(url)).filter((r) => r.payment_method === "DIRECT_DEBIT");
  raw[`${s.fuel}.${s.kind}`] = rates;
  for (const r of [...rates].sort((a, b) => a.valid_from.localeCompare(b.valid_from))) {
    const unit = s.kind === "unit_rate" ? "p/kWh" : "p/day";
    rows.push([s.fuel, s.kind, r.valid_from, r.valid_to ?? "", r.value_inc_vat, unit, "DIRECT_DEBIT", PRODUCT, region].join(","));
  }
}

writeFileSync("data/reference/octopus_tariffs_raw.json", `${JSON.stringify({ product: PRODUCT, region, fetched: new Date().toISOString(), series: raw }, null, 1)}\n`);
writeFileSync("data/reference/octopus_tariffs.csv", `${rows.join("\n")}\n`);
console.log(`Saved ${rows.length - 1} rates for ${PRODUCT} region ${region} to data/reference/octopus_tariffs.csv`);
