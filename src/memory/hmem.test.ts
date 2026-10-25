import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { composeAnswer } from "../agent/answer.ts";
import type { ChatOptions, ChatResult, ToolCall } from "../agent/llm.ts";
import { investigate } from "../agent/orchestrators/investigate.ts";
import { Trace } from "../agent/trace.ts";
import { localSource } from "../data/local.ts";
import { issueContract } from "../scout/contract.ts";
import { HouseholdMemory, noteDate } from "./hmem.ts";

const PUMP = "We installed a heat pump on 15 March 2026";

describe("HouseholdMemory", () => {
  it("numbers notes M1, M2 and reads the date they talk about", () => {
    const mem = new HouseholdMemory();
    expect(mem.addNote(PUMP)).toMatchObject({ id: "M1", text: PUMP });
    expect(mem.addNote("My son moved back home in June 2026").id).toBe("M2");
    expect(mem.notes().map((n) => n.id)).toEqual(["M1", "M2"]);
    expect([noteDate(PUMP), noteDate("in June 2026"), noteDate("no date here")]).toEqual(["2026-03-15", "2026-06-01", null]);
  });

  it("recalls notes ranked by H-MEM, leaving out notes dated after the bills", async () => {
    const mem = new HouseholdMemory();
    mem.addNote("My son moved back home in June 2026");
    mem.addNote(PUMP);
    const april = await mem.recall("heat pump", { utility: "electricity", from: "2026-03-01", to: "2026-04-30" });
    expect(april.map((n) => n.id)).toEqual(["M2"]);
    const summer = await mem.recall("heat pump", { utility: "electricity", from: "2026-06-01", to: "2026-07-31" });
    expect(summer.map((n) => n.id)).toEqual(["M2", "M1"]);
    expect(summer[0].relevance).toBeGreaterThan(summer[1].relevance);
    expect(mem.audit().map((e) => e.action)).toEqual(["create", "create", "read", "read", "read", "read"]); // each recall reads both notes
  });

  it("keeps notes and the ledger on disk", () => {
    const dir = mkdtempSync(join(tmpdir(), "hmem-"));
    try {
      new HouseholdMemory({ persistDir: dir }).addNote(PUMP);
      const again = new HouseholdMemory({ persistDir: dir });
      expect(again.notes()).toEqual([expect.objectContaining({ id: "M1", text: PUMP })]);
      expect(again.audit()[0]).toMatchObject({ action: "create", actor: "whybill" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// April electricity, before and after the heat pump note. The usage agent
// recalls notes, and passes M1 to the fuel-switch test when it has it.
async function aprilElectricity(mem: HouseholdMemory) {
  const contract = issueContract(
    {
      traceId: "t",
      intent: { primary: { id: "bill.explain.electricity", version: 1 }, parameters: {}, references: { bill_a: "A-E-202603", bill_b: "A-E-202604" }, confidence: 1, alternates: [] },
      risk: { level: "low", flags: [], redactions: [], approvals: [] },
      toolPlan: [],
      modelProfile: { id: "nemotron-ultra", model: "fake" },
      scope: { user: {}, surface: "web", capabilities: ["bills.read", "reads.read", "tariffs.read", "weather.read", "memory.recall"] },
      registryVersion: 1,
      policyPackVersion: "whybill@1",
    },
    "test-secret",
  );
  const steps = new Map<string, number>();
  const chatFn = async (opts: ChatOptions): Promise<ChatResult> => {
    const n = (steps.get(opts.agent) ?? 0) + 1;
    steps.set(opts.agent, n);
    let calls: [string, object][] = [];
    let text = '{"findings": [], "follow_up": null}';
    if (opts.agent.startsWith("orchestrator:")) text = JSON.stringify(n === 1 ? { done: false, requests: [], note: "" } : { done: true, requests: [], note: "Done." });
    if (opts.agent === "specialist:usage" && n === 1) calls = [["recall_notes", { query: "heat pump" }]];
    if (opts.agent === "specialist:usage" && n === 2) {
      const recalled = JSON.parse(String(opts.messages.at(-1)!.content)) as { notes: { id: string }[] };
      calls = [["test_cause", { cause: "C9", notes: recalled.notes.map((x) => x.id) }]];
    }
    if (opts.agent === "writer") text = "";
    const toolCalls: ToolCall[] = calls.map(([name, args], i) => ({ id: `c${n}-${i}`, type: "function", function: { name, arguments: JSON.stringify(args) } }));
    return { text: calls.length ? "" : text, reasoning: "", message: { role: "assistant", content: "", tool_calls: toolCalls }, toolCalls, route: "nightshift", model: "fake", receipt: null, cached: false, ms: 1 };
  };
  const trace = new Trace();
  const r = await investigate(contract, "electricity", { trace, data: localSource, memory: mem, chatFn });
  return composeAnswer("Why did my electricity bill change in April?", r, { trace, chatFn, notes: mem.notes() });
}

describe("the heat pump note", () => {
  it("changes the answer once it's added, and the ledger shows it created and recalled", async () => {
    const mem = new HouseholdMemory();
    const before = await aprilElectricity(mem);
    expect(before.memory).toEqual([]);
    expect(before.answer_markdown).not.toContain("[M1]");

    mem.addNote(PUMP);
    const after = await aprilElectricity(mem);
    expect(after.checked.by).toBe("template");
    expect(after.causes.find((c) => c.id === "C9")).toMatchObject({ verdict: "supported", memory: ["M1"] });
    expect(after.memory).toEqual([expect.objectContaining({ id: "M1", text: PUMP })]);
    expect(after.answer_markdown).toContain("[M1]");
    expect(after.answer_markdown).not.toBe(before.answer_markdown);
    expect(mem.audit().map((e) => [e.action, e.memoryId])).toEqual([["create", "mem-1"], ["read", "mem-1"]]);

    mem.saveFindings(after);
    expect(mem.findings({ bill_a: "A-E-202603", bill_b: "A-E-202604" }).map((r) => r.tags.find((t) => /^C\d$/.test(t)))).toEqual(after.causes.filter((c) => c.verdict === "supported").map((c) => c.id));
    expect(mem.feedback(after, true)).toBe(1 + mem.findings().length);
    expect(mem.audit().filter((e) => e.action === "feedback")).toHaveLength(1 + mem.findings().length);
  });

  it("refuses a note id the agent didn't recall", async () => {
    const mem = new HouseholdMemory();
    const { testCauseTool } = await import("../agent/tools/index.ts");
    const { openInvestigation } = await import("../agent/investigation.ts");
    const { rows } = await localSource.bills({ utility: "electricity" });
    const inv = openInvestigation({ utility: "electricity", contract: {} as never, data: localSource, a: rows[0], b: rows[1], trace: new Trace(), memory: mem });
    expect(await testCauseTool(["C9"]).run({ cause: "C9", notes: ["M7"] }, inv)).toEqual({ error: expect.stringContaining("M7 isn't a note you recalled") });
  });
});
