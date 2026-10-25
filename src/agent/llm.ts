// Every model call goes through here. Meterless Nightshift first; NVIDIA
// direct only when Nightshift can't be reached, and the trace says so.
// Wrong keys and refusals are raised, never retried on the other route.
//
// Nightshift has a response cache that keys on the user message alone and
// drops tool calls from cached replies (found 25 Oct 2026). So each call is
// made unique with a short request tag unless the caller opts into the cache.

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
  route: "nightshift" | "nvidia-direct";
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
      "meterless-scope": "user",
    },
  };
}

function nvidiaDirect(): Route {
  return {
    name: "nvidia-direct",
    url: `${process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1"}/chat/completions`,
    headers: { Authorization: `Bearer ${required("NVIDIA_API_KEY")}` },
  };
}

async function post(route: Route, body: unknown, timeoutMs: number) {
  // One retry for rate limits and server errors, on the same route.
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(route.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...route.headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.ok) return res.json();
    const detail = (await res.text()).slice(0, 300);
    if (attempt === 0 && (res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 1000));
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

async function send(opts: ChatOptions, fresh: boolean) {
  const body = {
    model: opts.model,
    messages: fresh ? withRequestTag(opts.messages, randomUUID().slice(0, 8)) : opts.messages,
    ...(opts.tools?.length ? { tools: opts.tools, tool_choice: "auto" } : {}),
    ...(opts.thinking ? {} : { chat_template_kwargs: { enable_thinking: false } }),
    max_tokens: opts.maxTokens ?? (opts.thinking ? 4096 : 1024),
  };
  const timeoutMs = opts.timeoutMs ?? 120_000;
  let route = nightshift();
  try {
    return { route, data: await post(route, body, timeoutMs) };
  } catch (err) {
    if (!unreachable(err)) throw err;
    route = nvidiaDirect();
    return { route, data: await post(route, body, timeoutMs) };
  }
}

export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const started = Date.now();
  try {
    return await attempt(opts, started);
  } catch (err) {
    // Failed calls are traced too, so a fallback further up can't hide them.
    opts.trace?.add({
      step: opts.agent,
      agent: opts.agent,
      label: `${opts.label} (failed)`,
      route: err instanceof LlmError ? err.route : "nightshift",
      model: opts.model,
      receipt: null,
      ms: Date.now() - started,
      detail: { error: (err as Error).message.slice(0, 200) },
    });
    throw err;
  }
}

async function attempt(opts: ChatOptions, started: number): Promise<ChatResult> {
  let { route, data } = await send(opts, !opts.cache);
  let cached = data.meterless?.from_cache === true;
  let message: Message = data.choices?.[0]?.message ?? { role: "assistant", content: "" };
  // A cached reply that came back empty is useless; ask again, uncached.
  if (cached && !message.content && !message.tool_calls?.length) {
    ({ route, data } = await send(opts, true));
    cached = data.meterless?.from_cache === true;
    message = data.choices?.[0]?.message ?? { role: "assistant", content: "" };
  }

  const result: ChatResult = {
    text: stripThinking(message.content ?? ""),
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
    detail: { cached },
  });
  return result;
}
