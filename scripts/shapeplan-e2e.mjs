// Shape plan e2e: node scripts/shapeplan-e2e.mjs  (server on :3000; poppler + python3/Pillow on PATH)
// For word search, crossword and sudoku: the four shape plans (one shape, surprise me,
// random from categories, page by page), the lineup with a pinned override, and an
// exported book whose consecutive puzzles have different shapes.
// Screenshots + 300 dpi page montages -> review/shapeplan/.
import { chromium } from "playwright";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "review/shapeplan";
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
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
const back = async () => {
  await page.click('[data-testid="wizard-back"]');
  await pause();
};
const q = () => page.getAttribute("[data-question]", "data-question");
const check = (ok, what) => {
  checks.push(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) errors.push(`check failed: ${what}`);
};
const hideToasts = () => page.addStyleTag({ content: ".Toastify{display:none!important}" });
const shot = async (name, el) => {
  await pause(300);
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
  await pause(500);
};
const waitFitted = async () => {
  await pause(300);
  await page.waitForFunction(() => !document.querySelector('[data-testid="reshape-progress"]'), null, { timeout: 300000 });
  await pause(300);
};
const lineup = () => page.$$eval('[data-testid^="lineup-"][data-shape]', (els) => els.map((e) => ({ i: Number(e.dataset.testid.slice(7)), shape: e.dataset.shape, leaf: e.dataset.leaf, theme: e.dataset.theme, pinned: e.classList.contains("pinned") })));
const noNeighbours = (l) => l.every((x, i) => i === 0 || x.shape !== l[i - 1].shape);
const pdfInfo = (file) => execFileSync("pdfinfo", [file]).toString();
const pageText = (file, p) => execFileSync("pdftotext", ["-f", String(p), "-l", String(p), "-layout", file, "-"]).toString();
async function exportPdf(name) {
  for (let i = 0; i < 12 && (await q()) !== "create"; i++) {
    if (await page.isEnabled('[data-testid="wizard-next"]').catch(() => false)) await next();
    else await page.click('[data-testid="wizard-skip"]');
  }
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 600000 }), page.click('[data-testid="download-pdf"]')]);
  const file = `${OUT}/${name}.pdf`;
  await dl.saveAs(file);
  return file;
}
/** Render the first `n` pages whose text has `marker` at 300 dpi and tile them into one montage. */
function montage(file, marker, n, name) {
  const pages = Number(/Pages:\s+(\d+)/.exec(pdfInfo(file))[1]);
  const hits = [];
  for (let p = 1; p <= pages && hits.length < n; p++) {
    const t = pageText(file, p);
    if (t.includes(marker) && !/HOW TO|SOLUTIONS|PUZZLE BOOK|YOUR NAME/i.test(t)) hits.push(p);
  }
  const files = [];
  for (const p of hits) {
    const base = `${OUT}/_${name}_p${p}`;
    execFileSync("pdftoppm", ["-r", "300", "-f", String(p), "-l", String(p), "-png", "-singlefile", file, base]);
    files.push(`${base}.png`);
  }
  const py = `
import sys
from PIL import Image, ImageDraw
files=sys.argv[2:]; out=sys.argv[1]
ims=[Image.open(f).convert("RGB") for f in files]
w=760; h=int(ims[0].height*w/ims[0].width); cols=3; rows=(len(ims)+cols-1)//cols; g=24
M=Image.new("RGB",(cols*w+(cols+1)*g, rows*h+(rows+1)*g),(226,232,240))
for k,im in enumerate(ims):
  im=im.resize((w,h), Image.LANCZOS)
  x=g+(k%cols)*(w+g); y=g+(k//cols)*(h+g)
  M.paste(im,(x,y))
  ImageDraw.Draw(M).rectangle([x-1,y-1,x+w,y+h],outline=(148,163,184))
M.save(out)
`;
  execFileSync("python3", ["-c", py, `${OUT}/${name}.png`, ...files]);
  for (const f of files) fs.copyFileSync(f, f.replace("/_", "/page_"));
  files.forEach((f) => fs.rmSync(f));
  stamp(`${name} (pages ${hits.join(",")})`);
  return hits;
}

/** Plan-mode tour shared by all three tools. `unit` = items in the lineup. */
async function tour(tool, count) {
  check((await q()) === "plan", `${tool}: template → shape plan question`);
  const cards = await page.$$('[data-testid^="plan-"][role="radio"]');
  check(cards.length === 4, `${tool}: four plan cards`);
  if (tool === "ws") await shot("01_plan_cards");
  else await shot(`${tool}_01_plan_cards`);

  // Surprise me
  await page.click('[data-testid="plan-surprise"]');
  check((await q()) === "shape", `${tool}: surprise → lineup screen`);
  await waitFitted();
  let l = await lineup();
  check(l.length === Math.min(count, 24), `${tool}: lineup shows every puzzle (${l.length})`);
  check(new Set(l.map((x) => x.shape)).size === l.length, `${tool}: surprise gives every puzzle a different shape`);
  check(new Set(l.map((x) => x.leaf.split(":")[0])).size >= 3, `${tool}: surprise mixes categories (${[...new Set(l.map((x) => x.leaf))].join(", ")})`);
  check(!l.some((x) => x.leaf === "letters"), `${tool}: surprise leaves out letters & numbers`);
  const before = l.map((x) => x.shape).join();
  let sig = await previewSig();
  await page.click('[data-testid="plan-shuffle"]');
  await waitFitted();
  await waitPreview(sig);
  l = await lineup();
  check(l.map((x) => x.shape).join() !== before, `${tool}: Shuffle gives a new lineup`);
  // Pin puzzle 3 to a chosen shape
  const pinKey = tool === "sd" ? "owl" : tool === "cw" ? "heart" : "elephant";
  await page.click('[data-testid="lineup-2"]');
  await page.waitForSelector('[data-testid="override-editor"]');
  await page.fill('[data-testid="override-picker"] [data-testid="shape-search"]', pinKey);
  await pause(200);
  sig = await previewSig();
  await page.click(`[data-testid="override-picker"] [data-testid="shape-${pinKey}"]`);
  await waitFitted();
  await waitPreview(sig);
  l = await lineup();
  check(l[2].shape === pinKey && l[2].pinned, `${tool}: puzzle 3 pinned to ${pinKey}`);
  check(noNeighbours(l), `${tool}: no two neighbouring puzzles share a shape`);
  if (tool === "ws") {
    await shot("03_lineup_pinned", '[data-testid="plan-panel"]');
    await shot("03b_lineup_full_page");
  } else await shot(`${tool}_03_lineup_pinned`);
  await page.click('[data-testid="plan-shuffle"]');
  await waitFitted();
  l = await lineup();
  check(l[2].shape === pinKey && l[2].pinned, `${tool}: the pinned puzzle survives Shuffle`);
  await page.click('[data-testid="override-unpin"]');
  await waitFitted();
  l = await lineup();
  check(!l[2].pinned, `${tool}: Back to random unpins`);

  // Random from categories
  await back();
  check((await q()) === "plan", `${tool}: back to plan cards`);
  await page.click('[data-testid="plan-pick"]');
  await page.waitForSelector('[data-testid="category-chooser"]');
  await page.click('[data-testid="plan-cats-none"]');
  await pause(200);
  check(!!(await page.$('[data-testid="plan-cats-empty"]')) && (await page.isDisabled('[data-testid="wizard-next"]')), `${tool}: at least one category is required`);
  await page.click('[data-testid="plan-cat-animals"]');
  await pause(150);
  if (tool !== "sd") await page.click('[data-testid="plan-cat-food"]');
  else await page.click('[data-testid="plan-cat-basic"]');
  await waitFitted();
  l = await lineup();
  const okLeaf = (x) => x.leaf.startsWith("animals") || x.leaf === (tool === "sd" ? "basic" : "food");
  check(l.every(okLeaf), `${tool}: only the chosen categories are used (${[...new Set(l.map((x) => x.leaf))].join(", ")})`);
  check(noNeighbours(l), `${tool}: categories plan has no neighbouring repeats`);
  if (tool === "ws") await shot("02_categories", '[data-question]');
  else await shot(`${tool}_02_categories`);
  // Narrow animals to one group
  await page.click('[data-testid="plan-cat-animals"]');
  await page.click('[data-testid="plan-group-ocean"]');
  await waitFitted();
  l = await lineup();
  check(l.every((x) => x.leaf === "animals:ocean" || x.leaf === (tool === "sd" ? "basic" : "food")), `${tool}: an animal group can be picked on its own`);
  if (tool === "ws") {
    await page.click('[data-testid="plan-themes-group"]');
    await waitFitted();
    l = await lineup();
    const byTheme = new Map();
    for (const x of l) byTheme.set(x.theme, [...(byTheme.get(x.theme) ?? []), x.shape]);
    check([...byTheme.values()].every((v) => new Set(v).size === 1), "ws: one shape per theme keeps a theme's puzzles together");
    await page.click('[data-testid="plan-themes-off"]');
    await waitFitted();
  }

  // Page by page
  const pickLineup = (await lineup()).map((x) => x.shape);
  await back();
  await page.click('[data-testid="plan-manual"]');
  await page.waitForSelector('[data-testid="page-editor"]');
  l = await lineup();
  check(l.map((x) => x.shape).join() === pickLineup.join(), `${tool}: page by page starts from the lineup you had`);
  await page.click('[data-testid="manual-clear"]');
  await waitFitted();
  await page.click('[data-testid="lineup-0"]');
  const manualPick = tool === "sd" ? "heart" : "star";
  const manualKey = tool === "cw" ? "circle" : manualPick;
  await page.fill('[data-testid="page-picker"] [data-testid="shape-search"]', manualKey);
  await pause(200);
  await page.click(`[data-testid="page-picker"] [data-testid="shape-${manualKey}"]`);
  await waitFitted();
  l = await lineup();
  check(l[0].shape === manualKey, `${tool}: puzzle 1 set by hand to ${manualKey}`);
  check((await page.getAttribute('[data-testid="lineup-1"]', "aria-selected")) === "true", `${tool}: picking moves on to the next puzzle`);
  await page.fill('[data-testid="page-picker"] [data-testid="shape-search"]', "");
  await page.click('[data-testid="manual-fill-random"]');
  await waitFitted();
  l = await lineup();
  check(l[0].shape === manualKey && new Set(l.map((x) => x.shape)).size >= Math.min(l.length, 6), `${tool}: fill unpicked pages randomly keeps hand picks`);
  if (tool === "ws") await shot("04_manual", '[data-question]');
  else await shot(`${tool}_04_manual`);

  // One shape mode still works
  await back();
  await page.click('[data-testid="plan-one"]');
  await page.waitForSelector('[data-testid="plan-panel"][data-mode="one"]');
  check(!(await page.$('[data-testid="lineup"]')), `${tool}: one shape hides the lineup`);

  // Finish in surprise mode for the export
  await back();
  await page.click('[data-testid="plan-surprise"]');
  await waitFitted();
  return lineup();
}

// ================= Word search =================
const THEMES = {
  Ocean: "WHALE DOLPHIN SHARK CORAL OCTOPUS SEAHORSE TURTLE LOBSTER STARFISH JELLYFISH OYSTER SQUID WALRUS SEAL CRAB SHRIMP CLAM KELP TIDE WAVE",
  Farm: "TRACTOR BARN HORSE COW PIG SHEEP GOAT CHICKEN ROOSTER DUCK HAY FIELD FENCE SILO PLOW CORN WHEAT FARMER STABLE PASTURE",
  Fruit: "APPLE BANANA CHERRY GRAPE LEMON MANGO ORANGE PEACH PEAR PLUM KIWI MELON PAPAYA APRICOT FIG LIME GUAVA BERRY DATE COCONUT",
  Space: "PLANET COMET ROCKET ORBIT GALAXY NEBULA METEOR SATURN JUPITER MARS VENUS MERCURY ASTEROID MOON STAR SOLAR LUNAR ECLIPSE CRATER COSMOS",
  Garden: "TULIP DAISY ROSE LILY SEED SOIL RAKE HOSE SPADE BLOOM PETAL STEM ROOT SPROUT IVY FERN MOSS WEED POND HEDGE",
  Weather: "CLOUD RAIN SUNNY WIND STORM THUNDER LIGHTNING RAINBOW BREEZE SNOWFLAKE PUDDLE FOG HAIL SLEET FROST DRIZZLE HUMID TORNADO MIST GUST",
};
const csv = ["Word,Theme"];
for (const [t, ws] of Object.entries(THEMES)) for (const w of ws.split(" ")) csv.push(`${w},${t}`);
fs.writeFileSync("/tmp/shapeplan_ws.csv", csv.join("\n") + "\n");
await page.goto(BASE + "/word-search?type=classic", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await hideToasts();
await page.click('[data-testid="choose-upload"]');
await page.setInputFiles('[data-testid="csv-input"]', "/tmp/shapeplan_ws.csv");
await pause(800);
await next(); // -> settings
for (let i = 0; i < 8 && !(await page.$('[data-testid="mode-auto"]')); i++) {
  if (await page.$("#wordsPerPuzzle")) await page.fill("#wordsPerPuzzle", "10");
  await next();
}
await page.click('[data-testid="mode-auto"]');
await page.waitForSelector('#active-grid, [data-testid="puzzle-pager"]', { timeout: 120000 });
await pause(400);
await next(); // -> review
await next(); // -> design
await waitPreview();
await next(); // template -> plan
const wsLineup = await tour("ws", 12);
check(wsLineup.length === 12 && new Set(wsLineup.map((x) => x.shape)).size === 12, "ws: final surprise lineup has 12 different shapes");
// Preview follows the selected puzzle
let sig = await previewSig();
await page.click('[data-testid="lineup-5"]');
await waitPreview(sig);
check((await previewSig()) !== sig, "ws: preview switches to the selected puzzle");
await page.click('[data-testid="override-close"]').catch(() => {});
await next();
check((await q()) === "frame", "ws: lineup → frame");
await next();
await page.click('[data-testid="design-keep"]');
await pause();
const wsPdf = await exportPdf("ws_surprise_book");
check(/Pages:\s+\d+/.test(pdfInfo(wsPdf)), "ws: PDF opens");
montage(wsPdf, "WORD SEARCH", 9, "05_ws_pages_montage");
// The puzzles themselves carry the planned shapes (same as the PDF input).
await page.click('nav[aria-label="Progress"] button[title="Review & solution"]');
await pause(600);
const wsShapes = [];
for (let i = 0; i < 12; i++) {
  await page.selectOption('select[aria-label="Choose a puzzle"]', String(i));
  await pause(120);
  wsShapes.push(await page.getAttribute("#review-grid", "data-shape"));
}
check(wsShapes.join() === wsLineup.map((x) => x.shape).join(), `ws: every puzzle was built in its planned shape (${wsShapes.join(", ")})`);

// ================= Crossword =================
const CW = "APPLE PEAR PLUM GRAPE LEMON MELON MANGO OLIVE PEACH BERRY LIME CHERRY TIGER LION ZEBRA HORSE MOUSE SHEEP GOOSE EAGLE ROBIN OTTER WHALE SHARK TABLE CHAIR SOFA LAMP CLOCK SHELF DESK BENCH PIANO GUITAR DRUM FLUTE RIVER OCEAN LAKE HILL CLIFF VALLEY DESERT FOREST ISLAND MEADOW CANYON STREAM BREAD BUTTER CHEESE PASTA RICE SALAD SOUP HONEY SUGAR CREAM PEPPER SALT RED BLUE GREEN YELLOW PURPLE ORANGE PINK BROWN BLACK WHITE SILVER GOLD".split(" ");
const cwRows = ["Word,Clue,Theme"];
CW.forEach((w, i) => cwRows.push(`${w},A clue for ${w.toLowerCase()},Mixed ${Math.floor(i / 8) + 1}`));
fs.writeFileSync("/tmp/shapeplan_cw.csv", cwRows.join("\n") + "\n");
await page.goto(BASE + "/cross-word", { waitUntil: "networkidle" });
await hideToasts();
await page.click('[data-testid="choose-upload"]');
await page.setInputFiles('[data-testid="csv-input"]', "/tmp/shapeplan_cw.csv");
await pause(800);
await next();
await page.fill("#perPuzzle", "8").catch(() => {});
await page.click('[data-testid="build-crosswords"]');
await page.waitForSelector("#cw-grid", { timeout: 300000 });
await pause(300);
await next(); // -> design
await waitPreview();
await next();
const cwLineup = await tour("cw", 9);
check(cwLineup.length === 9 && noNeighbours(cwLineup), "cw: final surprise lineup has no neighbouring repeats");
await next();
await next();
await page.click('[data-testid="design-keep"]');
await pause();
const cwPdf = await exportPdf("cw_surprise_book");
check(/Pages:\s+\d+/.test(pdfInfo(cwPdf)), "cw: PDF opens");
montage(cwPdf, "ACROSS", 9, "06_cw_pages_montage");
await page.click('nav[aria-label="Progress"] button[title="Build & review"]');
await pause(600);
const cwShapes = [];
const tabs = await page.$$('[role="tablist"][aria-label] [role="tab"]');
for (let i = 0; i < Math.min(9, tabs.length); i++) {
  await tabs[i].click();
  await pause(150);
  cwShapes.push(await page.getAttribute("#cw-grid", "data-shape"));
}
check(cwShapes.join() === cwLineup.map((x) => x.shape).join(), `cw: every crossword was built in its planned shape (${cwShapes.join(", ")})`);

// ================= Sudoku =================
await page.goto(BASE + "/sudoku", { waitUntil: "networkidle" });
await hideToasts();
await page.click('[data-testid="quick-custom"]');
await page.fill('[data-testid="count-easy"]', "6");
await page.fill('[data-testid="count-medium"]', "6");
await page.click('[data-testid="generate-sudoku"]');
await page.waitForSelector("#sudoku-grid", { timeout: 300000 });
await next(); // -> design
await waitPreview();
await next();
const sdLineup = await tour("sd", 12);
check(sdLineup.length === 12 && new Set(sdLineup.map((x) => x.shape)).size === 12, "sd: final surprise lineup has 12 different frames");
await next();
await next();
await page.click('[data-testid="design-keep"]');
await pause();
const sdPdf = await exportPdf("sd_surprise_book");
check(/Pages:\s+\d+/.test(pdfInfo(sdPdf)), "sd: PDF opens");
montage(sdPdf, "SUDOKU", 6, "07_sd_pages_montage");

check(errors.filter((e) => !e.startsWith("check failed")).length === 0, "no console errors");
await browser.close();
finish();
