// AI mystery cases e2e: node scripts/ai-cases-e2e.mjs
//  - SETUP_URL (default :3000, a server without AWS): the AI card shows "Needs AWS setup", quietly.
//  - MOCK_URL (default :3001, BEDROCK_MOCK=1): AI card → options → Generate (progress) → review
//    (notes, regenerate one case) → settings → build & check → design → PDF.
// Fails on console errors, page errors, failed requests or error toasts. Screenshots -> review/ai-cases/.
import { chromium } from "playwright";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const SETUP = process.env.SETUP_URL ?? "http://localhost:3000";
const MOCK = process.env.MOCK_URL ?? "http://localhost:3001";
const OUT = "review/ai-cases";
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
  await page.screenshot({ path: `${OUT}/01_setup_needed.png` });
  await page.click(tid("my-source-starter"));
  await page.waitForTimeout(400);
  check((await page.getAttribute("[data-question]", "data-question")) === "starter", "the other sources still work");
  await page.context().close();

  // ---- 2. mock model: the whole flow to a PDF
  page = await open(MOCK);
  await page.waitForFunction(() => !document.querySelector('[data-testid="my-source-ai"]')?.disabled, null, { timeout: 15000 });
  check(/Recommended/.test(await page.textContent(tid("my-source-ai"))), "with AWS, the AI card is first and recommended");
  await page.screenshot({ path: `${OUT}/02_sources.png` });
  await page.click(tid("my-source-ai"));
  await page.waitForTimeout(400);
  await page.click(tid("my-ai-setting-museum"));
  await page.click(tid("my-ai-tone-teens"));
  await page.fill(tid("my-ai-count"), "12");
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/03_options.png` });
  check(/Generate 12 cases/.test(await page.textContent(tid("my-ai-generate"))), "Generate button names the case count");
  await page.click(tid("my-ai-generate"));
  await page.waitForSelector(tid("my-ai-progress"), { timeout: 10000 });
  await page.waitForFunction(() => /case \d+ of 12|Polishing/i.test(document.querySelector('[data-testid="my-ai-progress"]')?.textContent ?? ""), null, { timeout: 30000 });
  await page.screenshot({ path: `${OUT}/04_progress.png` });
  check(true, "progress shows the storyline, then “Writing case N of 12…”");
  await page.waitForSelector(tid("my-ai-review"), { timeout: 120000 });
  await page.waitForTimeout(500);
  const rows = await page.$$(tid("my-review-case"));
  check(rows.length === 12, `review lists 12 cases (${rows.length})`);
  check(!!(await page.$(tid("my-ai-notes"))), "repairs are listed behind a quiet disclosure");
  await page.screenshot({ path: `${OUT}/05_review.png`, fullPage: true });
  const before = await page.textContent(`${tid("my-review-case")}:nth-of-type(4) .pg-my-row-title`).catch(() => "");
  const third = (await page.$$(tid("my-ai-regenerate")))[2];
  await third.click();
  await page.waitForFunction(() => ![...document.querySelectorAll('[data-testid="my-ai-regenerate"]')].some((b) => b.disabled), null, { timeout: 60000 });
  const titles = await page.$$eval('[data-testid="my-review-case"] .pg-my-row-title', (els) => els.map((e) => e.textContent));
  check(/Revisited/.test(titles[2]) && titles[2] !== before, `“Regenerate this case” rewrote case 3 (${titles[2]})`);
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
  await page.screenshot({ path: `${OUT}/06_built.png` });
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
  if (pg > 0) execFileSync("pdftoppm", ["-r", "100", "-png", "-singlefile", "-f", String(pg), "-l", String(pg), file, `${OUT}/07_pdf_case`]);
  await page.context().close();
} catch (e) {
  errors.push(`flow: ${String(e.message).split("\n")[0]}`);
}
await browser.close();
console.log(checks.join("\n"));
console.log(`${checks.filter((c) => c.startsWith("✓")).length}/${checks.length} checks passed`);
if (errors.length) console.log("ERRORS:\n" + [...new Set(errors)].join("\n"));
else console.log("No console errors.");
process.exit(errors.length || checks.some((c) => c.startsWith("✗")) ? 1 : 0);
