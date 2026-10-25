// The app's Scout, configured for Why My Bill. Scout reports events through
// one callback; this routes each event to the trace of the request it
// belongs to, by trace id.

import { Scout, type ScoutEvent } from "../scout/index.ts";
import { WHYBILL_LEXICON, WHYBILL_REGISTRY } from "../scout/registry.ts";
import { WHYBILL_CAPABILITIES, WHYBILL_MODEL_PROFILES } from "../scout/route.ts";

const listeners = new Map<string, (e: ScoutEvent) => void>();

export function createScout(opts: { secret?: string } = {}): Scout {
  return new Scout({
    intentRegistry: WHYBILL_REGISTRY,
    lexicon: WHYBILL_LEXICON,
    capabilities: WHYBILL_CAPABILITIES,
    modelProfiles: WHYBILL_MODEL_PROFILES,
    policyPack: "whybill",
    secret: opts.secret, // undefined: SCOUT_SECRET from .env.local, read when signing
    onEvent: (e) => listeners.get(e.traceId)?.(e),
  });
}

let appScout: Scout | null = null;

export function getScout(): Scout {
  appScout ??= createScout();
  return appScout;
}

// Sends Scout's events for one trace id to `fn` until the returned function is called.
export function listen(traceId: string, fn: (e: ScoutEvent) => void): () => void {
  listeners.set(traceId, fn);
  return () => listeners.delete(traceId);
}
