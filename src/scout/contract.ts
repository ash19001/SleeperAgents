// Scout's execution contract: signed with HMAC-SHA256 over canonical JSON,
// valid for 5 minutes, and checked by every engine before it acts. Spec:
// vendor/meterless/scout-intent/docs/execution-contract.md.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { ExecutionContract } from "./types.ts";

export const CONTRACT_TTL_MS = 5 * 60_000;

export function scoutSecret(): string {
  const secret = process.env.SCOUT_SECRET;
  if (!secret) throw new Error("SCOUT_SECRET is not set in .env.local. Create one with: openssl rand -hex 32");
  return secret;
}

// JSON with object keys sorted at every level, so a contract always encodes
// to the same bytes. Undefined fields are left out.
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

// ULID: 10 characters of millisecond time, then 16 of randomness, in
// Crockford base32. Within one millisecond the randomness counts up, so ids
// stay in order.
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
let lastTime = -1;
let lastRandom: number[] = [];

export function ulid(now = Date.now()): string {
  let random: number[];
  if (now === lastTime) {
    random = [...lastRandom];
    for (let i = random.length - 1; i >= 0; i--) {
      if (random[i] < 31) {
        random[i]++;
        break;
      }
      random[i] = 0;
    }
  } else {
    random = Array.from(randomBytes(16), (b) => b % 32);
  }
  lastTime = now;
  lastRandom = random;
  let time = "";
  for (let t = now, i = 0; i < 10; i++, t = Math.floor(t / 32)) time = B32[t % 32] + time;
  return time + random.map((n) => B32[n]).join("");
}

type Unsigned = Omit<ExecutionContract, "contractId" | "issuedAt" | "expiresAt" | "signature" | "signedBy">;

const hmac = (secret: string, body: unknown) => createHmac("sha256", secret).update(canonicalJson(body)).digest("hex");

export function issueContract(fields: Unsigned, secret: string, now = Date.now()): ExecutionContract {
  const body: Omit<ExecutionContract, "signature"> = {
    ...fields,
    contractId: ulid(now),
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + CONTRACT_TTL_MS).toISOString(),
    signedBy: "scout",
  };
  return { ...body, signature: hmac(secret, body) };
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "unsigned" | "bad-signature" | "expired" | "scope-mismatch" | "intent-mismatch" | "missing-approval" };

// Called by every engine at its boundary. `require` lists what the caller is
// about to do, so out-of-scope work is refused here rather than discouraged.
export function verifyContract(
  contract: ExecutionContract,
  opts: { secret: string; now?: number; require?: { intent?: string; capabilities?: string[] } },
): VerifyResult {
  if (!contract?.signature || contract.signedBy !== "scout") return { ok: false, reason: "unsigned" };
  const { signature, ...body } = contract;
  const expected = Buffer.from(hmac(opts.secret, body), "hex");
  const given = Buffer.from(signature, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "bad-signature" };
  if ((opts.now ?? Date.now()) > Date.parse(contract.expiresAt)) return { ok: false, reason: "expired" };
  if (opts.require?.intent && contract.intent.primary.id !== opts.require.intent) return { ok: false, reason: "intent-mismatch" };
  if (opts.require?.capabilities?.some((c) => !contract.scope.capabilities.includes(c))) return { ok: false, reason: "scope-mismatch" };
  if (contract.risk.level === "high" && contract.risk.approvals.length === 0) return { ok: false, reason: "missing-approval" };
  return { ok: true };
}
