-- Removes everything whybill_create.sql made: the views, then the REST
-- tables, then the Lightning database. The container itself has no SQL drop
-- (see getting-started's REST HOWTO, section 3); remove it in the Zetaris UI
-- once its views are gone.
DROP VIEW whybill.weather_daily;
DROP VIEW whybill.tariffs;
DROP VIEW whybill.bills;
DROP VIEW whybill.reads;
DROP LIGHTNING DATABASE TABLE whybill_src.open_meteo_daily;
DROP LIGHTNING DATABASE TABLE whybill_src.octopus_gas_standing;
DROP LIGHTNING DATABASE TABLE whybill_src.octopus_gas_unit;
DROP LIGHTNING DATABASE TABLE whybill_src.octopus_elec_standing;
DROP LIGHTNING DATABASE TABLE whybill_src.octopus_elec_unit;
DROP LIGHTNING DATABASE TABLE whybill_src.water_charges;
DROP LIGHTNING DATABASE TABLE whybill_src.waterco_bills;
DROP LIGHTNING DATABASE TABLE whybill_src.supplier_a_reads;
DROP LIGHTNING DATABASE TABLE whybill_src.supplier_a_bills;
DROP LIGHTNING DATABASE WHYBILL_SRC;
