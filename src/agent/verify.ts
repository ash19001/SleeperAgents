// The checker. Runs in code before any answer is shown, with the rules from
// PLAN.md's answer contract:
// 1. the £ parts add up to the change, to the penny;
// 2. the text has no numbers of its own: every figure is a {F#} placeholder;
// 3. every {F#}, [E#] and [M#] it uses exists;
// 4. every sentence that uses a cause's figure cites evidence;
// 5. only supported causes have figures to give (see facts.ts), and each
//    supported cause passes its threshold in code;
// 6. every fact marked required (a supported part over £1) is used.
// It returns the problems in plain words, for the writer's one rewrite.

import type { CauseId } from "../billmodel/causes.ts";
import type { Part } from "../lib/types.ts";
import type { CaseFinding } from "../memory/casefile.ts";
import type { AnswerFact } from "./facts.ts";
import type { MeasuredCause } from "./investigation.ts";

export interface CheckInput {
  text: string;
  facts: AnswerFact[];
  components: Part[];
  change: number;
  findings: CaseFinding[];
  measured: Partial<Record<CauseId, MeasuredCause>>;
  evidenceIds: string[];
  memoryIds: string[];
}

const PLACEHOLDER = /\{F\d+\}/g;
const CITE = /\[([EM]\d+)\]/g;

// Sentences, each with the citations that follow its full stop.
export function sentences(text: string): string[] {
  // A full stop before a digit is a decimal point ("£32.18"), not an ending.
  return (text.match(/(?:[^.!?]|[.!?](?=\d))+(?:[.!?]+|$)(?:\s*\[[EM]\d+\])*/g) ?? [text]).map((s) => s.trim()).filter(Boolean);
}

export function check(input: CheckInput): string[] {
  const errors: string[] = [];
  const facts = new Map(input.facts.map((f) => [f.id, f]));
  const known = new Set([...input.evidenceIds, ...input.memoryIds]);

  const sum = input.components.reduce((t, c) => t + Math.round(c.gbp * 100), 0);
  if (sum !== Math.round(input.change * 100)) errors.push(`The parts add up to £${(sum / 100).toFixed(2)}, not the change of £${input.change.toFixed(2)}.`);

  if (!input.text.trim()) errors.push("The answer is empty.");
  for (const s of sentences(input.text)) {
    const bare = s.replace(PLACEHOLDER, "").replace(CITE, "");
    const digits = bare.match(/[£$]?\d+(?:[.,:]\d+)*(?:%|[a-z]+)?/i);
    if (digits) errors.push(`"${s.slice(0, 80)}" writes the number "${digits[0]}" itself; use a {F#} placeholder from the facts table.`);
    const used = [...s.matchAll(PLACEHOLDER)].map((m) => m[0].slice(1, -1));
    for (const id of used) if (!facts.has(id)) errors.push(`{${id}} isn't in the facts table.`);
    const cites = [...s.matchAll(CITE)].map((m) => m[1]);
    for (const id of cites) if (!known.has(id)) errors.push(`[${id}] isn't an evidence or note id for this answer.`);
    if (used.some((id) => facts.get(id)?.cause) && !cites.length) errors.push(`"${s.slice(0, 80)}" gives a cause's figure without citing its evidence, like [E1].`);
  }

  const found = new Map(input.findings.map((f) => [f.cause, f]));
  for (const f of input.findings) {
    if (f.verdict === "supported" && input.measured[f.cause]?.passes !== true) errors.push(`${f.cause} is marked supported but its measurement doesn't pass the threshold.`);
  }
  for (const f of input.facts) {
    if (f.cause && found.get(f.cause)?.verdict !== "supported") errors.push(`{${f.id}} belongs to ${f.cause}, which isn't supported.`);
  }

  const usedAll = new Set([...input.text.matchAll(PLACEHOLDER)].map((m) => m[0].slice(1, -1)));
  for (const f of input.facts) if (f.required && !usedAll.has(f.id)) errors.push(`The answer leaves out {${f.id}} (${f.meaning}).`);
  return [...new Set(errors)];
}
