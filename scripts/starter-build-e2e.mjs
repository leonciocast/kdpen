// Leoncio-like check: a saved mystery design full of shapes that can't hold a case
// (from an earlier "Surprise me"), then build the Saltmere starter in every setting combo.
// Fails on any error toast, console error, page error, failed request or validator problem.
// Usage: node scripts/starter-build-e2e.mjs [--base http://localhost:3000] [--workers 3]
import { chromium } from "playwright";
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const BASE = arg("base", "http://localhost:3000");
const WORKERS = Number(arg("workers", 3));
const BAD = "letterL,letterI,digit1,digit7,zigzag,wave,checkers,islands9,longneck,whale,trex,giraffe,letterT,letterZ,digit4,snowflake,boat,guitar,dragon,crocodile,seahorse,fish,bat,letterF".split(",");
const runs = [];
for (const count of [6, 12, 18, 24]) for (const diff of ["easy", "medium", "hard"]) for (const hm of [1, 0]) for (const me of [1, 0]) runs.push({ count, diff, hm, me, kind: BAD[runs.length % BAD.length] });
const browser = await chromium.launch();
let cursor = 0, ok = 0;
const fails = [];
async function one(spec) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 } });
  const page = await ctx.newPage();
  const problems = [];
  page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text().slice(0, 200)}`));
  page.on("pageerror", (e) => problems.push(`pageerror: ${e}`));
  page.on("requestfailed", (q) => !/^(blob|data):/.test(q.url()) && problems.push(`request failed: ${q.url()}`));
  await ctx.exposeFunction("__err", (t) => problems.push(`error UI: ${t}`));
  await ctx.addInitScript(({ kind, bad }) => {
    if (!sessionStorage.getItem("__s")) {
      sessionStorage.setItem("__s", "1");
      const pins = {};
      bad.forEach((k, i) => (pins[i] = k));
      localStorage.setItem("puzzle-generator.design.v1.mystery", JSON.stringify({ shape: { kind, mix: "each", seed: 7, pins } }));
    }
    new MutationObserver(() => document.querySelectorAll(".Toastify__toast--error").forEach((el) => !el.dataset.seen && ((el.dataset.seen = "1"), window.__err?.(el.textContent)))).observe(document, { childList: true, subtree: true });
  }, { kind: spec.kind, bad: BAD });
  const tid = (id) => `[data-testid="${id}"]`;
  const click = async (id) => (await page.click(tid(id), { timeout: 30000 }), await page.waitForTimeout(250));
  try {
    await page.goto(BASE + "/word-search", { waitUntil: "networkidle" });
    await click("ws-type-mystery");
    await click("my-source-starter");
    await click("my-starter-next");
    await click(`my-count-${spec.count}`);
    const NEXT = ".pg-wizard-footer .pg-footer-right > button.btn-primary";
    if ((await page.getAttribute("[data-question]", "data-question")) !== "difficulty") await page.click(NEXT);
    await click(`my-diff-${spec.diff}`);
    if ((await page.getAttribute("[data-question]", "data-question")) === "difficulty") await page.click(NEXT);
    for (const [key, want] of [["hiddenMessage", spec.hm], ["missingEvidence", spec.me], ["storyline", spec.hm || spec.me ? 1 : 0]]) {
      if ((await page.isChecked(tid(`my-${key}`))) !== !!want) await page.click(tid(`my-${key}`));
    }
    await page.waitForTimeout(200);
    await page.click(NEXT);
    await click("my-style-dossier");
    await click("my-settings-done");
    await click("my-build");
    await page.waitForSelector(tid("my-checks"), { state: "attached", timeout: 300000 });
    if (await page.$(tid("my-problems"))) problems.push(`validator: ${await page.textContent(tid("my-problems"))}`);
  } catch (e) {
    problems.push(`flow: ${String(e.message).split("\n")[0]}`);
    await page.screenshot({ path: `review/starter_${spec.count}_${spec.diff}_${spec.hm}${spec.me}_fail.png` }).catch(() => {});
  }
  await ctx.close();
  return problems;
}
await Promise.all(Array.from({ length: WORKERS }, async () => {
  while (cursor < runs.length) {
    const s = runs[cursor++];
    const p = await one(s);
    const name = `n=${s.count} ${s.diff} message=${s.hm} missing=${s.me} saved=${s.kind}`;
    if (p.length) fails.push(name), console.log(`✗ ${name}\n    ${[...new Set(p)].slice(0, 4).join("\n    ")}`);
    else ok++, console.log(`✓ ${name}`);
  }
}));
await browser.close();
console.log(`\n${ok}/${runs.length} starter builds passed${fails.length ? "" : " with no errors"}.`);
process.exit(fails.length ? 1 : 0);
