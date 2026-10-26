// The agent loop every agent runs: call the model with its tools, run the
// tools it asks for (each checked against the contract's capabilities),
// hand back the results, and stop when it replies with a report that fits
// its schema, or after maxSteps model calls.

import { z } from "zod";
import { chat, type ChatOptions, type ChatResult, type Message } from "./llm.ts";
import type { Investigation } from "./investigation.ts";
import { toSpec, type Tool } from "./tools/index.ts";

export interface AgentSpec<R> {
  name: string; // "specialist:billing"
  model: string;
  system: string;
  tools: Tool[];
  report: z.ZodType<R>;
  reportShape: string; // the JSON shape to reply with, shown to the model
  maxSteps?: number;
  thinking?: boolean;
}

export interface AgentRun<R> {
  report: R | null; // null when it ran out of steps or never gave a usable report
  steps: number;
  toolCalls: number;
  error?: string;
  callFailed?: boolean; // a model call failed (rather than the agent running out of steps)
}

export type ChatFn = (opts: ChatOptions) => Promise<ChatResult>;

export function parseReport<R>(text: string, schema: z.ZodType<R>): { ok: true; value: R } | { ok: false; error: string } {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) return { ok: false, error: "no JSON object in the reply" };
  try {
    const parsed = schema.safeParse(JSON.parse(text.slice(start, end + 1)));
    return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  } catch (err) {
    return { ok: false, error: `not valid JSON (${(err as Error).message})` };
  }
}

// Tools that only read data; the rest (get_split, test_cause) work it out in code.
const DATA_TOOLS = new Set(["get_bills", "get_meter_readings", "get_tariff", "get_weather"]);

async function runTool(tool: Tool | undefined, name: string, rawArgs: string, inv: Investigation, agent: string): Promise<unknown> {
  const started = performance.now();
  const step = (label: string, route: string) =>
    inv.trace.add({ step: "tool", agent, label, route, model: null, ms: Math.round((performance.now() - started) * 10) / 10 });
  if (!tool) {
    step(`${name}: no such tool`, "code");
    return { error: `There is no tool called ${name}.` };
  }
  // The contract decides what this investigation may read.
  const missing = tool.needs(inv).filter((c) => !inv.contract.scope.capabilities.includes(c));
  if (missing.length) {
    step(`${name} refused: the contract doesn't allow ${missing.join(", ")}`, "code");
    return { error: `Not allowed by this investigation's contract: ${missing.join(", ")}.` };
  }
  let args: unknown;
  try {
    args = tool.input.parse(rawArgs ? JSON.parse(rawArgs) : {});
  } catch (err) {
    step(`${name}: bad input`, "code");
    return { error: `Bad input for ${name}: ${(err as Error).message.slice(0, 200)}` };
  }
  try {
    // Its own read counter (everything else shared), so parallel tool calls
    // each know whether they sent a query or used data read earlier.
    const call = { ...inv, reads: 0 };
    const result = await tool.run(args, call);
    inv.reads += call.reads;
    const shown = rawArgs && rawArgs !== "{}" ? `${name}(${rawArgs})` : name;
    step(shown, name === "recall_notes" ? "h-mem" : call.reads > 0 ? inv.data.name : DATA_TOOLS.has(name) ? "cache" : "code");
    return result;
  } catch (err) {
    step(`${name} failed`, "code");
    return { error: `${name} failed: ${(err as Error).message.slice(0, 200)}` };
  }
}

export async function runAgent<R>(spec: AgentSpec<R>, task: string, inv: Investigation, chatFn: ChatFn = chat): Promise<AgentRun<R>> {
  const maxSteps = spec.maxSteps ?? 6;
  const byName = new Map(spec.tools.map((t) => [t.name, t]));
  const messages: Message[] = [
    { role: "system", content: spec.system },
    { role: "user", content: `${task}\n\nUse your tools for every fact and number. When you're done, reply with only this JSON object:\n${spec.reportShape}` },
  ];
  let toolCalls = 0;
  for (let step = 1; step <= maxSteps; step++) {
    // The last step offers no tools, so the agent reports with what it has.
    const last = step === maxSteps && maxSteps > 1;
    if (last) messages.push({ role: "user", content: `No more tool calls. Reply now with only the JSON object:\n${spec.reportShape}` });
    let res: ChatResult;
    try {
      res = await chatFn({ agent: spec.name, label: step === 1 ? "Start the task" : last ? "Report" : `Step ${step}`, model: spec.model, messages, tools: last ? undefined : spec.tools.map(toSpec), thinking: spec.thinking, trace: inv.trace });
    } catch (err) {
      return { report: null, steps: step, toolCalls, error: (err as Error).message, callFailed: true };
    }
    if (last && res.toolCalls.length) break;
    if (res.toolCalls.length) {
      messages.push({ role: "assistant", content: res.message.content ?? "", tool_calls: res.toolCalls });
      const results = await Promise.all(res.toolCalls.map((c) => runTool(byName.get(c.function.name), c.function.name, c.function.arguments, inv, spec.name)));
      res.toolCalls.forEach((c, i) => messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(results[i]) }));
      toolCalls += res.toolCalls.length;
      continue;
    }
    const parsed = parseReport(res.text, spec.report);
    if (parsed.ok) return { report: parsed.value, steps: step, toolCalls };
    messages.push({ role: "assistant", content: res.text }, { role: "user", content: `That report wasn't usable: ${parsed.error}. Reply with only the JSON object.` });
  }
  return { report: null, steps: maxSteps, toolCalls, error: "ran out of steps" };
}
