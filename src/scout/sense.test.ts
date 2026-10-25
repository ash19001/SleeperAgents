import { describe, expect, it } from "vitest";
import { WHYBILL_LEXICON, WHYBILL_REGISTRY, loadRegistry, loadSenseConfig } from "./registry.ts";
import { selfTest, sense } from "./sense.ts";

const registry = loadRegistry(WHYBILL_REGISTRY);
const config = loadSenseConfig(WHYBILL_LEXICON);
const run = (prompt: string, semantic?: Record<string, number>) => sense({ prompt, semantic }, registry, config);

describe("sense, keywords only", () => {
  it.each([
    ["Why did my gas bill go up in January?", "bill.explain.gas"],
    ["why was my electricity bill lower in June", "bill.explain.electricity"],
    ["my power bill jumped", "bill.explain.electricity"],
    ["Why did my water bill go up? Could it be a leak?", "bill.explain.water"],
    ["the boiler has been on a lot, why is the bill so big", "bill.explain.gas"],
  ])("routes %j to %s in the High band", (prompt, intent) => {
    const r = run(prompt);
    expect(r.top.intent).toBe(intent);
    expect(r.band).toBe("high");
    expect(r.clarification).toBeUndefined();
    expect(r.multi).toEqual([]);
  });

  it("splits a question that names two utilities", () => {
    const r = run("Why did my gas and electricity bills go up in January?");
    expect(r.multi.map((c) => c.intent).sort()).toEqual(["bill.explain.electricity", "bill.explain.gas"]);
    expect(r.clarification).toBeUndefined();
  });

  it("asks which bill when 'energy' could mean gas or electricity", () => {
    const r = run("Why did my energy bills go up?");
    expect(r.multi).toEqual([]);
    expect(r.clarification?.options.map((o) => o.intent).sort()).toEqual(["bill.explain.electricity", "bill.explain.gas"]);
    expect(r.clarification?.question).toBe("Which bill do you mean: electricity or gas?");
  });

  it("asks which bill when no utility is named", () => {
    const r = run("Why is my bill so high?");
    expect(r.band).toBe("low");
    expect(r.clarification?.options).toHaveLength(3);
  });

  it("sends greetings to GENERAL", () => {
    const r = run("hello, what can you do?");
    expect(r.top.intent).toBe("GENERAL");
    expect(r.clarification).toBeUndefined();
  });

  it("keeps a weak general question in GENERAL without asking which bill", () => {
    const r = run("what can you help me with?");
    expect(r.top.intent).toBe("GENERAL");
    expect(r.clarification).toBeUndefined();
  });

  it("falls back to GENERAL's band for unrelated text", () => {
    expect(run("what's the capital of France").band).toBe("reject");
  });
});

describe("sense with the intake agent as Stage 2", () => {
  it("resolves 'energy' to the utility the intake agent chose", () => {
    const r = run("Why did my energy bills go up?", { "bill.explain.gas": 1 });
    expect(r.stage2).toBe("used");
    expect(r.top.intent).toBe("bill.explain.gas");
    expect(r.clarification).toBeUndefined();
  });

  it("keeps a clear keyword match in the High band", () => {
    const r = run("Why did my gas bill go up?", { "bill.explain.gas": 1 });
    expect(r.top.intent).toBe("bill.explain.gas");
    expect(r.band).toBe("high");
  });
});

describe("selfTest", () => {
  it("scans the full registry inside Scout's 16 ms budget", () => {
    expect(selfTest(registry, config).ok).toBe(true);
  });
});
