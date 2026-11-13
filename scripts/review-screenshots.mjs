// Headless review: node scripts/review-screenshots.mjs (server must be on :3000)
import { chromium } from "playwright";
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const out = (n) => `review/${n}`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.screenshot({ path: out("01_home.png") });

await page.goto(BASE + "/word-search", { waitUntil: "networkidle" });
await page.fill("#wordInput", "SUNFLOWER TOMATO BASIL SHOVEL COMPOST TULIP CARROT MULCH NIÑO T-REX");
await page.click("text=Add Words");
await page.fill("#gridSize", "12");
await page.click("text=Place words manually");
const cell = (r, c) => page.locator(`#active-grid [data-cell="${r},${c}"]`);
// SUNFLOWER: click start then end
await page.click('[data-word="SUNFLOWER"]');
await cell(0, 0).click();
await cell(0, 8).click();
// TOMATO: chosen direction (down)
await page.click('[data-word="TOMATO"]');
await page.selectOption("#dirMode", "S");
await cell(1, 2).click();
// BASIL diagonal using shared S? place diagonally from (2,4)
await page.selectOption("#dirMode", "click-end");
await page.click('[data-word="BASIL"]');
await cell(3, 4).click();
await cell(7, 8).click();
// invalid attempt: SHOVEL across row 0 conflicts -> expect toast
await page.click('[data-word="SHOVEL"]');
await cell(0, 3).click();
await cell(5, 3).click();
await page.waitForTimeout(300);
// hover preview for next word
await page.click('[data-word="COMPOST"]');
await cell(11, 0).click();
await cell(11, 6).hover();
await page.waitForTimeout(300);
await page.screenshot({ path: out("02_editor_manual_placement.png"), fullPage: true });
const toasts = await page.locator(".Toastify__toast").allInnerTexts();

await page.keyboard.press("Escape");
await page.click("text=Auto-place remaining");
await page.click("text=Fill random letters");
await page.waitForTimeout(500);
await page.screenshot({ path: out("03_generated_puzzle.png"), fullPage: true });
await page.click("text=Show Solution");
await page.waitForTimeout(300);
await page.screenshot({ path: out("04_solution_color.png"), fullPage: true });
await page.selectOption('select[aria-label="Solution style"]', "bw");
await page.waitForTimeout(300);
await page.locator("#active-grid").screenshot({ path: out("05_solution_bw_grid.png") });

// Automatic mode with multiple puzzles + PDF download from the browser
await page.fill("#wordInput", "WHALE CORAL DOLPHIN LOBSTER SEAWEED OCTOPUS TIDE HARBOR ANCHOR STARFISH");
await page.click("text=Add Words");
await page.fill("#wordsPerPuzzle", "10");
await page.click("text=Generate automatically");
await page.waitForTimeout(500);
await page.screenshot({ path: out("06_auto_generated.png"), fullPage: true });
const [dl] = await Promise.all([page.waitForEvent("download"), page.click("text=Download KDP PDF")]);
await dl.saveAs(out("browser_export.pdf"));
await page.waitForTimeout(500);
console.log(JSON.stringify({ errors, toasts }, null, 2));
await browser.close();
