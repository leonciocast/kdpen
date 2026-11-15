// AI mystery cases e2e: node scripts/ai-cases-e2e.mjs
//  - SETUP_URL (default :3000, a server without AWS): the AI card shows "Needs AWS setup", quietly.
//  - MOCK_URL (default :3001, BEDROCK_MOCK=1): AI-first start → ✨ New mystery (progress with titles) →
//    review (stats, ⋯ regenerate one case, replace confirm, a second new mystery) → build & check → PDF.
// Fails on console errors, page errors, failed requests or error toasts. Screenshots -> review/ai-magic/.
import { chromium } from "playwright";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const SETUP = process.env.SETUP_URL ?? "http://localhost:3000";
const MOCK = process.env.MOCK_URL ?? "http://localhost:3001";
const OUT = process.env.OUT ?? "review/ai-magic";
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const checks = [];
const errors = [];
const check = (ok, s) => checks.push(`${ok ? "✓" : "✗"} ${s}`);
async function open(base) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text().slice(0, 200)}`));
  page.on("pageerror", (e) => errors.push(`pageerror: ${e}`));
  page.on("requestfailed", (r) => !/^(blob|data):/.test(r.url()) && errors.push(`request failed: ${r.url()}`));
  page.on("response", (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`));
  await ctx.exposeFunction("__err", (t) => errors.push(`error toast: ${t}`));
  await ctx.addInitScript(() => new MutationObserver(() => document.querySelectorAll(".Toastify__toast--error").forEach((el) => !el.dataset.seen && ((el.dataset.seen = "1"), window.__err?.(el.textContent)))).observe(document, { childList: true, subtree: true }));
  await page.goto(base + "/word-search", { waitUntil: "networkidle" });
  await page.click('[data-testid="ws-type-mystery"]');
  await page.waitForTimeout(600);
  return page;
}
const tid = (id) => `[data-testid="${id}"]`;
const NEXT = ".pg-wizard-footer .pg-footer-right > button.btn-primary";
try {
  // ---- 1. not configured: quiet setup state
  let page = await open(SETUP);
  await page.waitForFunction(() => /Needs AWS setup/.test(document.querySelector('[data-testid="my-source-ai"]')?.textContent ?? ""), null, { timeout: 15000 });
  check(await page.isDisabled(tid("my-source-ai")), "without AWS, the AI card is shown but can't be picked");
  check(/Needs AWS setup/.test(await page.textContent(tid("my-source-ai"))), "it says “Needs AWS setup”");
  check(/Recommended/.test(await page.textContent(tid("my-source-starter"))), "the Saltmere Lantern is recommended instead");
  await page.screenshot({ path: `${OUT}/00_setup_needed_saltmere_fallback.png` });
  await page.click(tid("my-source-starter"));
  await page.waitForTimeout(400);
  check((await page.getAttribute("[data-question]", "data-question")) === "starter", "the other sources still work");
  await page.context().close();

  // ---- 2. mock model: AI first, one click to a new mystery
  page = await open(MOCK);
  await page.waitForSelector(tid("my-ai-magic"), { timeout: 15000 });
  check((await page.getAttribute("[data-question]", "data-question")) === "source" && !(await page.$(tid("my-source-ai"))), "the AI start leads the Murder Mystery flow (no source cards)");
  check(!(await page.getAttribute(tid("my-ai-customize"), "open")) && !(await page.getAttribute(tid("my-other-sources"), "open")), "Customize and other sources start folded away");
  check(/cases · .* · surprise setting/.test(await page.textContent(tid("my-ai-defaults"))), `defaults are shown quietly (${(await page.textContent(tid("my-ai-defaults"))).trim()})`);
  await page.screenshot({ path: `${OUT}/01_ai_start.png` });
  await page.hover(tid("my-ai-magic"));
  await page.locator(tid("my-ai-start")).screenshot({ path: `${OUT}/02_magic_button.png` });
  await page.click(`${tid("my-other-sources")} > summary`);
  await page.click(`${tid("my-ai-customize")} > summary`);
  await page.click(tid("my-ai-setting-museum"));
  await page.click(tid("my-ai-tone-teens"));
  await page.fill(tid("my-ai-count"), "12");
  await page.waitForTimeout(300);
  check(/12 cases · Teens/.test(await page.textContent(tid("my-ai-defaults"))), "Customize updates the one-line summary");
  await page.screenshot({ path: `${OUT}/03_customize_and_other_ways.png`, fullPage: true });
  await page.click(`${tid("my-ai-customize")} > summary`);
  await page.click(`${tid("my-other-sources")} > summary`);
  await page.click(tid("my-ai-magic"));
  await page.waitForSelector(tid("my-ai-progress"), { timeout: 10000 });
  await page.waitForSelector(tid("my-ai-progress-titles"), { timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll(".pg-ai-titles li.done").length > 0, null, { timeout: 30000 });
  const ptitle = await page.textContent(".pg-ai-progress-title");
  check(/“.+”/.test(ptitle), `progress shows the story title once the outline is in (${ptitle})`);
  check((await page.$$(".pg-ai-titles li")).length === 12, "progress lists the 12 case titles, ticking them off");
  await page.screenshot({ path: `${OUT}/04_progress.png` });
  await page.waitForSelector(tid("my-ai-review"), { timeout: 120000 });
  await page.waitForTimeout(500);
  const rows = await page.$$(tid("my-review-case"));
  check(rows.length === 12, `review lists 12 cases (${rows.length})`);
  await page.click(`${tid("my-ai-notes")} > summary`);
  const stats = await page.textContent(tid("my-ai-stats")).catch(() => "");
  check(/tokens in.*about \$\d/.test(stats), `time, tokens and cost are in the quiet notes (${stats.trim()})`);
  await page.screenshot({ path: `${OUT}/05_review.png`, fullPage: true });
  const firstTitle = await page.textContent("[data-question] h2, .pg-q-title").catch(() => "");
  const before = (await page.$$eval('[data-testid="my-review-case"] .pg-my-row-title', (els) => els.map((e) => e.textContent)))[2];
  await page.locator(tid("my-ai-case-menu")).nth(2).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/06_case_menu.png` });
  await page.click(tid("my-ai-regenerate"));
  await page.waitForFunction(() => !document.querySelector(".pg-my-row.busy"), null, { timeout: 60000 });
  await page.waitForTimeout(300);
  const titles = await page.$$eval('[data-testid="my-review-case"] .pg-my-row-title', (els) => els.map((e) => e.textContent));
  check(/Revisited/.test(titles[2]) && titles[2] !== before, `⋯ “Regenerate this case” rewrote case 3 (${titles[2]})`);
  // A whole new mystery from the review: asks first.
  await page.click(tid("my-ai-magic-review"));
  await page.waitForSelector(tid("my-ai-magic-review-confirm"));
  check(/Replace “.+”\?/.test(await page.textContent(".pg-magic-confirm")), "the magic button asks before replacing the current mystery");
  await page.locator(".pg-ai-summary").screenshot({ path: `${OUT}/07_replace_confirm.png` });
  await page.click(tid("my-ai-magic-review-confirm"));
  await page.waitForSelector(tid("my-ai-progress"), { timeout: 10000 });
  await page.waitForSelector(tid("my-ai-review"), { timeout: 120000 });
  await page.waitForTimeout(400);
  const recent = await page.evaluate(() => JSON.parse(localStorage.getItem("puzzle-generator.ai-recent.v1") ?? "{}").list ?? []);
  check(recent.length === 2, `recent titles are remembered and sent as “avoid” next time (${recent.length})`);
  check((await page.$$(tid("my-review-case"))).length === 12, "the new mystery keeps the chosen 12 cases");
  void firstTitle;
  await page.click(tid("my-ai-apply"));
  await page.waitForTimeout(400);
  // settings
  let phrase = "";
  for (let i = 0; i < 6 && (await page.getAttribute("[data-question]", "data-question")) !== "style"; i++) {
    const k = await page.getAttribute("[data-question]", "data-question");
    if (k === "difficulty") await page.click(tid("my-diff-medium"));
    if (k === "features") phrase = await page.inputValue(tid("my-phrase")).catch(() => "");
    if ((await page.getAttribute("[data-question]", "data-question")) === k) await page.click(NEXT);
    await page.waitForTimeout(300);
  }
  await page.click(tid("my-style-dossier"));
  await page.click(tid("my-settings-done"));
  await page.click(tid("my-build"));
  await page.waitForSelector(tid("my-checks"), { state: "attached", timeout: 300000 });
  check(!(await page.$(tid("my-problems"))), "all 12 AI cases build and pass every check");
  check(!!(await page.$(tid("my-ai-magic-build"))), "after building, a quiet New mystery button is still there");
  await page.screenshot({ path: `${OUT}/08_built.png` });
  await page.click(tid("my-build-next"));
  await page.waitForTimeout(500);
  for (let i = 0; i < 20 && (await page.getAttribute("[data-question]", "data-question")) !== "create"; i++) {
    if (await page.$(tid("design-keep"))) await page.click(tid("design-keep"));
    else if (await page.isEnabled(NEXT).catch(() => false)) await page.click(NEXT);
    else if (await page.$(tid("wizard-skip"))) await page.click(tid("wizard-skip"));
    await page.waitForTimeout(500);
  }
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 300000 }), page.click(tid("download-pdf"))]);
  const file = `${OUT}/ai_book.pdf`;
  await dl.saveAs(file);
  const text = execFileSync("pdftotext", ["-layout", file, "-"]).toString();
  const n = Number(execFileSync("pdfinfo", [file]).toString().match(/Pages:\s+(\d+)/)[1]);
  check((text.match(/CASE FILE/g) ?? []).length === 12, "PDF has 12 case files");
  check(text.includes("CASE BOARD") && n % 2 === 0 && n >= 24, `PDF has the Case Board and a KDP page count (${n})`);
  check(!!phrase && text.replace(/\s+/g, "").includes(phrase.replace(/\s+/g, "")), `solutions reveal the final answer (${phrase})`);
  const pg = text.split("\f").findIndex((p) => p.includes("CASE FILE")) + 1;
  if (pg > 0) execFileSync("pdftoppm", ["-r", "100", "-png", "-singlefile", "-f", String(pg), "-l", String(pg), file, `${OUT}/09_pdf_case`]);
  await page.context().close();
} catch (e) {
  await browser.contexts().at(-1)?.pages()[0]?.screenshot({ path: `${OUT}/_fail.png`, fullPage: true }).catch(() => {});
  errors.push(`flow: ${String(e.message).split("\n")[0]}`);
}
await browser.close();
console.log(checks.join("\n"));
console.log(`${checks.filter((c) => c.startsWith("✓")).length}/${checks.length} checks passed`);
if (errors.length) console.log("ERRORS:\n" + [...new Set(errors)].join("\n"));
else console.log("No console errors.");
process.exit(errors.length || checks.some((c) => c.startsWith("✗")) ? 1 : 0);
