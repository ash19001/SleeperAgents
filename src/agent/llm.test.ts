import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { currentQuestion, extraBill, questionNotices, withQuestion } from "../lib/session.ts";
import { chat } from "./llm.ts";
import { Trace } from "./trace.ts";

const ask = (trace = new Trace()) => ({ agent: "intake", label: "Read the question", model: "nvidia/test", messages: [{ role: "user" as const, content: "Why?" }], trace });
const refused = () => Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } });

beforeEach(() => {
  vi.stubEnv("NIGHTSHIFT_BASE_URL", "http://127.0.0.1:9/v1");
  vi.stubEnv("NIGHTSHIFT_TOKEN", "test-token");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("chat, within one question", () => {
  it("stops calling Nightshift once it isn't reachable", async () => {
    const fetch = vi.fn(async () => {
      throw refused();
    });
    vi.stubGlobal("fetch", fetch);
    const trace = new Trace();
    await withQuestion(async () => {
      await expect(chat(ask(trace))).rejects.toThrow(/isn't reachable/);
      await expect(chat(ask(trace))).rejects.toThrow("Not sent: Meterless Nightshift isn't running.");
      expect(questionNotices(true)).toEqual([expect.stringMatching(/^The AI models couldn't finish this answer \(Meterless Nightshift isn't running\)/)]);
      expect(questionNotices(false)).toEqual([expect.stringMatching(/read by keyword rules alone/)]);
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(trace.steps.map((s) => s.label)).toEqual(["Read the question (failed)", "Read the question (not sent)"]);
    expect(trace.steps[1].model).toBeNull();
  });

  it("sends nothing once the question's time limit has passed", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await withQuestion(async () => {
      await new Promise((r) => setTimeout(r, 5));
      await expect(chat(ask())).rejects.toThrow(/time limit/);
      expect(currentQuestion()?.models?.reason).toBe("time");
      expect(questionNotices(true)[0]).toMatch(/^The AI models couldn't finish this answer \(they took longer than the/);
    }, 1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("doesn't count calls that never reached Nightshift against the rate limit", async () => {
    vi.stubEnv("LLM_RPM", "2");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(refused())));
    const started = Date.now();
    // Outside a question, so each call is tried; without the refund the third would wait a minute.
    for (let i = 0; i < 4; i++) await expect(chat(ask())).rejects.toThrow(/isn't reachable/);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("spaces calls evenly, even when they're asked for at once", async () => {
    vi.stubEnv("LLM_RPM", "600"); // one every 100 ms
    const at: number[] = [];
    vi.stubGlobal("fetch", vi.fn(async () => {
      at.push(Date.now());
      return Response.json({ choices: [{ message: { role: "assistant", content: "{}" } }] });
    }));
    await Promise.all([chat(ask()), chat(ask()), chat(ask())]);
    expect(at).toHaveLength(3);
    expect(at[1] - at[0]).toBeGreaterThanOrEqual(95);
    expect(at[2] - at[1]).toBeGreaterThanOrEqual(95);
  });

  it("gives a question about more bills more time, and says how long", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await withQuestion(async () => {
      const q = currentQuestion()!;
      expect(q.deadline - q.started).toBe(240_000);
      extraBill();
      expect(q.deadline - q.started).toBe(360_000);
      q.models = { reason: "time", why: "out of time" };
      expect(questionNotices(true)[0]).toMatch(/took longer than the 6-minute limit/);
      await expect(chat(ask())).rejects.toThrow("Not sent: the question's time limit was reached.");
    }, 240_000);
  });

  // Last: the 429 cools every later call in this file down.
  it("doesn't wait for a retry that would pass the time limit", async () => {
    vi.stubEnv("LLM_RPM", "600");
    const fetch = vi.fn(async () => new Response("Too Many Requests", { status: 429, headers: { "retry-after": "120" } }));
    vi.stubGlobal("fetch", fetch);
    const started = Date.now();
    await withQuestion(async () => {
      await expect(chat(ask())).rejects.toThrow(/would pass the question's time limit/);
      expect(currentQuestion()?.models?.reason).toBe("time");
    }, 10_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
