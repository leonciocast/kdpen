// Book preview e2e: node scripts/preview-e2e.mjs  (server on :3000; poppler's pdftotext on PATH)
// For word search, crossword and sudoku: open "Preview & arrange", real mouse drag to reorder,
// zoom, pagination, page/spread views, undo/redo, then export and check the PDF page order
// against the default export. Also times a 10,000-word book. Screenshots -> review/preview/.
import { chromium } from "playwright";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "review/preview";
const SKIP_10K = process.env.SKIP_10K === "1";
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
const checks = [];
const perf = [];
page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()}: ${m.text()}`));
page.on("pageerror", (e) => errors.push(`${page.url()}: ${e}`));
page.on("dialog", (d) => d.accept());
const T0 = Date.now();
process.on("uncaughtException", (e) => { console.log(checks.join("\n")); console.log(errors.join("\n")); console.error(e.message.split("\n")[0]); process.exit(1); });
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
const shot = async (name, opts = {}) => {
  await pause(200);
  if (opts.el) await page.locator(opts.el).screenshot({ path: `${OUT}/${name}.png` });
  else await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  stamp(name);
};
const waitDesign = () => page.waitForFunction(() => document.querySelector('[data-testid="design-preview"]')?.width > 50, null, { timeout: 60000 });
const thumbs = () => page.$$eval('[data-testid="bp-thumb"]', (els) => els.map((e) => ({ key: e.dataset.key, label: e.dataset.label, page: Number(e.dataset.page) })));
const allPages = () =>
  page.evaluate(async () => {
    // Every page (the grid is virtualized): scroll through and collect.
    const sc = document.querySelector(".pg-bp-scroll");
    const seen = new Map();
    for (let y = 0; ; y += sc.clientHeight * 0.8) {
      sc.scrollTop = y;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      document.querySelectorAll('[data-testid="bp-thumb"]').forEach((e) => seen.set(Number(e.dataset.page), { key: e.dataset.key, label: e.dataset.label, page: Number(e.dataset.page) }));
      if (y >= sc.scrollHeight) break;
    }
    sc.scrollTop = 0;
    return [...seen.values()].sort((a, b) => a.page - b.page);
  });
const waitReady = async (timeout = 120000) => {
  await page.waitForSelector('[data-testid="book-preview"][data-ready="1"]', { timeout });
  await page.waitForFunction(() => {
    const c = [...document.querySelectorAll('[data-testid="bp-thumb"] canvas, [data-testid="bp-page-canvas"]')];
    return c.length > 0 && c.slice(0, 8).every((x) => x.dataset.state === "fresh");
  }, null, { timeout });
};
const pdfPages = (file) => execFileSync("pdftotext", ["-layout", file, "-"]).toString().split("\f").slice(0, -1);
const strip = (s) => s.replace(/\d+/g, "#").replace(/\s+/g, "");
async function exportPdf(name) {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 600000 }), page.click('[data-testid="download-pdf"]')]);
  const file = `${OUT}/${name}.pdf`;
  await dl.saveAs(file);
  return file;
}
async function drag(fromSel, toSel, name) {
  const a = await page.locator(fromSel).boundingBox();
  const b = await page.locator(toSel).boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  const tx = b.x + 4;
  const ty = b.y + b.height / 2;
  for (let i = 1; i <= 12; i++) await page.mouse.move(a.x + a.width / 2 + ((tx - a.x - a.width / 2) * i) / 12, a.y + a.height / 2 + ((ty - a.y - a.height / 2) * i) / 12);
  await pause(150);
  check(await page.isVisible('[data-testid="bp-drop"]'), `${name}: drop marker shows while dragging`);
  if (name) await shot(`${name}_02_dragging`);
  await page.mouse.up();
  await pause(200);
}

/** The shared preview checks for one tool; we're on the preview question. */
async function exercise(tool, unit) {
  let t0 = Date.now();
  await waitReady();
  perf.push(`${tool}: preview open → first thumbnails ${Date.now() - t0} ms (PDF build ${Math.round(await page.evaluate(() => window.__kdpenPreviewMs))} ms)`);
  check((await q()) === "preview", `${tool}: extras → preview question`);
  await shot(`${tool}_01_grid`);
  const before = await allPages();
  const total = Number((await page.innerText('[data-testid="bp-total"]')).replace(/\D/g, ""));
  check(total === before.length, `${tool}: "of ${total}" matches ${before.length} pages`);

  // Default export (reference for the order check)
  await next();
  check((await q()) === "create", `${tool}: Looks good → create`);
  const fileA = await exportPdf(`${tool}_default`);
  const A = pdfPages(fileA);
  check(A.length === before.length, `${tool}: default PDF has ${A.length} pages = preview ${before.length}`);
  await page.click('[data-testid="wizard-back"]');
  await pause();
  check((await q()) === "preview", `${tool}: back from create → preview`);
  await waitReady();

  // Real mouse drag: the last puzzle page goes before the first one (smaller thumbnails so both are on screen).
  await page.click('[data-testid="bp-fullscreen"]');
  for (let i = 0; i < 3; i++) await page.click('[data-testid="bp-zoom-out"]');
  await pause(300);
  const puz = before.filter((p) => p.label.startsWith(unit));
  const last = puz[puz.length - 1];
  const first = puz[0];
  await drag(`[data-key="${last.key}"]`, `[data-key="${first.key}"]`, tool);
  let after = await allPages();
  const moved = after.find((p) => p.key === last.key);
  const firstNo = (l) => l.replace(/–.*/, "").replace(/s (\d)/, " $1");
  check(moved.page === first.page && firstNo(moved.label) === firstNo(first.label), `${tool}: dragged "${last.label}" → now page ${moved.page} "${moved.label}" (renumbered)`);
  check(after.find((p) => p.key === first.key).label !== first.label, `${tool}: the old first ${unit.toLowerCase()} renumbered to "${after.find((p) => p.key === first.key).label}"`);
  t0 = Date.now();
  await waitReady();
  perf.push(`${tool}: rebuild after a drag ${Date.now() - t0} ms`);
  await shot(`${tool}_03_after_drag`);
  await page.click('[data-testid="bp-fullscreen"]');
  await page.keyboard.press("Control+0");
  await pause(200);
  check(await page.isEnabled('[data-testid="bp-undo"]'), `${tool}: undo is available after the drag`);

  // Zoom: button, slider and keyboard
  const w0 = (await page.locator('[data-testid="bp-thumb"]').first().boundingBox()).width;
  await page.click('[data-testid="bp-zoom-in"]');
  await page.click('[data-testid="bp-zoom-in"]');
  await pause(200);
  const w1 = (await page.locator('[data-testid="bp-thumb"]').first().boundingBox()).width;
  check(w1 > w0, `${tool}: zoom in grows thumbnails ${Math.round(w0)} → ${Math.round(w1)} px`);
  await page.focus(".pg-bp-scroll");
  await page.keyboard.press("Control+Minus");
  await page.keyboard.press("Control+Minus");
  await page.keyboard.press("Control+Minus");
  await pause(200);
  const w2 = (await page.locator('[data-testid="bp-thumb"]').first().boundingBox()).width;
  check(w2 < w1, `${tool}: Ctrl − shrinks thumbnails ${Math.round(w1)} → ${Math.round(w2)} px`);
  await page.keyboard.press("Control+0");
  check(await page.isEnabled('[data-testid="bp-undo"]'), `${tool}: undo still available after zoom`);

  // Pagination
  await page.fill('[data-testid="bp-page-input"]', "1");
  await page.press('[data-testid="bp-page-input"]', "Enter");
  await page.click('[data-testid="bp-next"]');
  check((await page.inputValue('[data-testid="bp-page-input"]')) === "2", `${tool}: next → page 2`);
  await page.fill('[data-testid="bp-page-input"]', String(moved.page));
  await page.press('[data-testid="bp-page-input"]', "Enter");
  check((await page.inputValue('[data-testid="bp-page-input"]')) === String(moved.page), `${tool}: jump to page ${moved.page}`);
  await page.focus(".pg-bp-scroll");
  await page.keyboard.press("ArrowRight");
  check((await page.inputValue('[data-testid="bp-page-input"]')) === String(moved.page + 1), `${tool}: → arrow key moves to page ${moved.page + 1}`);
  await page.keyboard.press("ArrowLeft");
  check(await page.isEnabled('[data-testid="bp-undo"]'), `${tool}: undo still available after paging`);

  // Single page view, fit modes, zoom, safe zones
  await page.click('[data-testid="bp-view-page"]');
  await waitReady();
  await page.click('[data-testid="bp-zones"]');
  await shot(`${tool}_04_page_zones`);
  const pct0 = await page.innerText('[data-testid="bp-zoom-pct"]');
  await page.click('[data-testid="bp-fit-width"]');
  await pause(300);
  const pct1 = await page.innerText('[data-testid="bp-zoom-pct"]');
  check(pct0 !== pct1, `${tool}: fit page ${pct0} → fit width ${pct1}`);
  await page.click('[data-testid="bp-zoom-in"]');
  await pause(200);
  const pct2 = await page.innerText('[data-testid="bp-zoom-pct"]');
  check(parseInt(pct2) > parseInt(pct1), `${tool}: zoom in ${pct1} → ${pct2}`);
  await page.click('[data-testid="bp-fit-page"]');
  await page.click('[data-testid="bp-zones"]');
  await page.click('[data-testid="bp-view-spread"]');
  await waitReady();
  check((await page.locator('[data-testid="bp-page-canvas"]').count()) === 2, `${tool}: spread shows two facing pages`);
  await shot(`${tool}_05_spread`);
  await page.click('[data-testid="bp-view-grid"]');
  await pause(300);

  // Undo / redo
  await page.click('[data-testid="bp-undo"]');
  await pause(200);
  after = await allPages();
  check(after.find((p) => p.key === last.key).label === last.label, `${tool}: undo puts "${last.label}" back`);
  await page.click('[data-testid="bp-redo"]');
  await pause(200);
  after = await allPages();
  check(firstNo(after.find((p) => p.key === last.key).label) === firstNo(first.label), `${tool}: redo moves it again`);

  // Export the arranged book and compare with the default export.
  await waitReady();
  await next();
  check(await page.isVisible('[data-testid="order-custom"]'), `${tool}: create step says "Your arrangement"`);
  const fileB = await exportPdf(`${tool}_arranged`);
  const B = pdfPages(fileB);
  check(B.length === after.length, `${tool}: arranged PDF has ${B.length} pages = preview ${after.length}`);
  const defIndex = new Map(before.map((p, i) => [p.key, i]));
  let same = 0;
  let compared = 0;
  const bad = [];
  after.forEach((p, i) => {
    if (p.label.startsWith("Answers") || p.label === "Contents") return; // answers re-flow; contents numbers change
    const j = defIndex.get(p.key);
    if (j === undefined) return;
    compared++;
    if (strip(B[i]) === strip(A[j])) same++;
    else bad.push(`${p.page} ${p.label}`);
  });
  check(same === compared, `${tool}: every arranged page prints the same page as before, at its new place (${same}/${compared})${bad.length ? " differ: " + bad.slice(0, 4).join(", ") : ""}`);
  const nums = after.filter((p, i) => !p.label.startsWith("Title") && !p.label.startsWith("Copyright") && !p.label.startsWith("This book") && !p.label.startsWith("Thank") && !p.label.startsWith("Blank") && /\S/.test(B[i]));
  const numbered = nums.filter((p) => new RegExp(`(^|[\\s—–-])${p.page}[\\s—–-]*$`).test(B[p.page - 1].trimEnd()));
  check(numbered.length === nums.length, `${tool}: printed page numbers follow the new order (${numbered.length}/${nums.length})`);
  const tocI = after.findIndex((p) => p.label === "Contents");
  if (tocI >= 0) {
    const solPage = after.find((p) => p.label.startsWith("Answers")).page;
    check(new RegExp(`Solutions[ .]*${solPage}\\b`).test(B[tocI].replace(/\s+/g, " ")), `${tool}: contents lists Solutions on page ${solPage}`);
  }
  return { before, after, A, B };
}

// ---------------- Word search (three themes) ----------------
await page.goto(BASE + "/word-search?type=classic", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await hideToasts();
const groups = [
  ["Animals", "LION TIGER ZEBRA MONKEY PANDA KOALA OTTER HORSE"],
  ["Fruit", "APPLE MANGO PEACH LEMON GRAPE MELON CHERRY BANANA"],
  ["Colors", "PURPLE ORANGE YELLOW SILVER GOLDEN MAROON VIOLET INDIGO"],
];
for (let g = 0; g < groups.length; g++) {
  if (g > 0) await page.click('[data-testid="add-more"]');
  await page.click('[data-testid="choose-type"]');
  await page.fill("#wordInput", groups[g][1].split(" ").join("\n"));
  await page.press("#wordInput", "Control+Enter");
  await pause();
  await page.fill("#themeInput", groups[g][0]);
  await page.press("#themeInput", "Enter");
  await pause();
}
await next();
await page.click('[data-testid="difficulty-easy"]');
await pause();
await page.fill("#wordsPerPuzzle", "4");
await pause();
await next();
await next();
await page.click('[data-testid="mode-auto"]');
await page.waitForSelector('[data-testid="puzzle-pager"], #active-grid', { timeout: 60000 });
await pause(500);
await next();
await next();
await waitDesign();
await next(); // -> plan
await next(); // -> shape
await next(); // -> frame
await next();
await page.click('[data-testid="design-keep"]');
await pause();
await next();
await page.fill("#fm-author", "Ana Pérez").catch(() => {});
await next();
await page.click('[data-testid="wizard-skip"]');
await pause();
const ws = await exercise("ws", "Puzzle");
// Word-search extras: multi-select, insert, delete, KDP fixes, full screen
await page.click('[data-testid="wizard-back"]');
await waitReady();
const wsP = (await allPages()).filter((p) => p.label.startsWith("Puzzle"));
await page.click(`[data-key="${wsP[0].key}"]`);
await page.click(`[data-key="${wsP[2].key}"]`, { modifiers: ["Shift"] });
check((await page.innerText('[data-testid="bp-selcount"]')).startsWith("3"), "ws: shift-click selects a range of 3");
await page.click(`[data-key="${wsP[4].key}"]`, { modifiers: ["Control"] });
check((await page.innerText('[data-testid="bp-selcount"]')).startsWith("4"), "ws: ctrl-click adds a 4th page");
await shot("ws_06_multiselect");
await page.click('[data-testid="bp-move-end"]');
await pause(200);
let pagesNow = await allPages();
const firstSol = pagesNow.findIndex((p) => p.label.startsWith("Answers"));
const lastPuz = pagesNow.map((p) => p.label.startsWith("Puzzle")).lastIndexOf(true);
check(lastPuz > firstSol, "ws: moving puzzles to the end puts them after the answers");
check((await page.getAttribute('[data-testid="bp-check-order"]', "data-level")) === "warn", "ws: KDP check warns: answers before puzzles");
await page.click('[data-testid="bp-clear"]');
await shot("ws_07_warning");
await page.click('[data-testid="bp-fix-order"]');
await pause(200);
check((await page.getAttribute('[data-testid="bp-check-order"]', "data-level")) === "ok", "ws: the fix link moves the answers after the puzzles");
const n0 = (await allPages()).length;
await page.click(`[data-key="${wsP[1].key}"]`);
await page.click('[data-testid="bp-more"]');
await shot("ws_08_more_menu");
await page.click('[data-testid="bp-insert-notes"]');
await pause(200);
pagesNow = await allPages();
const ins = pagesNow.find((p) => p.key.startsWith("notes-x"));
check(!!ins, `ws: inserted a notes page at page ${ins?.page}`);
check(pagesNow.length === n0 || pagesNow.length === n0 + 2, `ws: page count stays even (${n0} → ${pagesNow.length})`);
await page.focus(".pg-bp-scroll");
await page.keyboard.press("Delete");
await pause(200);
check(!(await allPages()).some((p) => p.key.startsWith("notes-x")), "ws: Delete key removes the selected page");
await page.click(`[data-key="${wsP[3].key}"]`);
await page.click('[data-testid="bp-delete"]');
await pause(200);
check((await page.getAttribute('[data-testid="bp-check-deleted"]', "data-level")) === "info", "ws: removing a puzzle shows up in the KDP check");
await page.click('[data-testid="bp-fix-deleted"]');
await pause(200);
check((await page.$('[data-testid="bp-check-deleted"]')) === null, "ws: Bring back restores it");
await page.click('[data-testid="bp-more"]');
await page.click('[data-testid="bp-sort-theme"]');
await pause(200);
await page.click('[data-testid="bp-fullscreen"]');
await waitReady();
await shot("ws_09_fullscreen");
await page.keyboard.press("Escape");
await pause(200);
check(!(await page.$(".pg-bp.full")), "ws: Esc leaves full screen");
await page.click('[data-testid="bp-reset"]');
await pause(200);
check(!(await page.$('[data-testid="bp-reset"]')), "ws: Original order resets the arrangement");
check((await q()) === "preview", "ws: keys in the preview never advance the wizard");

// ---------------- Crossword (themes from a CSV) ----------------
const cwRows = ["Word,Clue,Theme"];
const cwThemes = {
  Fruit: ["APPLE", "PEAR", "PLUM", "GRAPE", "LEMON", "MELON", "MANGO", "OLIVE", "PEACH", "BERRY", "LIME", "KIWI"],
  Animals: ["LION", "TIGER", "EAGLE", "OTTER", "HORSE", "MOUSE", "SNAKE", "ZEBRA", "CAMEL", "PANDA", "KOALA", "SHEEP"],
  Music: ["PIANO", "GUITAR", "DRUM", "FLUTE", "VIOLIN", "TRUMPET", "HARP", "CELLO", "TUBA", "OBOE", "BANJO", "ORGAN"],
};
for (const [th, list] of Object.entries(cwThemes)) for (const w of list) cwRows.push(`${w},Clue for ${w.toLowerCase()},${th}`);
fs.writeFileSync("/tmp/cw_preview.csv", cwRows.join("\n") + "\n");
await page.goto(BASE + "/cross-word", { waitUntil: "networkidle" });
await hideToasts();
await page.click('[data-testid="choose-upload"]');
await page.setInputFiles('[data-testid="csv-input"]', "/tmp/cw_preview.csv");
await pause(800);
await next();
await page.fill("#perPuzzle", "6").catch(() => {});
await page.click('[data-testid="build-crosswords"]');
await page.waitForSelector("#cw-grid", { timeout: 180000 });
await pause(300);
await next();
await waitDesign();
await next(); // -> plan
await next(); // -> shape
await next(); // -> frame
await next();
await page.click('[data-testid="design-keep"]');
await pause();
await next();
await next();
await page.click('[data-testid="wizard-skip"]');
await pause();
await exercise("cw", "Crossword");

// ---------------- Sudoku (4 per page: page groups move as a whole) ----------------
await page.goto(BASE + "/sudoku", { waitUntil: "networkidle" });
await hideToasts();
await page.click('[data-testid="quick-custom"]');
await page.fill('[data-testid="count-easy"]', "6");
await page.fill('[data-testid="count-medium"]', "6");
await page.fill('[data-testid="count-hard"]', "6");
await page.click('[data-testid="generate-sudoku"]');
await page.waitForSelector("#sudoku-grid", { timeout: 300000 });
await next();
await waitDesign();
await next(); // -> plan
await next(); // -> shape
await next(); // -> frame
await next();
await page.click('[data-testid="design-keep"]');
await page.selectOption('[data-testid="per-page"]', "4");
await pause();
await next();
await next();
await page.click('[data-testid="wizard-skip"]');
await pause();
await exercise("sd", "Puzzle");

// ---------------- 10,000-word book: performance ----------------
if (!SKIP_10K) {
  const letters = "AEIOUBCDFGHLMNPRSTVWY";
  let seed = 42;
  const rnd = () => {
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
  await page.goto(BASE + "/word-search?type=classic", { waitUntil: "networkidle" });
  await hideToasts();
  await page.click('[data-testid="choose-upload"]');
  await page.setInputFiles('[data-testid="csv-input"]', "/tmp/ws_10k.csv");
  await page.waitForFunction(() => document.querySelector('[data-testid="word-count"]')?.textContent?.startsWith("10,000"), null, { timeout: 60000 });
  await next();
  await next();
  await page.fill("#wordsPerPuzzle", "36");
  await next();
  await next();
  await page.click('[data-testid="mode-auto"]');
  await page.waitForSelector('[data-testid="puzzle-pager"]', { timeout: 300000 });
  await next();
  await next();
  await waitDesign();
  await next(); // -> plan
  await next(); // -> shape
  await next(); // -> frame
  await next();
  await page.click('[data-testid="design-keep"]');
  await next();
  await next();
  const t0 = Date.now();
  await page.click('[data-testid="wizard-skip"]');
  await page.waitForSelector('[data-testid="bp-thumb"]');
  const tGrid = Date.now() - t0;
  await waitReady(300000);
  const tReady = Date.now() - t0;
  const n10 = Number((await page.innerText('[data-testid="bp-total"]')).replace(/\D/g, ""));
  perf.push(`10k words (${n10} pages): page grid with labels ${tGrid} ms, real PDF thumbnails ${tReady} ms (PDF build ${Math.round(await page.evaluate(() => window.__kdpenPreviewMs))} ms)`);
  await shot("ws10k_01_grid");
  // Scroll smoothness: scroll the whole grid over ~4 s and measure frame times.
  const fr = await page.evaluate(async () => {
    const sc = document.querySelector(".pg-bp-scroll");
    const times = [];
    const start = performance.now();
    const dur = 4000;
    await new Promise((done) => {
      const tick = (now) => {
        times.push(now);
        const f = Math.min(1, (now - start) / dur);
        sc.scrollTop = f * (sc.scrollHeight - sc.clientHeight);
        if (f < 1) requestAnimationFrame(tick);
        else done();
      };
      requestAnimationFrame(tick);
    });
    const d = times.slice(1).map((t, i) => t - times[i]).sort((a, b) => a - b);
    return { frames: d.length, avg: d.reduce((a, b) => a + b, 0) / d.length, p95: d[Math.floor(d.length * 0.95)], max: d[d.length - 1], long: d.filter((x) => x > 50).length, nodes: document.querySelectorAll('[data-testid="bp-thumb"]').length };
  });
  perf.push(`10k scroll top→bottom in 4 s: ${fr.frames} frames, avg ${fr.avg.toFixed(1)} ms (${(1000 / fr.avg).toFixed(0)} fps), p95 ${fr.p95.toFixed(1)} ms, max ${fr.max.toFixed(0)} ms, ${fr.long} frames > 50 ms; only ${fr.nodes} thumbnails in the DOM`);
  await pause(1500);
  await shot("ws10k_02_scrolled_end");
  // Drag in the big book (near the end, with auto-scroll not needed) and time the rebuild.
  await page.evaluate(() => (document.querySelector(".pg-bp-scroll").scrollTop = 0));
  await page.click('[data-testid="bp-fullscreen"]');
  await pause(600);
  const vis = await page.$$eval('[data-testid="bp-thumb"]', (els) => {
    const r = document.querySelector(".pg-bp-scroll").getBoundingClientRect();
    return els.filter((e) => { const b = e.getBoundingClientRect(); return b.top >= r.top && b.bottom <= r.bottom; }).map((e) => ({ key: e.dataset.key, label: e.dataset.label }));
  });
  const pz = vis.filter((p) => p.label.startsWith("Puzzle"));
  if (pz.length >= 2) {
    await drag(`[data-key="${pz[pz.length - 1].key}"]`, `[data-key="${pz[0].key}"]`, "ws10k");
    const t1 = Date.now();
    const lab = await page.getAttribute(`[data-key="${pz[pz.length - 1].key}"]`, "data-label");
    perf.push(`10k: labels/numbers updated instantly after drag ("${pz[pz.length - 1].label}" → "${lab}")`);
    await waitReady(300000);
    perf.push(`10k: real thumbnails refreshed ${Date.now() - t1} ms after the drag`);
    await shot("ws10k_03_after_drag");
  } else errors.push("10k: no puzzle pages visible to drag");
  // Auto-scroll: hold a page near the bottom edge and the grid scrolls by itself.
  const sc0 = await page.evaluate(() => document.querySelector(".pg-bp-scroll").scrollTop);
  const box = await page.locator(".pg-bp-scroll").boundingBox();
  const src = await page.locator(`[data-key="${pz[1].key}"]`).boundingBox();
  await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2);
  await page.mouse.down();
  await page.mouse.move(src.x + src.width / 2, box.y + box.height - 10, { steps: 8 });
  await pause(1200);
  const sc1 = await page.evaluate(() => document.querySelector(".pg-bp-scroll").scrollTop);
  await page.mouse.up();
  check(sc1 > sc0 + 300, `10k: dragging near the bottom edge auto-scrolls (${Math.round(sc0)} → ${Math.round(sc1)} px)`);
  await waitReady(300000);
}

await browser.close();
console.log(checks.join("\n"));
console.log("\nPerformance:\n" + perf.join("\n"));
console.log(errors.length ? `\nERRORS (${errors.length}):\n${errors.join("\n")}` : "\nNo console errors.");
process.exit(errors.length ? 1 : 0);
