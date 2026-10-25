// Scout's Route and Recommend stages. Route turns an intent's abstract
// capabilities into concrete tools through the capability graph; Recommend
// picks a model profile for the task. Specs: docs/capability-graph.md and
// docs/model-routing.md in vendor/meterless/scout-intent.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Intent, ModelProfile, ToolStep } from "./types.ts";

export interface ToolEdge {
  tool: string;
  readOnly: boolean;
  local: boolean;
  available?: boolean;
  latencyMs?: number;
}

export interface CapabilityGraph {
  version: number;
  capabilities: Record<string, ToolEdge[]>;
}

export interface ModelProfiles {
  version: number;
  profiles: ModelProfile[];
}

export const WHYBILL_CAPABILITIES = "src/scout/capabilities.json";
export const WHYBILL_MODEL_PROFILES = "src/scout/model-profiles.json";

const readJson = (path: string) => JSON.parse(readFileSync(resolve(path), "utf8"));

export function loadGraph(source?: string | CapabilityGraph): CapabilityGraph {
  if (!source) return { version: 0, capabilities: {} };
  return typeof source === "string" ? readJson(source) : source;
}

export function loadProfiles(source?: string | ModelProfiles): ModelProfiles {
  if (!source) return { version: 0, profiles: [] };
  return typeof source === "string" ? readJson(source) : source;
}

// One step per capability, in the intent's order. Selection rules: drop
// unavailable tools, then prefer local, then the lowest latency. A capability
// the graph doesn't know keeps its own name as the tool, marked unresolved,
// rather than being swapped for some other tool.
export function route(intent: Intent, graph: CapabilityGraph): { toolPlan: ToolStep[]; unresolved: string[] } {
  const toolPlan: ToolStep[] = [];
  const unresolved: string[] = [];
  for (const capability of intent.capabilities) {
    const edges = (graph.capabilities[capability] ?? [])
      .filter((e) => e.available !== false)
      .sort((a, b) => Number(b.local) - Number(a.local) || (a.latencyMs ?? 0) - (b.latencyMs ?? 0));
    if (edges.length) {
      toolPlan.push({ capability, tool: edges[0].tool, readOnly: edges[0].readOnly, input: {} });
    } else {
      unresolved.push(capability);
      toolPlan.push({ capability, tool: capability, readOnly: false, input: { unresolved: true } });
    }
  }
  return { toolPlan, unresolved };
}

// Compatibility first (the profile must have every capability the task needs
// and be cleared for the data class), then a profile made for the task, then
// the fastest.
export function recommend(
  profiles: ModelProfiles,
  task: string,
  needs: string[] = ["function_calling"],
  dataClass = "household",
): ModelProfile | null {
  const fit = profiles.profiles.filter((p) => needs.every((n) => p.capabilities.includes(n)) && p.dataClasses.includes(dataClass));
  const forTask = fit.filter((p) => p.tasks.includes(task));
  const pool = forTask.length ? forTask : fit;
  return [...pool].sort((a, b) => a.latencyP95Ms - b.latencyP95Ms)[0] ?? null;
}
