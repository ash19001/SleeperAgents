import { session, clickOn, glide } from "./rec.mjs";
const answerHas = (page, text) => page.waitForFunction((t) => document.querySelector("#answer-title")?.textContent?.includes(t), text, { timeout: 30000 });
const toTop = async (page, sel, offset = 30) => {
  const y = await page.evaluate(([sel, offset]) => document.querySelector(sel).getBoundingClientRect().top - offset, [sel, offset]);
  await glide(page, y, 1100);
};

// Heat pump note: April electricity before and after.
{
  const s = await session("http://localhost:5178");
  const { page } = s;
  await s.start("heatpump");
  await page.waitForTimeout(800);
  await clickOn(page, page.getByRole("button", { name: "Why did my electricity bill change in April?" }).or(page.getByRole("link", { name: "Why did my electricity bill change in April?" })).first());
  await answerHas(page, "April");
  s.mark("before");
  await page.waitForTimeout(700);
  await toTop(page, "#answer-title");
  await page.waitForTimeout(4500);
  s.mark("to-notes");
  await toTop(page, "#notes-title", 20);
  await page.waitForTimeout(600);
  await clickOn(page, page.getByRole("button", { name: "Use the heat pump example" }));
  await page.waitForTimeout(900);
  await clickOn(page, page.getByRole("button", { name: "Save note" }));
  s.mark("saved");
  await page.waitForTimeout(1300);
  await clickOn(page, page.getByRole("button", { name: "Ask the last question again" }));
  s.mark("ask-again");
  await page.waitForTimeout(1000);
  await toTop(page, "#answer-title");
  s.mark("after");
  await page.waitForTimeout(4000);
  const m1 = page.locator("section[aria-labelledby=answer-title] button", { hasText: /^M1$/ }).first();
  await clickOn(page, m1);
  s.mark("note-drawer");
  await page.waitForTimeout(3500);
  await s.stop();
  await page.screenshot({ path: "hp-end.png" });
  await s.close();
}

