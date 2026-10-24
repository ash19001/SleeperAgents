// Looks up the SAMPLE household's area from the first half of a postcode and
// writes data/sample/household_SAMPLE.json. Both APIs are free and need no key:
//   Octopus      -> price region (Great Britain has 14, lettered A to P)
//   postcodes.io -> town and coordinates, used for the weather
//
// Run: node scripts/lookup_area.ts [postcode district, default M1]

import { mkdirSync, writeFileSync } from "node:fs";

const REGIONS: Record<string, string> = {
  A: "Eastern England", B: "East Midlands", C: "London", D: "Merseyside and North Wales",
  E: "West Midlands", F: "North East England", G: "North West England", H: "Southern England",
  J: "South East England", K: "South Wales", L: "South West England", M: "Yorkshire",
  N: "South Scotland", P: "North Scotland",
};

// Water company by postcode area. Partial on purpose: company boundaries don't
// follow postcode areas exactly, so any area not listed gives null.
const WATER: Record<string, string> = {
  M: "United Utilities", BL: "United Utilities", OL: "United Utilities", WN: "United Utilities",
  WA: "United Utilities", PR: "United Utilities", BB: "United Utilities", FY: "United Utilities",
  LA: "United Utilities", CA: "United Utilities", L: "United Utilities",
};

async function getJson(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json();
}

const district = (process.argv[2] ?? "M1").trim().toUpperCase();
const area = district.match(/^[A-Z]{1,2}/)?.[0] ?? "";

const regionUrl = `https://api.octopus.energy/v1/industry/grid-supply-points/?postcode=${encodeURIComponent(district)}`;
const placeUrl = `https://api.postcodes.io/outcodes/${encodeURIComponent(district)}`;
const [region, place] = await Promise.all([getJson(regionUrl), getJson(placeUrl)]);

const code = String(region.results?.[0]?.group_id ?? "").replace("_", "");
if (!REGIONS[code]) throw new Error(`Octopus gave no price region for ${district}`);

const household = {
  note: "SAMPLE household: the bills are made up, the area details come from the lookups below.",
  postcode_district: district,
  town: place.result.admin_district?.[0] ?? district,
  latitude: Math.round(place.result.latitude * 10_000) / 10_000,
  longitude: Math.round(place.result.longitude * 10_000) / 10_000,
  price_region: { code, name: REGIONS[code] },
  water_company: WATER[area] ?? null,
  sources: { price_region: regionUrl, location: placeUrl },
  looked_up: new Date().toISOString().slice(0, 10),
};

const dir = new URL("../data/sample/", import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL("household_SAMPLE.json", dir), `${JSON.stringify(household, null, 2)}\n`);
console.log(household);
