// Turns one utility's investigation into the answer the page shows. Code
// builds the facts table, the causes and the next steps; Nemotron Ultra
// writes the text with {F#} placeholders and [E#] citations; the checker
// (verify.ts) reads it before anyone else does. If the checker finds
// problems, the writer gets one rewrite with the list; if that fails too,
// the answer is a plain template built from the facts.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type { CauseId } from "../billmodel/causes.ts";
import type { PartId } from "../billmodel/decompose.ts";
import { CAUSE_NAMES } from "../lib/labels.ts";
import type { Answer, Note } from "../lib/types.ts";
import { PART_CAUSES } from "../memory/casefile.ts";
import { buildFacts, causesTable, components, nextSteps, type AnswerFact, type FactsTable } from "./facts.ts";
import { chat, deepModel, type Message } from "./llm.ts";
import { parseReport, type ChatFn } from "./loop.ts";
import type { InvestigationResult } from "./orchestrators/investigate.ts";
import type { Trace } from "./trace.ts";
import { check } from "./verify.ts";

const WRITER = readFileSync(resolve("src/agent/prompts/writer.md"), "utf8");
const Written = z.object({ answer_markdown: z.string().min(1).max(2000) });

const cite = (ids: string[]) => ids.map((id) => `[${id}]`).join("");
const supportedCauses = (r: InvestigationResult) => r.findings.filter((f) => f.verdict === "supported").map((f) => f.cause);

function factsFor(table: FactsTable, cause: CauseId): AnswerFact[] {
  return table.facts.filter((f) => f.cause === cause || (f.key.startsWith("part:") && PART_CAUSES[f.key.slice(5) as PartId].includes(cause)));
}

function writerBrief(question: string, r: InvestigationResult, table: FactsTable, notes: Note[]): string {
  const ruledOut = r.findings.filter((f) => f.verdict !== "supported").map((f) => CAUSE_NAMES[f.cause]);
  return [
    `Question: "${question}"`,
    `${r.utility[0].toUpperCase()}${r.utility.slice(1)} bills: ${r.a.label}, then ${r.b.label}.`,
    "",
    "Facts table:",
    ...table.facts.map((f) => `- {${f.id}} = ${f.value}: ${f.meaning} ${cite(f.evidence)}${f.required ? " (must use)" : ""}`),
    "",
    "Supported causes (give these as the reasons):",
    ...supportedCauses(r).map((c) => {
      const f = r.findings.find((x) => x.cause === c)!;
      return `- ${CAUSE_NAMES[c]}: facts ${factsFor(table, c).map((x) => `{${x.id}}`).join(", ") || "none"}; evidence ${cite([...f.evidence, ...f.memory])}`;
    }),
    `Checked and ruled out or not enough data: ${ruledOut.join(", ") || "none"}.`,
    notes.length ? `Household notes: ${notes.map((n) => `[${n.id}] "${n.text}"`).join("; ")}` : "Household notes: none.",
  ].join("\n");
}

// The fallback: one sentence for the change, one per supported part.
export function templateAnswer(r: InvestigationResult, table: FactsTable): string {
  const fact = (k: string) => table.byKey.get(k)!;
  const supported = new Set(supportedCauses(r));
  const phrase: Record<PartId, () => string> = {
    period: () => "The difference in the number of days on the bill",
    weather: () => "The weather",
    usage_other: () => (supported.has("C8") ? "Extra water use beyond the weather, which may be a leak," : supported.has("C9") ? "Switching from gas to electric heating" : "A change in how much you used, beyond the weather,"),
    unit_price: () => "The change in unit rate",
    standing: () => "The change in standing charge",
    estimate: () => "Correcting an estimated reading",
    oneoff: () => "A credit or one-off charge",
  };
  const change = fact("change");
  const lines = [`Your ${r.utility} bill went ${r.change >= 0 ? "up" : "down"} by {${change.id}}, from {${fact("total_a").id}} to {${fact("total_b").id}} ${cite(change.evidence)}.`];
  const parts = table.facts.filter((f) => f.key.startsWith("part:"));
  for (const f of parts) {
    const p = f.key.slice(5) as PartId;
    lines.push(`${phrase[p]()} ${r.parts[p] >= 0 ? "added" : "took off"} {${f.id}} ${cite(f.evidence)}.`);
  }
  if (!parts.length) lines.push("Nothing on the bill changed enough to count as a cause.");
  return lines.join(" ");
}

export interface Checked {
  by: "writer" | "rewrite" | "template";
  problems: string[][]; // the checker's findings on each attempt that failed
}

export async function composeAnswer(question: string, r: InvestigationResult, ctx: { trace: Trace; chatFn?: ChatFn; notes?: Note[] }): Promise<Answer & { checked: Checked }> {
  const chatFn = ctx.chatFn ?? chat;
  const table = buildFacts(r);
  const parts = components(r);
  const memoryIds = [...new Set(r.findings.flatMap((f) => f.memory))];
  const notes = (ctx.notes ?? []).filter((n) => memoryIds.includes(n.id));
  const inspect = (text: string) =>
    check({ text, facts: table.facts, components: parts, change: r.change, findings: r.findings, measured: r.measured, evidenceIds: r.evidence.map((e) => e.id), memoryIds: notes.map((n) => n.id) });
  const step = (label: string, ms: number, detail?: Record<string, unknown>) => ctx.trace.add({ step: "check", agent: "checker", label, route: "code", model: null, ms, detail });

  const messages: Message[] = [
    { role: "system", content: WRITER },
    { role: "user", content: writerBrief(question, r, table, notes) },
  ];
  const problems: string[][] = [];
  let text = "";
  let by: Checked["by"] = "template";
  for (const attempt of ["writer", "rewrite"] as const) {
    let draft: string;
    try {
      const res = await chatFn({ agent: "writer", label: attempt === "writer" ? "Write the answer" : "Rewrite the answer", model: deepModel(), messages, maxTokens: 1200, trace: ctx.trace });
      const parsed = parseReport(res.text, Written);
      messages.push({ role: "assistant", content: res.text });
      if (!parsed.ok) {
        problems.push([`The reply wasn't the JSON asked for: ${parsed.error}`]);
        messages.push({ role: "user", content: `That wasn't usable: ${parsed.error}. Reply with only the JSON object.` });
        continue;
      }
      draft = parsed.value.answer_markdown.trim();
    } catch (err) {
      problems.push([`The writer failed: ${(err as Error).message.slice(0, 120)}`]);
      break;
    }
    const started = performance.now();
    const found = inspect(draft);
    const ms = Math.round(performance.now() - started);
    if (!found.length) {
      step(`Checked the answer: passed${attempt === "rewrite" ? " on the rewrite" : ""}`, ms);
      text = draft;
      by = attempt;
      break;
    }
    problems.push(found);
    step(`Checker found ${found.length} problem${found.length === 1 ? "" : "s"}${attempt === "writer" ? "; asked for a rewrite" : ""}`, ms, { problems: found });
    messages.push({ role: "user", content: `The checker found these problems:\n${found.map((p) => `- ${p}`).join("\n")}\nRewrite the answer to fix them. Reply with only the JSON object.` });
  }
  if (!text) {
    text = templateAnswer(r, table);
    const left = inspect(text);
    step(left.length ? `Used the template answer (checker: ${left.join(" ")})` : "Used the template answer: checked, passed", 0);
  }

  return {
    question,
    utility: r.utility,
    bill_a: r.a.bill_id,
    bill_b: r.b.bill_id,
    total_a: r.a.total_gbp,
    total_b: r.b.total_gbp,
    change_gbp: r.change,
    components: parts,
    causes: causesTable(r),
    facts: table.facts.map(({ id, value, evidence }) => ({ id, value, evidence })),
    answer_markdown: text,
    next_steps: nextSteps(r),
    evidence: r.evidence.map(({ id, title, sql, rows, sha256, at }) => ({ id, title, sql, rows, sha256, at })),
    memory: notes,
    trace: ctx.trace.steps,
    checked: { by, problems },
  };
}
