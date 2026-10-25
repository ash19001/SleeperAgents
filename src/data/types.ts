// The unified shapes every tool reads, whatever the source. The local SAMPLE
// source builds them from the supplier files; the Zetaris views will return
// the same columns.

import type { Bill, Utility } from "../lib/types.ts";

export interface UBill extends Bill {
  supplier: string;
  units_true: number; // from meter readings; differs from units_billed after an estimate
  energy_gbp: number; // volumetric charges (water and sewerage for water)
  standing_gbp: number; // standing or fixed charges for the whole period
  standing_gbp_per_day: number;
  adjustment_note: string;
}

export interface MeterRead {
  utility: Utility;
  read_date: string;
  register: number; // kWh, or m³ for water
  unit: string;
  source: string;
}

export interface TariffRate {
  utility: Utility;
  kind: "unit" | "standing";
  valid_from: string; // UK date the rate starts
  valid_to: string | null; // UK date it stops (exclusive)
  value: number;
  unit: "p/kWh" | "p/day" | "£/m³" | "£/year";
}

export interface WeatherDay {
  day: string;
  tmean_c: number;
  tmax_c: number;
  rain_mm: number;
  hdd: number; // heating degree days at 15.5 °C
}

// What a tool read and how, so every number traces back to it. `source` says
// whether it came from Zetaris or, until the data is registered there, a
// local SAMPLE file.
export interface EvidenceRecord {
  id: string;
  title: string;
  source: "zetaris" | "local-sample";
  sql: string; // the SQL sent to Zetaris, or a description of the local read
  rows: number;
  sha256: string; // of the rows returned
  at: string;
}

export interface Read<T> {
  rows: T[];
  evidence: EvidenceRecord;
}

export interface DataSource {
  name: "zetaris" | "local-sample";
  bills(filter?: { utility?: Utility; ids?: string[] }): Promise<Read<UBill>>;
  reads(utility: Utility, from: string, to: string): Promise<Read<MeterRead>>;
  tariffs(utility: Utility, from: string, to: string): Promise<Read<TariffRate>>;
  weather(from: string, to: string): Promise<Read<WeatherDay>>;
}
