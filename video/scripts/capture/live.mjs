import { session, clickOn, glide } from "./rec.mjs";
const s = await session("http://localhost:5177");
const { page } = s;
await s.start("live-gas");
try {
  await page.waitForTimeout(1200);
  await clickOn(page, page.getByRole("tab", { name: "Gas" }));
  await page.waitForTimeout(900);
  await clickOn(page, page.locator('button[aria-label^="Gas bill, Jan"]'));
  s.mark("asked");
  await page.waitForTimeout(1500);
  await page.mouse.move(1265, 712, { steps: 20 });
  await glide(page, 260, 1000);
  const t = Date.now();
  // Follow the agent list as rows are added, until the answer arrives.
  for (;;) {
    const state = await page.evaluate(() => {
      const title = document.querySelector("#answer-title")?.textContent ?? "";
      const rows = document.querySelectorAll("ul[aria-live] > li");
      const last = rows[rows.length - 1]?.getBoundingClientRect().bottom ?? 0;
      return { done: title.includes("Jan 2026") || title.includes("Couldn"), over: last - (innerHeight - 24) };
    });
    if (state.done) break;
    if (state.over > 0) await glide(page, state.over + 30, 700);
    if (Date.now() - t > 420000) throw new Error("no answer in 7 minutes");
    await page.waitForTimeout(400);
  }
  s.mark("answer");
  console.log("answered in", ((Date.now() - t) / 1000).toFixed(0), "s");
  await page.waitForTimeout(4000);
} finally {
  await s.stop();
  console.log((await page.evaluate(() => document.querySelector("main")?.innerText ?? document.body.innerText)).slice(0, 1200));
  await s.close();
}
