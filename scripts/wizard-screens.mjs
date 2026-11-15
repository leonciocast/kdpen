// Screenshot every question of every tool at 1280px: node scripts/wizard-screens.mjs  (server on :3000)
// Writes review/wizard/<tool>_<nn>_<screen>.png. Also exercises Back, Skip, Enter and "add more". Fails on console errors.
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "review/wizard";
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
const checks = [];
page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()}: ${m.text()}`));
page.on("pageerror", (e) => errors.push(`${page.url()}: ${e}`));
page.on("dialog", (d) => d.accept());
const T0 = Date.now();
const stamp = (s) => console.log(((Date.now() - T0) / 1000).toFixed(1), s);
const pause = (ms = 350) => page.waitForTimeout(ms);
const next = async () => {
  await page.click('[data-testid="wizard-next"]');
  await pause();
};
const back = async () => {
  await page.click('[data-testid="wizard-back"]');
  await pause();
};
const q = () => page.getAttribute("[data-question]", "data-question");
const expectQ = async (key, what) => {
  const k = await q();
  checks.push(`${k === key ? "✓" : "✗"} ${what} (on "${k}", expected "${key}")`);
  if (k !== key) errors.push(`flow: ${what}: on "${k}", expected "${key}"`);
};
const hideToasts = () => page.addStyleTag({ content: ".Toastify{display:none!important}" });
const shot = async (name) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await pause(250);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  stamp(name);
};
const waitPreview = async () => {
  await page.waitForFunction(() => document.querySelector('[data-testid="design-preview"]')?.width > 50, null, { timeout: 30000 });
  await pause(700);
};

async function sharedDesignExport(prefix, n) {
  await waitPreview();
  await shot(`${prefix}_${n}a_design_template`);
  await next();
  await expectQ("plan", `${prefix}: template → shape plan`);
  await next();
  await expectQ("shape", `${prefix}: plan → shape`);
  await waitPreview();
  await shot(`${prefix}_${n}a2_design_shape`);
  await next();
  await expectQ("frame", `${prefix}: shape → frame`);
  await waitPreview();
  await shot(`${prefix}_${n}a3_design_frame`);
  await next();
  await shot(`${prefix}_${n}b_design_happy`);
  await page.click('[data-testid="design-customize"]');
  await waitPreview();
  await shot(`${prefix}_${n}c_design_customize`);
  await next();
  await expectQ("size", `${prefix}: customize → export size`);
  await shot(`${prefix}_${n + 1}a_export_size`);
  await next();
  await shot(`${prefix}_${n + 1}b_export_title`);
  await next();
  await shot(`${prefix}_${n + 1}c_export_extras`);
  await page.click('[data-testid="wizard-skip"]');
  await expectQ("preview", `${prefix}: skip extras → preview & arrange`);
  await page.waitForSelector('[data-testid="book-preview"][data-ready="1"]', { timeout: 60000 });
  await pause(800);
  await shot(`${prefix}_${n + 1}d_export_preview`);
  await next();
  await expectQ("create", `${prefix}: preview → create`);
  await shot(`${prefix}_${n + 1}e_export_create`);
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 120000 }), page.click('[data-testid="download-pdf"]')]);
  await dl.path();
  await pause(500);
  await shot(`${prefix}_${n + 1}f_export_done`);
  // Back from export's first question lands on design's last question.
  for (let i = 0; i < 5; i++) await back();
  await expectQ("customize", `${prefix}: back from export → design customize`);
}

await page.goto(BASE + "/", { waitUntil: "networkidle" });
await shot("00_home");

// ---------------- Word search ----------------
await page.goto(BASE + "/word-search", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await hideToasts();
await shot("ws_1a_how");
await page.click('[data-testid="choose-type"]');
await shot("ws_1b_type_empty");
await page.fill("#wordInput", "ICE CREAM\nSunshine\nBeach Ball\nSandcastle\nSeashell\nSurfing\nLemonade\nSunglasses\nPicnic\nWaves\nT-REX\nFlip Flops");
await shot("ws_1c_type_filled");
await page.press("#wordInput", "Control+Enter");
await pause();
await expectQ("theme", "ws: Ctrl+Enter in textarea → theme");
await page.fill("#themeInput", "Summer Fun");
await shot("ws_1d_theme");
await back();
await expectQ("type", "ws: back from theme → type");
checks.push(`${(await page.inputValue("#wordInput")).includes("Flip Flops") ? "✓" : "✗"} ws: typed words kept after going back`);
await next();
checks.push(`${(await page.inputValue("#themeInput")) === "Summer Fun" ? "✓" : "✗"} ws: theme kept after going back`);
await page.press("#themeInput", "Enter");
await pause();
await expectQ("list", "ws: Enter on theme → words added, list shown");
await shot("ws_1e_list");
await page.click('[data-testid="add-more"]');
await expectQ("how", "ws: add more → choice");
await page.click('[data-testid="choose-type"]');
await page.fill("#wordInput", "Sun Hat");
await next();
await page.click('[data-testid="wizard-skip"]');
await expectQ("list", "ws: skip theme → list");
await page.click('[aria-label="Remove SUN HAT"]');
await next();
await shot("ws_2a_difficulty");
await page.click('[data-testid="difficulty-medium"]');
await expectQ("size", "ws: picking a difficulty → size");
await shot("ws_2b_size");
await next();
await shot("ws_2c_rules");
await next();
await shot("ws_3a_place_how");
await page.click('[data-testid="mode-auto"]');
await page.waitForSelector('[data-testid="puzzle-pager"], #active-grid', { timeout: 60000 });
await pause(500);
await shot("ws_3b_place_ready");
await next();
await shot("ws_4_review");
await next();
await sharedDesignExport("ws", 5);
// Manual placement is its own screen
await page.click('text=Place words'); // stepper
await back();
await expectQ("how", "ws: back from puzzles → placement choice");
await page.click('[data-testid="mode-manual"]');
await pause(500);
await shot("ws_3c_place_manual");

// ---------------- Crossword ----------------
await page.goto(BASE + "/cross-word", { waitUntil: "networkidle" });
await hideToasts();
await shot("cw_1a_how");
await page.click('[data-testid="choose-type"]');
await shot("cw_1b_type_empty");
await page.fill("#clueInput", "LION - King of the jungle\nICE CREAM - Frozen summer treat\nPIANO - Instrument with 88 keys\nAPPLE - Red fruit\nLEMON - Citrus fruit\nRAINBOW - Arc of colors\nCANDLE - Wax light\nOWL - Bird with sharp eyes\nTULIP - Spring flower\nNORTH - Compass direction");
await shot("cw_1c_type_filled");
await page.click('[data-testid="add-clues"]');
await pause();
await expectQ("list", "cw: add → list");
await shot("cw_1d_list");
await next();
await shot("cw_2a_size");
await page.click('[data-testid="build-crosswords"]');
await page.waitForSelector("#cw-grid", { timeout: 60000 });
await pause(400);
await shot("cw_2b_results");
await next();
await sharedDesignExport("cw", 3);
await page.goto(BASE + "/cross-word", { waitUntil: "networkidle" });
await hideToasts();
await page.click('[data-testid="choose-upload"]');
await shot("cw_1e_upload");

// ---------------- Sudoku ----------------
await page.goto(BASE + "/sudoku", { waitUntil: "networkidle" });
await hideToasts();
await shot("sd_1a_mix");
await page.click('[data-testid="quick-1"]');
await expectQ("counts", "sd: preset → counts");
await shot("sd_1b_counts");
await page.click('[data-testid="generate-sudoku"]');
await page.waitForSelector("#sudoku-grid", { timeout: 120000 });
await pause(400);
await shot("sd_2_review");
await next();
await sharedDesignExport("sd", 3);

// Word search upload path
await page.goto(BASE + "/word-search", { waitUntil: "networkidle" });
await hideToasts();
await page.click('[data-testid="choose-upload"]');
await shot("ws_1f_upload");

await browser.close();
console.log(checks.join("\n"));
console.log(errors.length ? `ERRORS (${errors.length}):\n${errors.join("\n")}` : "No console errors.");
process.exit(errors.length ? 1 : 0);
