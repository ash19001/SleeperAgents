// Fetches real daily weather for the SAMPLE household's area (coordinates in
// household_SAMPLE.json) from the Open-Meteo archive. Public API, no key.
// Adds heating degree days, max(0, 15.5 − mean temperature). The year before
// the bills is for fitting how use follows the weather.
//
// Run: node scripts/fetch_weather.ts

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const START = "2024-10-01";
const END = "2026-10-20";
const HDD_BASE = 15.5;

const household = JSON.parse(readFileSync("data/sample/household_SAMPLE.json", "utf8"));
const url =
  `https://archive-api.open-meteo.com/v1/archive?latitude=${household.latitude}&longitude=${household.longitude}` +
  `&start_date=${START}&end_date=${END}&daily=temperature_2m_mean,temperature_2m_max,precipitation_sum&timezone=Europe%2FLondon`;

const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
if (!res.ok) throw new Error(`Open-Meteo answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
const body = await res.json();
const d = body.daily as { time: string[]; temperature_2m_mean: (number | null)[]; temperature_2m_max: (number | null)[]; precipitation_sum: (number | null)[] };

mkdirSync("data/reference", { recursive: true });
writeFileSync("data/reference/open_meteo_raw.json", `${JSON.stringify({ fetched: new Date().toISOString(), url, ...body })}\n`);

const rows = ["day,tmean_c,tmax_c,rain_mm,hdd"];
let missing = 0;
d.time.forEach((day, i) => {
  const mean = d.temperature_2m_mean[i];
  if (mean === null) missing++;
  const hdd = mean === null ? "" : Math.max(0, HDD_BASE - mean).toFixed(2);
  rows.push([day, mean ?? "", d.temperature_2m_max[i] ?? "", d.precipitation_sum[i] ?? "", hdd].join(","));
});
writeFileSync("data/reference/weather_daily.csv", `${rows.join("\n")}\n`);
console.log(`Saved ${d.time.length} days (${START} to ${END}, ${missing} missing) for ${household.town} to data/reference/weather_daily.csv`);
