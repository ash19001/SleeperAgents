// The five specialists. Each owns a few causes and a few tools, runs the
// shared agent loop on Nemotron Lightning, and reports a verdict per cause.
// The agent decides what to look at, links household notes and explains;
// code decides pass or fail and supplies every £ figure. Where the agent's
// verdict disagrees with the measurement, the measurement wins and the
// finding says so.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type { CauseId } from "../billmodel/causes.ts";
import type { Utility } from "../lib/types.ts";
import { testCause, type Investigation } from "./investigation.ts";
import { fastModel } from "./llm.ts";
import { runAgent, type ChatFn } from "./loop.ts";
import { getBills, getMeterReadings, getSplit, getTariff, getWeather, recallNotes, testCauseTool, type Tool } from "./tools/index.ts";

export type SpecialistName = "billing" | "tariff" | "weather" | "usage" | "leak";

interface SpecialistDef {
  causes: (u: Utility) => CauseId[];
  tools: Tool[];
  utilities: Utility[];
}

export const SPECIALISTS: Record<SpecialistName, SpecialistDef> = {
  billing: { causes: () => ["C3", "C4", "C5"], tools: [getBills, getMeterReadings], utilities: ["electricity", "gas", "water"] },
  tariff: { causes: () => ["C1", "C2"], tools: [getTariff, getBills], utilities: ["electricity", "gas", "water"] },
  weather: { causes: () => ["C6"], tools: [getWeather, getSplit], utilities: ["electricity", "gas", "water"] },
  usage: { causes: (u) => (u === "water" ? ["C7"] : ["C7", "C9"]), tools: [getSplit, getMeterReadings, recallNotes], utilities: ["electricity", "gas", "water"] },
  leak: { causes: () => ["C8"], tools: [getSplit, getMeterReadings, recallNotes], utilities: ["water"] },
};

export const specialistsFor = (u: Utility) => (Object.keys(SPECIALISTS) as SpecialistName[]).filter((s) => SPECIALISTS[s].utilities.includes(u));

export interface Finding {
  cause: CauseId;
  verdict: "supported" | "ruled_out" | "inconclusive";
  effect_gbp: number; // from the measurement, never from the model
  value: number | null;
  threshold: string;
  evidence: string[];
  memory: string[];
  reasoning: string;
  specialist: SpecialistName;
  measured_by: "agent" | "code"; // code: the agent didn't test it in this run, so code did
  overridden: boolean; // the agent's verdict disagreed with the measurement
  claimed: Finding["verdict"] | null; // the agent's own verdict, if it gave one
}

export interface SpecialistResult {
  specialist: SpecialistName;
  findings: Finding[];
  follow_up: string | null;
  steps: number;
  toolCalls: number;
  error?: string;
}

const prompt = (name: string) => readFileSync(resolve(`src/agent/prompts/specialists/${name}.md`), "utf8");

function reportSchema(causes: CauseId[]) {
  return z.object({
    findings: z.array(
      z.object({
        cause: z.enum(causes as [CauseId, ...CauseId[]]),
        verdict: z.enum(["supported", "ruled_out", "inconclusive"]),
        evidence: z.array(z.string()).default([]),
        memory: z.array(z.string()).default([]),
        reasoning: z.string().max(600),
      }),
    ),
    follow_up: z.string().nullable().optional(),
  });
}

const verdictOf = (passes: boolean | null) => (passes === true ? "supported" : passes === false ? "ruled_out" : "inconclusive");

export async function runSpecialist(name: SpecialistName, task: string, inv: Investigation, chatFn?: ChatFn): Promise<SpecialistResult> {
  const def = SPECIALISTS[name];
  const causes = def.causes(inv.utility);
  // testCause records a new measurement object each time, so comparing with
  // this snapshot shows which causes the agent tested in this run.
  const before = new Map(inv.measured);
  const run = await runAgent(
    {
      name: `specialist:${name}`,
      model: fastModel(),
      system: `${prompt("_shared")}\n${prompt(name)}`,
      tools: [...def.tools, testCauseTool(causes)],
      report: reportSchema(causes),
      reportShape: `{"findings": [{"cause": "${causes[0]}", "verdict": "supported" | "ruled_out" | "inconclusive", "evidence": ["E1"], "memory": [], "reasoning": "..."}], "follow_up": null}`,
      maxSteps: 6,
    },
    `${task}\nBills: ${inv.a.label} (${inv.a.bill_id}) then ${inv.b.label} (${inv.b.bill_id}), ${inv.utility}.`,
    inv,
    chatFn,
  );

  // Settle every owned cause against its measurement.
  const said = new Map((run.report?.findings ?? []).map((f) => [f.cause, f]));
  const known = new Set(inv.evidence.records.map((r) => r.id));
  const findings: Finding[] = [];
  for (const cause of causes) {
    const byAgent = inv.measured.has(cause) && inv.measured.get(cause) !== before.get(cause);
    // An earlier measurement stands (with any notes linked to it); code
    // measures only what nobody has measured yet.
    const m = inv.measured.get(cause) ?? (await testCause(inv, cause));
    const claim = said.get(cause);
    const verdict = verdictOf(m.passes);
    findings.push({
      cause,
      verdict,
      effect_gbp: m.effect_gbp,
      value: m.value,
      threshold: m.threshold,
      evidence: [...new Set([...m.evidence, ...(claim?.evidence ?? []).filter((e) => known.has(e))])],
      memory: m.memory,
      reasoning: claim?.reasoning ?? "",
      specialist: name,
      measured_by: byAgent ? "agent" : "code",
      overridden: Boolean(claim && claim.verdict !== verdict),
      claimed: claim?.verdict ?? null,
    });
  }
  return { specialist: name, findings, follow_up: run.report?.follow_up ?? null, steps: run.steps, toolCalls: run.toolCalls, error: run.error };
}
