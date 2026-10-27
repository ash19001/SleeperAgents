// Records real browser clips as JPEG frames with timestamps (CDP screencast),
// with a drawn cursor, for the demo video.
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";

const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
// FOOTAGE_OUT keeps frames out of the project while recording, so the
// dev server's file watcher doesn't see thousands of new files.
export const OUT = process.env.FOOTAGE_OUT ?? new URL("../../public/footage", import.meta.url).pathname;

const CURSOR = `
(() => {
  const add = () => {
    if (document.getElementById("__cursor")) return;
    const c = document.createElement("div");
    c.id = "__cursor";
    c.innerHTML = '<svg width="30" height="34" viewBox="0 0 30 34"><path d="M3 2 L3 26 L9.5 20 L14 31 L18.5 29 L14 18.5 L23 18.5 Z" fill="#0b1530" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: "fixed", left: "0", top: "0", zIndex: "2147483647", pointerEvents: "none", translate: "-100px -100px", transition: "none" });
    const ring = document.createElement("div");
    ring.id = "__ring";
    Object.assign(ring.style, { position: "fixed", width: "44px", height: "44px", marginLeft: "-22px", marginTop: "-22px", borderRadius: "50%", border: "3px solid #ffde3b", background: "rgba(255,222,59,0.25)", zIndex: "2147483646", pointerEvents: "none", opacity: "0", left: "0", top: "0" });
    document.documentElement.append(ring, c);
    addEventListener("mousemove", (e) => { c.style.translate = (e.clientX - 3) + "px " + (e.clientY - 2) + "px"; }, true);
    addEventListener("mousedown", (e) => {
      ring.style.left = e.clientX + "px"; ring.style.top = e.clientY + "px";
      ring.animate([{ opacity: 1, scale: 0.5 }, { opacity: 0, scale: 1.4 }], { duration: 450, easing: "ease-out" });
    }, true);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", add); else add();
})();`;

export async function session(url, { width = 1280, height = 720, scale = 1.5 } = {}) {
  // The forced scale makes screencast frames full resolution (1920 x 1080).
  const browser = await chromium.launch({ executablePath: exe, args: [`--force-device-scale-factor=${scale}`] });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale });
  await context.addInitScript(CURSOR);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.mouse.move(width * 0.6, height * 0.55);
  const cdp = await context.newCDPSession(page);
  let clip = null;

  // Frames arrive only when the page repaints; the timestamps say when.
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    if (!clip) return;
    const file = `${String(clip.frames.length).padStart(5, "0")}.jpg`;
    writeFileSync(`${clip.dir}/${file}`, Buffer.from(data, "base64"));
    clip.frames.push({ file, t: metadata.timestamp });
  });

  return {
    page, errors,
    async start(name) {
      const dir = `${OUT}/${name}`;
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      clip = { name, dir, frames: [], t0: Date.now() / 1000 };
      await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: width * scale, maxHeight: height * scale, everyNthFrame: 1 });
      // Force a first frame.
      await page.evaluate(() => document.body.style.setProperty("--nudge", String(Math.random())));
      await page.waitForTimeout(300);
    },
    // Marks a moment in the clip, for the edit.
    mark(label) { clip.marks = clip.marks ?? []; clip.marks.push({ label, t: Date.now() / 1000 }); },
    async stop() {
      await page.waitForTimeout(400);
      await cdp.send("Page.stopScreencast");
      const c = clip;
      clip = null;
      const t0 = c.frames[0]?.t ?? c.t0;
      const end = Date.now() / 1000;
      writeFileSync(`${c.dir}/frames.json`, JSON.stringify({
        width: width * scale, height: height * scale,
        duration: +(end - t0).toFixed(3),
        frames: c.frames.map((f) => ({ file: f.file, t: +(f.t - t0).toFixed(3) })),
        marks: (c.marks ?? []).map((m) => ({ label: m.label, t: +(m.t - t0).toFixed(3) })),
      }));
      console.log(`${c.name}: ${c.frames.length} frames, ${(end - t0).toFixed(1)} s`);
    },
    async close() { await browser.close(); if (errors.length) console.log("page errors:", errors); },
  };
}

// Smooth pointer travel to an element, then a click.
export async function clickOn(page, locator, { steps = 28, pause = 250 } = {}) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps });
  await page.waitForTimeout(pause);
  await page.mouse.down();
  await page.mouse.up();
}

export async function typeInto(page, locator, text, delay = 45) {
  await clickOn(page, locator);
  await locator.fill("");
  await page.keyboard.type(text, { delay });
}

// Eased smooth scroll by a distance, so the page glides rather than jumps.
export async function glide(page, dy, ms = 1200) {
  await page.evaluate(async ([dy, ms]) => {
    const start = scrollY, t0 = performance.now();
    await new Promise((done) => {
      const step = (now) => {
        const p = Math.min(1, (now - t0) / ms);
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        scrollTo(0, start + dy * e);
        p < 1 ? requestAnimationFrame(step) : done();
      };
      requestAnimationFrame(step);
    });
  }, [dy, ms]);
}
