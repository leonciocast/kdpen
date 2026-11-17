// Screens of the paste review (word search + crossword, notes closed/open, narrow width).
// node scripts/paste-redesign-shots.mjs before|after   (server on :3000)
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const TAG = process.argv[2] ?? "after";
const OUT = "review/paste-redesign";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const errors = [];
async function run(width, height, name, tool) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: width < 600 ? 2 : 1 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`${BASE}/${tool}`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: ".Toastify{display:none!important}" });
  await page.click('[data-testid="choose-paste"]');
  await page.click('[data-testid="paste-example"]');
  if (tool === "cross-word") {
    const v = await page.inputValue('[data-testid="paste-input"]');
    await page.fill('[data-testid="paste-input"]', v + "\nCONE - A second cone clue\nSUNDAE\nSLUSH - Melting snow");
  }
  await page.click('[data-testid="paste-next"]');
  await page.waitForTimeout(500);
  await page.mouse.move(0, 0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${OUT}/${TAG}_${name}.png`, fullPage: true });
  const toggles = await page.$$('[data-testid="paste-notes-toggle"]');
  if (toggles.length) {
    for (const t of toggles) await t.click();
    await page.waitForTimeout(300);
    await page.mouse.move(0, 0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${OUT}/${TAG}_${name}_notes_open.png`, fullPage: true });
  }
  await ctx.close();
}
await run(1440, 1000, "ws", "word-search?type=classic");
await run(1440, 1000, "cw", "cross-word");
await run(390, 844, "ws_narrow", "word-search?type=classic");
if (TAG !== "before") {
  // Open menu (desktop)
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/word-search?type=classic`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: ".Toastify{display:none!important}" });
  await page.click('[data-testid="choose-paste"]');
  await page.click('[data-testid="paste-example"]');
  await page.click('[data-testid="paste-next"]');
  await page.waitForTimeout(400);
  await page.locator('[data-testid="paste-theme"]').nth(1).locator('[data-testid="paste-menu"]').click();
  await page.locator('[data-testid="paste-theme"]').nth(1).hover();
  await page.waitForTimeout(250);
  await page.locator(".pg-paste-review").screenshot({ path: `${OUT}/${TAG}_ws_menu.png` });
  await ctx.close();
}
await browser.close();
console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "No console errors.");
