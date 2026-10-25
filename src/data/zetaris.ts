// The household's data through Zetaris: the views in container `whybill`
// (zetaris/whybill_create.sql) over six registered sources. runSql sends one
// read-only statement to Zetaris's SQL API and refuses anything else; every
// read becomes an evidence record with the exact SQL and a SHA-256 of the
// rows that came back. Returns the same shapes as the local source.

import { createHash, randomUUID } from "node:crypto";
import type { Utility } from "../lib/types.ts";
import { label } from "./local.ts";
import type { DataSource, EvidenceRecord, MeterRead, Read, TariffRate, UBill, WeatherDay } from "./types.ts";

type Row = Record<string, string | null>;

const READ_ONLY = /^\s*(select|with|show|describe)\b/i;

export async function runSql(sql: string, limit = 5000): Promise<Row[]> {
  const bare = sql.replace(/'[^']*'/g, "''");
  if (!READ_ONLY.test(sql) || /;\s*\S/.test(bare)) throw new Error("Zetaris: the app sends one read-only statement at a time (SELECT, WITH, SHOW or DESCRIBE).");
  const base = (process.env.ZETARIS_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  const res = await fetch(`${base}/api/proxy/sql-editor/sqls/run-query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.ZETARIS_API_KEY ?? ""}`,
      "X-Org-ID": String(process.env.ZETARIS_ORG_ID ?? ""),
      "X-Request-ID": randomUUID(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, limit, ...(process.env.ZETARIS_ENGINE_ID ? { engineId: process.env.ZETARIS_ENGINE_ID } : {}) }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Zetaris answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { headers: string[]; data: (string | null)[][] };
  return body.data.map((row) => Object.fromEntries(body.headers.map((h, i) => [h, row[i]])));
}

// Re-reads a supplier feed after the household adds a bill: Zetaris drops
// its cached copy and caches a fresh one from the feed. Only these two
// statements, on these tables, are ever sent outside runSql.
const FEED_TABLES = { "supplier-a-bills": "supplier_a_bills", "supplier-a-reads": "supplier_a_reads", "waterco-bills": "waterco_bills" } as const;

export async function refreshFeeds(feeds: (keyof typeof FEED_TABLES)[]): Promise<void> {
  const base = (process.env.ZETARIS_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  for (const table of feeds.map((f) => FEED_TABLES[f])) {
    for (const sql of [`UNCACHE TABLE whybill_src.${table}`, `CACHE TABLE whybill_src.${table}`]) {
      const res = await fetch(`${base}/api/proxy/sql-editor/sqls/run-query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.ZETARIS_API_KEY ?? ""}`, "X-Org-ID": String(process.env.ZETARIS_ORG_ID ?? ""), "X-Request-ID": randomUUID(), "Content-Type": "application/json" },
        body: JSON.stringify({ sql, limit: 1 }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new Error(`Zetaris refresh failed (${sql}): ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
  }
}

// Zetaris returns every value as a string.
const num = (v: string | null | undefined) => (v === null || v === undefined || v === "" ? 0 : Number(v));
const str = (v: string | null | undefined) => v ?? "";

// Filter values come from code (utility names, ISO dates, bill ids), but are checked anyway.
const UTILITIES = new Set(["electricity", "gas", "water"]);
const q = (v: string, kind: "utility" | "date" | "id") => {
  const ok = kind === "utility" ? UTILITIES.has(v) : kind === "date" ? /^\d{4}-\d{2}-\d{2}$/.test(v) : /^[A-Za-z0-9-]+$/.test(v);
  if (!ok) throw new Error(`Zetaris: refused ${kind} value ${JSON.stringify(v)}`);
  return `'${v}'`;
};

async function read<T>(title: string, sql: string, map: (r: Row) => T): Promise<Read<T>> {
  const raw = await runSql(sql);
  const rows = raw.map(map);
  const evidence: EvidenceRecord = { id: "", title, source: "zetaris", sql, rows: rows.length, sha256: createHash("sha256").update(JSON.stringify(raw)).digest("hex"), at: new Date().toISOString() };
  return { rows, evidence };
}

export const zetarisSource: DataSource = {
  name: "zetaris",

  bills(filter = {}) {
    const where = [filter.utility && `utility = ${q(filter.utility, "utility")}`, filter.ids?.length && `bill_id IN (${filter.ids.map((i) => q(i, "id")).join(", ")})`].filter(Boolean);
    const sql = `SELECT utility, supplier, bill_id, period_start, period_end, days, units_billed, units_true, unit, read_type,
       energy_gbp, standing_gbp, adjustments_gbp, adjustment_note, total_gbp
FROM whybill.bills${where.length ? `\nWHERE ${where.join(" AND ")}` : ""}
ORDER BY utility, period_start`;
    return read<UBill>("Bills", sql, (r) => ({
      utility: str(r.utility) as Utility,
      supplier: str(r.supplier),
      bill_id: str(r.bill_id),
      ...label(str(r.period_start), str(r.period_end), r.utility === "water"),
      period_start: str(r.period_start),
      period_end: str(r.period_end),
      days: num(r.days),
      units_billed: num(r.units_billed),
      units_true: num(r.units_true),
      unit: str(r.unit),
      read_type: r.read_type === "estimated" ? "estimated" : "actual",
      energy_gbp: num(r.energy_gbp),
      standing_gbp: num(r.standing_gbp),
      standing_gbp_per_day: num(r.standing_gbp) / (num(r.days) || 1),
      adjustments_gbp: num(r.adjustments_gbp),
      adjustment_note: str(r.adjustment_note),
      total_gbp: num(r.total_gbp),
    }));
  },

  reads(utility, from, to) {
    const sql = `SELECT utility, read_date, register, unit, source
FROM whybill.reads
WHERE utility = ${q(utility, "utility")} AND read_date BETWEEN ${q(from, "date")} AND ${q(to, "date")}
ORDER BY read_date`;
    return read<MeterRead>("Meter readings", sql, (r) => ({ utility: str(r.utility) as Utility, read_date: str(r.read_date), register: num(r.register), unit: str(r.unit), source: str(r.source) }));
  },

  tariffs(utility, from, to) {
    const sql = `SELECT utility, kind, valid_from, valid_to, value, unit
FROM whybill.tariffs
WHERE utility = ${q(utility, "utility")} AND valid_from <= ${q(to, "date")} AND (valid_to IS NULL OR valid_to > ${q(from, "date")})
ORDER BY kind, valid_from`;
    return read<TariffRate>(utility === "water" ? "Water charges" : `${utility === "gas" ? "Gas" : "Electricity"} tariff`, sql, (r) => ({
      utility: str(r.utility) as Utility,
      kind: r.kind === "standing" ? "standing" : "unit",
      valid_from: str(r.valid_from),
      valid_to: r.valid_to || null,
      value: num(r.value),
      unit: str(r.unit) as TariffRate["unit"],
    }));
  },

  weather(from, to) {
    const sql = `SELECT day, tmean_c, tmax_c, rain_mm, hdd
FROM whybill.weather_daily
WHERE day BETWEEN ${q(from, "date")} AND ${q(to, "date")}
ORDER BY day`;
    return read<WeatherDay>("Daily weather", sql, (r) => ({ day: str(r.day), tmean_c: num(r.tmean_c), tmax_c: num(r.tmax_c), rain_mm: num(r.rain_mm), hdd: num(r.hdd) }));
  },
};
