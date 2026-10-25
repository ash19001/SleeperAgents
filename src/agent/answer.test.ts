import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { localSource } from "../data/local.ts";
import type { Utility } from "../lib/types.ts";
import { issueContract } from "../scout/contract.ts";
import { composeAnswer, templateAnswer } from "./answer.ts";
import { combine } from "./combiner.ts";
import { buildFacts, components } from "./facts.ts";
import type { ChatOptions, ChatResult } from "./llm.ts";
import { investigate, type InvestigationResult } from "./orchestrators/investigate.ts";
import { Trace } from "./trace.ts";
import { check, sentences } from "./verify.ts";

const { scenarios } = JSON.parse(readFileSync("eval/scenarios.json", "utf8")) as { scenarios: { id: string; utility: Utility; bill_a: string; bill_b: string }[] };

// A fake model: the orchestrator plans then closes, specialists report at
// once (code settles every cause), and the writer/combiner play back `texts`.
function fake(texts: string[] = []) {
  const calls: ChatOptions[] = [];
  let orch = 0;
  let n = 0;
  const fn = async (opts: ChatOptions): Promise<ChatResult> => {
    calls.push(structuredClone(opts));
    const text = opts.agent.startsWith("orchestrator:")
      ? JSON.stringify(orch++ % 2 === 0 ? { done: false, requests: [], note: "" } : { done: true, requests: [], note: "Done." })
      : opts.agent.startsWith("specialist:")
        ? '{"findings": [], "follow_up": null}'
        : (texts[n++] ?? "");
    return { text, message: { role: "assistant", content: text }, toolCalls: [], route: "nightshift", model: "fake", receipt: null, cached: false, ms: 1 };
  };
  return { fn, calls };
}

const cache = new Map<string, InvestigationResult>();
async function result(id: string): Promise<InvestigationResult> {
  if (cache.has(id)) return cache.get(id)!;
  const sc = scenarios.find((s) => s.id === id)!;
  const contract = issueContract(
    {
      traceId: "t",
      intent: { primary: { id: `bill.explain.${sc.utility}`, version: 1 }, parameters: {}, references: { bill_a: sc.bill_a, bill_b: sc.bill_b }, confidence: 1, alternates: [] },
      risk: { level: "low", flags: [], redactions: [], approvals: [] },
      toolPlan: [],
      modelProfile: { id: "nemotron-ultra", model: "fake" },
      scope: { user: {}, surface: "web", capabilities: ["bills.read", "reads.read", "tariffs.read", "water_charges.read", "weather.read"] },
      registryVersion: 1,
      policyPackVersion: "whybill@1",
    },
    "test-secret",
  );
  const r = await investigate(contract, sc.utility, { trace: new Trace(), data: localSource, chatFn: fake().fn });
  cache.set(id, r);
  return r;
}

const inputFor = (r: InvestigationResult, text: string) => {
  const table = buildFacts(r);
  return { text, facts: table.facts, components: components(r), change: r.change, findings: r.findings, measured: r.measured, evidenceIds: r.evidence.map((e) => e.id), memoryIds: [] };
};

describe("facts", () => {
  it("gives figures only to parts a supported cause explains", async () => {
    const r = await result("gas-january");
    const { byKey } = buildFacts(r);
    expect(byKey.get("change")).toMatchObject({ id: "F1", value: "£32.18", required: true });
    expect([...byKey.keys()].filter((k) => k.startsWith("part:"))).toEqual(["part:weather", "part:period", "part:estimate", "part:unit_price", "part:standing"]);
    expect(byKey.has("part:usage_other")).toBe(false); // C7 ruled out
    expect(byKey.get("C3:days_b")?.value).toBe("35 days");
    expect(byKey.get("C1:price_b")?.value).toMatch(/^\d+\.\d\dp per kWh$/);
    expect(byKey.get("part:standing")?.required).toBe(false); // under £1
  });
});

describe("checker", () => {
  it("passes the template answer for every scenario", async () => {
    for (const sc of scenarios) {
      const r = await result(sc.id);
      expect(check(inputFor(r, templateAnswer(r, buildFacts(r)))), sc.id).toEqual([]);
    }
  });

  it("splits sentences with their citations", () => {
    expect(sentences("It rose by {F1} [E1]. The weather added {F2}. [E2][E3] Nothing else.")).toEqual(["It rose by {F1} [E1].", "The weather added {F2}. [E2][E3]", "Nothing else."]);
  });

  it("catches numbers, unknown ids, missing citations and missing facts", async () => {
    const r = await result("gas-january");
    const f = buildFacts(r).byKey;
    const ok = templateAnswer(r, buildFacts(r));
    expect(check(inputFor(r, ok.replace(`{${f.get("change")!.id}}`, "£32.18")))).toEqual(expect.arrayContaining([expect.stringContaining('writes the number "£32.18"'), expect.stringContaining("leaves out {F1}")]));
    expect(check(inputFor(r, `${ok} It was {F99} [E9].`))).toEqual(expect.arrayContaining(["{F99} isn't in the facts table.", "[E9] isn't an evidence or note id for this answer."]));
    expect(check(inputFor(r, `${ok} The weather added {${f.get("part:weather")!.id}}.`))).toEqual([expect.stringContaining("without citing its evidence")]);
    const days = f.get("C3:days_b")!.id;
    expect(check(inputFor(r, `${ok} It covered {${days}} days [E1].`))).toEqual([`{${days}} already ends in "days" (35 days); don't repeat it.`]);
  });

  it("catches parts that don't add up and unsupported causes marked supported", async () => {
    const r = await result("gas-january");
    const input = inputFor(r, templateAnswer(r, buildFacts(r)));
    expect(check({ ...input, change: input.change + 0.02 })).toEqual([expect.stringContaining("The parts add up to")]);
    expect(check({ ...input, findings: input.findings.map((x) => (x.cause === "C5" ? { ...x, verdict: "supported" as const } : x)) })).toEqual([expect.stringContaining("C5 is marked supported")]);
  });
});

describe("composeAnswer", () => {
  it("uses the writer's text when it passes", async () => {
    const r = await result("gas-january");
    const good = templateAnswer(r, buildFacts(r));
    const { fn, calls } = fake([JSON.stringify({ answer_markdown: good })]);
    const a = await composeAnswer("Why did my gas bill go up in January?", r, { trace: new Trace(), chatFn: fn });
    expect(a.checked).toEqual({ by: "writer", problems: [] });
    expect(a.answer_markdown).toBe(good);
    expect(a.facts[0]).toEqual({ id: "F1", value: "£32.18", evidence: expect.any(Array) });
    expect(a.next_steps.map((s) => s.cause)).toEqual(["C4", "C1", "C6"]);
    expect(a.components.reduce((t, c) => t + Math.round(c.gbp * 100), 0)).toBe(Math.round(a.change_gbp * 100));
    expect(a.trace.some((s) => s.label === "Checked the answer: passed")).toBe(true);
    const brief = calls.find((c) => c.agent === "writer")!.messages[1].content!;
    expect(brief).toContain("{F1} = £32.18: how much the bill went up");
    expect(brief).toContain("Checked and ruled out or not enough data: Credit or one-off charge, Use changed beyond the weather, Switched fuel.");
  });

  it("asks for one rewrite with the checker's problems", async () => {
    const r = await result("gas-january");
    const good = templateAnswer(r, buildFacts(r));
    const { fn, calls } = fake([JSON.stringify({ answer_markdown: "Your bill went up by £32.18." }), JSON.stringify({ answer_markdown: good })]);
    const a = await composeAnswer("Why?", r, { trace: new Trace(), chatFn: fn });
    expect(a.checked.by).toBe("rewrite");
    expect(a.checked.problems[0]).toEqual(expect.arrayContaining([expect.stringContaining('writes the number "£32.18"')]));
    expect(calls.filter((c) => c.agent === "writer").at(-1)!.messages.at(-1)!.content).toContain("The checker found these problems:");
  });

  it("falls back to the template after two failures", async () => {
    const r = await result("water-summer-leak");
    const { fn } = fake(["no json", JSON.stringify({ answer_markdown: "It went up 61 pounds." })]);
    const a = await composeAnswer("Why?", r, { trace: new Trace(), chatFn: fn });
    expect(a.checked.by).toBe("template");
    expect(a.answer_markdown).toContain("Extra water use beyond the weather, which may be a leak, added");
    expect(a.next_steps[0].cause).toBe("C8");
  });
});

describe("combine", () => {
  it("links gas and electricity by the fuel switch in the template", async () => {
    const [elec, gas] = await Promise.all([result("elec-april"), result("gas-april")]);
    const answers = await Promise.all([elec, gas].map((r) => composeAnswer("Why?", r, { trace: new Trace(), chatFn: fake().fn })));
    const c = await combine("Why did my energy bills change in April?", answers, { trace: new Trace(), chatFn: fake().fn });
    expect(c.by).toBe("template");
    expect(c.summary_markdown).toMatch(/^Your electricity bill went down by \{F1\} and your gas bill went down by \{F2\}\. Both come from the same change/);
    expect(c.summary_facts.map((f) => f.id)).toEqual(["F1", "F2"]);
  });

  it("uses the combiner's text when it passes", async () => {
    const answers = await Promise.all(["elec-january", "gas-january"].map(async (id) => composeAnswer("Why?", await result(id), { trace: new Trace(), chatFn: fake().fn })));
    const text = "Your electricity bill went up by {F1} and your gas bill by {F2}, mostly because January's bills covered more days.";
    const c = await combine("Why?", answers, { trace: new Trace(), chatFn: fake([JSON.stringify({ summary_markdown: text })]).fn });
    expect(c).toMatchObject({ by: "writer", summary_markdown: text });
  });
});
