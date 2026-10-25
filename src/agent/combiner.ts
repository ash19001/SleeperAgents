// The combiner, for questions about two or more utilities: Nemotron Ultra
// writes a short summary above the per-utility answers, linking them where
// they connect (a fuel switch shows as gas down and electricity up). Same
// rules as the writer: numbers only as {F#} from its own small facts table,
// checked in code, one rewrite, then a template.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { CAUSE_NAMES } from "../lib/labels.ts";
import type { Answer, Fact } from "../lib/types.ts";
import type { AnswerFact } from "./facts.ts";
import { chat, deepModel, type Message } from "./llm.ts";
import { parseReport, type ChatFn } from "./loop.ts";
import type { Trace } from "./trace.ts";
import { check } from "./verify.ts";

const COMBINER = readFileSync(resolve("src/agent/prompts/combiner.md"), "utf8");
const Written = z.object({ summary_markdown: z.string().min(1).max(1200) });

export interface Combined {
  summary_markdown: string;
  summary_facts: Fact[];
  by: "writer" | "rewrite" | "template";
}

export const fuelSwitch = (answers: Answer[]) => answers.some((a) => a.causes.some((c) => c.id === "C9" && c.verdict === "supported"));

export async function combine(question: string, answers: Answer[], ctx: { trace: Trace; chatFn?: ChatFn }): Promise<Combined> {
  const chatFn = ctx.chatFn ?? chat;
  const facts: AnswerFact[] = answers.map((a, i) => ({
    id: `F${i + 1}`,
    key: `change:${a.utility}`,
    value: `£${Math.abs(a.change_gbp).toFixed(2)}`,
    evidence: [],
    meaning: `how much the ${a.utility} bill went ${a.change_gbp >= 0 ? "up" : "down"}`,
    required: true,
  }));
  const switched = fuelSwitch(answers);
  const brief = [
    `Question: "${question}"`,
    "",
    "Facts table:",
    ...facts.map((f) => `- {${f.id}} = ${f.value}: ${f.meaning} (must use)`),
    "",
    ...answers.map((a) => {
      const main = a.causes.filter((c) => c.verdict === "supported").sort((x, y) => Math.abs(y.effect_gbp) - Math.abs(x.effect_gbp)).slice(0, 3);
      return `${a.utility[0].toUpperCase()}${a.utility.slice(1)} (${a.bill_a} to ${a.bill_b}): main reasons ${main.map((c) => CAUSE_NAMES[c.id]).join(", ") || "none over the thresholds"}.`;
    }),
    switched ? "Fuel switch: supported. The fall in gas and the rise in electricity beyond the weather are the same change: the household now heats with electricity." : "Fuel switch: not supported. Don't link the bills by a switch.",
  ].join("\n");
  const inspect = (text: string) => check({ text, facts, components: [], change: 0, findings: [], measured: {}, evidenceIds: [], memoryIds: [] });
  const step = (label: string, detail?: Record<string, unknown>) => ctx.trace.add({ step: "check", agent: "checker", label, route: "code", model: null, ms: 0, detail });

  const messages: Message[] = [
    { role: "system", content: COMBINER },
    { role: "user", content: brief },
  ];
  for (const attempt of ["writer", "rewrite"] as const) {
    let draft: string;
    try {
      const res = await chatFn({ agent: "combiner", label: attempt === "writer" ? "Write the summary" : "Rewrite the summary", model: deepModel(), messages, maxTokens: 800, trace: ctx.trace });
      const parsed = parseReport(res.text, Written);
      messages.push({ role: "assistant", content: res.text });
      if (!parsed.ok) {
        messages.push({ role: "user", content: `That wasn't usable: ${parsed.error}. Reply with only the JSON object.` });
        continue;
      }
      draft = parsed.value.summary_markdown.trim();
    } catch {
      break;
    }
    const found = inspect(draft);
    if (!found.length) {
      step(`Checked the summary: passed${attempt === "rewrite" ? " on the rewrite" : ""}`);
      return { summary_markdown: draft, summary_facts: facts.map(({ id, value, evidence }) => ({ id, value, evidence })), by: attempt };
    }
    step(`Checker found ${found.length} problem${found.length === 1 ? "" : "s"} in the summary`, { problems: found });
    messages.push({ role: "user", content: `The checker found these problems:\n${found.map((p) => `- ${p}`).join("\n")}\nRewrite the summary to fix them. Reply with only the JSON object.` });
  }
  const parts = answers.map((a, i) => `your ${a.utility} bill went ${a.change_gbp >= 0 ? "up" : "down"} by {${facts[i].id}}`);
  const text = `${parts.join(answers.length === 2 ? " and " : ", ").replace(/^y/, "Y")}.${switched ? " Both come from the same change: you now heat with electricity instead of gas." : ""} Each bill is explained below.`;
  step("Used the template summary");
  return { summary_markdown: text, summary_facts: facts.map(({ id, value, evidence }) => ({ id, value, evidence })), by: "template" };
}
