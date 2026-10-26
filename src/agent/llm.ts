// Every model call goes through here, and through Meterless Nightshift: it
// holds the NVIDIA key and routes to Nemotron, so the app never sees that
// key. If Nightshift can't be reached the call fails with a clear message,
// and the callers' own fallbacks take over (keyword intake, causes settled
// in code, the template answer; replay mode for demos).
//
// Nightshift has a response cache that keys on the user message alone and
// drops tool calls from cached replies (found 25 Oct 2026). So each call is
// made unique with a short request tag unless the caller opts into the cache.
//
// Nightshift also keeps its own memory of past answers and injects up to
// three into each prompt (found 26 Oct 2026: ~900 extra tokens a call, and
// agents copied earlier answers word for word, across different cases).
// `user` and `session` scope both store and inject; `none` does neither
// (tested: identical calls in a row, nothing injected). Calls use `none`, so
// each investigation reasons only from its own evidence; household memory is
// the app's own H-MEM, used deliberately through recall_notes.

import { randomUUID } from "node:crypto";
import type { Trace } from "./trace.ts";

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolSpec {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ChatOptions {
  agent: string; // who is calling, e.g. "intake" or "specialist:weather"
  label: string; // what the call is for, shown in the trace
  model: string;
  messages: Message[];
  tools?: ToolSpec[];
  maxTokens?: number;
  timeoutMs?: number;
  trace?: Trace;
  cache?: boolean; // allow Nightshift's response cache; only for calls whose answer depends on the user message alone
  thinking?: boolean; // let the model reason before answering; off by default (see below)
}

// Both Nemotron models reason before they answer unless told not to, and the
// reasoning counts against max_tokens: Lightning spends about 500 tokens of it
// on a one-line JSON reply, so a small limit leaves the answer empty.
// `chat_template_kwargs.enable_thinking: false` turns it off, through
// Nightshift and direct (tested 25 Oct 2026).

export interface ChatResult {
  text: string; // the reply with any reasoning before </think> removed
  message: Message; // the raw assistant message, for tool-call loops
  toolCalls: ToolCall[];
  route: "nightshift";
  reasoning: string; // what the model thought before answering, when thinking is on
  model: string; // the model that actually answered
  receipt: string | null; // Nightshift's compute receipt id
  cached: boolean; // served from Nightshift's cache
  ms: number;
}

export class LlmError extends Error {
  readonly status: number | null;
  readonly route: string;

  constructor(message: string, route: string, status: number | null = null) {
    super(message);
    this.name = "LlmError";
    this.route = route;
    this.status = status;
  }
}

export const fastModel = () => process.env.MODEL_FAST || "nvidia/nemotron-3.5-lightning-30b-a3b";
export const deepModel = () => process.env.MODEL_DEEP || "nvidia/nemotron-3-ultra-550b-a55b";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set in .env.local`);
  return value;
}

// Some models think out loud before "</think>"; keep only what follows.
export function stripThinking(text: string): string {
  const withoutBlocks = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const end = withoutBlocks.lastIndexOf("</think>");
  return (end >= 0 ? withoutBlocks.slice(end + "</think>".length) : withoutBlocks).trim();
}

// True when the request never reached the server (refused, reset, DNS).
function unreachable(err: unknown): boolean {
  if (!(err instanceof TypeError)) return false;
  const code = (err.cause as { code?: string } | undefined)?.code ?? "";
  return ["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EHOSTUNREACH", "UND_ERR_SOCKET"].includes(code) || err.message === "fetch failed";
}

interface Route {
  name: ChatResult["route"];
  url: string;
  headers: Record<string, string>;
}

function nightshift(): Route {
  return {
    name: "nightshift",
    url: `${required("NIGHTSHIFT_BASE_URL")}/chat/completions`,
    headers: {
      Authorization: `Bearer ${required("NIGHTSHIFT_TOKEN")}`,
      "meterless-app": process.env.NIGHTSHIFT_APP_ID || "why-my-bill",
      "meterless-scope": process.env.NIGHTSHIFT_SCOPE || "none",
    },
  };
}

// NVIDIA answers 429 when calls come too fast for the account's allowance
// (Nightshift passes it on as a 502 naming nvidia_429). So calls
// wait for a slot, at most LLM_RPM starts a minute and LLM_CONCURRENCY at
// once. A 429 cools every call in the process down, not just the one that
// got it: all calls wait out the back-off, and the rate is halved for the
// next two minutes, so parallel agents don't keep hitting the limit.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RECENT_429_MS = 120_000;
let coolUntil = 0;
let last429 = 0;
const rpm = () => {
  const base = Number(process.env.LLM_RPM) || 30;
  return Date.now() - last429 < RECENT_429_MS ? Math.max(4, Math.floor(base / 2)) : base;
};
const concurrency = () => Number(process.env.LLM_CONCURRENCY) || 4;
const starts: number[] = [];
let active = 0;

interface CallStats {
  waitedMs: number;
  retries: number;
}

async function slot(stats: CallStats): Promise<() => void> {
  const began = Date.now();
  for (;;) {
    const now = Date.now();
    while (starts.length && now - starts[0] > 60_000) starts.shift();
    if (now < coolUntil) {
      await sleep(Math.min(1000, coolUntil - now));
      continue;
    }
    if (active < concurrency() && starts.length < rpm()) {
      active++;
      starts.push(now);
      stats.waitedMs += now - began;
      return () => {
        active--;
      };
    }
    await sleep(starts.length >= rpm() ? Math.min(1000, 60_050 - (now - starts[0])) : 100);
  }
}

async function post(route: Route, body: unknown, timeoutMs: number, stats: CallStats) {
  for (let attempt = 0; ; attempt++) {
    const release = await slot(stats);
    let res: Response;
    try {
      res = await fetch(route.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...route.headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } finally {
      release();
    }
    if (res.ok) return res.json();
    const detail = (await res.text()).slice(0, 300);
    const limited = res.status === 429 || /nvidia_429|too many requests/i.test(detail);
    if ((limited && attempt < 6) || (!limited && res.status >= 500 && attempt === 0)) {
      const wait = limited ? Number(res.headers.get("retry-after")) * 1000 || Math.min(30_000, 4000 * 2 ** attempt) : 1000;
      if (limited) {
        last429 = Date.now();
        coolUntil = Math.max(coolUntil, Date.now() + wait);
      }
      stats.retries++;
      stats.waitedMs += wait;
      await sleep(wait + Math.random() * 250);
      continue;
    }
    throw new LlmError(`${route.name} answered ${res.status}: ${detail}`, route.name, res.status);
  }
}

// Adds a short tag to the last user message so Nightshift's cache can't match it.
export function withRequestTag(messages: Message[], tag: string): Message[] {
  const last = messages.map((m) => m.role).lastIndexOf("user");
  if (last < 0) return messages;
  return messages.map((m, i) => (i === last ? { ...m, content: `${m.content ?? ""}\n\n[request ${tag}]` } : m));
}

async function send(opts: ChatOptions, fresh: boolean, stats: CallStats) {
  const body = {
    model: opts.model,
    messages: fresh ? withRequestTag(opts.messages, randomUUID().slice(0, 8)) : opts.messages,
    ...(opts.tools?.length ? { tools: opts.tools, tool_choice: "auto" } : {}),
    ...(opts.thinking ? {} : { chat_template_kwargs: { enable_thinking: false } }),
    max_tokens: opts.maxTokens ?? (opts.thinking ? 4096 : 1024),
  };
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const route = nightshift();
  try {
    return { route, data: await post(route, body, timeoutMs, stats) };
  } catch (err) {
    if (unreachable(err)) throw new LlmError(`Meterless Nightshift isn't reachable at ${route.url}. Is the Nightshift app running?`, route.name);
    throw err;
  }
}

export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const started = Date.now();
  const stats: CallStats = { waitedMs: 0, retries: 0 };
  try {
    return await attempt(opts, started, stats);
  } catch (err) {
    // Failed calls are traced too, so a fallback further up can't hide them.
    opts.trace?.add({
      step: opts.agent,
      agent: opts.agent,
      label: `${opts.label} (failed)`,
      route: "nightshift",
      model: opts.model,
      receipt: null,
      ms: Date.now() - started,
      detail: { error: (err as Error).message.slice(0, 200), ...stats },
    });
    throw err;
  }
}

async function attempt(opts: ChatOptions, started: number, stats: CallStats): Promise<ChatResult> {
  let { route, data } = await send(opts, !opts.cache, stats);
  let cached = data.meterless?.from_cache === true;
  let message: Message = data.choices?.[0]?.message ?? { role: "assistant", content: "" };
  // A cached reply that came back empty is useless; ask again, uncached.
  if (cached && !message.content && !message.tool_calls?.length) {
    ({ route, data } = await send(opts, true, stats));
    cached = data.meterless?.from_cache === true;
    message = data.choices?.[0]?.message ?? { role: "assistant", content: "" };
  }

  const raw = message.content ?? "";
  const thought = raw.lastIndexOf("</think>");
  const result: ChatResult = {
    text: stripThinking(raw),
    reasoning: thought >= 0 ? raw.slice(0, thought).replace(/<think>/g, "").trim() : "",
    message,
    toolCalls: message.tool_calls ?? [],
    route: route.name,
    model: data.meterless?.routed_model ?? data.model ?? opts.model,
    receipt: data.meterless?.receipt_id ?? null,
    cached,
    ms: Date.now() - started,
  };
  opts.trace?.add({
    step: opts.agent,
    agent: opts.agent,
    label: opts.label,
    route: result.route,
    model: result.model,
    receipt: result.receipt,
    ms: result.ms,
    detail: { cached, ...stats, tokens: data.usage?.completion_tokens ?? null, memories: data.meterless?.receipt?.hmem?.injected ?? 0, ...(result.reasoning ? { reasoning_chars: result.reasoning.length } : {}) },
  });
  return result;
}
