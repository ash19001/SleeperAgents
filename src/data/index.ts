// Which source the agents read: Zetaris when its whybill views answer,
// otherwise the local SAMPLE files. Every evidence record says which, and an
// answer that read the local files without being told to says so.
// WHYBILL_DATA=zetaris or =local forces one. While on the local files, the
// choice is checked again after a minute, so registering the views in
// Zetaris (or starting it again) takes effect without a restart.
//
// If a Zetaris read fails partway through, that read and the rest until the
// next check come from the local SAMPLE copy (the same rows: npm run
// zetaris:check).

import { currentQuestion } from "../lib/session.ts";
import { localSource } from "./local.ts";
import type { DataSource } from "./types.ts";
import { runSql, zetarisSource } from "./zetaris.ts";

const RECHECK_MS = 60_000;
const CHECK = "SELECT COUNT(*) AS n FROM whybill.bills";
const check = () => runSql(CHECK, 1, 15_000); // a hung Zetaris costs 15 s a minute, not 60

let zetarisUp: boolean | null = null; // null: not checked yet
let checkedAt = 0;
let why = ""; // why the last check or read failed, in a few plain words

function down(err: unknown) {
  zetarisUp = false;
  checkedAt = Date.now();
  const message = (err as Error).message;
  why = /isn't reachable/.test(message) ? "it isn't running" : /didn't answer within/.test(message) ? "it took too long" : "it answered with an error";
}

// The question being answered reads the local copy: its answer will say so.
function usingLocal() {
  const q = currentQuestion();
  if (q) q.zetaris ??= why;
}

async function zetarisFirst<T>(read: (source: DataSource) => Promise<T>): Promise<T> {
  if (zetarisUp !== false) {
    try {
      return await read(zetarisSource);
    } catch (err) {
      down(err);
      console.warn(`[why-my-bill] Zetaris read failed, using the local SAMPLE copy: ${(err as Error).message}`);
    }
  }
  usingLocal();
  return read(localSource);
}

// Zetaris, with the local SAMPLE copy behind every read.
const zetarisOrLocal: DataSource = {
  get name() {
    return zetarisUp === false ? "local-sample" : "zetaris";
  },
  bills: (filter) => zetarisFirst((s) => s.bills(filter)),
  reads: (utility, from, to) => zetarisFirst((s) => s.reads(utility, from, to)),
  tariffs: (utility, from, to) => zetarisFirst((s) => s.tariffs(utility, from, to)),
  weather: (from, to) => zetarisFirst((s) => s.weather(from, to)),
};

export async function dataSource(): Promise<DataSource> {
  const want = process.env.WHYBILL_DATA;
  if (want === "local") return localSource;
  if (want === "zetaris") {
    if (!zetarisUp) await check();
    zetarisUp = true;
    return zetarisSource;
  }
  if (zetarisUp === null || (!zetarisUp && Date.now() - checkedAt >= RECHECK_MS)) {
    try {
      await check();
      zetarisUp = true;
      checkedAt = Date.now();
    } catch (err) {
      down(err);
    }
  }
  if (zetarisUp) return zetarisOrLocal;
  usingLocal();
  return localSource;
}
