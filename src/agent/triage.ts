// Triage: Scout's guard on the raw text, the intake agent, bill pairs, one
// signed Scout contract per utility, then that utility's orchestrator, all
// utilities at once. Every step lands in the trace.
//
// If the intake agent is unavailable or finds nothing, Scout's keyword scan
// takes over: named utilities still work; "energy" or "my bill" gets a
// clarifying question.

import { ulid } from "../scout/contract.ts";
import { guard } from "../scout/guard.ts";
import type { Scout, ScoutEvent } from "../scout/index.ts";
import { sense } from "../scout/sense.ts";
import type { ExecutionContract, UserRef } from "../scout/types.ts";
import type { AskResult, Bill, ClarifyOption, TraceStep, TriageRequest, Utility } from "../lib/types.ts";
import { periodFromText, resolvePair, yearsIn } from "./bills.ts";
import { runIntake, type Intake } from "./intake.ts";
import { runOrchestrator, type OrchestratorResult } from "./orchestrators/index.ts";
import { getScout, listen } from "./scout.ts";
import { Trace } from "./trace.ts";

export interface TriageOptions {
  bills: Bill[];
  scout?: Scout;
  intake?: (question: string, bills: Bill[], trace?: Trace) => Promise<Intake | null>;
  user?: UserRef;
  surface?: string;
  onStep?: (step: TraceStep) => void; // hears each trace step as it lands
  // Runs each utility's orchestrator; the pipeline passes one that investigates.
  orchestrate?: (contract: ExecutionContract, ctx: { scout: Scout; trace: Trace }) => Promise<OrchestratorResult>;
}

const INTENT: Record<Utility, string> = {
  electricity: "bill.explain.electricity",
  gas: "bill.explain.gas",
  water: "bill.explain.water",
};
const UTILITY = Object.fromEntries(Object.entries(INTENT).map(([u, i]) => [i, u as Utility])) as Record<string, Utility>;
const NAME: Record<Utility, string> = { electricity: "Electricity", gas: "Gas", water: "Water" };

const GENERAL_REPLY =
  "I explain why a household electricity, gas or water bill went up or down. Try “Why did my gas bill go up in January?”";

function eventStep(e: ScoutEvent): TraceStep {
  const label: Record<ScoutEvent["event"], string> = {
    "scout.decision": `Scout decided: ${e.intent ?? "no intent"} (${e.band ?? e.risk}${e.stage2 === "used" ? ", with the intake agent" : ", keywords only"})`,
    "scout.clarification": `Scout asked a clarifying question (${e.trigger})`,
    "contract.issued": `Signed contract …${String(e.contractId).slice(-6)} for ${e.intent}, model ${e.profile}`,
    "contract.verified": `${e.engine} verified the contract`,
    "contract.refused": `${e.engine} refused the contract (${e.reason})`,
    "contract.expired": `${e.engine} refused an expired contract`,
  };
  return { step: e.event, agent: "scout", label: label[e.event], route: "code", model: null, ms: Number(e.latencyMs ?? 0), detail: { ...e } };
}

function direction(text: string): "up" | "down" | "change" {
  if (/\b(up|rose|risen|higher|jump(ed)?|increase[ds]?|(more )?expensive|so high)\b/i.test(text)) return "up";
  if (/\b(down|fell|fallen|lower|drop(ped)?|decrease[ds]?|cheap(er)?)\b/i.test(text)) return "down";
  return "change";
}

const monthName = (period: string) => new Date(`${period}-01T00:00:00Z`).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

const options = (utilities: Utility[]): ClarifyOption[] => utilities.map((u) => ({ label: NAME[u], utility: u }));

export async function triage(question: string, opts: TriageOptions): Promise<AskResult> {
  const scout = opts.scout ?? getScout();
  const intake = opts.intake ?? runIntake;
  const user = opts.user ?? { id: "household", role: "household" };
  const surface = opts.surface ?? "web";
  const trace = new Trace([], opts.onStep);
  const traceId = ulid();
  const stop = listen(traceId, (e) => trace.add(eventStep(e)));
  const clarify = (message: string, utilities: Utility[]): AskResult => ({ kind: "clarify", message, options: options(utilities), trace: trace.steps });

  try {
    // 1. Guard the raw text before any model sees it.
    const started = performance.now();
    const pre = guard({ text: question, user, surface, rateKey: user.id });
    const hidden = [...new Set(pre.redactions.map((r) => r.kind))];
    trace.add({
      step: "scout.guard",
      agent: "scout",
      label: pre.level === "block" ? "Blocked the question" : hidden.length ? `Checked the question and hid: ${hidden.join(", ")}` : "Checked the question",
      route: "code",
      model: null,
      ms: Math.round((performance.now() - started) * 10) / 10,
      detail: { level: pre.level, flags: pre.flags.map((f) => `${f.layer}:${f.kind}`) },
    });
    if (pre.level === "block") return { kind: "blocked", reason: pre.reason ?? "The question was blocked.", trace: trace.steps };
    const text = pre.text;

    // 2. The intake agent reads the question; Scout's keywords if it can't.
    const read = await intake(text, opts.bills, trace);
    // Utilities the text names outright: High band on Scout's keywords alone.
    const keywords = sense({ prompt: text }, scout.registry, scout.config);
    const named = keywords.candidates.filter((c) => UTILITY[c.intent] && c.score >= scout.config.bands.high).map((c) => UTILITY[c.intent]);

    let requests = read?.requests ?? [];
    let source: "intake" | "keywords" = "intake";
    if (read?.unclear) {
      if (!named.length) return clarify(read.unclear.question, read.unclear.options);
      // The intake agent asked, but the text names a utility: go with the words.
      trace.add({ step: "cross-check", agent: "scout", label: `The intake agent asked which bill; the text names ${named.join(", ")}`, route: "code", model: null, ms: 0 });
      source = "keywords";
      requests = named.map((utility) => ({ utility, period: periodFromText(text, opts.bills), direction: direction(text) }));
    } else if (requests.length) {
      // Cross-check: utilities the text names must match what the intake agent read. If not, ask.
      const asked = requests.map((r) => r.utility);
      if (named.length && (named.some((u) => !asked.includes(u)) || asked.some((u) => !named.includes(u)))) {
        trace.add({ step: "cross-check", agent: "scout", label: `Keywords name ${named.join(", ")}; the intake agent read ${asked.join(", ")}`, route: "code", model: null, ms: 0 });
        return clarify("Which bill do you mean?", [...new Set([...named, ...asked])]);
      }
    } else {
      source = "keywords";
      if (!read) trace.add({ step: "fallback", agent: "triage", label: "Intake agent unavailable; used Scout's keywords", route: "code", model: null, ms: 0 });
      const sensed = keywords;
      if (sensed.clarification) return clarify(sensed.clarification.question, sensed.clarification.options.map((o) => UTILITY[o.intent]).filter(Boolean));
      const intents = sensed.multi.length ? sensed.multi.map((c) => c.intent) : [sensed.top.intent];
      const utilities = intents.map((i) => UTILITY[i]).filter(Boolean);
      if (!utilities.length || sensed.band === "reject") return { kind: "general", message: GENERAL_REPLY, trace: trace.steps };
      const period = periodFromText(text, opts.bills);
      requests = utilities.map((utility) => ({ utility, period, direction: direction(text) }));
    }

    // 3 to 5. Per utility: bill pair, signed contract, orchestrator.
    const notes: string[] = [];
    let missing: { utility: Utility; period: string } | undefined;
    const suggestions: ClarifyOption[] = [];
    const namedYears = yearsIn(question);
    const outcomes = await Promise.all(
      requests.map(async (r): Promise<TriageRequest | AskResult | null> => {
        const pair = resolvePair(opts.bills, r.utility, r.period, namedYears);
        if (!pair.ok) {
          if (pair.reason === "other-year") {
            const asked = pair.period ? monthName(pair.period) : pair.years.join(" or ");
            const offer = pair.suggestion ? ` Did you mean ${pair.suggestion.label}?` : "";
            notes.push(`There's no ${r.utility} bill for ${asked}: your ${r.utility} bills run from ${pair.first.label} to ${pair.latest.label}.${offer}`);
            if (pair.suggestion) {
              const year = pair.suggestion.label.match(/\d{4}/g)!.at(-1)!;
              const again = question.replace(/\b(?:19|20)\d{2}\b/g, year);
              if (!suggestions.some((s) => s.question === again)) suggestions.push({ label: pair.suggestion.label, utility: r.utility, question: again });
            }
            return null;
          }
          if (pair.reason === "missing") {
            missing ??= { utility: pair.utility, period: pair.period };
            notes.push(`There's no ${r.utility} bill for ${monthName(pair.period)} yet: the latest is ${pair.latest.label}. Add it and I'll explain it.`);
            return null;
          }
          notes.push(
            pair.reason === "first-bill"
              ? `That's the first ${r.utility} bill on record, so there's no earlier bill to compare it with.`
              : `There's no ${r.utility} bill for that month.`,
          );
          return null;
        }
        const intent = INTENT[r.utility];
        const decision = await scout.decide({
          prompt: text,
          user,
          surface,
          context: {
            traceId,
            semantic: { [intent]: 1 },
            parameters: { period: r.period, direction: r.direction },
            references: { bill_a: pair.bill_a.bill_id, bill_b: pair.bill_b.bill_id },
            task: "orchestrate",
          },
        });
        if (decision.risk.level === "block") return { kind: "blocked", reason: decision.risk.reason ?? "The question was blocked." };
        const contract = decision.executionContract;
        // Scout's keywords disagree with the intake agent: ask rather than guess.
        if (!contract || contract.intent.primary.id !== intent) {
          const named = (decision.clarification?.options ?? []).map((o) => UTILITY[o.intent]).filter(Boolean);
          return clarify(decision.clarification?.question ?? "Which bill do you mean?", named.length ? named : [r.utility]);
        }
        const done = await (opts.orchestrate ?? runOrchestrator)(contract, { scout, trace });
        return {
          utility: r.utility,
          period: r.period,
          direction: r.direction,
          bill_a: pair.bill_a.bill_id,
          bill_b: pair.bill_b.bill_id,
          contract: {
            contractId: contract.contractId,
            intent: contract.intent.primary.id,
            confidence: contract.intent.confidence,
            band: decision.intent?.band ?? "unknown",
            risk: contract.risk.level,
            capabilities: contract.scope.capabilities,
            model: contract.modelProfile.model,
            expiresAt: contract.expiresAt,
            signature: contract.signature,
          },
          orchestrator: { status: done.status, reason: done.reason, model: done.model, ms: done.ms },
        };
      }),
    );

    const stopper = outcomes.find((o): o is AskResult => o !== null && "kind" in o);
    if (stopper) return stopper.kind === "clarify" || stopper.kind === "blocked" ? { ...stopper, trace: trace.steps } : stopper;
    const done = outcomes.filter((o): o is TriageRequest => o !== null);
    if (!done.length) return { kind: "clarify", message: notes.join(" ") || "I couldn't find that bill.", options: suggestions, missing, trace: trace.steps };
    return { kind: "triage", question, source, requests: done, redactions: hidden, notes, trace: trace.steps };
  } finally {
    stop();
  }
}
