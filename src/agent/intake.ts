// The intake agent (Nemotron Lightning): turns the question, already checked
// by Scout's guard, into fixed-format requests, one per utility. It is
// Scout's Stage-2 scorer; if it fails, triage falls back to Scout's keywords.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type { Bill, Utility } from "../lib/types.ts";
import { billMonths } from "./bills.ts";
import { chat, fastModel, type Message } from "./llm.ts";
import type { Trace } from "./trace.ts";

const UTILITY = z.enum(["electricity", "gas", "water"]);

export const IntakeSchema = z.object({
  requests: z
    .array(
      z.object({
        utility: UTILITY,
        period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable(),
        direction: z.enum(["up", "down", "change"]),
      }),
    )
    .max(3),
  unclear: z.object({ question: z.string().min(1), options: z.array(UTILITY).min(2) }).nullable(),
});

export type Intake = z.infer<typeof IntakeSchema>;

const PROMPT_FILE = "src/agent/prompts/intake.md";

// The model's reply as JSON: code fences and any text around the object removed.
export function parseIntake(text: string): { ok: true; intake: Intake } | { ok: false; error: string } {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) return { ok: false, error: "no JSON object in the reply" };
  let json: unknown;
  try {
    json = JSON.parse(text.slice(start, end + 1));
  } catch (err) {
    return { ok: false, error: `not valid JSON (${(err as Error).message})` };
  }
  const parsed = IntakeSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  // One request per utility, first mention wins.
  const seen = new Set<Utility>();
  const requests = parsed.data.requests.filter((r) => !seen.has(r.utility) && seen.add(r.utility));
  return { ok: true, intake: { ...parsed.data, requests } };
}

export async function runIntake(question: string, bills: Bill[], trace?: Trace): Promise<Intake | null> {
  const months = billMonths(bills);
  const system =
    readFileSync(resolve(PROMPT_FILE), "utf8") +
    `\nMonths with bills (YYYY-MM). Pick period from these:\n- electricity: ${months.electricity.join(", ")}\n- gas: ${months.gas.join(", ")}\n- water: ${months.water.join(", ")}\n`;
  const messages: Message[] = [
    { role: "system", content: system },
    { role: "user", content: question },
  ];
  for (let attempt = 0; attempt < 2; attempt++) {
    let reply;
    try {
      reply = await chat({ agent: "intake", label: attempt ? "Read the question (retry)" : "Read the question", model: fastModel(), messages, maxTokens: 400, trace });
    } catch {
      return null; // the model is unavailable; triage uses Scout's keywords alone
    }
    const parsed = parseIntake(reply.text);
    if (parsed.ok) return parsed.intake;
    messages.push({ role: "assistant", content: reply.text }, { role: "user", content: `That reply was not usable: ${parsed.error}. Reply with the JSON object only.` });
  }
  return null;
}
