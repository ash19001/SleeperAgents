import { describe, expect, it } from "vitest";
import { localSource } from "../../data/local.ts";
import { issueContract } from "../../scout/contract.ts";
import { diligentSpecialist, fakeReply } from "../fakes.ts";
import type { ChatOptions, ChatResult } from "../llm.ts";
import { createScout } from "../scout.ts";
import { Trace } from "../trace.ts";
import { runOrchestrator } from "./index.ts";
import { investigate, MAX_FOLLOW_UPS } from "./investigate.ts";

const SECRET = "test-secret-not-for-use";
const CAPS = ["bills.read", "reads.read", "tariffs.read", "weather.read"];

const contract = (bill_a = "A-G-202512", bill_b = "A-G-202601") =>
  issueContract(
    {
      traceId: "t",
      intent: { primary: { id: "bill.explain.gas", version: 1 }, parameters: {}, references: { bill_a, bill_b }, confidence: 1, alternates: [] },
      risk: { level: "low", flags: [], redactions: [], approvals: [] },
      toolPlan: [],
      modelProfile: { id: "nemotron-ultra", model: "fake" },
      scope: { user: {}, surface: "web", capabilities: CAPS },
      registryVersion: 1,
      policyPackVersion: "whybill@1",
    },
    SECRET,
  );

// A fake model: the orchestrator plays back scripted replies in order;
// specialists test their causes and report what was measured, unless a
// test swaps one in with `specialist`.
function fake(orchestrator: string[], specialist: (opts: ChatOptions) => { text: string; calls: [string, object][] } = diligentSpecialist) {
  const calls: ChatOptions[] = [];
  let n = 0;
  const fn = async (opts: ChatOptions): Promise<ChatResult> => {
    calls.push(structuredClone(opts));
    if (opts.agent.startsWith("orchestrator:")) return fakeReply(orchestrator[n++] ?? "");
    const r = specialist(opts);
    return fakeReply(r.text, r.calls, calls.length);
  };
  return { fn, calls };
}

const plan = JSON.stringify({ done: false, requests: [{ specialist: "weather", task: "Check how much colder January was." }], note: "Starting." });
const close = JSON.stringify({ done: true, requests: [], note: "Every part is accounted for." });
const askUsage = JSON.stringify({ done: false, requests: [{ specialist: "usage", task: "Look for a household note on the heating." }], note: "One question left." });
const askWeather = JSON.stringify({ done: false, requests: [{ specialist: "weather", task: "Recheck the weather fit." }], note: "" });
const specialistCalls = (calls: ChatOptions[], name: string) => calls.filter((c) => c.agent === `specialist:${name}` && c.label === "Start the task");

describe("investigate", () => {
  it("plans, sends every specialist, reviews and closes", async () => {
    const { fn, calls } = fake([plan, close]);
    const trace = new Trace();
    const r = await investigate(contract(), "gas", { trace, data: localSource, chatFn: fn });

    expect(r).toMatchObject({ rounds: 1, note: "Every part is accounted for.", markovian: { status: "completed", steps: 2 } });
    // Every cause the gas team owns, settled in code, matching the answer key.
    const verdicts = Object.fromEntries(r.findings.map((f) => [f.cause, f.verdict]));
    expect(Object.keys(verdicts)).toEqual(["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C9"]);
    for (const c of ["C3", "C6", "C4", "C1"]) expect(verdicts[c]).toBe("supported");
    for (const c of ["C5", "C9"]) expect(verdicts[c]).not.toBe("supported");
    // Ultra's task reached the weather specialist; the others got the default.
    expect(specialistCalls(calls, "weather")[0].messages[1].content).toContain("Check how much colder January was.");
    expect(specialistCalls(calls, "tariff")[0].messages[1].content).toContain("Check your causes");
    // The orchestrator ran on the deep model, and saw the case file.
    const orch = calls.filter((c) => c.agent === "orchestrator:gas");
    expect(orch.map((c) => c.label)).toEqual(["Plan the investigation", "Review round 1"]);
    expect(orch[1].messages[1].content).toContain("Findings (latest per cause");
    expect(orch[1].messages[1].content).toContain("Carried over from earlier steps:\nCOMPLETED: round 1 asked billing, tariff, weather, usage");
    // The case file kept the reviews and the audit trail.
    expect(r.reviews.map((v) => [v.round, v.done, v.requests.length, v.by])).toEqual([[1, false, 4, "agent"], [2, true, 0, "agent"]]);
    expect(r.caseFile.audit().some((e) => e.kind === "assertFact" && e.actor === "specialist:weather")).toBe(true);
    expect(trace.steps.map((s) => s.route)).toContain("markovian");
  });

  it("runs a follow-up round and keeps both findings", async () => {
    const { fn, calls } = fake([plan, askUsage, close]);
    const r = await investigate(contract(), "gas", { trace: new Trace(), data: localSource, chatFn: fn });
    expect(r.rounds).toBe(2);
    expect(specialistCalls(calls, "usage")).toHaveLength(2);
    expect(specialistCalls(calls, "usage")[1].messages[1].content).toMatch(/Follow-up from the orchestrator: Look for a household note.*\nYour findings so far: C7 /);
    expect(specialistCalls(calls, "tariff")).toHaveLength(1);
    expect(r.caseFile.history("C7").map((f) => (f.value as { round: number }).round)).toEqual([1, 2]);
    expect(r.findings.find((f) => f.cause === "C7")?.round).toBe(2);
  });

  it(`stops after ${MAX_FOLLOW_UPS} follow-up rounds`, async () => {
    const { fn } = fake([plan, askUsage, askWeather, askUsage]);
    const r = await investigate(contract(), "gas", { trace: new Trace(), data: localSource, chatFn: fn });
    expect(r.rounds).toBe(1 + MAX_FOLLOW_UPS);
    expect(r.reviews.map((v) => v.requests.map((q) => q.specialist))).toEqual([["billing", "tariff", "weather", "usage"], ["usage"], ["weather"], []]);
    expect(r.markovian).toMatchObject({ status: "completed", steps: MAX_FOLLOW_UPS + 2 });
    expect(r.reviews.at(-1)).toMatchObject({ done: true, requests: [] });
  });

  it("falls back to code when Ultra's replies are unusable", async () => {
    const { fn, calls } = fake(["not json", "still not json", "{}", "nope"]);
    const r = await investigate(contract(), "gas", { trace: new Trace(), data: localSource, chatFn: fn });
    expect(r.rounds).toBe(1);
    expect(specialistCalls(calls, "billing")).toHaveLength(1);
    expect(r.reviews.map((v) => [v.done, v.by])).toEqual([[false, "code"], [true, "code"]]);
  });

  it("gives each specialist one follow-up at most", async () => {
    const { fn, calls } = fake([plan, askUsage, askUsage]);
    const r = await investigate(contract(), "gas", { trace: new Trace(), data: localSource, chatFn: fn });
    expect(r.rounds).toBe(2);
    expect(specialistCalls(calls, "usage")).toHaveLength(2);
    const review = calls.filter((c) => c.agent === "orchestrator:gas")[2].messages[1].content;
    expect(review).toContain("Already had their one follow-up: usage.");
    expect(review).toContain("Follow-ups already asked:\n- usage (review 2): Look for a household note on the heating.");
  });

  it("counts a part as accounted for once all its causes are ruled out", async () => {
    const { fn } = fake([plan, close]);
    const r = await investigate(contract(), "gas", { trace: new Trace(), data: localSource, chatFn: fn });
    // Jan gas: +£1.79 use beyond the weather, C7 and C9 both ruled out.
    expect(r.parts.usage_other).toBeGreaterThan(1);
    expect(r.unexplained).toEqual([]);
    expect(r.caseFile.promptContext()).toContain("checked and ruled out (accounted for: too small a change to count as a cause): Use beyond the weather.");
  });

  it("ignores requests for specialists that aren't on the team", async () => {
    const { fn } = fake([plan, JSON.stringify({ done: false, requests: [{ specialist: "leak", task: "Check for a leak." }], note: "" })]);
    const r = await investigate(contract(), "gas", { trace: new Trace(), data: localSource, chatFn: fn });
    expect(r.rounds).toBe(1);
    expect(r.reviews.at(-1)).toMatchObject({ done: true });
  });
});

// A weather specialist that gets C6 wrong on its first run: it claims the
// opposite of what test_cause measured. On a follow-up it agrees, unless stubborn.
function wrongOnWeather(stubborn = false) {
  return (opts: ChatOptions) => {
    const r = diligentSpecialist(opts);
    const followUp = String(opts.messages[1]?.content).startsWith("Follow-up");
    if (opts.agent !== "specialist:weather" || !r.text || (followUp && !stubborn)) return r;
    const report = JSON.parse(r.text);
    for (const f of report.findings) if (f.cause === "C6") f.verdict = f.verdict === "supported" ? "ruled_out" : "supported";
    return { text: JSON.stringify(report), calls: [] };
  };
}

describe("the critique loop", () => {
  it("sends a contradicted verdict back, even when Ultra is ready to close", async () => {
    const { fn, calls } = fake([plan, close, close], wrongOnWeather());
    const r = await investigate(contract(), "gas", { trace: new Trace(), data: localSource, chatFn: fn });
    expect(r.rounds).toBe(2);
    expect(r.reviews[1]).toMatchObject({ done: false, requests: [{ specialist: "weather", by: "code" }] });
    expect(specialistCalls(calls, "weather").at(-1)!.messages[1].content).toContain("Your verdict on C6 (Weather) was ruled out, but test_cause measures");
    // The orchestrator saw the issue in the case file before deciding.
    expect(calls.filter((c) => c.agent === "orchestrator:gas")[1].messages[1].content).toContain("Issues found in code");
    expect(r.findings.find((f) => f.cause === "C6")).toMatchObject({ round: 2, overridden: false, verdict: "supported" });
    expect(r.caseFile.history("C6")).toHaveLength(2);
    const story = r.timeline.map((t) => `${t.actor}: ${t.text} ${(t.detail ?? []).join(" / ")}`);
    expect(story.some((t) => t.startsWith("Code check: The orchestrator was ready to close, but code found issues") && t.includes("sent back to weather"))).toBe(true);
    expect(story.some((t) => t.includes("weather resolved C6: it now agrees with the measurement"))).toBe(true);
  });

  it("sends back causes a specialist didn't test", async () => {
    let firstTariff = true;
    const lazyTariff = (opts: ChatOptions) => {
      if (opts.agent === "specialist:tariff" && firstTariff) {
        firstTariff = false;
        return { text: '{"findings": [], "follow_up": null}', calls: [] as [string, object][] };
      }
      return diligentSpecialist(opts);
    };
    const { fn, calls } = fake([plan, close, close], lazyTariff);
    const r = await investigate(contract(), "gas", { trace: new Trace(), data: localSource, chatFn: fn });
    expect(r.rounds).toBe(2);
    expect(specialistCalls(calls, "tariff").at(-1)!.messages[1].content).toMatch(/You reported without testing C1 .*You reported without testing C2/);
    expect(r.findings.filter((f) => f.specialist === "tariff").map((f) => f.measured_by)).toEqual(["agent", "agent"]);
  });

  it("doesn't send a specialist back twice", async () => {
    const { fn } = fake([plan, close, close, close], wrongOnWeather(true));
    const r = await investigate(contract(), "gas", { trace: new Trace(), data: localSource, chatFn: fn });
    expect(r.rounds).toBe(2);
    expect(r.findings.find((f) => f.cause === "C6")).toMatchObject({ overridden: true, verdict: "supported" });
    expect(r.timeline.flatMap((t) => t.detail ?? [])).toContain("weather still disagrees on C6; the measurement stands");
  });
});

describe("runOrchestrator with data", () => {
  const scout = createScout({ secret: SECRET });

  it("runs the investigation", async () => {
    const { fn } = fake([plan, close]);
    const r = await runOrchestrator(contract(), { scout, trace: new Trace(), data: localSource, chatFn: fn });
    expect(r.status).toBe("done");
    expect(r.investigation?.findings).toHaveLength(8);
  });

  it("reports an error when the bills aren't found", async () => {
    const r = await runOrchestrator(contract("X", "Y"), { scout, trace: new Trace(), data: localSource, chatFn: fake([]).fn });
    expect(r).toMatchObject({ status: "error", reason: "bills not found: X, Y" });
  });
});
