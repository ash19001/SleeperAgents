// Fake model replies for tests. Not used by the app.

import type { ChatOptions, ChatResult, ToolCall } from "./llm.ts";

export function fakeReply(text: string, calls: [string, object][] = [], n = 0): ChatResult {
  const toolCalls: ToolCall[] = calls.map(([name, args], i) => ({ id: `call-${n}-${i}`, type: "function", function: { name, arguments: JSON.stringify(args) } }));
  return { text, message: { role: "assistant", content: text, tool_calls: toolCalls }, toolCalls, route: "nightshift", model: "fake", receipt: null, cached: false, ms: 1 };
}

// A specialist that does its job: on its first turn it tests every cause it
// owns with test_cause; then it reports the verdicts the measurements gave.
export function diligentSpecialist(opts: ChatOptions): { text: string; calls: [string, object][] } {
  const tool = opts.tools?.find((t) => t.function.name === "test_cause");
  const owned = ((tool?.function.parameters as { properties?: { cause?: { enum?: string[] } } })?.properties?.cause?.enum ?? []) as string[];
  type Result = { cause: string; passes: boolean | null; evidence: string[] };
  const results = opts.messages
    .filter((m) => m.role === "tool")
    .flatMap((m): Result[] => {
      try {
        return (JSON.parse(m.content ?? "") as { results?: Result[] }).results ?? [];
      } catch {
        return [];
      }
    });
  if (!results.length && owned.length) return { text: "", calls: [["test_cause", { causes: owned }]] };
  const verdict = (p: boolean | null) => (p === true ? "supported" : p === false ? "ruled_out" : "inconclusive");
  const findings = results.map((r) => ({ cause: r.cause, verdict: verdict(r.passes), evidence: r.evidence ?? [], memory: [], reasoning: "Measured with test_cause." }));
  return { text: JSON.stringify({ findings, follow_up: null }), calls: [] };
}
