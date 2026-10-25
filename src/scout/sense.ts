// Scout's Sense stage: score every intent, place the best in a confidence
// band, spot prompts that carry two or more intents, and decide when to ask
// a clarifying question. Spec: vendor/meterless/scout-intent/docs/scoring.md.
//
// Where the spec leaves room, we chose:
// - The formula's weights are renormalised over the terms that ran. With
//   Stage 1 alone (lexical and recency) a clear trigger reaches the High
//   band; without this, Stage 1 alone could never score above 0.45.
// - lexical(intent) is the intent's own matched trigger weight, capped at 1.
//   A phrase listed under several intents splits its weight between them and
//   gives none of them its own span. So "energy" gives gas and electricity
//   weak, overlapping evidence (a tie), while "gas and electricity" gives
//   each strong evidence on separate spans (two intents).
// - The tie rule applies in the Medium and High bands, not only Medium: two
//   intents that score alike on the same words are a question, not a guess.

import type { SenseConfig } from "./registry.ts";
import type { Band, Clarification, Intent, IntentCandidate, IntentRegistry } from "./types.ts";

export interface SenseInput {
  prompt: string;
  semantic?: Record<string, number>; // Stage 2, 0 to 1 per intent id; from the intake agent
  contextual?: Record<string, number>;
  recency?: Record<string, number>;
}

export interface SenseResult {
  candidates: IntentCandidate[]; // every intent, best first
  top: IntentCandidate;
  band: Band;
  multi: IntentCandidate[]; // two or more intents to run together, else []
  clarification?: Clarification;
  stage2: "used" | "skipped";
  ms: number;
}

interface Trigger {
  phrase: string;
  weight: number;
  pattern: RegExp;
}

interface Match {
  span: [number, number];
  weight: number; // after splitting between the intents that share the phrase
  own: boolean; // only this intent lists the phrase
}

const STOPWORDS = new Set(
  ("the and for with what why did does was this that from into your you are how can have has had been about when which " +
    "who will would should could there their them they then than also just only some any all not but our out get got per " +
    "via each more most much very please need want like make made give tell show find").split(" "),
);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const compile = (phrase: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(phrase)}(?![\\p{L}\\p{N}])`, "giu");

// Registries without a lexicon (such as Meterless's eval fixtures) get
// triggers from their examples and descriptions: words and word pairs,
// weighted down the more intents share them.
function deriveTriggers(intents: Intent[]): Record<string, { phrase: string; weight: number }[]> {
  const grams = new Map<string, string[]>();
  for (const intent of intents) {
    const found = new Set<string>();
    for (const text of [...intent.examples, intent.description]) {
      const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
      const kept = words.filter((w) => w.length >= 3 && !STOPWORDS.has(w));
      kept.forEach((w) => found.add(w));
      for (let i = 0; i + 1 < kept.length; i++) found.add(`${kept[i]} ${kept[i + 1]}`);
    }
    grams.set(intent.id, [...found]);
  }
  const df = new Map<string, number>();
  for (const list of grams.values()) for (const g of list) df.set(g, (df.get(g) ?? 0) + 1);
  return Object.fromEntries(
    [...grams].map(([id, list]) => [id, list.map((g) => ({ phrase: g, weight: (g.includes(" ") ? 0.9 : 0.5) / (df.get(g) ?? 1) }))]),
  );
}

const compiled = new WeakMap<IntentRegistry, Map<string, Trigger[]>>();

function triggersFor(registry: IntentRegistry, config: SenseConfig): Map<string, Trigger[]> {
  const cached = compiled.get(registry);
  if (cached) return cached;
  const derived = deriveTriggers(registry.intents.filter((i) => !config.triggers[i.id]));
  const map = new Map<string, Trigger[]>();
  for (const intent of registry.intents) {
    const list = config.triggers[intent.id] ?? derived[intent.id] ?? [];
    map.set(intent.id, list.map((t) => ({ ...t, phrase: t.phrase.toLowerCase(), pattern: compile(t.phrase.toLowerCase()) })));
  }
  compiled.set(registry, map);
  return map;
}

export function bandOf(score: number, bands: SenseConfig["bands"]): Band {
  if (score >= bands.high) return "high";
  if (score >= bands.medium) return "medium";
  if (score >= bands.low) return "low";
  return "reject";
}

const overlaps = (a: [number, number], b: [number, number]) => a[0] < b[1] && b[0] < a[1];

// "bill.explain.gas" → "Gas"; anything else → its description.
function optionLabel(intent: Intent): string {
  const last = intent.id.split(".").pop() ?? intent.id;
  return intent.category === "bill" ? last.charAt(0).toUpperCase() + last.slice(1) : intent.description;
}

function clarify(trigger: Clarification["trigger"], options: Intent[]): Clarification {
  const labels = options.map(optionLabel);
  const list = labels.length > 1 ? `${labels.slice(0, -1).join(", ")} or ${labels.at(-1)}` : labels[0];
  const bills = options.every((o) => o.category === "bill");
  return {
    trigger,
    question: bills ? `Which bill do you mean: ${list.toLowerCase()}?` : `Which do you mean: ${list}?`,
    options: options.slice(0, 4).map((o) => ({ label: optionLabel(o), intent: o.id })),
  };
}

export function sense(input: SenseInput, registry: IntentRegistry, config: SenseConfig): SenseResult {
  const started = performance.now();
  const text = input.prompt.toLowerCase();
  const triggers = triggersFor(registry, config);

  // How many intents list each phrase, so shared phrases split their weight.
  const sharers = new Map<string, number>();
  for (const list of triggers.values()) for (const t of list) sharers.set(t.phrase, (sharers.get(t.phrase) ?? 0) + 1);

  const matches = new Map<string, Match[]>();
  for (const [id, list] of triggers) {
    const found: Match[] = [];
    for (const t of list) {
      t.pattern.lastIndex = 0;
      const m = t.pattern.exec(text);
      if (m) {
        const n = sharers.get(t.phrase) ?? 1;
        found.push({ span: [m.index, m.index + m[0].length], weight: t.weight / n, own: n === 1 });
      }
    }
    matches.set(id, found);
  }

  const w = config.weights;
  const ran = { lexical: true, recency: true, semantic: Boolean(input.semantic), contextual: Boolean(input.contextual) };
  const totalWeight = (Object.keys(ran) as (keyof typeof ran)[]).filter((k) => ran[k]).reduce((t, k) => t + w[k], 0);

  const order = new Map(registry.intents.map((intent, i) => [intent.id, i]));
  const candidates: IntentCandidate[] = registry.intents
    .map((intent) => {
      const found = matches.get(intent.id) ?? [];
      const lexical = Math.min(1, found.reduce((t, m) => t + m.weight, 0) / config.lexicalSaturation);
      const raw =
        w.lexical * lexical +
        w.recency * (input.recency?.[intent.id] ?? 0) +
        (ran.semantic ? w.semantic * (input.semantic?.[intent.id] ?? 0) : 0) +
        (ran.contextual ? w.contextual * (input.contextual?.[intent.id] ?? 0) : 0);
      const ownSpan = found.find((m) => m.own)?.span;
      const candidate: IntentCandidate = { intent: intent.id, score: Math.round((raw / totalWeight) * 1000) / 1000 };
      if (ownSpan ?? found[0]?.span) candidate.span = ownSpan ?? found[0].span;
      return candidate;
    })
    .sort((a, b) => b.score - a.score || (order.get(a.intent) ?? 0) - (order.get(b.intent) ?? 0));

  const byId = new Map(registry.intents.map((i) => [i.id, i]));
  const ownSpanOf = (id: string) => matches.get(id)?.find((m) => m.own)?.span;
  const actionable = candidates.filter((c) => c.intent !== "GENERAL");
  const top = candidates[0];
  const band = bandOf(top.score, config.bands);
  const result: SenseResult = { candidates, top, band, multi: [], stage2: ran.semantic ? "used" : "skipped", ms: 0 };

  // Two or more intents: the best two both High, each with its own words.
  const [first, second] = actionable;
  const disjoint = (a: IntentCandidate, b: IntentCandidate) => {
    const sa = ownSpanOf(a.intent);
    const sb = ownSpanOf(b.intent);
    return Boolean(sa && sb && !overlaps(sa, sb));
  };
  if (first && second && first.score >= config.bands.high && second.score >= config.bands.high && disjoint(first, second)) {
    const plan: IntentCandidate[] = [];
    for (const c of actionable) {
      if (c.score < config.secondaryFloor) break;
      if (ownSpanOf(c.intent) && plan.every((p) => disjoint(p, c))) plan.push(c);
    }
    result.multi = plan;
  } else if (top.intent !== "GENERAL") {
    // Only real intents are offered as options; a weak GENERAL match just stays GENERAL.
    if (band === "low") {
      const options = actionable.filter((c) => c.score > 0 && c.score >= top.score - 0.15).slice(0, 3);
      result.clarification = clarify("low-band", options.map((c) => byId.get(c.intent)!));
    } else if ((band === "medium" || band === "high") && second && top.score - second.score <= config.tieWindow) {
      const options = actionable.filter((c) => top.score - c.score <= config.tieWindow).slice(0, 4);
      result.clarification = clarify("tie", options.map((c) => byId.get(c.intent)!));
    }
  }

  result.ms = performance.now() - started;
  return result;
}

// Scout's startup self-test: every full-registry scan of the probe set (the
// intents' own examples) must finish inside the budget.
export function selfTest(registry: IntentRegistry, config: SenseConfig, budgetMs = 16): { ok: boolean; worstMs: number } {
  let worstMs = 0;
  for (const intent of registry.intents) {
    for (const prompt of intent.examples) worstMs = Math.max(worstMs, sense({ prompt }, registry, config).ms);
  }
  return { ok: worstMs < budgetMs, worstMs };
}
