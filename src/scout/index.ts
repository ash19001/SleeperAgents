// Our implementation of Meterless's Scout Intent spec
// (vendor/meterless/scout-intent/AGENTS.md). Meterless publish the spec and
// an eval harness but no code, so this is ours, built to the spec's public
// surface: new Scout({...}), decide(), classify(), replan(), verifyContract().
//
// decide() runs Guard → Sense → Interpret → Guard (with the intent) → Route →
// Recommend and returns a signed execution contract, or a clarifying
// question, or a block. Scout decides; it never executes anything.

import { scoutSecret, issueContract, ulid, verifyContract, type VerifyResult } from "./contract.ts";
import { guard } from "./guard.ts";
import { loadRegistry, loadSenseConfig, type SenseConfig } from "./registry.ts";
import { loadGraph, loadProfiles, recommend, route, type CapabilityGraph, type ModelProfiles } from "./route.ts";
import { bandOf, sense, selfTest } from "./sense.ts";
import type {
  Band,
  Clarification,
  ExecutionContract,
  GuardResult,
  Intent,
  IntentCandidate,
  IntentRegistry,
  ModelProfileRef,
  RiskClass,
  RiskFlag,
  ToolStep,
  UserRef,
} from "./types.ts";

export { verifyContract } from "./contract.ts";
export type * from "./types.ts";

export interface ScoutEvent {
  event: "scout.decision" | "scout.clarification" | "contract.issued" | "contract.verified" | "contract.refused" | "contract.expired";
  traceId: string;
  [field: string]: unknown;
}

export interface ScoutOptions {
  intentRegistry: string | IntentRegistry;
  policyPack?: string | string[];
  modelProfiles?: string | ModelProfiles;
  capabilities?: string | CapabilityGraph;
  lexicon?: string | Partial<SenseConfig>;
  secret?: string; // defaults to SCOUT_SECRET, read when a contract is signed
  onEvent?: (e: ScoutEvent) => void;
}

export interface DecideInput {
  prompt: string;
  user?: UserRef;
  surface: string;
  context?: {
    traceId?: string;
    semantic?: Record<string, number>; // Stage 2 scores per intent id (our intake agent)
    contextual?: Record<string, number>;
    parameters?: Record<string, unknown>; // bound by the caller, checked against the intent's schema
    references?: Record<string, unknown>; // entity ids, e.g. the two bills
    task?: string; // what the contract is for, used to pick a model profile
    rateKey?: string;
    parentId?: string;
  };
}

export interface Decision {
  traceId: string;
  prompt: string; // after redaction
  candidates: IntentCandidate[];
  intent: { primary: string; confidence: number; band: Band; parameters: Record<string, unknown>; references: Record<string, unknown>; alternates: IntentCandidate[] } | null;
  risk: GuardResult;
  toolPlan: ToolStep[];
  modelProfile: ModelProfileRef | null;
  clarification?: Clarification;
  plan?: { intent: string; score: number; executionContract: ExecutionContract }[]; // two or more intents
  executionContract?: ExecutionContract;
  latencyMs: number;
}

const LEVELS: RiskClass[] = ["low", "medium", "high"];
const maxLevel = (a: RiskClass, b: RiskClass) => (LEVELS.indexOf(a) >= LEVELS.indexOf(b) ? a : b);

// Checks bound parameters against an intent's schema: enum, pattern, type, range.
function checkParameters(intent: Intent, params: Record<string, unknown>): { ok: Record<string, unknown>; missing: string[] } {
  const ok: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(params)) {
    const rule = intent.parameters.properties[name] as { enum?: unknown[]; pattern?: string; type?: string; minimum?: number; maximum?: number } | undefined;
    if (!rule || value === null || value === undefined) continue;
    if (rule.enum && !rule.enum.includes(value)) continue;
    if (rule.pattern && (typeof value !== "string" || !new RegExp(rule.pattern).test(value))) continue;
    if (rule.type === "integer" && !Number.isInteger(value)) continue;
    if (typeof value === "number" && ((rule.minimum ?? -Infinity) > value || value > (rule.maximum ?? Infinity))) continue;
    ok[name] = value;
  }
  const missing = (intent.parameters.required ?? []).filter((r) => !(r in ok));
  return { ok, missing };
}

export class Scout {
  readonly registry: IntentRegistry;
  readonly config: SenseConfig;
  readonly graph: CapabilityGraph;
  readonly profiles: ModelProfiles;
  readonly policyPackVersion: string;
  private readonly secret?: string;
  private readonly onEvent?: (e: ScoutEvent) => void;
  private readonly byId: Map<string, Intent>;
  private readonly issued = new Map<string, { input: DecideInput; traceId: string }>(); // for replan, newest 200

  constructor(opts: ScoutOptions) {
    this.registry = loadRegistry(opts.intentRegistry);
    this.config = loadSenseConfig(opts.lexicon);
    this.graph = loadGraph(opts.capabilities);
    this.profiles = loadProfiles(opts.modelProfiles);
    this.policyPackVersion = `${[opts.policyPack ?? "default"].flat().join("+")}@1`;
    this.secret = opts.secret;
    this.onEvent = opts.onEvent;
    this.byId = new Map(this.registry.intents.map((i) => [i.id, i]));
    // Startup self-test: a full-registry scan must stay under 16 ms.
    const test = selfTest(this.registry, this.config);
    if (!test.ok) console.error(`Scout self-test failed: a registry scan took ${test.worstMs.toFixed(1)} ms (budget 16 ms)`);
  }

  private emit(e: ScoutEvent) {
    this.onEvent?.(e);
  }

  classify(input: { prompt: string; surface: string }): Promise<{ candidates: IntentCandidate[] }> {
    return Promise.resolve({ candidates: sense({ prompt: input.prompt }, this.registry, this.config).candidates });
  }

  async decide(input: DecideInput): Promise<Decision> {
    const started = performance.now();
    const ctx = input.context ?? {};
    const traceId = ctx.traceId ?? ulid();
    const done = (d: Omit<Decision, "traceId" | "latencyMs">): Decision => {
      const decision = { ...d, traceId, latencyMs: Math.round((performance.now() - started) * 10) / 10 };
      this.emit({ event: "scout.decision", traceId, intent: d.intent?.primary ?? null, band: d.intent?.band ?? null, risk: d.risk.level, latencyMs: decision.latencyMs, stage2: ctx.semantic ? "used" : "skipped" });
      return decision;
    };
    const empty = { candidates: [], intent: null, toolPlan: [], modelProfile: null };

    // Guard first, on the raw text: injection, length, sensitive details, rate.
    const pre = guard({ text: input.prompt, user: input.user, surface: input.surface, rateKey: ctx.rateKey });
    if (pre.level === "block") return done({ ...empty, prompt: pre.text, risk: { level: "block", flags: pre.flags, redactions: pre.redactions, reason: pre.reason } });

    // Sense, on the redacted text.
    const sensed = sense({ prompt: pre.text, semantic: ctx.semantic, contextual: ctx.contextual }, this.registry, this.config);
    const preRisk: GuardResult = { level: pre.level, flags: pre.flags, redactions: pre.redactions };

    if (sensed.clarification) {
      this.emit({ event: "scout.clarification", traceId, trigger: sensed.clarification.trigger });
      return done({ ...empty, prompt: pre.text, candidates: sensed.candidates, risk: preRisk, clarification: sensed.clarification });
    }

    // Two or more intents: one contract each; the decision describes the first.
    if (sensed.multi.length >= 2) {
      const issued = sensed.multi.map((c) => ({ c, ...this.issue(input, pre, c.intent, c.score, sensed.candidates, traceId) }));
      const plan = issued.filter((x) => x.contract).map((x) => ({ intent: x.c.intent, score: x.c.score, executionContract: x.contract! }));
      return done({ ...issued[0].decision, prompt: pre.text, candidates: sensed.candidates, plan, executionContract: plan[0]?.executionContract });
    }

    // Reject band: the safe GENERAL intent, if the registry has one.
    const chosen = sensed.band === "reject" && this.byId.has("GENERAL") ? { intent: "GENERAL", score: sensed.top.score } : sensed.top;
    const issued = this.issue(input, pre, chosen.intent, chosen.score, sensed.candidates, traceId);
    return done({ ...issued.decision, prompt: pre.text, candidates: sensed.candidates, executionContract: issued.contract });
  }

  // Interpret, Guard with the intent, Route, Recommend, then sign.
  private issue(input: DecideInput, pre: GuardResult & { text: string }, intentId: string, score: number, candidates: IntentCandidate[], traceId: string) {
    const ctx = input.context ?? {};
    const intent = this.byId.get(intentId)!;
    const params = checkParameters(intent, ctx.parameters ?? {});
    const alternates = candidates.filter((c) => c.intent !== intentId).slice(0, 3);
    const intentOut = { primary: intentId, confidence: score, band: bandOf(score, this.config.bands), parameters: params.ok, references: ctx.references ?? {}, alternates };

    const { toolPlan } = route(intent, this.graph);
    const post = guard({ text: pre.text, intent, user: input.user, surface: input.surface, requestedCapabilities: toolPlan.map((s) => s.capability) });
    const flags: RiskFlag[] = [...pre.flags, ...post.flags.filter((f) => !pre.flags.some((p) => p.kind === f.kind && p.evidence === f.evidence))];

    if (post.level === "block") {
      return { decision: { candidates, intent: intentOut, toolPlan: [], modelProfile: null, risk: { level: "block" as const, flags, redactions: pre.redactions, reason: post.reason } }, contract: undefined };
    }
    const level = maxLevel(pre.level as RiskClass, post.level as RiskClass);
    const risk = { level, flags, redactions: pre.redactions };

    const ask = (trigger: Clarification["trigger"], question: string): { decision: Omit<Decision, "traceId" | "latencyMs" | "prompt">; contract: undefined } => ({
      decision: { candidates, intent: intentOut, toolPlan, modelProfile: null, risk, clarification: { trigger, question, options: [{ label: intent.description, intent: intentId }] } },
      contract: undefined,
    });
    if (params.missing.length) return ask("params", `I need ${params.missing.join(" and ")} to do that. Can you add it?`);
    if (intent.riskClass === "high" && score < 0.95) return ask("high-risk", `Just to check: do you want me to ${intent.description.toLowerCase()}?`);

    const task = ctx.task ?? (toolPlan.length ? "orchestrate" : "respond");
    const profile = recommend(this.profiles, task, toolPlan.length ? ["function_calling"] : []);
    const modelProfile = profile ? { id: profile.id, model: profile.model } : { id: "none", model: "none" };
    const decision = { candidates, intent: intentOut, toolPlan, modelProfile, risk: { ...risk, level } };
    const contract = issueContract(
      {
        traceId,
        parentId: ctx.parentId,
        intent: { primary: { id: intentId, version: intent.version }, parameters: params.ok, references: ctx.references ?? {}, confidence: score, alternates },
        risk: { level, flags, redactions: pre.redactions, approvals: [] },
        toolPlan,
        modelProfile,
        scope: { user: input.user ?? {}, surface: input.surface, capabilities: [...intent.capabilities] },
        registryVersion: this.registry.version,
        policyPackVersion: this.policyPackVersion,
      },
      this.secret ?? scoutSecret(),
    );
    this.issued.set(contract.contractId, { input, traceId });
    if (this.issued.size > 200) this.issued.delete(this.issued.keys().next().value!);
    this.emit({ event: "contract.issued", traceId, contractId: contract.contractId, intent: intentId, risk: level, profile: modelProfile.id });
    return { decision, contract };
  }

  // Engines call this at their boundary before acting on a contract.
  verify(contract: ExecutionContract, opts: { engine: string; require?: { intent?: string; capabilities?: string[] }; now?: number }): VerifyResult {
    const result = verifyContract(contract, { secret: this.secret ?? scoutSecret(), now: opts.now, require: opts.require });
    const traceId = contract?.traceId ?? "unknown";
    if (result.ok) this.emit({ event: "contract.verified", traceId, contractId: contract.contractId, engine: opts.engine });
    else this.emit({ event: result.reason === "expired" ? "contract.expired" : "contract.refused", traceId, contractId: contract?.contractId, engine: opts.engine, reason: result.reason });
    return result;
  }

  // A downstream engine couldn't finish: decide again with the same inputs,
  // the original contract as parent and the same trace.
  async replan(input: { parent: string; reason: string; state?: unknown }): Promise<Decision> {
    const original = this.issued.get(input.parent);
    if (!original) throw new Error(`no contract ${input.parent} to re-plan from`);
    return this.decide({ ...original.input, context: { ...original.input.context, traceId: original.traceId, parentId: input.parent } });
  }
}
