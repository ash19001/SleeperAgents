import { session, clickOn, typeInto, glide } from "./rec.mjs";
// Live mode: ask about a bill that isn't there yet, add it, and let the agents
// explain it. Writes .household/added.json and refreshes Zetaris's cached
// supplier feeds; undo both afterwards.
const s = await session("http://localhost:5177");
const { page } = s;
const title = () => page.evaluate(() => document.querySelector("#answer-title")?.textContent ?? "");
const toEl = async (locator, offset = 30, ms = 1100) => {
  const box = await locator.boundingBox();
  await glide(page, box.y - offset, ms);
};
await s.start("addbill");
try {
  await page.waitForTimeout(1000);
  await typeInto(page, page.locator("input[placeholder]"), "Why did my gas bill change in October 2026?");
  await page.waitForTimeout(300);
  await clickOn(page, page.getByRole("button", { name: "Ask", exact: true }));
  s.mark("asked");
  await page.waitForFunction(() => document.querySelector("#answer-title")?.textContent?.includes("isn't here"), null, { timeout: 120000, polling: 300 });
  s.mark("missing");
  await page.waitForTimeout(2200);
  await clickOn(page, page.getByRole("button", { name: /Add the October 2026 gas bill/ }));
  await page.waitForFunction(() => document.querySelector("#answer-title")?.textContent?.startsWith("Add your"), null, { timeout: 30000 });
  await page.waitForTimeout(800);
  s.mark("form");
  await toEl(page.locator("#answer-title"), 30, 1000);
  await page.waitForTimeout(1500);
  await clickOn(page, page.getByRole("button", { name: "Fill in example figures" }));
  s.mark("filled");
  await page.waitForTimeout(2200);
  await toEl(page.getByText("Units used:"), 260, 1100);
  await page.waitForTimeout(2200);
  await clickOn(page, page.getByRole("button", { name: "Save bill and explain it" }));
  s.mark("saved");
  await page.mouse.move(1265, 712, { steps: 20 });
  const t = Date.now();
  let scrolled = false;
  for (;;) {
    const state = await page.evaluate(() => {
      const title = document.querySelector("#answer-title")?.textContent ?? "";
      const rows = document.querySelectorAll("ul[aria-live] > li");
      const last = rows[rows.length - 1]?.getBoundingClientRect().bottom ?? 0;
      const head = document.querySelector("#answer-title")?.getBoundingClientRect().top ?? 0;
      return { title, working: title.includes("working"), done: /^Why/.test(title) || title.includes("Couldn"), over: last - (innerHeight - 24), head };
    });
    if (state.done) break;
    if (state.working && !scrolled) { scrolled = true; s.mark("working"); await glide(page, state.head - 30, 900); }
    else if (state.working && state.over > 0) await glide(page, state.over + 30, 700);
    if (Date.now() - t > 420000) throw new Error("no answer in 7 minutes");
    await page.waitForTimeout(400);
  }
  s.mark("answer");
  console.log("answered in", ((Date.now() - t) / 1000).toFixed(0), "s:", await title());
  await page.waitForTimeout(800);
  await toEl(page.locator("#answer-title"), 30, 1100);
  await page.waitForTimeout(4500);
} finally {
  await s.stop();
  await page.screenshot({ path: "/private/tmp/claude-501/-Users-ash-Projects-sleeper-agents/c73f7feb-7a92-4e99-8d44-b3e35d0be88a/scratchpad/pw/ab-end.png" });
  await s.close();
}
