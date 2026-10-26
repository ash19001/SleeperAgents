import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Each test starts with fresh modules, so nothing is known about Zetaris yet.
const fresh = async () => ({ ...(await import("./index.ts")), ...(await import("../lib/session.ts")) });
const answers = () => new Response(JSON.stringify({ headers: ["n"], data: [["30"]] }), { status: 200 });

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("WHYBILL_DATA", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("dataSource", () => {
  it("reads the local copy when Zetaris isn't running, and the answer says so", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    const { dataSource, withQuestion, questionNotices } = await fresh();
    await withQuestion(async () => {
      expect((await dataSource()).name).toBe("local-sample");
      expect(questionNotices(true)).toEqual(["Zetaris couldn't be used (it isn't running), so this answer read the local SAMPLE copy of the same data."]);
    });
  });

  it("switches to the local copy when Zetaris stops partway through, then tries again a minute later", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    let up = true;
    const fetch = vi.fn(async () => (up ? answers() : Promise.reject(new TypeError("fetch failed"))));
    vi.stubGlobal("fetch", fetch);
    const { dataSource, withQuestion, questionNotices } = await fresh();

    await withQuestion(async () => {
      const source = await dataSource();
      expect(source.name).toBe("zetaris");
      up = false;
      const read = await source.bills({ utility: "gas" });
      expect(read.evidence.source).toBe("local-sample");
      expect(read.rows.length).toBeGreaterThan(0);
      expect(source.name).toBe("local-sample");
      expect(questionNotices(true)[0]).toMatch(/^Zetaris couldn't be used \(it isn't running\)/);
    });

    // The next question goes straight to the local copy, without waiting on Zetaris.
    const calls = fetch.mock.calls.length;
    expect((await dataSource()).name).toBe("local-sample");
    expect(fetch.mock.calls.length).toBe(calls);

    // A minute later, Zetaris is back.
    up = true;
    vi.setSystemTime(Date.now() + 61_000);
    expect((await dataSource()).name).toBe("zetaris");
  });

  it("says nothing when told to use the local files", async () => {
    vi.stubEnv("WHYBILL_DATA", "local");
    const { dataSource, withQuestion, questionNotices } = await fresh();
    await withQuestion(async () => {
      expect((await dataSource()).name).toBe("local-sample");
      expect(questionNotices(true)).toEqual([]);
    });
  });
});
