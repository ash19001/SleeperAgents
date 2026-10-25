// The whole answer to one question: triage (guard, intake, Scout contracts),
// one investigation per utility in parallel, then the writer and checker
// for each, and the combiner when there are two or more. Clarify, blocked
// and general replies pass straight through from triage; if no utility
// could be investigated, the triage result goes back with the reasons.

import type { DataSource } from "../data/types.ts";
import type { AskResult, Utility } from "../lib/types.ts";
import type { HouseholdMemory } from "../memory/hmem.ts";
import { composeAnswer } from "./answer.ts";
import { combine } from "./combiner.ts";
import type { ChatFn } from "./loop.ts";
import { runOrchestrator } from "./orchestrators/index.ts";
import type { InvestigationResult } from "./orchestrators/investigate.ts";
import { Trace } from "./trace.ts";
import { triage, type TriageOptions } from "./triage.ts";

export interface PipelineOptions extends Omit<TriageOptions, "orchestrate"> {
  data: DataSource;
  memory?: HouseholdMemory;
  chatFn?: ChatFn;
}

const NAME: Record<Utility, string> = { electricity: "Electricity", gas: "Gas", water: "Water" };

export async function answerQuestion(question: string, opts: PipelineOptions): Promise<AskResult> {
  const found = new Map<string, InvestigationResult>();
  const result = await triage(question, {
    ...opts,
    orchestrate: async (contract, ctx) => {
      const r = await runOrchestrator(contract, { ...ctx, data: opts.data, memory: opts.memory, chatFn: opts.chatFn });
      if (r.investigation) found.set(contract.contractId, r.investigation);
      return r;
    },
  });
  if (result.kind !== "triage") return result;

  const done = result.requests.filter((q) => found.has(q.contract.contractId));
  if (!done.length) return result;
  const trace = new Trace(result.trace, opts.onStep);
  const notes = opts.memory?.notes() ?? [];
  const answers = await Promise.all(done.map((q) => composeAnswer(question, found.get(q.contract.contractId)!, { trace, chatFn: opts.chatFn, notes })));
  for (const a of answers) opts.memory?.saveFindings(a);
  const failed = result.requests.filter((q) => !found.has(q.contract.contractId)).map((q) => `${NAME[q.utility]} couldn't be investigated (${q.orchestrator.reason ?? q.orchestrator.status}).`);

  if (answers.length === 1 && !failed.length) return { kind: "answer", answer: answers[0] };
  const summary = answers.length > 1 ? await combine(question, answers, { trace, chatFn: opts.chatFn }) : null;
  return {
    kind: "answers",
    question,
    answers,
    summary_markdown: summary?.summary_markdown ?? "",
    summary_facts: summary?.summary_facts ?? [],
    notes: failed,
    trace: trace.steps,
  };
}
