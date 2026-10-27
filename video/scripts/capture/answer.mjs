import { session, clickOn, glide } from "./rec.mjs";
const s = await session("http://localhost:5178");
const { page } = s;
const toTop = async (sel, offset = 30, ms = 1100) => {
  const y = await page.evaluate(([sel, offset]) => document.querySelector(sel).getBoundingClientRect().top - offset, [sel, offset]);
  await glide(page, y, ms);
};
const toText = async (text, offset = 30, ms = 1100) => {
  const el = page.getByText(text, { exact: false }).first();
  const box = await el.boundingBox();
  await glide(page, box.y - offset, ms);
};
await s.start("answer-gas");
try {
  await page.waitForTimeout(600);
  await clickOn(page, page.getByRole("tab", { name: "Gas" }));
  await page.waitForTimeout(700);
  await clickOn(page, page.locator('button[aria-label^="Gas bill, Jan"]'));
  await page.waitForFunction(() => document.querySelector("#answer-title")?.textContent?.includes("Jan 2026"), null, { timeout: 30000 });
  s.mark("answer");
  await page.waitForTimeout(500);
  await toTop("#answer-title");
  await page.mouse.move(1000, 640, { steps: 20 });
  await page.waitForTimeout(4500);
  s.mark("fact");
  await clickOn(page, page.locator('button[title="Where £27.05 comes from"]').first());
  await page.waitForTimeout(2600);
  s.mark("sql");
  const rows = page.locator("dialog[open] ul button");
  const n = await rows.count();
  let pick = rows.first();
  for (let i = 0; i < n; i++) if (/weather/i.test(await rows.nth(i).innerText())) { pick = rows.nth(i); break; }
  await clickOn(page, pick);
  await page.waitForTimeout(4500);
  s.mark("close");
  await clickOn(page, page.locator("dialog[open]").getByRole("button", { name: "Close" }));
  await page.waitForTimeout(600);
  s.mark("split");
  await toText("Where the £", 30, 1300);
  await page.waitForTimeout(4000);
  s.mark("worked");
  await clickOn(page, page.getByRole("tab", { name: /How the agents worked it out/ }));
  await page.waitForTimeout(600);
  await toText("The investigation, round by round", 30, 1200);
  await page.waitForTimeout(3500);
  await glide(page, 480, 1600);
  await page.waitForTimeout(3000);
  s.mark("made");
  const made = page.getByText("How this answer was made").first();
  await clickOn(page, made);
  await page.waitForTimeout(600);
  await toText("How this answer was made", 30, 1200);
  await page.waitForTimeout(3500);
  await glide(page, 420, 1500);
  await page.waitForTimeout(3000);
} finally {
  await s.stop();
  await page.screenshot({ path: "answer-end.png" });
  await s.close();
}
