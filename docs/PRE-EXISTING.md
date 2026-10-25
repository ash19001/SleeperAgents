# Pre-existing code and data

Everything in this repository was written during the hackathon, from 24 October 2026 (the first commit), except the items below. The same list goes in the submission form (rule 5.4).

## Code

| What | Where | Source | Licence | How it's used |
| --- | --- | --- | --- | --- |
| Meterless H-MEM, World Model and Markovian (reference implementations) | `vendor/meterless/hmem`, `world-model`, `markovian` | [Meterless/Meterless](https://github.com/Meterless/Meterless) at commit `1742dec`, copied unchanged on 25 Oct 2026 | Apache-2.0 (each keeps its `LICENSE`) | Imported as `#meterless/*` (package.json `imports`). H-MEM holds household notes and findings (`src/memory/hmem.ts`); World Model holds each investigation's case file (`src/memory/casefile.ts`); Markovian runs the orchestrator's review rounds (`src/agent/orchestrators/investigate.ts`). |
| Meterless Scout Intent specification, examples and eval harness | `vendor/meterless/scout-intent` | Same repository and commit | Apache-2.0 | Meterless publish no Scout implementation. Ours is in `src/scout/`, written here to the spec, and scored with their harness (`eval/scout_harness_report.md`). |
| Next.js app scaffold | `src/app/layout.tsx` (starting point), `eslint.config.mjs`, `next.config.ts`, `postcss.config.mjs`, `tsconfig.json`, `AGENTS.md` | `create-next-app` for Next.js 16.3.8 | MIT | Starting point for the web app; the pages, components and API routes are ours. `AGENTS.md` is written by `next dev`. |
| npm packages | `package.json` | next, react, react-dom, lucide-react, zod, tailwindcss, vitest, eslint | MIT / ISC | Ordinary dependencies, not committed. |

Adapted, not copied: the Zetaris SQL in `zetaris/whybill_create.sql` follows the patterns in Zetaris's [getting-started](https://github.com/zetaris/getting-started) REST cookbook (`CREATE LIGHTNING REST TABLE`, `CACHE TABLE`, `CREATE SCHEMASTORE VIEW`, `LATERAL VIEW explode`/`posexplode`), and `src/data/zetaris.ts` calls the same SQL API route as its `scripts/zetaris_api.ts` (Apache-2.0). No files were copied from it.

## Data

| What | Where | Source | Terms |
| --- | --- | --- | --- |
| Electricity and gas prices: Flexible Octopus (VAR-22-11-01), region G, direct debit | Read live by Zetaris (`octopus_*` tables); saved copy in `data/reference/octopus_tariffs*.{csv,json}` | [Octopus Energy public API](https://developer.octopus.energy/docs/api/) | Public API, no key |
| Daily weather for Manchester (53.4775, -2.2361) | Read live by Zetaris (`open_meteo_daily`); saved copy in `data/reference/weather_daily.csv`, `open_meteo_raw.json` | [Open-Meteo historical weather API](https://open-meteo.com/en/docs/historical-weather-api) | CC BY 4.0, attribution: Open-Meteo |
| Postcode district M1: coordinates and region | `data/sample/household_SAMPLE.json` | [postcodes.io](https://postcodes.io/) | Open Government Licence |

The household, its bills, meter readings and water charges are **SAMPLE** data, generated here by `scripts/generate_sample.ts` with eight planted events and an answer key (`eval/scenarios.json`). Nothing about a real household is used.
