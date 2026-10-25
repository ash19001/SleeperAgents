// Loads and checks an intent registry and the Stage-1 scoring config. A path
// is read relative to the working directory (the repo root for the app,
// tests and scripts).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type { IntentRegistry } from "./types.ts";

const IntentSchema = z.object({
  id: z.string().min(1),
  category: z.string(),
  description: z.string(),
  parameters: z.object({
    type: z.literal("object"),
    properties: z.record(z.string(), z.unknown()),
    required: z.array(z.string()).optional(),
  }),
  capabilities: z.array(z.string()),
  riskClass: z.enum(["low", "medium", "high"]),
  surfaces: z.array(z.string()),
  roles: z.array(z.string()),
  examples: z.array(z.string()).min(1, "every intent needs examples"),
  version: z.number().int(),
});

const RegistrySchema = z.object({
  version: z.number().int(),
  note: z.string().optional(),
  intents: z.array(IntentSchema).min(1),
});

const TriggerSchema = z.object({ phrase: z.string().min(1), weight: z.number().positive() });

export const SenseConfigSchema = z.object({
  weights: z.object({ lexical: z.number(), semantic: z.number(), contextual: z.number(), recency: z.number() }),
  bands: z.object({ high: z.number(), medium: z.number(), low: z.number() }),
  tieWindow: z.number(),
  secondaryFloor: z.number(),
  lexicalSaturation: z.number().positive(),
  triggers: z.record(z.string(), z.array(TriggerSchema)).default({}),
});

export type SenseConfig = z.infer<typeof SenseConfigSchema>;

export const WHYBILL_REGISTRY = "src/scout/intents.json";
export const WHYBILL_LEXICON = "src/scout/lexicon.json";

const readJson = (path: string) => JSON.parse(readFileSync(resolve(path), "utf8"));

export function loadRegistry(source: string | IntentRegistry): IntentRegistry {
  const raw = typeof source === "string" ? readJson(source) : source;
  const registry = RegistrySchema.parse(raw) as IntentRegistry;
  const ids = registry.intents.map((i) => i.id);
  const dupe = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dupe) throw new Error(`intent ${dupe} appears twice in the registry`);
  return registry;
}

// Defaults match Scout's canonical numbers; the lexicon adds trigger words.
export function loadSenseConfig(source?: string | Partial<SenseConfig>): SenseConfig {
  const raw = typeof source === "string" ? readJson(source) : (source ?? {});
  return SenseConfigSchema.parse({
    weights: { lexical: 0.4, semantic: 0.35, contextual: 0.2, recency: 0.05 },
    bands: { high: 0.8, medium: 0.55, low: 0.4 },
    tieWindow: 0.05,
    secondaryFloor: 0.55,
    lexicalSaturation: 1.0,
    ...raw,
  });
}
