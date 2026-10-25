-- =============================================================================
-- Why My Bill: the household's data in Zetaris.
--
-- Six sources, three formats, one SQL layer:
--   - Supplier A's energy bills (JSON, pence, nested adjustments) and meter
--     readings, and the water company's bills (litres and pounds) and
--     charges: SAMPLE feeds served by the app at host.docker.internal:5175
--     (src/app/api/data/[source]/route.ts), registered as REST tables.
--   - Octopus Energy's published tariff (Flexible Octopus VAR-22-11-01,
--     region G) and Open-Meteo's daily weather for Manchester: the real
--     public APIs, registered as REST tables. No keys needed.
-- The views in container `whybill` put them in the one shape the agents read
-- (src/data/types.ts). Each REST table is cached right after it's created,
-- so queries read the cached copy instead of calling the source again.
--
-- Run with: npm run zetaris:setup (dry run: prints these statements)
--           npm run zetaris:setup -- --apply (runs them one at a time)
-- The app must be running on port 5175 when the four SAMPLE feeds are created.
-- Teardown: zetaris/whybill_drop.sql.
-- =============================================================================

-- Step 0: the Lightning database for the raw sources, and the view container.
CREATE LIGHTNING DATABASE WHYBILL_SRC DESCRIBE BY "Why My Bill sources: SAMPLE supplier feeds, Octopus tariffs, Open-Meteo weather";

CREATE SCHEMASTORE CONTAINER whybill;

-- Step 1: the four SAMPLE supplier feeds, from the app.
CREATE LIGHTNING REST TABLE supplier_a_bills FROM WHYBILL_SRC REQUEST(
    endpoint "http://host.docker.internal:5175/api/data/supplier-a-bills",
    method "get",
    response_type "json",
    http_encoding "URLENCODED"
) HEADER (
) BODY ();
CACHE TABLE whybill_src.supplier_a_bills;

CREATE LIGHTNING REST TABLE supplier_a_reads FROM WHYBILL_SRC REQUEST(
    endpoint "http://host.docker.internal:5175/api/data/supplier-a-reads",
    method "get",
    response_type "json",
    http_encoding "URLENCODED"
) HEADER (
) BODY ();
CACHE TABLE whybill_src.supplier_a_reads;

CREATE LIGHTNING REST TABLE waterco_bills FROM WHYBILL_SRC REQUEST(
    endpoint "http://host.docker.internal:5175/api/data/waterco-bills",
    method "get",
    response_type "json",
    http_encoding "URLENCODED"
) HEADER (
) BODY ();
CACHE TABLE whybill_src.waterco_bills;

CREATE LIGHTNING REST TABLE water_charges FROM WHYBILL_SRC REQUEST(
    endpoint "http://host.docker.internal:5175/api/data/water-charges",
    method "get",
    response_type "json",
    http_encoding "URLENCODED"
) HEADER (
) BODY ();
CACHE TABLE whybill_src.water_charges;

-- Step 2: Octopus Energy's published prices (real API), one table per series.
CREATE LIGHTNING REST TABLE octopus_elec_unit FROM WHYBILL_SRC REQUEST(
    endpoint "https://api.octopus.energy/v1/products/VAR-22-11-01/electricity-tariffs/E-1R-VAR-22-11-01-G/standard-unit-rates/?period_from=2025-09-01T00:00:00Z&period_to=2026-10-21T00:00:00Z&page_size=1500",
    method "get",
    response_type "json",
    http_encoding "URLENCODED"
) HEADER (
    user-agent "why-my-bill hackathon demo"
) BODY ();
CACHE TABLE whybill_src.octopus_elec_unit;

CREATE LIGHTNING REST TABLE octopus_elec_standing FROM WHYBILL_SRC REQUEST(
    endpoint "https://api.octopus.energy/v1/products/VAR-22-11-01/electricity-tariffs/E-1R-VAR-22-11-01-G/standing-charges/?period_from=2025-09-01T00:00:00Z&period_to=2026-10-21T00:00:00Z&page_size=1500",
    method "get",
    response_type "json",
    http_encoding "URLENCODED"
) HEADER (
    user-agent "why-my-bill hackathon demo"
) BODY ();
CACHE TABLE whybill_src.octopus_elec_standing;

CREATE LIGHTNING REST TABLE octopus_gas_unit FROM WHYBILL_SRC REQUEST(
    endpoint "https://api.octopus.energy/v1/products/VAR-22-11-01/gas-tariffs/G-1R-VAR-22-11-01-G/standard-unit-rates/?period_from=2025-09-01T00:00:00Z&period_to=2026-10-21T00:00:00Z&page_size=1500",
    method "get",
    response_type "json",
    http_encoding "URLENCODED"
) HEADER (
    user-agent "why-my-bill hackathon demo"
) BODY ();
CACHE TABLE whybill_src.octopus_gas_unit;

CREATE LIGHTNING REST TABLE octopus_gas_standing FROM WHYBILL_SRC REQUEST(
    endpoint "https://api.octopus.energy/v1/products/VAR-22-11-01/gas-tariffs/G-1R-VAR-22-11-01-G/standing-charges/?period_from=2025-09-01T00:00:00Z&period_to=2026-10-21T00:00:00Z&page_size=1500",
    method "get",
    response_type "json",
    http_encoding "URLENCODED"
) HEADER (
    user-agent "why-my-bill hackathon demo"
) BODY ();
CACHE TABLE whybill_src.octopus_gas_standing;

-- Step 3: Open-Meteo's daily weather for the household (real API). The
-- response is parallel arrays (daily.time, daily.temperature_2m_mean, …),
-- read pairwise with posexplode in the view below.
CREATE LIGHTNING REST TABLE open_meteo_daily FROM WHYBILL_SRC REQUEST(
    endpoint "https://archive-api.open-meteo.com/v1/archive?latitude=53.4775&longitude=-2.2361&start_date=2024-10-01&end_date=2026-10-20&daily=temperature_2m_mean,temperature_2m_max,precipitation_sum&timezone=Europe%2FLondon",
    method "get",
    response_type "json",
    http_encoding "URLENCODED"
) HEADER (
    user-agent "why-my-bill hackathon demo"
) BODY ();
CACHE TABLE whybill_src.open_meteo_daily;

-- Step 4: the views the agents query, one shape for every utility.

-- Meter readings: Supplier A's register reads, plus the water company's
-- actual readings, which come on its bills.
CREATE SCHEMASTORE VIEW reads WITH CONTAINER whybill AS
SELECT lower(r.fuel) AS utility, r.read_date AS read_date, CAST(r.register_kwh AS DOUBLE) AS register, 'kWh' AS unit, r.source AS source
FROM whybill_src.supplier_a_reads LATERAL VIEW explode(records) x AS r
UNION ALL
SELECT 'water' AS utility, w.`to` AS read_date, CAST(w.currentReadingLitres AS DOUBLE) / 1000 AS register, 'm³' AS unit, 'BILL' AS source
FROM whybill_src.waterco_bills LATERAL VIEW explode(records) x AS w;

-- Bills: Supplier A (pence, nested adjustments; true units from the meter
-- reads either side of the period) and the water company (litres, pounds).
CREATE SCHEMASTORE VIEW bills WITH CONTAINER whybill AS
SELECT
    CASE b.fuel WHEN 'GAS' THEN 'gas' ELSE 'electricity' END AS utility,
    'Supplier A' AS supplier,
    b.bill_ref AS bill_id,
    b.period_from AS period_start,
    b.period_to AS period_end,
    CAST(b.standing_days AS INT) AS days,
    CAST(b.billed_kwh AS DOUBLE) AS units_billed,
    CAST(COALESCE(re.register_kwh - rs.register_kwh, b.billed_kwh) AS DOUBLE) AS units_true,
    'kWh' AS unit,
    CASE b.read_flag WHEN 'E' THEN 'estimated' ELSE 'actual' END AS read_type,
    CAST(b.energy_charge_pence AS DOUBLE) / 100 AS energy_gbp,
    CAST(b.standing_charge_pence AS DOUBLE) / 100 AS standing_gbp,
    CAST(aggregate(b.adjustments, CAST(0 AS BIGINT), (acc, a) -> acc + a.amount_pence) AS DOUBLE) / 100 AS adjustments_gbp,
    concat_ws('; ', transform(b.adjustments, a -> a.description)) AS adjustment_note,
    CAST(b.total_pence AS DOUBLE) / 100 AS total_gbp
FROM (SELECT e.* FROM whybill_src.supplier_a_bills LATERAL VIEW explode(records) x AS e) b
LEFT JOIN (SELECT r.* FROM whybill_src.supplier_a_reads LATERAL VIEW explode(records) x AS r) rs
    ON lower(rs.fuel) = CASE b.fuel WHEN 'GAS' THEN 'gas' ELSE 'electricity' END
   AND rs.read_date = CAST(date_sub(to_date(b.period_from), 1) AS STRING)
LEFT JOIN (SELECT r.* FROM whybill_src.supplier_a_reads LATERAL VIEW explode(records) x AS r) re
    ON lower(re.fuel) = CASE b.fuel WHEN 'GAS' THEN 'gas' ELSE 'electricity' END
   AND re.read_date = b.period_to
UNION ALL
SELECT
    'water' AS utility,
    'Waterco' AS supplier,
    w.billNumber AS bill_id,
    w.`from` AS period_start,
    w.`to` AS period_end,
    datediff(to_date(w.`to`), to_date(w.`from`)) + 1 AS days,
    CAST(w.usedLitres AS DOUBLE) / 1000 AS units_billed,
    CAST(w.usedLitres AS DOUBLE) / 1000 AS units_true,
    'm³' AS unit,
    CASE w.readingStatus WHEN 'Estimated' THEN 'estimated' ELSE 'actual' END AS read_type,
    CAST(ROUND(w.waterChargePounds + w.sewerageChargePounds, 2) AS DOUBLE) AS energy_gbp,
    CAST(ROUND(w.waterStandingPounds + w.sewerageStandingPounds, 2) AS DOUBLE) AS standing_gbp,
    CAST(0 AS DOUBLE) AS adjustments_gbp,
    '' AS adjustment_note,
    CAST(w.totalPounds AS DOUBLE) AS total_gbp
FROM whybill_src.waterco_bills LATERAL VIEW explode(records) x AS w;

-- Tariffs: Octopus's direct debit rates (UTC instants to UK dates), and the
-- water company's charges (water plus sewerage; valid_to made exclusive).
CREATE SCHEMASTORE VIEW tariffs WITH CONTAINER whybill AS
SELECT utility, kind,
       date_format(from_utc_timestamp(to_timestamp(valid_from), 'Europe/London'), 'yyyy-MM-dd') AS valid_from,
       CASE WHEN valid_to IS NULL THEN NULL ELSE date_format(from_utc_timestamp(to_timestamp(valid_to), 'Europe/London'), 'yyyy-MM-dd') END AS valid_to,
       value, unit
FROM (
    SELECT 'electricity' AS utility, 'unit' AS kind, CAST(r.valid_from AS STRING) AS valid_from, CAST(r.valid_to AS STRING) AS valid_to, CAST(r.value_inc_vat AS DOUBLE) AS value, 'p/kWh' AS unit, CAST(r.payment_method AS STRING) AS payment_method
    FROM whybill_src.octopus_elec_unit LATERAL VIEW explode(results) x AS r
    UNION ALL
    SELECT 'electricity', 'standing', CAST(r.valid_from AS STRING), CAST(r.valid_to AS STRING), CAST(r.value_inc_vat AS DOUBLE), 'p/day', CAST(r.payment_method AS STRING)
    FROM whybill_src.octopus_elec_standing LATERAL VIEW explode(results) x AS r
    UNION ALL
    SELECT 'gas', 'unit', CAST(r.valid_from AS STRING), CAST(r.valid_to AS STRING), CAST(r.value_inc_vat AS DOUBLE), 'p/kWh', CAST(r.payment_method AS STRING)
    FROM whybill_src.octopus_gas_unit LATERAL VIEW explode(results) x AS r
    UNION ALL
    SELECT 'gas', 'standing', CAST(r.valid_from AS STRING), CAST(r.valid_to AS STRING), CAST(r.value_inc_vat AS DOUBLE), 'p/day', CAST(r.payment_method AS STRING)
    FROM whybill_src.octopus_gas_standing LATERAL VIEW explode(results) x AS r
) rates
WHERE payment_method = 'DIRECT_DEBIT'
UNION ALL
SELECT 'water', 'unit', CAST(c.valid_from AS STRING), CAST(date_add(to_date(c.valid_to), 1) AS STRING), CAST(ROUND(c.water_gbp_per_m3 + c.sewerage_gbp_per_m3, 2) AS DOUBLE), '£/m³'
FROM whybill_src.water_charges LATERAL VIEW explode(records) x AS c
UNION ALL
SELECT 'water', 'standing', CAST(c.valid_from AS STRING), CAST(date_add(to_date(c.valid_to), 1) AS STRING), CAST(ROUND(c.water_fixed_gbp_per_year + c.sewerage_fixed_gbp_per_year, 2) AS DOUBLE), '£/year'
FROM whybill_src.water_charges LATERAL VIEW explode(records) x AS c;

-- Weather: one row per day; heating degree days at 15.5 °C.
CREATE SCHEMASTORE VIEW weather_daily WITH CONTAINER whybill AS
SELECT
    day,
    CAST(daily.temperature_2m_mean[i] AS DOUBLE) AS tmean_c,
    CAST(daily.temperature_2m_max[i] AS DOUBLE) AS tmax_c,
    CAST(daily.precipitation_sum[i] AS DOUBLE) AS rain_mm,
    ROUND(GREATEST(15.5 - daily.temperature_2m_mean[i], 0), 2) AS hdd
FROM whybill_src.open_meteo_daily LATERAL VIEW posexplode(daily.time) x AS i, day
WHERE daily.temperature_2m_mean[i] IS NOT NULL;
