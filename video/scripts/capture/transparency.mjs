import { session, clickOn, glide } from "./rec.mjs";
const s = await session("http://localhost:5178");
const { page } = s;
const toEl = async (locator, offset = 30, ms = 1100) => {
  const box = await locator.boundingBox();
  await glide(page, box.y - offset, ms);
};
const tabs = page.getByRole("tablist", { name: "Answer detail" });
await s.start("transparency");
try {
  await page.waitForTimeout(600);
  await clickOn(page, page.getByRole("tab", { name: "Gas" }));
  await page.waitForTimeout(600);
  await clickOn(page, page.locator('button[aria-label^="Gas bill, Jan"]'));
  await page.waitForFunction(() => document.querySelector("#answer-title")?.textContent?.includes("Jan 2026"), null, { timeout: 30000 });
  await page.waitForTimeout(500);
  await toEl(page.locator("#answer-title"), 30, 1000);
  await page.waitForTimeout(1200);
  await toEl(tabs, 24, 1000);
  s.mark("worked");
  await clickOn(page, page.getByRole("tab", { name: /How the agents worked it out/ }));
  await page.waitForTimeout(2600);
  for (let i = 0; i < 3; i++) {
    await glide(page, 330, 1500);
    await page.waitForTimeout(2400);
  }
  s.mark("made");
  const made = page.getByText("How this answer was made").first();
  await made.scrollIntoViewIfNeeded();
  await clickOn(page, made);
  await page.waitForTimeout(900);
  await toEl(made, 30, 1100);
  await page.waitForTimeout(2600);
  await glide(page, 400, 1500);
  await page.waitForTimeout(2600);
  s.mark("evidence");
  await toEl(tabs, 24, 1200);
  await clickOn(page, page.getByRole("tab", { name: /Evidence/ }));
  await page.waitForTimeout(3200);
  const rows = page.locator("[role=tabpanel] ul button");
  let pick = rows.first();
  for (let i = 0; i < (await rows.count()); i++) if (/tariff/i.test(await rows.nth(i).innerText())) { pick = rows.nth(i); break; }
  s.mark("query");
  await clickOn(page, pick);
  await page.waitForTimeout(4200);
} finally {
  await s.stop();
  await page.screenshot({ path: "/private/tmp/claude-501/-Users-ash-Projects-sleeper-agents/c73f7feb-7a92-4e99-8d44-b3e35d0be88a/scratchpad/pw/tr-end.png" });
  await s.close();
}
