// Shapes & frames e2e: node scripts/shapes-e2e.mjs  (server on :3000; poppler on PATH)
// For word search, crossword and sudoku: pick a shape and a frame in the Design step,
// check the puzzles are re-fitted (masked grid in the editor / review, outline drawn),
// manual placement stays inside the shape, then export and check the PDF. Screenshots -> review/shapes-e2e/.
import { chromium } from "playwright";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "review/shapes-e2e";
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 940 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
const checks = [];
page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()}: ${m.text()}`));
page.on("pageerror", (e) => errors.push(`${page.url()}: ${e}`));
page.on("dialog", (d) => d.accept());
const T0 = Date.now();
const finish = (code) => {
  console.log(checks.join("\n"));
  console.log(`${checks.filter((c) => c.startsWith("✓")).length}/${checks.length} checks passed`);
  if (errors.length) console.log("ERRORS:\n" + errors.join("\n"));
  process.exit(code ?? (errors.length ? 1 : 0));
};
process.on("uncaughtException", (e) => {
  errors.push(e.message.split("\n").slice(0, 3).join(" | "));
  page.screenshot({ path: `${OUT}/_fail.png` }).catch(() => {});
  setTimeout(() => finish(1), 1500);
});
const stamp = (s) => console.log(((Date.now() - T0) / 1000).toFixed(1), s);
const pause = (ms = 350) => page.waitForTimeout(ms);
const next = async () => {
  await page.click('[data-testid="wizard-next"]');
  await pause();
};
const q = () => page.getAttribute("[data-question]", "data-question");
const check = (ok, what) => {
  checks.push(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) errors.push(`check failed: ${what}`);
};
const hideToasts = () => page.addStyleTag({ content: ".Toastify{display:none!important}" });
const shot = async (name, el) => {
  await pause(250);
  if (el) await page.locator(el).first().screenshot({ path: `${OUT}/${name}.png` });
  else await page.screenshot({ path: `${OUT}/${name}.png` });
  stamp(name);
};
/** Wait until the design preview canvas has been redrawn (its pixels change). */
const previewSig = () => page.evaluate(() => {
  const c = document.querySelector('[data-testid="design-preview"]');
  if (!c || c.width < 50) return "";
  return c.toDataURL().slice(-200);
});
const waitPreview = async (before) => {
  await page.waitForFunction(() => document.querySelector('[data-testid="design-preview"]')?.width > 50, null, { timeout: 60000 });
  if (before !== undefined) {
    const t = Date.now();
    while (Date.now() - t < 20000) {
      if ((await previewSig()) !== before) break;
      await pause(250);
    }
  }
  await pause(600);
};
const pdfText = (file) => execFileSync("pdftotext", ["-layout", file, "-"]).toString();
const pdfInfo = (file) => execFileSync("pdfinfo", [file]).toString();
async function exportPdf(name) {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 600000 }), page.click('[data-testid="download-pdf"]')]);
  const file = `${OUT}/${name}.pdf`;
  await dl.saveAs(file);
  return file;
}

const shapeCardSel = '[data-testid^="shape-"]:not([data-testid^="shape-mix"]):not([data-testid^="shape-cat"]):not([data-testid="shape-picker"]):not([data-testid="shape-search"]):not([data-testid="shape-shade"]):not([data-testid^="shape-suggest"])';
const openCat = async (id) => {
  await page.click(`[data-testid="shape-cat-${id}"]`);
  await pause(200);
};
const allShapeCards = async () => {
  const keys = new Set();
  for (const cat of ["basic", "animals", "objects"]) {
    if (await page.$(`[data-testid="shape-cat-${cat}"]`)) {
      await openCat(cat);
      (await page.$$eval(shapeCardSel, (els) => els.map((e) => e.dataset.testid))).forEach((k) => keys.add(k));
    }
  }
  return [...keys];
};

const stepTo = (label) => page.click(`nav[aria-label="Progress"] button[title="${label}"]`);

// ================= Word search =================
await page.goto(BASE + "/word-search", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await hideToasts();
const WORDS = "BUTTERFLY LADYBUG SUNFLOWER MEADOW PICNIC BLOSSOM RAINBOW TULIP BUMBLEBEE GARDEN SPRING PUDDLE BREEZE CLOVER DAISY SEEDLING".split(" ");
await page.click('[data-testid="choose-type"]');
await page.fill("#wordInput", WORDS.join("\n"));
await page.press("#wordInput", "Control+Enter");
await pause();
await next(); // -> settings
for (let i = 0; i < 6 && !(await page.$('[data-testid="mode-auto"]')); i++) await next();
await page.click('[data-testid="mode-auto"]');
await page.waitForSelector('#active-grid, [data-testid="puzzle-pager"]', { timeout: 60000 });
await pause(400);
check((await page.getAttribute("#active-grid", "data-shape")) === "square", "ws: puzzles start as the classic square");
await next(); // -> review
await next(); // -> design
await waitPreview();
check((await q()) === "template", "ws: design starts with the template");
await next();
check((await q()) === "shape", "ws: template → Pick a shape");
const shapeCards = await allShapeCards();
check(shapeCards.length >= 80, `ws: a large shape library is offered (${shapeCards.length})`);
check(shapeCards.includes("shape-elephant") && shapeCards.includes("shape-heart"), "ws: animals and classic shapes are both offered");
await openCat("basic");
check((await page.$$('[data-testid="shape-picker"] svg.pg-shape-svg')).length >= 10, "ws: every visible shape card has a mini preview");
await shot("ws_01_shape_question");
let sig = await previewSig();
await openCat("objects");
await page.click('[data-testid="shape-heart"]');
await page.waitForSelector('[data-testid="reshape-done"]:has-text("heart")', { timeout: 60000 });
await waitPreview(sig);
check((await page.getAttribute('[data-testid="shape-heart"]', "aria-checked")) === "true", "ws: heart selected");
check(!(await page.isDisabled('[data-testid="wizard-next"]')), "ws: Next enabled once puzzles fit the heart");
await shot("ws_02_heart_picked");
// Mixed shapes
sig = await previewSig();
await page.click('[data-testid="shape-mix-each"]');
await page.waitForSelector('[data-testid="reshape-done"]:has-text("mixed")', { timeout: 60000 });
await waitPreview(sig);
await shot("ws_03_mixed");
await page.click('[data-testid="shape-mix-one"]');
await openCat("objects");
await page.click('[data-testid="shape-heart"]');
await page.waitForSelector('[data-testid="reshape-done"]:has-text("heart")', { timeout: 60000 });
await next();
check((await q()) === "frame", "ws: shape → Pick a frame");
check((await page.$$('[data-testid^="frame-"]:not([data-testid="frame-picker"]):not([data-testid="frame-next"]):not([data-testid="frame-extras"])')).length === 9, "ws: 9 frame styles");
for (const f of ["thick", "double", "dotted", "shadow", "rounded", "dashed"]) {
  sig = await previewSig();
  await page.click(`[data-testid="frame-${f}"]`);
  await waitPreview(sig);
  check((await page.getAttribute(`[data-testid="frame-${f}"]`, "aria-checked")) === "true", `ws: frame ${f} applies`);
}
sig = await previewSig();
await page.click('[data-testid="cells-circles"]');
await page.click('[aria-label="Box around the word list"] >> text=Dashed');
await waitPreview(sig);
await shot("ws_04_frame_dashed_circles");
await shot("ws_05_preview_page", '[data-testid="design-preview"]');
await next(); // -> happy?
await page.click('[data-testid="design-customize"]');
await pause();
check((await q()) === "customize", "ws: customize reachable");
await page.click('[data-testid="customize"] summary:has-text("Shape")');
await page.click('[data-testid="customize"] [data-testid="shape-cat-basic"]');
check((await page.$$('[data-testid="customize"] [data-testid="shape-star"]')).length === 1, "ws: shapes also in Customize");
await shot("ws_06_customize_shape");
// Review shows the heart grid
await stepTo("Review & solution");
await pause(600);
check((await page.getAttribute("#review-grid", "data-shape")) === "heart", "ws: review grid is heart-shaped");
check((await page.$$("#review-grid [data-testid=grid-outline]")).length === 1, "ws: review grid draws the outline");
await shot("ws_07_review_heart", "#review-grid");
const reviewCells = await page.$$eval("#review-grid text", (els) => els.length);
const vb = (await page.getAttribute("#review-grid", "viewBox")).split(" ").map(Number);
check(reviewCells > 0 && vb[2] > 0, `ws: review heart has ${reviewCells} letters`);
// Manual placement inside the shape only
await page.click("text=Edit word positions");
await pause(500);
await page.click("text=Clear random letters to edit");
await pause(300);
const placedWord = "TULIP";
await page.click(`[data-word="${placedWord}"]`);
await page.click("button:has-text('Remove')");
await pause(200);
await page.click(`[data-word="${placedWord}"]`);
await pause(300);
const cells = await page.$$eval("#active-grid [data-cell]", (els) => els.map((e) => ({ k: e.dataset.cell, s: e.dataset.state })));
check(cells.length === reviewCells && cells.length > 0, `ws: editor only offers the ${reviewCells} cells inside the heart (${cells.length})`);
check(cells.some((c) => c.s === "start"), "ws: valid start squares shown inside the heart");
const start = cells.find((c) => c.s === "start").k;
await page.click(`#active-grid [data-cell="${start}"]`);
await pause(300);
check((await page.getAttribute(`[data-word="${placedWord}"]`, "class")).includes("placed"), "ws: manual placement inside the heart works");
await shot("ws_08_editor_heart", "#active-grid");
// Finish and export
await page.click("button:has-text('Fill')").catch(() => {});
await pause(400);
await stepTo("Export book");
await pause(500);
check((await q()) === "size", "ws: export starts at size");
await next();
await next();
await next(); // -> preview
await next(); // -> create
const wsPdf = await exportPdf("ws_heart_book");
const wsTxt = pdfText(wsPdf).replace(/\s+/g, "");
check(WORDS.every((w) => wsTxt.includes(w)), "ws: every word is listed in the exported PDF");
check(/Pages:\s+\d+/.test(pdfInfo(wsPdf)), "ws: PDF opens");

// ================= Crossword =================
const cwRows = ["Word,Clue,Theme"];
for (const w of ["APPLE", "PEAR", "PLUM", "GRAPE", "LEMON", "MELON", "MANGO", "OLIVE", "PEACH", "BERRY", "LIME", "CHERRY"]) cwRows.push(`${w},Clue for ${w.toLowerCase()},Fruit`);
fs.writeFileSync("/tmp/cw_shapes.csv", cwRows.join("\n") + "\n");
await page.goto(BASE + "/cross-word", { waitUntil: "networkidle" });
await hideToasts();
await page.click('[data-testid="choose-upload"]');
await page.setInputFiles('[data-testid="csv-input"]', "/tmp/cw_shapes.csv");
await pause(800);
await next();
await page.fill("#perPuzzle", "12").catch(() => {});
await page.click('[data-testid="build-crosswords"]');
await page.waitForSelector("#cw-grid", { timeout: 180000 });
await pause(300);
await next(); // -> design
await waitPreview();
await next();
check((await q()) === "shape", "cw: template → Pick a shape");
check((await page.$$('[data-testid="shape-star"]')).length === 0, "cw: shapes that make poor crosswords are not offered");
check((await page.$$('[data-testid="shape-circle"]')).length === 1, "cw: circle offered");
sig = await previewSig();
await page.click('[data-testid="shape-circle"]');
await page.waitForSelector('[data-testid="reshape-done"]:has-text("circle")', { timeout: 60000 });
await waitPreview(sig);
await shot("cw_01_circle");
await next();
check((await q()) === "frame", "cw: shape → frame");
sig = await previewSig();
await page.click('[data-testid="frame-double"]');
await waitPreview(sig);
await shot("cw_02_frame_double");
await next();
await page.click('[data-testid="design-keep"]');
await pause();
check((await q()) === "size", "cw: design → export");
await next();
await next();
await next();
await next();
const cwPdf = await exportPdf("cw_circle_book");
check(/Pages:\s+\d+/.test(pdfInfo(cwPdf)) && pdfText(cwPdf).includes("ACROSS"), "cw: exported PDF has the crossword");
await stepTo("Build & review");
await pause(600);
check((await page.getAttribute("#cw-grid", "data-shape")) === "circle", "cw: review grid is circle-shaped");
await shot("cw_03_review_circle", "#cw-grid");

// ================= Sudoku =================
await page.goto(BASE + "/sudoku", { waitUntil: "networkidle" });
await hideToasts();
await page.click('[data-testid="quick-custom"]');
await page.fill('[data-testid="count-easy"]', "2");
await page.fill('[data-testid="count-medium"]', "2");
await page.fill('[data-testid="count-hard"]', "2");
await page.click('[data-testid="generate-sudoku"]');
await page.waitForSelector("#sudoku-grid", { timeout: 300000 });
await next(); // -> design
await waitPreview();
await next();
check((await q()) === "shape", "sd: template → Pick a frame shape");
check((await page.innerText("[data-question]")).includes("must stay a 9×9 square"), "sd: honest note that sudoku stays square");
if (await page.$('[data-testid="shape-cat-objects"]')) await openCat("objects");
check((await page.$$('[data-testid="shape-heart"]')).length === 0, "sd: only frame shapes offered");
await openCat("basic");
sig = await previewSig();
await page.click('[data-testid="shape-circle"]');
await waitPreview(sig);
await shot("sd_01_circle_frame");
await next();
sig = await previewSig();
await page.click('[data-testid="cells-circles"]');
await waitPreview(sig);
await shot("sd_02_circle_cells");
await next();
await page.click('[data-testid="design-keep"]');
await pause();
await next();
await next();
await page.click('[data-testid="wizard-skip"]').catch(() => {});
await pause();
while ((await q()) !== "create") await next();
const sdPdf = await exportPdf("sd_circle_book");
check(/Pages:\s+\d+/.test(pdfInfo(sdPdf)), "sd: exported PDF opens");

check(errors.filter((e) => !e.startsWith("check failed")).length === 0, "no console errors");
await browser.close();
finish();
