// Which source the agents read: Zetaris when its whybill views answer,
// otherwise the local SAMPLE files. Every evidence record says which.
// WHYBILL_DATA=zetaris or =local forces one. While on the local files, the
// choice is checked again after a minute, so registering the views in
// Zetaris takes effect without a restart.

import { localSource } from "./local.ts";
import type { DataSource } from "./types.ts";
import { runSql, zetarisSource } from "./zetaris.ts";

let chosen: { source: DataSource; at: number } | null = null;

export async function dataSource(): Promise<DataSource> {
  const want = process.env.WHYBILL_DATA;
  if (want === "local") return localSource;
  if (chosen && (chosen.source === zetarisSource || Date.now() - chosen.at < 60_000)) return chosen.source;
  try {
    await runSql("SELECT COUNT(*) AS n FROM whybill.bills");
    chosen = { source: zetarisSource, at: Date.now() };
  } catch (err) {
    if (want === "zetaris") throw err;
    chosen = { source: localSource, at: Date.now() };
  }
  return chosen.source;
}
