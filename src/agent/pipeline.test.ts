import { describe, expect, it } from "vitest";
import { localSource } from "../data/local.ts";
import { HouseholdMemory } from "../memory/hmem.ts";
import type { Intake } from "./intake.ts";
import { diligentSpecialist, fakeReply } from "./fakes.ts";
import type { ChatOptions, ChatResult } from "./llm.ts";
import { answerQuestion } from "./pipeline.ts";
import { createScout } from "./scout.ts";

const scout = createScout({ secret: "test-secret-not-for-use" });
const { rows: bills } = await localSource.bills();
let n = 0;
const user = () => ({ id: `pipeline-${n++}`, role: "household" });

// Orchestrators plan then close; specialists test their causes and report;
// the writer and combiner reply with nothing, so the checked templates are used.
function fake() {
  const seen = new Map<string, number>();
  return async (opts: ChatOptions): Promise<ChatResult> => {
    const k = (seen.get(opts.agent) ?? 0) + 1;
    seen.set(opts.agent, k);
    if (opts.agent.startsWith("specialist:")) {
      const r = diligentSpecialist(opts);
      return fakeReply(r.text, r.calls, k);
    }
    return fakeReply(opts.agent.startsWith("orchestrator:") ? JSON.stringify({ done: k > 1, requests: [], note: "" }) : "");
  };
}
const intake = (requests: Intake["requests"]) => async () => ({ requests, unclear: null }) as Intake;

describe("answerQuestion", () => {
  it("answers one utility", async () => {
    const memory = new HouseholdMemory();
    const r = await answerQuestion("Why did my gas bill go up in January?", {
      bills, scout, user: user(), data: localSource, memory, chatFn: fake(),
      intake: intake([{ utility: "gas", period: "2026-01", direction: "up" }]),
    });
    expect(r.kind).toBe("answer");
    if (r.kind !== "answer") return;
    expect(r.answer).toMatchObject({ utility: "gas", bill_a: "A-G-202512", bill_b: "A-G-202601", checked: { by: "template" } });
    expect(r.answer.evidence[0].source).toBe("local-sample");
    // One trace for the whole question: Scout, the orchestrator, the checker.
    const agents = new Set(r.answer.trace.map((s) => s.agent));
    for (const a of ["scout", "orchestrator:gas", "checker"]) expect(agents.has(a), a).toBe(true);
    // The supported causes went into H-MEM as findings.
    expect(memory.findings({ bill_a: "A-G-202512", bill_b: "A-G-202601" }).length).toBe(r.answer.causes.filter((c) => c.verdict === "supported").length);
  });

  it("answers gas and electricity together, linked by the fuel switch", async () => {
    const r = await answerQuestion("Why did my energy bills change in April?", {
      bills, scout, user: user(), data: localSource, chatFn: fake(),
      intake: intake([
        { utility: "electricity", period: "2026-04", direction: "change" },
        { utility: "gas", period: "2026-04", direction: "change" },
      ]),
    });
    expect(r.kind).toBe("answers");
    if (r.kind !== "answers") return;
    expect(r.answers.map((a) => a.utility)).toEqual(["electricity", "gas"]);
    expect(r.summary_markdown).toContain("Both come from the same change");
    expect(r.notes).toEqual([]);
    expect(r.trace.some((s) => s.label === "Used the template summary")).toBe(true);
  });

  it("passes clarifying questions straight through", async () => {
    const r = await answerQuestion("Why is my bill so high?", { bills, scout, user: user(), data: localSource, chatFn: fake(), intake: async () => ({ requests: [], unclear: { question: "Which bill do you mean?", options: ["gas", "electricity"] } }) });
    expect(r.kind).toBe("clarify");
  });
});
