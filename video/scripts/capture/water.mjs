import { session, clickOn, glide } from "./rec.mjs";
const answerHas = (page, text) => page.waitForFunction((t) => document.querySelector("#answer-title")?.textContent?.includes(t), text, { timeout: 30000 });
const toTop = async (page, sel, offset = 30) => {
  const y = await page.evaluate(([sel, offset]) => document.querySelector(sel).getBoundingClientRect().top - offset, [sel, offset]);
  await glide(page, y, 1100);
};

// Water: the possible leak.
{
  const s = await session("http://localhost:5178");
  const { page } = s;
  await s.start("water");
  await page.waitForTimeout(800);
  await clickOn(page, page.getByRole("button", { name: "Why did my water bill go up in June and July?" }).or(page.getByRole("link", { name: "Why did my water bill go up in June and July?" })).first());
  await answerHas(page, "water");
  await page.waitForTimeout(700);
  await toTop(page, "#answer-title");
  s.mark("answer");
  await page.waitForTimeout(4000);
  await glide(page, 520, 1600);
  s.mark("lower");
  await page.waitForTimeout(4000);
  await s.stop();
  await page.screenshot({ path: "water-end.png" });
  await s.close();
}
