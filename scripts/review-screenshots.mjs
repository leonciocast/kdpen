// End-to-end review walkthrough: node scripts/review-screenshots.mjs (server must be on :3000)
// Walks every tool like a new user and saves screenshots + downloaded PDFs into review/.
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "review";
fs.mkdirSync(OUT, { recursive: true });
// Scroll to the top first so the sticky header is not captured mid-page.
const shot = async (page, name, full = true) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
};
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()}: ${m.text()}`));
page.on("pageerror", (e) => errors.push(`${page.url()}: ${e}`));
const next = () => page.click('[data-testid="wizard-next"]');
const pause = (ms = 300) => page.waitForTimeout(ms);
async function download(name) {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), page.click('[data-testid="download-pdf"]')]);
  await dl.saveAs(`${OUT}/${name}`);
  return name;
}
const log = [];

// ---------- Home ----------
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await shot(page, "01_home");

// ---------- Word search ----------
await page.goto(BASE + "/word-search", { waitUntil: "networkidle" });
await shot(page, "02_ws_step1_empty");
await page.fill("#wordInput", "ICE CREAM\nSunshine\nBeach Ball\nSandcastle\nSeashell\nSurfing\nLemonade\nSunglasses\nPicnic\nWaves\nT-REX\nBAD WORD!!");
await page.click("text=Add to list");
await pause();
await shot(page, "03_ws_step1_words");
log.push("toasts after add: " + (await page.locator(".Toastify__toast").allInnerTexts()).join(" | "));
await next();
await page.fill("#gridSize", "14");
await shot(page, "04_ws_step2_settings");
await next();
await shot(page, "05_ws_step3_choose_mode");
await page.click('[data-testid="mode-manual"]');
await pause();
const cell = (r, c) => page.locator(`#active-grid [data-cell="${r},${c}"]`);
// ICE CREAM across (default direction) from top-left
await page.click('[data-word="ICE CREAM"]');
await cell(0, 0).click();
// SUNSHINE down
await page.click('[data-word="SUNSHINE"]');
await page.click('[data-dir="S"]');
await cell(1, 0).click();
// BEACH BALL diagonal
await page.click('[data-word="BEACH BALL"]');
await page.click('[data-dir="SE"]');
await cell(2, 2).click();
// SANDCASTLE start -> end mode
await page.click('[data-word="SANDCASTLE"]');
await page.click('[data-dir="free"]');
await cell(13, 0).click();
await cell(13, 9).click();
// SEASHELL backwards up: show live preview
await page.click('[data-word="SEASHELL"]');
await page.click('[data-dir="N"]');
await cell(12, 12).hover();
await pause();
await shot(page, "06_ws_step3_manual_preview");
log.push("instruction: " + (await page.locator('[data-testid="editor-instruction"]').innerText()));
await cell(12, 12).click();
// Invalid attempt (clash) to confirm friendly message
await page.click('[data-word="SURFING"]');
await page.click('[data-dir="E"]');
await cell(0, 3).click();
await pause();
log.push("toasts after clash: " + (await page.locator(".Toastify__toast").allInnerTexts()).join(" | "));
await page.click("text=/Auto-place/");
await pause();
await page.click('[data-testid="fill-letters"]');
await pause(500);
await shot(page, "07_ws_step3_finished");
await next();
await page.click("label[for=showSolution]");
await pause();
await shot(page, "08_ws_step4_review_solution");
await next();
await page.fill("#fm-title", "Summer Fun Word Search");
await page.fill("#fm-subtitle", "Large Print Puzzles for Sunny Days");
await page.fill("#fm-author", "Your Name");
await page.fill("#fm-dedication", "For everyone who loves summer.");
await pause();
await shot(page, "09_ws_step5_export");
await download("ws_downloaded.pdf");

// ---------- Crossword ----------
await page.goto(BASE + "/cross-word", { waitUntil: "networkidle" });
await shot(page, "10_cw_step1_empty");
await page.click("text=/Try a sample/");
await page.fill("#clueInput", "ICE CREAM - Frozen summer treat");
await page.click("text=/Add to list|Add clues|Add/ >> nth=0");
await pause();
await shot(page, "11_cw_step1_words");
await next();
await page.click('[data-testid="build-crosswords"]');
await pause(800);
await page.click("label[for=cwAnswers]");
await pause();
await shot(page, "12_cw_step2_review");
await next();
await shot(page, "13_cw_step3_export");
await download("cw_downloaded.pdf");

// ---------- Sudoku ----------
await page.goto(BASE + "/sudoku", { waitUntil: "networkidle" });
await page.click("text=Medium");
await page.fill("#count", "6");
await shot(page, "14_sd_step1_settings");
await page.click('[data-testid="generate-sudoku"]');
await pause(800);
await page.click("label[for=sdSolution]");
await shot(page, "15_sd_step2_review");
await next();
await shot(page, "16_sd_step3_export");
await download("sd_downloaded.pdf");

// Print view check (puzzles render in print media)
await page.emulateMedia({ media: "print" });
await page.pdf({ path: `${OUT}/sd_browser_print.pdf`, format: "Letter" });
await page.emulateMedia({ media: "screen" });

// ---------- Mobile ----------
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
m.on("pageerror", (e) => errors.push(`mobile: ${e}`));
await m.goto(BASE + "/word-search", { waitUntil: "networkidle" });
await m.click("text=Try a sample list");
await m.click('[data-testid="wizard-next"]');
await m.click('[data-testid="wizard-next"]');
await m.click('[data-testid="mode-manual"]');
await m.waitForTimeout(400);
await shot(m, "17_mobile_ws_manual");
await m.goto(BASE + "/", { waitUntil: "networkidle" });
await shot(m, "18_mobile_home");
await m.goto(BASE + "/sudoku", { waitUntil: "networkidle" });
await shot(m, "19_mobile_sudoku");
const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
log.push("mobile horizontal overflow: " + overflow);

await browser.close();
console.log(log.join("\n"));
console.log(errors.length ? "CONSOLE ERRORS:\n" + errors.join("\n") : "No console errors.");
