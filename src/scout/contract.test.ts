import { describe, expect, it } from "vitest";
import { CONTRACT_TTL_MS, canonicalJson, issueContract, ulid, verifyContract } from "./contract.ts";
import type { ExecutionContract } from "./types.ts";

const SECRET = "test-secret-not-for-use";
const NOW = Date.parse("2026-10-25T12:00:00Z");

function sample(): ExecutionContract {
  return issueContract(
    {
      traceId: "trace-1",
      intent: {
        primary: { id: "bill.explain.gas", version: 1 },
        parameters: { period: "2026-01", direction: "up" },
        references: { bill_a: "GAS-2025-12", bill_b: "GAS-2026-01" },
        confidence: 0.93,
        alternates: [],
      },
      risk: { level: "low", flags: [], redactions: [], approvals: [] },
      toolPlan: [{ capability: "bills.read", tool: "zetaris.bills", readOnly: true, input: {} }],
      modelProfile: { id: "nemotron-ultra", model: "nvidia/nemotron-3-ultra-550b-a55b" },
      scope: { user: { role: "household" }, surface: "web", capabilities: ["bills.read", "tariffs.read"] },
      registryVersion: 1,
      policyPackVersion: "default@1",
    },
    SECRET,
    NOW,
  );
}

describe("canonicalJson", () => {
  it("sorts keys at every level and drops undefined", () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: undefined } })).toBe('{"a":{"d":[2,{"y":2,"z":1}]},"b":1}');
  });
});

describe("ulid", () => {
  it("is 26 characters and sorts in issue order within one millisecond", () => {
    const ids = [ulid(NOW), ulid(NOW), ulid(NOW)];
    expect(ids.every((id) => id.length === 26)).toBe(true);
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(3);
  });
});

describe("verifyContract", () => {
  it("accepts a fresh, untouched contract", () => {
    const c = sample();
    expect(c.expiresAt).toBe(new Date(NOW + CONTRACT_TTL_MS).toISOString());
    expect(verifyContract(c, { secret: SECRET, now: NOW + 1000 })).toEqual({ ok: true });
  });

  it("refuses a contract changed after signing", () => {
    const c = sample();
    const tampered = { ...c, scope: { ...c.scope, capabilities: [...c.scope.capabilities, "bills.write"] } };
    expect(verifyContract(tampered, { secret: SECRET, now: NOW })).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("refuses a contract signed with another secret", () => {
    expect(verifyContract(sample(), { secret: "other", now: NOW })).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("refuses an expired contract", () => {
    expect(verifyContract(sample(), { secret: SECRET, now: NOW + CONTRACT_TTL_MS + 1 })).toEqual({ ok: false, reason: "expired" });
  });

  it("refuses an unsigned contract", () => {
    const c = { ...sample(), signature: "" };
    expect(verifyContract(c, { secret: SECRET, now: NOW })).toEqual({ ok: false, reason: "unsigned" });
  });

  it("refuses work outside the contract's scope or intent", () => {
    const c = sample();
    expect(verifyContract(c, { secret: SECRET, now: NOW, require: { capabilities: ["weather.read"] } })).toEqual({ ok: false, reason: "scope-mismatch" });
    expect(verifyContract(c, { secret: SECRET, now: NOW, require: { intent: "bill.explain.water" } })).toEqual({ ok: false, reason: "intent-mismatch" });
    expect(verifyContract(c, { secret: SECRET, now: NOW, require: { intent: "bill.explain.gas", capabilities: ["bills.read"] } })).toEqual({ ok: true });
  });
});
