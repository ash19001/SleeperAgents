# Data

All the data is small (about 150 KB) and committed, so the app runs from a clean clone. The household is made up; prices, weather and the area are real.

| File | What it is | Source and licence | Size | How it reaches the agents | Regenerate |
| --- | --- | --- | --- | --- | --- |
| `sample/supplierA_energy_bills_SAMPLE.json` (and `.csv`) | Electricity and gas bills, Oct 2025 to Sep 2026, in "Supplier A"'s format: pence, read flags, nested adjustments | SAMPLE, generated here | 24 bills | Served at `/api/data/supplier-a-bills`, registered in Zetaris as REST table `whybill_src.supplier_a_bills` | `node scripts/generate_sample.ts` |
| `sample/supplierA_meter_reads_SAMPLE.json` (and `.csv`) | Electricity and gas meter register readings | SAMPLE, generated here | 26 readings | `/api/data/supplier-a-reads` → `whybill_src.supplier_a_reads` | same |
| `sample/waterco_bills_SAMPLE.json` (and `.csv`) | Water bills every two months, in the water company's format: litres and pounds | SAMPLE, generated here | 6 bills | `/api/data/waterco-bills` → `whybill_src.waterco_bills` | same |
| `reference/water_charges_SAMPLE.csv` | Water and sewerage charges per m³ and per year | SAMPLE, made-up figures in a realistic range | 2 rates | `/api/data/water-charges` → `whybill_src.water_charges` | edit by hand |
| `reference/octopus_tariffs.csv`, `octopus_tariffs_raw.json` | Flexible Octopus (VAR-22-11-01), region G (North West), direct debit: unit rates and standing charges, Sep 2025 to Oct 2026 | [Octopus Energy public API](https://developer.octopus.energy/docs/api/), no key | 24 rates | Zetaris reads the live API (`whybill_src.octopus_*`); this saved copy is for the local fallback and `npm run zetaris:check` | `node scripts/fetch_tariffs.ts` |
| `reference/weather_daily.csv`, `open_meteo_raw.json` | Daily mean and maximum temperature, rain, and heating degree days for Manchester, 1 Oct 2024 to 20 Oct 2026 | [Open-Meteo historical weather API](https://open-meteo.com/en/docs/historical-weather-api), CC BY 4.0 | 750 days | Zetaris reads the live API (`whybill_src.open_meteo_daily`); saved copy as above | `node scripts/fetch_weather.ts` |
| `sample/household_SAMPLE.json` | The household's area: postcode district M1, coordinates, price region, water company | [postcodes.io](https://postcodes.io/), Open Government Licence | 1 record | Read by the app | `node scripts/lookup_area.ts` |
| `sample/preview_SAMPLE.json` | Hand-written answers for preview mode (the page before the agents existed) | Written here | 6 answers | Preview mode only | `node scripts/make_preview_SAMPLE.ts` |

## The SAMPLE household

`scripts/generate_sample.ts` builds the household with a fixed seed from the real tariffs and weather above, and plants eight events for the agents to find: (1) an estimated reading 15% low and its catch-up, (2) a 35-day bill after a 28-day one, (3) the real price changes on 1 January, 1 April and 1 July, (4) a heat pump fitted on 15 March 2026 (gas falls, electricity rises), (5) a £50 goodwill credit on a shorter bill, (6) water charges rising on 1 April, (7) a hot, dry July and a hidden leak from 15 June 2026, and (8) a control pair where nothing should be found. It writes the answer key to `eval/scenarios.json`: 11 bill pairs, each with the causes that must be found and those that must be ruled out.

## In Zetaris

`npm run zetaris:setup` (a dry run; add `-- --apply` to run it) runs `zetaris/whybill_create.sql`: nine REST tables in the Lightning database `WHYBILL_SRC`, each cached straight away, and four views in the SchemaStore container `whybill` that put them in one shape: `bills`, `reads`, `tariffs`, `weather_daily`. The app must be running on port 5175 first, since Zetaris fetches the SAMPLE feeds from it (`host.docker.internal:5175`). `npm run zetaris:check` compares the views with these files, and `-- --drop` removes everything.

## Bills the household adds

When a question is about a bill that isn't there yet, the page offers a form. An added bill is checked (its charges must add up to its total), stored in `.household/added.json` (not committed), served with the SAMPLE records in its supplier's format, and Zetaris's cached copy of that feed is refreshed.

## Limitations

- One made-up household in Manchester, on one Octopus tariff and one water company's charges.
- Weather runs to 20 October 2026, and the published prices to 21 October 2026.
- Water charges are SAMPLE figures, not a real company's published tariff.
- With no keys, `SAMPLE_MODE=true` (replay) serves answers recorded from live runs in `eval/answers/`.
