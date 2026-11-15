// End-to-end review: node scripts/review-screenshots.mjs (server must be on :3000)
// Walks every tool like a user (incl. a 10,000-word word search book and a 100-sudoku book),
// saves screenshots + PDFs into review/ and prints timings. Fails on console errors.
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "review";
fs.mkdirSync(OUT, { recursive: true });
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
page.on("dialog", (d) => d.accept());
const next = () => page.click('[data-testid="wizard-next"]');
const pause = (ms = 300) => page.waitForTimeout(ms);
const log = [];
const t = () => performance.now();

async function exportBook(name, timeout = 240000) {
  const t0 = t();
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout }), page.click('[data-testid="download-pdf"]')]);
  await dl.saveAs(`${OUT}/${name}`);
  const secs = ((t() - t0) / 1000).toFixed(1);
  const kb = Math.round(fs.statSync(`${OUT}/${name}`).size / 1024);
  log.push(`${name}: ${kb} KB, built + downloaded in ${secs}s`);
  return { secs, kb };
}
async function waitPreview() {
  await page.waitForFunction(() => {
    const c = document.querySelector('[data-testid="design-preview"]');
    return c && c.width > 50;
  }, null, { timeout: 30000 });
  await pause(700);
}

// ---------- Home ----------
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await shot(page, "01_home");

// ---------- Word search: small book with manual placement ----------
await page.goto(BASE + "/word-search", { waitUntil: "networkidle" });
await page.click('[data-testid="choose-type"]');
await page.fill("#wordInput", "ICE CREAM\nSunshine\nBeach Ball\nSandcastle\nSeashell\nSurfing\nLemonade\nSunglasses\nPicnic\nWaves\nT-REX");
await next(); // -> theme
await page.fill("#themeInput", "Summer Fun");
await next(); // add to list -> list
await pause();
await shot(page, "02_ws_step1_words");
await next();
await page.click('[data-testid="difficulty-hard"]'); // picks and moves on to size
await shot(page, "03_ws_step2_settings");
await next(); // -> rules
await next(); // -> place words
await page.click('[data-testid="mode-manual"]');
await pause();
await page.click('[data-word="ICE CREAM"]');
await page.locator('#active-grid [data-cell="0,0"]').click();
await page.click("text=Finish the rest automatically");
await pause();
await shot(page, "04_ws_step3_placed");
await next();
await shot(page, "05_ws_step4_review");
await next();
await waitPreview();
await shot(page, "06_ws_design_banner");
for (const id of ["kids", "elegant", "largeprint"]) {
  await page.click(`[data-testid="template-${id}"]`);
  await waitPreview();
  await shot(page, `07_ws_design_${id}`);
}
await page.click('[data-testid="template-banner"]');
await next(); // -> plan
await next(); // -> shape
await next(); // -> frame
await next(); // -> happy with it?
await page.click('[data-testid="design-customize"]');
await page.click('[data-testid="customize"] summary:has-text("Word list")');
await page.click('[data-testid="checkbox-toggle"]');
await waitPreview();
await page.locator('[data-testid="design-preview"]').screenshot({ path: `${OUT}/08_ws_preview_no_checkbox.png` });
await page.click('[data-testid="checkbox-toggle"]');
await page.click('[role="tablist"] >> text=How to play');
await waitPreview();
await page.locator('[data-testid="design-preview"]').screenshot({ path: `${OUT}/09_ws_preview_howto.png` });
await next(); // -> export: size
await shot(page, "10_ws_export");
await next(); // title
await next(); // extras
await next(); // preview
await next(); // create
await exportBook("ws_small_book.pdf");

// ---------- Word search: 10,000 words ----------
const letters = "AEIOUBCDFGHLMNPRSTVWY";
let seed = 42;
const rnd = () => {
  // mulberry32
  seed = (seed + 0x6d2b79f5) | 0;
  let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
};
const words = new Set();
while (words.size < 10000) {
  const len = 5 + Math.floor(rnd() * 7);
  let w = "";
  for (let i = 0; i < len; i++) w += letters[Math.floor(rnd() * letters.length)];
  if (!/(.)\1{3}/.test(w)) words.add(w);
}
const themes = ["Animals", "Food", "Travel", "Science", "Music"];
fs.writeFileSync("/tmp/ws_10k.csv", "Word,Theme\n" + [...words].map((w, i) => `${w},${themes[i % 5]}`).join("\n") + "\n");
await page.goto(BASE + "/word-search", { waitUntil: "networkidle" });
let t0 = t();
await page.click('[data-testid="choose-upload"]');
await page.setInputFiles('[data-testid="csv-input"]', "/tmp/ws_10k.csv");
await page.waitForFunction(() => document.querySelector('[data-testid="word-count"]')?.textContent?.startsWith("10,000"), null, { timeout: 60000 });
log.push(`10k CSV import: ${((t() - t0) / 1000).toFixed(1)}s`);
await shot(page, "11_ws10k_words", false);
await next(); // -> difficulty
await next(); // keep medium -> size
await page.fill("#wordsPerPuzzle", "36");
await pause();
log.push("10k split: " + (await page.locator('[data-testid="split-stats"]').innerText()).replace(/\n/g, " "));
await shot(page, "12_ws10k_settings", false);
await next(); // -> rules
await next(); // -> place words
t0 = t();
await page.click('[data-testid="mode-auto"]');
await page.waitForSelector('[data-testid="job-progress"]', { timeout: 10000 }).catch(() => {});
await pause(800);
await shot(page, "13_ws10k_generating", false);
await page.waitForSelector('[data-testid="puzzle-pager"]', { timeout: 300000 });
log.push(`10k generation (worker): ${((t() - t0) / 1000).toFixed(1)}s`);
await shot(page, "14_ws10k_placed", false);
await next(); // -> review
await next(); // -> design
await waitPreview();
await next(); // -> plan
await next(); // -> shape
await next(); // -> frame
await next(); // -> happy?
await page.click('[data-testid="design-keep"]'); // -> export
await next();
await next();
await next(); // -> preview
await next(); // -> create
await pause(500);
log.push("10k book stats: " + (await page.locator('[data-testid="page-estimate"]').innerText()));
await shot(page, "15_ws10k_export");
const big = await exportBook("ws_10k_book.pdf", 600000);
log.push(`10k PDF: ${big.kb} KB in ${big.secs}s`);
log.push("10k built files: " + (await page.locator('[data-testid="built-files"]').innerText()).replace(/\n/g, " "));

// ---------- Crossword: ~230 clues with themes ----------
const cw = ["Word,Clue,Theme"];
const pool = ["APPLE", "PEAR", "PLUM", "GRAPE", "LEMON", "MELON", "MANGO", "OLIVE", "PEACH", "BERRY", "LIME", "KIWI", "DATE", "FIG", "GUAVA"];
const animals = ["LION", "TIGER", "EAGLE", "OTTER", "HORSE", "MOUSE", "SNAKE", "ZEBRA", "CAMEL", "PANDA", "KOALA", "SHEEP", "GOAT", "SEAL", "WHALE"];
let n = 0;
outer: for (const a of pool) for (const b of animals) {
  cw.push(`${a}${b},Clue for ${a.toLowerCase()} ${b.toLowerCase()},${n % 2 ? "Animals" : "Fruit"}`);
  if (++n >= 200) break outer;
}
pool.forEach((w) => cw.push(`${w},A tasty fruit,Fruit`));
animals.forEach((w) => cw.push(`${w},An animal,Animals`));
fs.writeFileSync("/tmp/cw.csv", cw.join("\n") + "\n");
await page.goto(BASE + "/cross-word", { waitUntil: "networkidle" });
await page.click('[data-testid="choose-upload"]');
await page.setInputFiles('[data-testid="csv-input"]', "/tmp/cw.csv");
await pause(800);
log.push("crossword clues: " + (await page.locator('[data-testid="clue-count"]').innerText()));
await shot(page, "16_cw_clues", false);
await next(); // -> words per crossword
t0 = t();
await page.click('[data-testid="build-crosswords"]');
await page.waitForSelector("#cw-grid", { timeout: 180000 });
log.push(`crossword build: ${((t() - t0) / 1000).toFixed(1)}s`);
await shot(page, "17_cw_review", false);
await next();
await waitPreview();
await shot(page, "18_cw_design");
await next(); // -> plan
await next(); // -> shape
await next(); // -> frame
await next();
await page.click('[data-testid="design-keep"]');
await next();
await next();
await next(); // preview
await next();
await exportBook("crossword_book.pdf");

// ---------- Sudoku: 100 puzzles, mixed difficulty ----------
await page.goto(BASE + "/sudoku", { waitUntil: "networkidle" });
await page.click('[data-testid="quick-custom"]');
await page.fill('[data-testid="count-easy"]', "30");
await page.fill('[data-testid="count-medium"]', "40");
await page.fill('[data-testid="count-hard"]', "30");
await shot(page, "19_sd_choose", false);
t0 = t();
await page.click('[data-testid="generate-sudoku"]');
await page.waitForSelector("#sudoku-grid", { timeout: 300000 });
log.push(`100 sudoku generation: ${((t() - t0) / 1000).toFixed(1)}s`);
await next();
await page.click('[data-testid="template-modern"]');
await waitPreview();
await shot(page, "20_sd_design");
await next(); // -> plan
await next(); // -> shape
await next(); // -> frame
await next();
await page.click('[data-testid="design-keep"]');
await page.selectOption('[data-testid="per-page"]', "4");
await pause();
await next();
await next();
await next(); // -> preview
await next(); // -> create
log.push("sudoku stats: " + (await page.locator('[data-testid="page-estimate"]').innerText()));
await shot(page, "21_sd_export");
await exportBook("sudoku_100_book.pdf");

await browser.close();
console.log(log.join("\n"));
console.log(errors.length ? `CONSOLE ERRORS (${errors.length}):\n${errors.join("\n")}` : "No console errors.");
process.exit(errors.length ? 1 : 0);
