// Screenshot every step of every tool at 1280px: node scripts/ux-screens.mjs <prefix>  (server on :3000)
// Writes review/ux/<prefix>_<tool>_<nn>_<step>.png. Fails on console errors.
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PREFIX = process.argv[2] ?? "after";
const OUT = "review/ux";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()}: ${m.text()}`));
page.on("pageerror", (e) => errors.push(`${page.url()}: ${e}`));
page.on("dialog", (d) => d.accept());
page.on("crash", () => console.log("PAGE CRASH at", page.url()));
const T0 = Date.now();
const stamp = (s) => console.log(((Date.now() - T0) / 1000).toFixed(1), s);
const pause = (ms = 350) => page.waitForTimeout(ms);
const next = () => page.click('[data-testid="wizard-next"]');
const shot = async (name) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await pause(250);
  await page.screenshot({ path: `${OUT}/${PREFIX}_${name}.png`, fullPage: true });
  stamp(name);
};
// Hide toasts for clean screenshots (never remove React-owned nodes).
const dismissToasts = () => page.addStyleTag({ content: ".Toastify{display:none!important}" });
const waitPreview = async () => {
  await page.waitForFunction(() => document.querySelector('[data-testid="design-preview"]')?.width > 50, null, { timeout: 30000 });
  await pause(700);
};
const openUpload = async () => {
  const b = await page.$('[data-testid="choose-upload"]');
  if (b) await b.click();
};

await page.goto(BASE + "/", { waitUntil: "networkidle" });
await shot("home");

// Word search
await page.goto(BASE + "/word-search", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await shot("ws_1a_add_words_empty");
await page.fill("#wordInput", "ICE CREAM\nSunshine\nBeach Ball\nSandcastle\nSeashell\nSurfing\nLemonade\nSunglasses\nPicnic\nWaves\nT-REX\nFlip Flops");
await page.fill("#themeInput", "Summer Fun");
await page.click('[data-testid="add-words"]').catch(() => page.click("text=Add to list"));
await pause();
await dismissToasts();
await shot("ws_1b_add_words_filled");
await openUpload();
await pause();
await shot("ws_1c_add_words_upload");
await next();
await shot("ws_2_settings");
await next();
await shot("ws_3a_place_choose");
await page.click('[data-testid="mode-auto"]');
await page.waitForSelector("#active-grid", { timeout: 60000 }).catch(() => {});
await pause(600);
await dismissToasts();
await shot("ws_3b_place_done");
await next();
await shot("ws_4_review");
await next();
await waitPreview();
await shot("ws_5_design");
await next();
await shot("ws_6_export");

// Crossword
await page.goto(BASE + "/cross-word", { waitUntil: "networkidle" });
await shot("cw_1a_clues_empty");
await page.fill("#clueInput", "LION - King of the jungle\nORANGE - Citrus fruit\nPIANO - Instrument with 88 keys\nEAGLE - Bird with sharp eyes\nICE CREAM - Frozen treat\nRAINBOW - Arc of colors\nCANDLE - Wax light\nAPPLE - Red fruit\nNORTH - Compass direction\nGARDEN - Where flowers grow");
await page.click('[data-testid="add-clues"]').catch(() => page.click("text=Add to list"));
await pause();
await dismissToasts();
await shot("cw_1b_clues_filled");
await next();
await shot("cw_2a_build");
await page.click('[data-testid="build-crosswords"]');
await page.waitForSelector("#cw-grid", { timeout: 60000 });
await pause(500);
await dismissToasts();
await shot("cw_2b_review");
await next();
await waitPreview();
await shot("cw_3_design");
await next();
await shot("cw_4_export");

// Sudoku
await page.goto(BASE + "/sudoku", { waitUntil: "networkidle" });
await shot("sd_1_choose");
await page.click('[data-testid="generate-sudoku"]');
await page.waitForSelector("#sudoku-grid", { timeout: 60000 });
await pause(400);
await dismissToasts();
await shot("sd_2_review");
await next();
await waitPreview();
await shot("sd_3_design");
await next();
await shot("sd_4_export");

await browser.close();
console.log(errors.length ? `CONSOLE ERRORS:\n${errors.join("\n")}` : `No console errors. Screens in ${OUT}/${PREFIX}_*`);
process.exit(errors.length ? 1 : 0);
