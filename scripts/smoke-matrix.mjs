// "Every option" smoke matrix + random fuzz through the real UI (production server on :3000).
//   node scripts/smoke-matrix.mjs                 curated matrix (every option at least once)
//   node scripts/smoke-matrix.mjs --fuzz 50       + 50 random option combos per tool
//   options: --tools classic,mystery,crossword,sudoku  --workers 3  --seed 1  --only-fuzz
// Each run walks the wizard with Next/Back, changes options, generates, exports the PDF and
// checks it (KDP page size, even page count, expected content). A run fails on any console
// error, page error, unhandled rejection, failed request, error toast or error screen.
import { chromium } from "playwright";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i < 0 ? d : process.argv[i + 1];
};
const FUZZ = Number(arg("fuzz", 0));
const WORKERS = Number(arg("workers", 3));
const TOOLS = arg("tools", "classic,mystery,crossword,sudoku").split(",");
const ONLY_FUZZ = process.argv.includes("--only-fuzz");
const OUT = "review/smoke";
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- deterministic randomness
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = mulberry32(Number(arg("seed", 20261115)));
const pick = (a, r = R) => a[Math.floor(r() * a.length)];
const coin = (p = 0.5, r = R) => r() < p;

const TRIMS = { "6x9": [6, 9], "8.5x11": [8.5, 11], "8.27x11.69": [8.27, 11.69] };
const WORDS = "APPLE BANANA CHERRY MANGO LEMON GRAPE PEACH PLUM KIWI MELON ORANGE PAPAYA GUAVA LIME COCONUT APRICOT TIGER LION ZEBRA HIPPO RHINO GIRAFFE MONKEY PANDA KOALA OTTER BEAVER RABBIT FOX WOLF BEAR MOOSE EAGLE HAWK ROBIN PARROT PENGUIN DOLPHIN WHALE SHARK OCTOPUS CRAB TURTLE SNAIL BEETLE SUNSHINE RAINBOW THUNDER BREEZE CLOUD STORM PIANO GUITAR VIOLIN TRUMPET FLUTE DRUM HARP CELLO BANJO".split(" ");
const words = (n, r) => [...new Set(Array.from({ length: n * 2 }, () => pick(WORDS, r)))].slice(0, n);
const PASTE_WS = "Fruit: apple, banana, cherry, mango, lemon, grape, peach, plum, kiwi, melon\nOcean animals: dolphin, whale, shark, octopus, crab, turtle, seal, squid, starfish, coral";
const SEED_RECENTS = ["longneck", "dragon", "bee", "letterB", "letterE", "pear", "icecream", "letterF"];

// ---------------------------------------------------------------- the curated matrix
// Every option appears at least once; fuzz adds random combinations on top.
const MATRIX = [];
const add = (tool, o) => MATRIX.push({ tool, name: `${tool}:${Object.entries(o).map(([k, v]) => `${k}=${v}`).join(",")}`, ...o });
if (TOOLS.includes("mystery")) {
  add("mystery", { repro: "leoncio", source: "starter", count: 24, diff: "medium", plan: "surprise", seeded: true, actions: "pin-recent,pin-category,pin-search,rapid,unpin,shuffle", trim: "8.5x11" });
  add("mystery", { source: "starter", count: 6, diff: "easy", layers: "all", style: "dossier", plan: "one", oneShape: "heart", trim: "6x9", bleed: true, template: "random" });
  add("mystery", { source: "starter", count: 12, diff: "hard", layers: "message", style: "clean", plan: "pick", cats: "letters,clusters,stepped,animals", trim: "8.27x11.69" });
  add("mystery", { source: "starter", count: 18, diff: "medium", layers: "missing", style: "dossier", plan: "manual", actions: "manual-pick,fill-random,clear", trim: "8.5x11" });
  add("mystery", { source: "starter", count: 24, diff: "hard", layers: "none", style: "clean", plan: "surprise", actions: "shuffle,pin-category", trim: "6x9" });
  add("mystery", { source: "paste", diff: "medium", layers: "all", style: "dossier", plan: "pick", cats: "basic,food,nature", trim: "8.5x11", seeded: true });
  add("mystery", { source: "theme", settings: "hotel,train,circus", themeCount: 10, diff: "easy", layers: "storyline-only", style: "clean", plan: "one", oneShape: "letterB", trim: "8.5x11", buildFirst: false });
  add("mystery", { source: "theme", settings: "manor,museum,liner,lodge,vineyard", themeCount: 30, diff: "hard", layers: "all", style: "dossier", plan: "manual", actions: "manual-pick,apply-rest", trim: "6x9", bleed: true });
  add("mystery", { source: "starter", count: 12, diff: "medium", layers: "all", style: "dossier", plan: "pick", cats: "holiday,objects,hollow", backAndForth: true, trim: "8.5x11" });
}
if (TOOLS.includes("classic")) {
  add("classic", { input: "type", diff: "easy", plan: "one", oneShape: "circle", trim: "8.5x11", seeded: true });
  add("classic", { input: "paste", diff: "medium", plan: "surprise", actions: "shuffle,pin-recent,pin-category,unpin", trim: "6x9", bleed: true });
  add("classic", { input: "type", diff: "hard", plan: "pick", cats: "animals,letters,clusters,stepped", trim: "8.27x11.69" });
  add("classic", { input: "type", diff: "expert", plan: "manual", actions: "manual-pick,fill-random", trim: "8.5x11", backAndForth: true });
}
if (TOOLS.includes("crossword")) {
  add("crossword", { clues: 12, plan: "one", oneShape: "heart", trim: "8.5x11" });
  add("crossword", { clues: 20, plan: "surprise", actions: "shuffle,pin-category", trim: "6x9", bleed: true });
  add("crossword", { clues: 16, plan: "pick", cats: "animals,food", trim: "8.27x11.69", backAndForth: true });
  add("crossword", { clues: 10, plan: "manual", actions: "manual-pick,fill-random", trim: "8.5x11" });
}
if (TOOLS.includes("sudoku")) {
  add("sudoku", { mix: "custom", plan: "one", trim: "8.5x11", perPage: 1 });
  add("sudoku", { mix: "quick-0", plan: "surprise", actions: "shuffle", trim: "6x9", bleed: true, perPage: 4 });
  add("sudoku", { mix: "custom", plan: "pick", cats: "basic,animals", trim: "8.27x11.69", perPage: 2, backAndForth: true });
  add("sudoku", { mix: "custom", plan: "manual", actions: "manual-pick,fill-random", trim: "8.5x11", perPage: 6 });
}

function fuzzRun(tool, i) {
  const r = mulberry32(Math.floor(R() * 1e9));
  const o = { fuzz: i, r, plan: pick(["one", "surprise", "pick", "manual"], r), trim: pick(Object.keys(TRIMS), r), bleed: coin(0.3, r), template: coin(0.5, r) ? "random" : undefined, backAndForth: coin(0.3, r), seeded: coin(0.4, r) };
  o.actions = [pick(["shuffle", "pin-recent", "pin-category", "pin-search", "rapid", "unpin", "manual-pick", "fill-random", "apply-rest", "clear"], r), pick(["shuffle", "pin-category", "unpin"], r)].join(",");
  o.cats = [...new Set([pick(["basic", "letters", "clusters", "stepped", "animals", "food", "nature", "holiday", "objects", "hollow"], r), pick(["basic", "animals", "food", "letters"], r)])].join(",");
  if (tool === "mystery") Object.assign(o, { source: pick(["starter", "starter", "paste", "theme"], r), count: pick([6, 12, 18, 24], r), diff: pick(["easy", "medium", "hard"], r), layers: pick(["all", "all", "none", "message", "missing", "storyline"], r), style: pick(["dossier", "clean"], r), settings: pick(["hotel", "manor,train", "circus,liner,lodge", "vineyard,museum"], r), themeCount: pick([3, 8, 15, 40], r), buildFirst: coin(0.85, r) });
  if (tool === "classic") Object.assign(o, { input: pick(["type", "paste"], r), diff: pick(["easy", "medium", "hard", "expert"], r) });
  if (tool === "crossword") Object.assign(o, { clues: pick([8, 12, 20, 30], r) });
  if (tool === "sudoku") Object.assign(o, { mix: pick(["custom", "custom", "quick-0"], r), perPage: pick([1, 2, 4, 6], r) });
  o.name = `${tool}:fuzz#${i}:${["source", "count", "diff", "layers", "style", "input", "clues", "mix", "plan", "actions", "cats", "trim", "bleed"].filter((k) => o[k] !== undefined).map((k) => `${k}=${o[k]}`).join(",")}`;
  return { tool, ...o };
}

// ---------------------------------------------------------------- one run
async function run(browser, spec, idx) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const problems = [];
  const log = [];
  const r = spec.r ?? mulberry32(idx * 7919 + 13);
  page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text().slice(0, 300)}`));
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 300)}`));
  page.on("requestfailed", (q) => !q.url().startsWith("blob:") && !q.url().startsWith("data:") && problems.push(`request failed: ${q.url()} ${q.failure()?.errorText}`));
  page.on("response", (res) => res.status() >= 400 && problems.push(`HTTP ${res.status()}: ${res.url()}`));
  await ctx.exposeFunction("__smokeError", (t) => problems.push(`error UI: ${t}`));
  await ctx.addInitScript(({ seeded, recents }) => {
    if (seeded && !sessionStorage.getItem("__seeded")) {
      sessionStorage.setItem("__seeded", "1");
      localStorage.setItem("puzzle-generator.recent-shapes.v1", JSON.stringify(recents));
      // A prior classic book: Surprise-me plan with pins on letters and animals.
      localStorage.setItem("puzzle-generator.design.v1.word-search", JSON.stringify({ shape: { kind: "longneck", mix: "each", seed: 4242, pins: { 0: "letterB", 1: "dragon", 3: "longneck" } } }));
      localStorage.setItem("puzzle-generator.design.v1.mystery", JSON.stringify({ shape: { kind: "letterF", mix: "each", seed: 99, pins: { 0: "longneck", 2: "letterE" } } }));
    }
    window.addEventListener("unhandledrejection", (e) => window.__smokeError?.(`unhandled rejection: ${e.reason?.message ?? e.reason}`));
    const seen = new WeakSet();
    new MutationObserver(() => {
      document.querySelectorAll(".Toastify__toast--error").forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        window.__smokeError?.(`toast: ${el.textContent}`);
      });
      const body = document.body?.innerText ?? "";
      if (/Application error|Unhandled Runtime Error|Something went wrong/.test(body) && !seen.has(document.body)) {
        seen.add(document.body);
        window.__smokeError?.("error screen");
      }
    }).observe(document, { childList: true, subtree: true });
  }, { seeded: !!spec.seeded, recents: SEED_RECENTS });

  const pause = (ms = 300) => page.waitForTimeout(ms);
  const q = () => page.getAttribute("[data-question]", "data-question", { timeout: 15000 }).catch(() => null);
  const has = async (sel) => !!(await page.$(sel));
  const tid = (id) => `[data-testid="${id}"]`;
  const click = async (id, ms = 300) => {
    await page.click(id.startsWith("[") || id.startsWith("#") || id.startsWith(".") || id.includes(" ") ? id : tid(id), { timeout: 20000 });
    await pause(ms);
  };
  const NEXT_BTN = ".pg-wizard-footer .pg-footer-right > button.btn-primary";
  const nextOk = () => page.isEnabled(NEXT_BTN, { timeout: 2000 }).catch(() => false);
  const next = async () => {
    const t = Date.now();
    while (!(await nextOk())) {
      if (Date.now() - t > 120000) throw new Error(`Next stayed disabled on "${await q()}"`);
      await pause(300);
    }
    await click(NEXT_BTN);
  };
  const back = () => click("wizard-back");
  const fitted = async () => {
    await pause(250);
    await page.waitForFunction(() => !document.querySelector('[data-testid="reshape-progress"]'), null, { timeout: 300000 });
    await pause(250);
  };
  /** Back then Next again: the answer must be kept. */
  const wobble = async () => {
    if (!spec.backAndForth || !coin(0.5, r)) return;
    const k = await q();
    await back();
    // A choice-card question has no Next: picking the kept answer again moves on.
    if (await has(NEXT_BTN)) await next();
    else if (await has('.pg-choice-card[aria-checked="true"]')) await click('.pg-choice-card[aria-checked="true"]', 600);
    else if (await has(tid("design-keep"))) await click("design-keep", 600); // action cards, nothing to keep
    if ((await q()) !== k) problems.push(`flow: back/next from "${k}" landed on "${await q()}"`);
  };
  const step = (s) => log.push(s);

  // Shape pickers ------------------------------------------------------------
  async function pickIn(scope, how) {
    const sc = `${tid(scope)} `;
    if (how === "search") {
      await page.fill(sc + tid("shape-search"), pick(["heart", "star", "cat", "tree", "pear", "letter", "fish"], r));
      await pause(400);
    } else if (how === "recent" && (await has(sc + tid("shape-recent")))) {
      const cards = await page.$$(sc + `${tid("shape-recent")} [data-testid^="shape-"]`);
      if (cards.length) return void (await pick(cards, r).click(), await pause(400));
    } else {
      const cats = await page.$$(sc + '[data-testid^="shape-cat-"]');
      if (cats.length) {
        await pick(cats, r).click();
        await pause(300);
        const subs = await page.$$(sc + '[data-testid^="shape-subcat-"]');
        if (subs.length && coin(0.5, r)) await pick(subs, r).click(), await pause(200);
      }
    }
    const cards = (await page.$$(sc + '[data-testid^="shape-"]')).filter(Boolean);
    const real = [];
    for (const c of cards) {
      const id = await c.getAttribute("data-testid");
      if (!/^shape-(cat|subcat|search|recent|suggest|mystery)/.test(id) && (await c.isVisible())) real.push(c);
    }
    if (real.length) await pick(real, r).click(), await pause(400);
    if (how === "search") await page.fill(sc + tid("shape-search"), "").catch(() => {});
  }
  async function pickFrame(scope) {
    const frames = await page.$$(`${tid(scope)} [data-testid^="frame-"]`);
    const vis = [];
    for (const f of frames) if ((await f.isVisible()) && (await f.getAttribute("data-testid")) !== "frame-picker") vis.push(f);
    if (vis.length) await pick(vis, r).click(), await pause(400);
  }
  const lineupCount = () => page.$$eval('[data-testid^="lineup-"][data-shape]', (els) => els.length).catch(() => 0);

  async function planActions() {
    const mode = spec.plan;
    await click(`plan-${mode}`, 600);
    await fitted();
    const acts = (spec.actions ?? "").split(",").filter(Boolean);
    if (mode === "pick" && spec.cats) {
      await click("plan-cats-none");
      if (!(await has(tid("plan-cats-empty")))) problems.push("plan: no 'pick a category' hint with none selected");
      for (const c of spec.cats.split(",")) if (await has(tid(`plan-cat-${c}`))) await click(`plan-cat-${c}`, 250);
      if (!(await page.$$('[aria-checked="true"][data-testid^="plan-cat-"], [aria-checked="mixed"][data-testid^="plan-cat-"]')).length) await click("plan-cats-all");
      await fitted();
    }
    for (const a of acts) {
      step(`action ${a}`);
      const n = await lineupCount();
      if (a === "shuffle" && (await has(tid("plan-shuffle"))) && (await page.isEnabled(tid("plan-shuffle")))) await click("plan-shuffle", 500);
      else if (a.startsWith("pin-") && n && (await has(tid("lineup-0")))) {
        await click(`lineup-${Math.floor(r() * Math.min(n, 8))}`, 500);
        const scope = (await has(tid("override-picker"))) ? "override-picker" : (await has(tid("page-picker"))) ? "page-picker" : null;
        if (scope) spec.tool === "sudoku" ? await pickFrame(scope) : await pickIn(scope, a.slice(4));
        if (await has(tid("override-close"))) await click("override-close");
      } else if (a === "rapid" && n) {
        for (let k = 0; k < 6; k++) {
          await page.click(tid(`lineup-${k % Math.min(n, 8)}`)).catch(() => {});
          const scope = (await has(tid("override-picker"))) ? "override-picker" : (await has(tid("page-picker"))) ? "page-picker" : null;
          if (scope) {
            const cards = await page.$$(`${tid(scope)} [data-testid^="shape-"]:not([data-testid^="shape-cat"]):not([data-testid^="shape-subcat"]):not([data-testid="shape-search"])`);
            const vis = [];
            for (const c of cards.slice(0, 40)) if (await c.isVisible()) vis.push(c);
            if (vis.length) await pick(vis, r).click();
          }
          await pause(80);
        }
        if (await has(tid("override-close"))) await click("override-close");
      } else if (a === "unpin" && n) {
        await click(`lineup-${Math.floor(r() * Math.min(n, 8))}`, 400);
        if (await has(tid("override-unpin"))) await click("override-unpin");
        if (await has(tid("override-close"))) await click("override-close");
        if (await has(tid("plan-unpin-all"))) await click("plan-unpin-all");
      } else if (a === "manual-pick" && mode === "manual") {
        if (await has(tid("lineup-0"))) await click("lineup-0", 400);
        for (let k = 0; k < 3; k++) {
          if (!(await has(tid("page-picker")))) break;
          spec.tool === "sudoku" ? await pickFrame("page-picker") : await pickIn("page-picker", pick(["category", "recent", "search"], r));
        }
      } else if (a === "fill-random" && (await has(tid("manual-fill-random")))) await click("manual-fill-random", 500);
      else if (a === "apply-rest" && (await has(tid("manual-apply-rest")))) await click("manual-apply-rest", 400);
      else if (a === "clear" && (await has(tid("manual-clear")))) await click("manual-clear", 400);
      await fitted();
    }
    if (spec.tool === "mystery") {
      const shapes = await page.$$eval('[data-testid^="lineup-"][data-shape]', (els) => els.map((e) => e.dataset.shape)).catch(() => []);
      const bad = shapes.filter((k) => /^(letter[CFIJKLPSTVXYZ]|digit[1234 78]|checkers|islands9|zigzag|wave|blockx|snowflake)$/.test(k));
      if (bad.length) problems.push(`mystery lineup offers shapes that can't hold a case: ${[...new Set(bad)].join(", ")}`);
    }
  }

  // Shared design + export ----------------------------------------------------
  async function designExport() {
    for (let guard = 0; guard < 30; guard++) {
      const k = await q();
      step(`q ${k}`);
      if (k === "template") {
        if (spec.template === "random") {
          const t = await page.$$('[data-testid^="template-"]');
          if (t.length) await pick(t, r).click(), await pause(400);
        }
        await wobble();
        await next();
      } else if (k === "plan") {
        await planActions();
        await next();
      } else if (k === "shape") {
        if (spec.tool === "sudoku") await pickFrame("frame-picker").catch(() => {});
        else if (spec.oneShape && (await has(tid(`shape-search`)))) {
          await page.fill(tid("shape-search"), spec.oneShape);
          await pause(400);
          const c = await page.$(tid(`shape-${spec.oneShape}`));
          if (c) await c.click(), await pause(500);
          else if (spec.tool === "mystery" && /^letter[CFIJKLPSTVXYZ]$/.test(spec.oneShape)) step("thin letter not offered for mystery (expected)");
          else problems.push(`shape ${spec.oneShape} not offered`);
          await page.fill(tid("shape-search"), "");
        } else await pickIn("shape-picker", pick(["category", "search", "recent"], r)).catch(() => {});
        await fitted();
        await wobble();
        await next();
      } else if (k === "frame") {
        const cells = await page.$$('[data-testid^="cells-"]');
        if (cells.length && coin(0.5, r)) await pick(cells, r).click(), await pause(300);
        await next();
      } else if (k === "tune" || (await has(tid("design-keep")))) {
        if (coin(0.5, r)) await click("design-keep", 600);
        else {
          await click("design-customize", 800);
          await next();
        }
      } else if (k === "customize") await next();
      else if (k === "size") {
        await page.selectOption("#trim", spec.trim);
        const bleed = await page.isChecked("#bleed");
        if (!!spec.bleed !== bleed) await page.click("#bleed");
        if (spec.perPage && (await has(tid("per-page")))) await page.selectOption(tid("per-page"), String(spec.perPage));
        const aps = await page.$$eval("#answersPerPage option", (els) => els.map((e) => e.value)).catch(() => []);
        if (aps.length) await page.selectOption("#answersPerPage", pick(aps, r));
        await wobble();
        await next();
      } else if (k === "title") {
        await page.fill("#fm-author", "Smoke Tester").catch(() => {});
        await next();
      } else if (k === "extras") {
        for (const x of ["belongsTo", "toc", "howTo", "thankYou"]) if (coin(0.3, r)) await page.click(tid(`extra-${x}`)).catch(() => {});
        if (coin(0.5, r) && (await has(tid("wizard-skip")))) await click("wizard-skip");
        else await next();
      } else if (k === "preview") {
        await page.waitForSelector('[data-testid="book-preview"][data-ready="1"]', { timeout: 300000 });
        await pause(500);
        await next();
      } else if (k === "create") {
        const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 600000 }), click("download-pdf")]);
        const file = `${OUT}/${idx}_${spec.tool}.pdf`;
        await dl.saveAs(file);
        return file;
      } else {
        if (await nextOk()) await next();
        else if (await has(tid("wizard-skip"))) await click("wizard-skip");
        else throw new Error(`stuck on question "${k}"`);
      }
    }
    throw new Error("export never reached");
  }

  // Tool flows ----------------------------------------------------------------
  async function mystery() {
    await page.goto(BASE + "/word-search", { waitUntil: "networkidle" });
    await click("ws-type-mystery");
    await click(`my-source-${spec.source}`);
    if (spec.source === "starter") {
      await wobble();
      await click("my-starter-next");
      await click(`my-count-${spec.count}`);
      await next();
    } else if (spec.source === "paste") {
      await click("my-paste-example");
      await click("my-paste-next");
      await click("my-paste-apply");
    } else {
      for (const s of spec.settings.split(",")) {
        const on = await page.getAttribute(tid(`my-setting-${s}`), "aria-pressed");
        if (on !== "true") await click(`my-setting-${s}`, 150);
      }
      await page.fill(tid("my-theme-count"), String(spec.themeCount));
      await pause();
      await click("my-theme-next");
    }
    await click(`my-diff-${spec.diff}`);
    if ((await q()) === "difficulty") await next();
    const want = { all: [1, 1, 1], none: [0, 0, 0], message: [1, 0, 0], missing: [0, 1, 0], storyline: [0, 1, 1], "storyline-only": [0, 0, 1] }[spec.layers ?? "all"];
    for (const [j, key] of ["hiddenMessage", "missingEvidence", "storyline"].entries()) {
      const on = await page.isChecked(tid(`my-${key}`));
      if (!!want[j] !== on) await page.click(tid(`my-${key}`)), await pause(150);
    }
    if (spec.layers === "storyline-only") {
      // The Case Board needs letters to come from somewhere: the step must explain that and block Next.
      const hint = (await page.textContent(tid("wizard-hint"))) ?? "";
      if ((await nextOk()) || !/Case Board needs/.test(hint)) problems.push("layers: storyline alone was not blocked with a clear hint");
      await page.click(tid("my-missingEvidence")), await pause(150);
    }
    if (await has(tid("my-phrase"))) {
      const n = spec.source === "paste" ? 2 : spec.source === "theme" ? spec.themeCount : spec.count;
      await page.fill(tid("my-phrase"), n >= 11 ? "CASE CLOSED" : "SOLVED".slice(0, Math.max(1, Math.min(6, n))));
      await pause();
    }
    await wobble();
    await next();
    await click(`my-style-${spec.style ?? "dossier"}`);
    await click("my-settings-done");
    if (spec.buildFirst === false) {
      // Stepper jump to Design before building is not allowed: the stepper must block it.
      const reachable = await page.isEnabled('nav[aria-label="Progress"] button:has-text("Design")').catch(() => false);
      if (reachable) problems.push("design step reachable before the cases are built");
    }
    await click("my-build");
    await page.waitForSelector(tid("my-checks"), { state: "attached", timeout: 300000 });
    if (await has(tid("my-problems"))) problems.push(`validator: ${await page.textContent(tid("my-problems"))}`);
    if (coin(0.5, r)) await click("my-solution-toggle");
    await click("my-build-next", 600);
    const file = await designExport();
    const text = execFileSync("pdftotext", [file, "-"]).toString();
    if (!/CASE/.test(text)) problems.push("PDF has no case files");
    return file;
  }
  async function classic() {
    await page.goto(BASE + "/word-search?type=classic", { waitUntil: "networkidle" });
    if (spec.input === "paste") {
      await click("choose-paste");
      await page.fill(tid("paste-input"), PASTE_WS);
      await click("paste-next", 800);
      await click("paste-apply", 800);
    } else {
      await click("choose-type");
      await page.fill("#wordInput", words(14, r).join("\n"));
      await next();
      await page.fill("#themeInput", "Smoke Mix");
      await next();
    }
    for (let g = 0; g < 6 && (await q()) !== "difficulty"; g++) await next();
    await click(`difficulty-${spec.diff}`);
    await wobble();
    await next(); // size
    await next(); // rules
    await click("mode-auto");
    await page.waitForSelector('[data-testid="puzzle-pager"], #active-grid', { timeout: 120000 });
    await pause(400);
    for (let g = 0; g < 4 && (await q()) !== "template"; g++) await next();
    return designExport();
  }
  async function crossword() {
    await page.goto(BASE + "/cross-word", { waitUntil: "networkidle" });
    await click("choose-type");
    await page.fill("#clueInput", words(spec.clues, r).map((w) => `${w} - A clue for ${w.toLowerCase()}`).join("\n"));
    await click("add-clues");
    await wobble();
    await next();
    await click("build-crosswords");
    await page.waitForSelector("#cw-grid", { timeout: 120000 });
    await pause(400);
    for (let g = 0; g < 4 && (await q()) !== "template"; g++) await next();
    return designExport();
  }
  async function sudoku() {
    await page.goto(BASE + "/sudoku", { waitUntil: "networkidle" });
    if (spec.mix === "custom") {
      await click("quick-custom");
      for (const d of ["easy", "medium", "hard", "expert"]) await page.fill(tid(`count-${d}`), String(Math.floor(r() * 4)));
      await page.fill(tid("count-medium"), String(1 + Math.floor(r() * 4)));
    } else await click(spec.mix);
    await wobble();
    await click("generate-sudoku");
    await page.waitForSelector("#sudoku-grid", { timeout: 180000 });
    await pause(400);
    for (let g = 0; g < 4 && (await q()) !== "template"; g++) await next();
    return designExport();
  }

  const t0 = Date.now();
  let file = null;
  try {
    file = await { mystery, classic, crossword, sudoku }[spec.tool]();
    // KDP checks on the exported PDF.
    const info = execFileSync("pdfinfo", [file]).toString();
    const pages = Number(info.match(/Pages:\s+(\d+)/)[1]);
    const [w, h] = info.match(/Page size:\s+([\d.]+) x ([\d.]+)/).slice(1).map(Number);
    const [tw, th] = TRIMS[spec.trim];
    const ew = (tw + (spec.bleed ? 0.125 : 0)) * 72;
    const eh = (th + (spec.bleed ? 0.25 : 0)) * 72;
    if (Math.abs(w - ew) > 0.6 || Math.abs(h - eh) > 0.6) problems.push(`PDF page ${w}x${h}pt, expected ${ew}x${eh}`);
    if (pages % 2 || pages < 24) problems.push(`PDF has ${pages} pages (KDP: even, at least 24)`);
    log.push(`pdf ${pages} pages`);
  } catch (e) {
    problems.push(`flow: ${String(e.message ?? e).split("\n")[0]} (at ${await q()})`);
    await page.screenshot({ path: `${OUT}/${idx}_${spec.tool}_fail.png`, fullPage: true }).catch(() => {});
  }
  await pause(500).catch(() => {});
  await ctx.close().catch(() => {});
  return { spec, problems, secs: (Date.now() - t0) / 1000, log };
}

// ---------------------------------------------------------------- pool
const runs = [...(ONLY_FUZZ ? [] : MATRIX)];
for (const tool of TOOLS) for (let i = 1; i <= FUZZ; i++) runs.push(fuzzRun(tool, i));
console.log(`${runs.length} runs (${ONLY_FUZZ ? 0 : MATRIX.length} matrix + ${FUZZ * TOOLS.length} fuzz), ${WORKERS} workers`);
let browser = await chromium.launch();
// A crashed browser (box hiccup) is a harness problem, not an app one: relaunch and retry that run once.
const browserCrashed = (res) => res.problems.some((p) => /has been closed|Browser closed|Target crashed/.test(p));
const FROM = Number(arg("from", 0));
const results = [];
let cursor = FROM;
await Promise.all(
  Array.from({ length: WORKERS }, async () => {
    while (cursor < runs.length) {
      const idx = cursor++;
      let res = await run(browser, runs[idx], idx).catch((e) => ({ spec: runs[idx], problems: [`harness: ${e.message}`], secs: 0, log: [] }));
      if (browserCrashed(res) || /harness/.test(res.problems[0] ?? "")) {
        if (!browser.isConnected()) browser = await chromium.launch();
        console.log(`  … retrying [${idx}] after a browser crash`);
        res = await run(browser, runs[idx], idx).catch((e) => ({ spec: runs[idx], problems: [`harness: ${e.message}`], secs: 0, log: [] }));
      }
      results[idx] = res;
      console.log(`${res.problems.length ? "✗" : "✓"} [${idx}] ${res.spec.name.slice(0, 150)} (${res.secs.toFixed(0)}s)${res.problems.length ? "\n    " + [...new Set(res.problems)].slice(0, 6).join("\n    ") : ""}`);
    }
  }),
);
await browser.close();
const done = results.filter(Boolean);
const failed = done.filter((x) => x.problems.length);
const byTool = {};
for (const x of done) {
  const t = (byTool[x.spec.tool] ??= { runs: 0, ok: 0 });
  t.runs++;
  if (!x.problems.length) t.ok++;
}
console.log("\nSUMMARY " + Object.entries(byTool).map(([t, v]) => `${t} ${v.ok}/${v.runs}`).join(" · "));
console.log(failed.length ? `${failed.length} runs failed` : "All runs passed with no errors.");
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(done.map(({ spec: { r, ...s }, ...x }) => ({ spec: s, ...x })), null, 1));
process.exit(failed.length ? 1 : 0);
