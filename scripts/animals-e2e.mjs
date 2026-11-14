// Animal shapes e2e: node scripts/animals-e2e.mjs  (server on :3000; poppler on PATH)
// Covers category tabs, search, shade, an animal word search / crossword / sudoku,
// and exports PDFs. Screenshots -> review/animals/.
import { chromium } from "playwright";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "review/animals";
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
const pdfInfo = (file) => execFileSync("pdfinfo", [file]).toString();
async function exportPdf(name) {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 600000 }), page.click('[data-testid="download-pdf"]')]);
  const file = `${OUT}/${name}.pdf`;
  await dl.saveAs(file);
  return file;
};

// ================= Word search =================
await page.goto(BASE + "/word-search", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await hideToasts();
const WORDS = "ELEPHANT GIRAFFE PENGUIN DOLPHIN KANGAROO BUTTERFLY OCTOPUS FLAMINGO PANDA HEDGEHOG SQUIRREL RABBIT".split(" ");
await page.click('[data-testid="choose-type"]');
await page.fill("#wordInput", WORDS.join("\n"));
await page.press("#wordInput", "Control+Enter");
await pause();
await next();
for (let i = 0; i < 6 && !(await page.$('[data-testid="mode-auto"]')); i++) await next();
await page.click('[data-testid="mode-auto"]');
await page.waitForSelector('#active-grid, [data-testid="puzzle-pager"]', { timeout: 60000 });
await next();
await next();
await waitPreview();
await next(); // shape
check((await q()) === "shape", "ws: Pick a shape");
check((await page.$('[data-testid="shape-cat-animals"]')) !== null, "ws: Animals category tab is shown");
check((await page.$('[data-testid="shape-search"]')) !== null, "ws: search box is shown");
check((await page.$('[data-testid="shape-mix-animals"]')) !== null, "ws: random animals mix is offered");
check((await page.$('[data-testid="shape-shade"]')) !== null, "ws: shaded silhouette toggle is shown");
await shot("picker-basic");
await page.click('[data-testid="shape-cat-animals"]');
await pause(300);
check((await page.$('[data-testid="shape-elephant"]')) !== null, "ws: elephant is in the Animals tab");
const animalCards = await page.$$eval('[data-testid^="shape-"]:not([data-testid^="shape-mix"]):not([data-testid^="shape-cat"]):not([data-testid="shape-picker"]):not([data-testid="shape-search"]):not([data-testid="shape-shade"]):not([data-testid^="shape-suggest"])', (els) => els.length);
check(animalCards >= 40, `ws: many animals are listed (${animalCards})`);
await page.fill('[data-testid="shape-search"]', "eleph");
await pause(300);
check((await page.$('[data-testid="shape-elephant"]')) !== null, "ws: search finds elephant");
check((await page.$('[data-testid="shape-dog"]')) === null, "ws: search hides non-matches");
await shot("picker-search");
let sig = await previewSig();
await page.click('[data-testid="shape-elephant"]');
await page.waitForSelector('[data-testid="reshape-done"]:has-text("elephant")', { timeout: 60000 });
await waitPreview(sig);
check((await page.getAttribute('[data-testid="shape-elephant"]', "aria-checked")) === "true", "ws: elephant selected");
check(await page.isChecked('[data-testid="shape-shade"]'), "ws: picking an animal turns the shaded silhouette on");
await shot("picker-animals");
await shot("picker-elephant");
await page.click('[data-testid="shape-mix-animals"]');
await page.waitForFunction(() => document.querySelector('[data-testid="shape-mix-animals"]')?.getAttribute("aria-checked") === "true", null, { timeout: 10000 });
await page.waitForSelector('[data-testid="reshape-done"]:has-text("animal")', { timeout: 60000 });
await shot("picker-mix-animals");
await page.click('[data-testid="shape-mix-one"]');
await page.fill('[data-testid="shape-search"]', "elephant");
await pause(200);
await page.click('[data-testid="shape-elephant"]');
await page.waitForSelector('[data-testid="reshape-done"]:has-text("elephant")', { timeout: 60000 });
await next(); // frame
await next();
await page.click('[data-testid="design-keep"]');
await pause();
await next();
await next();
await next();
await next();
const wsPdf = await exportPdf("ws_elephant_book");
check(/Pages:\s+\d+/.test(pdfInfo(wsPdf)), "ws: elephant PDF exports");

// ================= Crossword =================
const cwRows = ["Word,Clue,Theme"];
for (const w of ["APPLE", "PEAR", "PLUM", "GRAPE", "LEMON", "MELON", "MANGO", "OLIVE", "PEACH", "BERRY", "LIME", "CHERRY"]) cwRows.push(`${w},Clue for ${w.toLowerCase()},Owls`);
fs.writeFileSync("/tmp/cw_animals.csv", cwRows.join("\n") + "\n");
await page.goto(BASE + "/cross-word", { waitUntil: "networkidle" });
await hideToasts();
await page.click('[data-testid="choose-upload"]');
await page.setInputFiles('[data-testid="csv-input"]', "/tmp/cw_animals.csv");
await pause(800);
await next();
await page.fill("#perPuzzle", "12").catch(() => {});
await page.click('[data-testid="build-crosswords"]');
await page.waitForSelector("#cw-grid", { timeout: 180000 });
await next();
await waitPreview();
await next();
check((await q()) === "shape", "cw: Pick a shape");
check((await page.$('[data-testid="shape-suggest"]')) !== null, "cw: theme 'Owls' suggests the owl shape");
await shot("cw-suggest-owl");
await page.click('[data-testid="shape-suggest-apply"]');
await page.waitForSelector('[data-testid="reshape-done"]:has-text("owl")', { timeout: 60000 });
await shot("cw-owl-picked");
await next();
await page.click('[data-testid="frame-medium"], [data-testid="frame-thin"]').catch(() => {});
await next();
await page.click('[data-testid="design-keep"]');
await pause();
await next();
await next();
await next();
await next();
const cwPdf = await exportPdf("cw_owl_book");
check(/Pages:\s+\d+/.test(pdfInfo(cwPdf)), "cw: owl PDF exports");

// ================= Sudoku =================
await page.goto(BASE + "/sudoku", { waitUntil: "networkidle" });
await hideToasts();
await page.click('[data-testid="quick-custom"]');
await page.fill('[data-testid="count-easy"]', "2");
await page.fill('[data-testid="count-medium"]', "2");
await page.fill('[data-testid="count-hard"]', "0");
await page.click('[data-testid="generate-sudoku"]');
await page.waitForSelector("#sudoku-grid", { timeout: 300000 });
await next();
await waitPreview();
await next();
check((await q()) === "shape", "sd: Pick a frame shape");
await page.click('[data-testid="shape-cat-animals"]');
await pause(250);
sig = await previewSig();
const sdAnimal = (await page.$('[data-testid="shape-penguin"]')) ? "penguin" : "owl";
await page.click(`[data-testid="shape-${sdAnimal}"]`);
await waitPreview(sig);
await shot("sd-animal-frame");
await next();
await page.click('[data-testid="design-keep"]').catch(async () => { await next(); await page.click('[data-testid="design-keep"]'); });
await pause();
while ((await q()) !== "create" && (await q()) !== "size") await next();
if ((await q()) === "size") {
  await next();
  await next();
  await next();
  await next();
}
const sdPdf = await exportPdf("sd_animal_book");
check(/Pages:\s+\d+/.test(pdfInfo(sdPdf)), "sd: animal-frame PDF exports");

check(errors.filter((e) => !e.startsWith("check failed")).length === 0, "no console errors");
await browser.close();
finish();
