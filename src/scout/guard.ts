// Scout's Guard stage: five independent layers (injection, policy, scope,
// sensitivity, rate limit), each passing, warning or blocking. Spec:
// vendor/meterless/scout-intent/docs/risk-and-policy.md. Blocks are kept for
// clear cases; doubtful ones warn, which lifts the risk level instead.
//
// Triage runs it twice: on the raw text before any model sees it (no intent
// yet), and again on each decision with its intent, user and surface.

import type { GuardResult, Intent, Redaction, RiskClass, RiskFlag, UserRef } from "./types.ts";

export interface GuardInput {
  text: string;
  intent?: Intent;
  user?: UserRef;
  surface?: string;
  requestedCapabilities?: string[];
  rateKey?: string; // who to rate-limit, e.g. a user id; omitted means no rate check
  now?: number;
}

export interface GuardOutcome extends GuardResult {
  text: string; // the input with sensitive details replaced
}

export const MAX_PROMPT_CHARS = 500;

// Injection: block only on clear patterns. Evidence is the pattern's name,
// never the payload.
const BLOCK_PATTERNS: { kind: string; name: string; re: RegExp }[] = [
  { kind: "pattern", name: "override-instructions", re: /\b(ignore|disregard|forget|override)\b[^.?!\n]{0,40}\b(previous|prior|above|earlier|all|your|these|those)\b[^.?!\n]{0,20}\b(instructions?|prompts?|rules|guidelines|directions)\b/i },
  { kind: "pattern", name: "control-tag", re: /<\/?\s*(system|assistant|user|tool)\s*>/i },
  { kind: "pattern", name: "inst-marker", re: /\[\/?INST\]/i },
  { kind: "pattern", name: "special-token", re: /<\|[^|>\n]{1,40}\|>/ },
  { kind: "pattern", name: "role-line", re: /^\s*(system|assistant)\s*:/im },
  { kind: "pattern", name: "prompt-exfiltration", re: /\b(reveal|show|print|repeat|output|tell me)\b[^.?!\n]{0,30}\b(system prompt|your (instructions|prompt|rules))\b/i },
  { kind: "role-drift", name: "new-role", re: /\b(you are now|from now on,? you (are|will be)|pretend (to be|you are)|roleplay as|act as (an?|the) (unrestricted|different|new|evil|jailbroken|uncensored))\b/i },
  { kind: "tool-ref", name: "sql-write", re: /\b(drop|truncate|alter)\s+(table|database|schema|view)\b|\bdelete\s+from\b|\binsert\s+into\b|\bupdate\s+\w+\s+set\b|\bunion\s+select\b|;\s*--/i },
  { kind: "pattern", name: "override-principal", re: /\b(ignore|disregard)\s+(the\s+)?(user|system|developer|operator)\b/i },
  { kind: "tool-ref", name: "privilege-escalation", re: /\bgrant\s+(me\s+|us\s+|myself\s+)?(admin|administrator|root|superuser|full access|full rights)\b|\b(elevate|escalate)\s+(my\s+)?(privileges?|permissions?|access)\b/i },
  { kind: "pattern", name: "secret-exfiltration", re: /\b(reveal|show|dump|print|list|send|leak|export)\b[^.?!\n]{0,30}\b(credentials?|passwords?|api keys?|secret keys?|access tokens?)\b/i },
  // Invisible and text-direction control characters hide instructions from people reading the text.
  { kind: "pattern", name: "control-characters", re: /[‪-‮⁦-⁩​-‏⁠﻿]/ },
];

// Out-of-band tool requests: warn, since some are innocent wording.
const WARN_PATTERNS: { kind: string; name: string; re: RegExp }[] = [
  { kind: "tool-ref", name: "run-code", re: /\b(run|execute)\s+(this\s+|the\s+|a\s+|my\s+)?(sql|query|command|code|script)\b/i },
  { kind: "tool-ref", name: "send-message", re: /\b(send|write|post)\s+(an?\s+)?(email|e-mail|message|text|letter)\b/i },
];

// Sensitive details, replaced before anything downstream sees the text.
const SENSITIVE: { kind: string; re: RegExp }[] = [
  { kind: "credential", re: /\b(nvapi-[\w-]{10,}|sk-[\w-]{16,}|bearer\s+[\w.-]{16,}|[a-f0-9]{32,})\b/gi },
  { kind: "email", re: /\b[\w.+-]+@[\w-]+(\.[\w-]+)+\b/g },
  { kind: "card", re: /\b(?:\d[ -]?){13,19}\b/g },
  { kind: "phone", re: /(?:\+44\s?|\b0)\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}\b/g },
  { kind: "number", re: /\b\d{8,}\b/g },
  { kind: "postcode", re: /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi },
];

const REASONS: Record<string, string> = {
  pattern: "The question looks like an attempt to change the assistant's instructions.",
  "role-drift": "The question asks the assistant to take on a different role.",
  "tool-ref": "The question contains database commands, which this assistant never runs.",
  length: `Questions are limited to ${MAX_PROMPT_CHARS} characters.`,
  role: "This request isn't available to your account.",
  surface: "This request isn't available here.",
  rate: "Too many questions in a short time. Wait a minute and try again.",
};

function redact(text: string): { text: string; redactions: Redaction[] } {
  const found: Redaction[] = [];
  for (const { kind, re } of SENSITIVE) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const span: [number, number] = [m.index, m.index + m[0].length];
      if (!found.some((r) => span[0] < r.span[1] && r.span[0] < span[1])) found.push({ kind, span });
    }
  }
  found.sort((a, b) => a.span[0] - b.span[0]);
  let out = "";
  let at = 0;
  for (const r of found) {
    out += `${text.slice(at, r.span[0])}[${r.kind}]`;
    at = r.span[1];
  }
  return { text: out + text.slice(at), redactions: found };
}

// A token bucket per key: 20 questions, refilled at 20 a minute.
const RATE_CAPACITY = 20;
const RATE_REFILL_PER_MS = 20 / 60_000;
const buckets = new Map<string, { tokens: number; at: number }>();

function takeToken(key: string, now: number): boolean {
  const b = buckets.get(key) ?? { tokens: RATE_CAPACITY, at: now };
  b.tokens = Math.min(RATE_CAPACITY, b.tokens + (now - b.at) * RATE_REFILL_PER_MS);
  b.at = now;
  buckets.set(key, b);
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

const LIFT: Record<RiskClass, RiskClass> = { low: "medium", medium: "high", high: "high" };

export function guard(input: GuardInput): GuardOutcome {
  const flags: RiskFlag[] = [];
  const block = (layer: RiskFlag["layer"], kind: string, evidence?: string) => flags.push({ layer, kind, outcome: "block", evidence });
  const warn = (layer: RiskFlag["layer"], kind: string, evidence?: string) => flags.push({ layer, kind, outcome: "warn", evidence });

  // 1. Injection
  for (const p of BLOCK_PATTERNS) if (p.re.test(input.text)) block("injection", p.kind, p.name);
  for (const p of WARN_PATTERNS) if (p.re.test(input.text)) warn("injection", p.kind, p.name);

  // 2. Policy: length, role and surface
  if (input.text.length > MAX_PROMPT_CHARS) block("policy", "length", `${input.text.length} characters`);
  if (input.intent) {
    const roles = input.intent.roles;
    if (!roles.includes("*") && !roles.includes(input.user?.role ?? "")) block("policy", "role", input.user?.role ?? "none");
    if (input.surface && !input.intent.surfaces.includes(input.surface)) block("policy", "surface", input.surface);
  }

  // 3. Scope: everything asked for must be in the intent's capabilities
  if (input.intent && input.requestedCapabilities) {
    const outside = input.requestedCapabilities.filter((c) => !input.intent!.capabilities.includes(c));
    if (outside.length) warn("scope", "scope-mismatch", outside.join(","));
  }

  // 4. Sensitivity: redact, don't block
  const { text, redactions } = redact(input.text);
  for (const kind of new Set(redactions.map((r) => r.kind))) warn("sensitivity", kind);

  // 5. Rate limit
  if (input.rateKey && !takeToken(input.rateKey, input.now ?? Date.now())) block("rate", "rate");

  const blocked = flags.find((f) => f.outcome === "block");
  if (blocked) return { level: "block", flags, redactions, reason: REASONS[blocked.kind] ?? "The request was blocked.", text };

  // Each warning lifts the level by one band; redactions alone don't.
  let level: RiskClass = input.intent?.riskClass ?? "low";
  for (const f of flags) if (f.outcome === "warn" && f.layer !== "sensitivity") level = LIFT[level];
  return { level, flags, redactions, text };
}
