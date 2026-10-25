import { describe, expect, it } from "vitest";
import { z } from "zod";
import { localSource } from "../data/local.ts";
import { issueContract } from "../scout/contract.ts";
import { EvidenceLog, type Investigation } from "./investigation.ts";
import type { ChatOptions, ChatResult, ToolCall } from "./llm.ts";
import { runAgent, type AgentSpec } from "./loop.ts";
import { getBills, getTariff, testCauseTool, toSpec } from "./tools/index.ts";
import { Trace } from "./trace.ts";

const { rows: bills } = await localSource.bills();
const bill = (id: string) => bills.find((b) => b.bill_id === id)!;

function investigation(capabilities = ["bills.read", "reads.read", "tariffs.read", "weather.read"]): Investigation {
  const contract = issueContract(
    {
      traceId: "t",
      intent: { primary: { id: "bill.explain.gas", version: 1 }, parameters: {}, references: {}, confidence: 1, alternates: [] },
      risk: { level: "low", flags: [], redactions: [], approvals: [] },
      toolPlan: [],
      modelProfile: { id: "nemotron-lightning", model: "fake" },
      scope: { user: {}, surface: "web", capabilities },
      registryVersion: 1,
      policyPackVersion: "whybill@1",
    },
    "test-secret",
  );
  return { utility: "gas", contract, data: localSource, a: bill("A-G-202512"), b: bill("A-G-202601"), evidence: new EvidenceLog(), trace: new Trace(), measured: new Map(), cache: new Map() };
}

// A fake model that plays back scripted turns: tool calls, or a final text.
function scripted(turns: ({ calls: [string, object][] } | { text: string })[]) {
  const seen: ChatOptions[] = [];
  let n = 0;
  const fn = async (opts: ChatOptions): Promise<ChatResult> => {
    seen.push(structuredClone(opts));
    const turn = turns[n++] ?? { text: "" };
    const toolCalls: ToolCall[] = "calls" in turn ? turn.calls.map(([name, args], i) => ({ id: `call-${n}-${i}`, type: "function", function: { name, arguments: JSON.stringify(args) } })) : [];
    const text = "text" in turn ? turn.text : "";
    return { text, message: { role: "assistant", content: text, tool_calls: toolCalls }, toolCalls, route: "nightshift", model: "fake", receipt: null, cached: false, ms: 1 };
  };
  return { fn, seen };
}

const Report = z.object({ cause: z.string(), verdict: z.enum(["supported", "ruled_out", "inconclusive"]) });
const spec: AgentSpec<z.infer<typeof Report>> = {
  name: "specialist:test",
  model: "fake",
  system: "You test causes.",
  tools: [getBills, getTariff, testCauseTool(["C1", "C3"])],
  report: Report,
  reportShape: '{"cause": "C3", "verdict": "supported"}',
};

describe("runAgent", () => {
  it("runs the tools the model asks for and returns its report", async () => {
    const inv = investigation();
    const { fn, seen } = scripted([{ calls: [["get_bills", {}], ["test_cause", { cause: "C3" }]] }, { text: '{"cause": "C3", "verdict": "supported"}' }]);
    const run = await runAgent(spec, "Test C3.", inv, fn);
    expect(run).toMatchObject({ report: { cause: "C3", verdict: "supported" }, steps: 2, toolCalls: 2 });
    expect(inv.measured.get("C3")).toMatchObject({ passes: true, value: 7 });
    // The second call carried both tool results back to the model.
    expect(seen[1].messages.filter((m) => m.role === "tool")).toHaveLength(2);
    expect(inv.evidence.records.map((r) => r.id)).toEqual(["E1", "E2"]);
    expect(inv.trace.steps.filter((s) => s.step === "tool").map((s) => s.label)).toEqual(["get_bills", 'test_cause({"cause":"C3"})']);
  });

  it("refuses a tool the contract doesn't allow, and tells the model", async () => {
    const inv = investigation(["bills.read"]);
    const { fn, seen } = scripted([{ calls: [["get_tariff", {}]] }, { text: '{"cause": "C1", "verdict": "inconclusive"}' }]);
    const run = await runAgent(spec, "Test C1.", inv, fn);
    expect(run.report?.verdict).toBe("inconclusive");
    expect(seen[1].messages.at(-1)?.content).toContain("Not allowed by this investigation's contract: tariffs.read");
    expect(inv.trace.steps.some((s) => s.label?.startsWith("get_tariff refused"))).toBe(true);
  });

  it("rejects a cause the specialist doesn't own", async () => {
    const inv = investigation();
    const { fn, seen } = scripted([{ calls: [["test_cause", { cause: "C9" }]] }, { text: '{"cause": "C1", "verdict": "inconclusive"}' }]);
    await runAgent(spec, "Test.", inv, fn);
    expect(seen[1].messages.at(-1)?.content).toContain("Bad input for test_cause");
    expect(inv.measured.size).toBe(0);
  });

  it("asks again when the report doesn't fit the schema", async () => {
    const inv = investigation();
    const { fn } = scripted([{ text: "It was the weather, probably." }, { text: '{"cause": "C3", "verdict": "ruled_out"}' }]);
    const run = await runAgent(spec, "Test.", inv, fn);
    expect(run).toMatchObject({ report: { verdict: "ruled_out" }, steps: 2 });
  });

  it("gives up after maxSteps", async () => {
    const inv = investigation();
    const { fn } = scripted(Array.from({ length: 5 }, () => ({ calls: [["get_bills", {}]] as [string, object][] })));
    const run = await runAgent({ ...spec, maxSteps: 3 }, "Test.", inv, fn);
    expect(run).toMatchObject({ report: null, steps: 3, error: "ran out of steps" });
  });
});

describe("tool specs", () => {
  it("describe test_cause's input as JSON Schema", () => {
    const s = toSpec(testCauseTool(["C1", "C2"]));
    expect(s.function.parameters).toMatchObject({ type: "object", properties: { cause: { type: "string", enum: ["C1", "C2"] } }, required: ["cause"] });
  });
});
