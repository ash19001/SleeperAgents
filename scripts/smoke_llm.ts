// Smoke test for src/agent/llm.ts: Nightshift is up, both Nemotron models
// answer through it, a tool call works, and every call lands in the trace.
// Never prints tokens or keys.

import { chat, deepModel, fastModel, type ToolSpec } from "../src/agent/llm.ts";
import { Trace } from "../src/agent/trace.ts";

process.loadEnvFile(".env.local");

const results: boolean[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  results.push(ok);
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? `: ${detail}` : ""}`);
};

// 1. Nightshift answers and lists its routing modes.
try {
  const res = await fetch(`${process.env.NIGHTSHIFT_BASE_URL}/models`, {
    headers: { Authorization: `Bearer ${process.env.NIGHTSHIFT_TOKEN}` },
    signal: AbortSignal.timeout(10_000),
  });
  check("Nightshift /models", res.ok, res.ok ? "online" : `HTTP ${res.status}`);
} catch (err) {
  check("Nightshift /models", false, `no answer (${(err as Error).message})`);
}

const trace = new Trace();

// 2. Both models answer through Nightshift, with a receipt.
for (const model of [fastModel(), deepModel()]) {
  try {
    const r = await chat({
      agent: "smoke",
      label: "Say which model you are",
      model,
      messages: [{ role: "user", content: "Reply with one short sentence saying which model you are." }],
      trace,
    });
    const ok = r.route === "nightshift" && /nemotron/i.test(r.model) && Boolean(r.text) && Boolean(r.receipt) && !r.text.includes("</think>");
    check(`chat ${model}`, ok, `${r.route}, ${r.model}, receipt ${r.receipt}, ${r.ms} ms: ${r.text.slice(0, 80)}`);
  } catch (err) {
    check(`chat ${model}`, false, (err as Error).message);
  }
}

// 3. The fast model calls a tool.
const tools: ToolSpec[] = [{
  type: "function",
  function: {
    name: "get_bill_total",
    description: "Return the total in pounds of one household bill.",
    parameters: { type: "object", properties: { bill_id: { type: "string" } }, required: ["bill_id"] },
  },
}];
try {
  const r = await chat({
    agent: "smoke",
    label: "Tool call",
    model: fastModel(),
    messages: [
      { role: "system", content: "Use tools for every number." },
      { role: "user", content: "How much was gas bill GAS-2026-01?" },
    ],
    tools,
    trace,
  });
  const call = r.toolCalls[0];
  check("tool call", call?.function.name === "get_bill_total" && call.function.arguments.includes("GAS-2026-01"), call ? `${call.function.name}(${call.function.arguments})` : "no tool call");
} catch (err) {
  check("tool call", false, (err as Error).message);
}

// 4. Every call was traced.
check("trace", trace.steps.length === 3, `${trace.steps.length} steps recorded`);

process.exitCode = results.every(Boolean) ? 0 : 1;
