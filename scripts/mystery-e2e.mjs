// Murder mystery word search e2e: node scripts/mystery-e2e.mjs  (server on :3000; poppler on PATH)
// Word Search → "What type?" → Murder Mystery → starter pack (24 cases) → settings → build &
// check → design → export; the PDF has 24 case files, the Case Board, the finale and solutions
// with the final answer. Also pasted cases, 120 templated cases, and the classic type.
// Screenshots -> review/mystery/.
import { chromium } from "playwright";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "review/mystery";
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
const checks = [];
page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()}: ${m.text()}`));
page.on("pageerror", (e) => errors.push(`${page.url()}: ${e}`));
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
const click = async (id) => {
  await page.click(`[data-testid="${id}"]`);
  await pause();
};
const next = () => click("wizard-next");
const q = () => page.getAttribute("[data-question]", "data-question");
const check = (ok, what) => {
  checks.push(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) errors.push(`check failed: ${what}`);
};
const hideToasts = () => page.addStyleTag({ content: ".Toastify{display:none!important}" });
const shot = async (name, opts = {}) => {
  await pause(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true, ...opts });
  stamp(name);
};
const pdfText = (file) => execFileSync("pdftotext", ["-layout", file, "-"]).toString();
const pages = (file) => Number(execFileSync("pdfinfo", [file]).toString().match(/Pages:\s+(\d+)/)[1]);
async function buildCases() {
  await click("my-build");
  await page.waitForSelector('[data-testid="my-checks"]', { state: "attached", timeout: 120000 });
  await pause(400);
}

// ---- 1. type question
await page.goto(BASE + "/word-search", { waitUntil: "networkidle" });
await hideToasts();
check((await q()) === "type", "Word Search opens on the type question");
const cards = await page.$$eval(".pg-ws-types .pg-choice-card", (els) => els.map((e) => ({ id: e.dataset.testid, disabled: e.disabled })));
check(cards[0]?.id === "ws-type-mystery" && cards[1]?.id === "ws-type-classic", "Murder Mystery is the first card, Classic the second");
check(cards.filter((c) => c.disabled).length === 2, "two greyed 'Coming soon' cards");
await shot("01_type_cards");

// ---- 2. classic still works
await click("ws-type-classic");
check(!!(await page.$('[data-testid="choose-paste"]')), "Classic opens the existing word flow");
check(page.url().includes("type=classic"), "the type is kept in the address");
await click("wizard-back");
check((await q()) === "type", "Back from the first classic question returns to the type question");

// ---- 3. mystery: starter pack
await click("ws-type-mystery");
check((await q()) === "source", "Mystery starts with the case source");
await shot("02_case_source");
await click("my-source-starter");
const titles = await page.$$eval('[data-testid="my-starter-list"] li', (els) => els.length);
check(titles === 24, `starter pack lists 24 cases (${titles})`);
await shot("03_starter_pack");
await click("my-starter-next");
check((await q()) === "count", "settings start with the number of cases");
await click("my-count-24");
await next();
check((await q()) === "difficulty", "difficulty question");
await click("my-diff-medium");
await next();
check((await q()) === "features", "mystery layers question");
await shot("04_mystery_settings");
await next();
check((await q()) === "style", "case-file style question");
await click("my-style-dossier");
await click("my-settings-done");
check((await q()) === "build", "build & check step");
const t0 = Date.now();
await buildCases();
stamp(`built 24 cases in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
const checkLines = await page.$$eval('[data-testid="my-checks"] li', (els) => els.map((e) => e.textContent.trim()));
check(checkLines.length >= 4, `verification list shown (${checkLines.length} checks)`);
check(!(await page.$('[data-testid="my-problems"]')), "no validation problems");
await shot("05_built_case");
await click("my-solution-toggle");
const msg = await page.textContent('[data-testid="my-case-message"]');
check(/THE|CULPRIT|GUILTY|LOOK/.test(msg ?? ""), `solution view shows the hidden message (${msg})`);
await shot("06_built_solution");
await click("my-build-next");

// ---- 4. design + export
let sawPreview = false;
for (let i = 0; i < 20 && (await q()) !== "create"; i++) {
  if ((await q()) === "preview" && !sawPreview) {
    await page.waitForSelector('[data-testid="pv-page"], .pg-pv-page, canvas', { timeout: 60000 }).catch(() => {});
    await pause(2500);
    await shot("07_preview", { fullPage: false });
    sawPreview = true;
  }
  if (await page.$('[data-testid="design-keep"]')) await click("design-keep");
  else if (await page.isEnabled('[data-testid="wizard-next"]').catch(() => false)) await next();
  else await click("wizard-skip");
}
check(sawPreview, "the book preview was shown");
const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 600000 }), page.click('[data-testid="download-pdf"]')]);
const file = `${OUT}/mystery_24.pdf`;
await dl.saveAs(file);
const text = pdfText(file);
const caseFiles = (text.match(/CASE FILE/g) ?? []).length;
check(caseFiles === 24, `PDF has 24 case-file pages (${caseFiles})`);
// Casebook headings are set in title case; compare without case.
const upper = text.toUpperCase();
for (const t of ["HOW TO SOLVE", "CASE BOARD", "CASE CLOSED", "SOLUTIONS", "THE SUSPECT FILE", "DETECTIVE NOTES", "The Harbormaster's Last Watch", "The Lighthouse Stairs"]) check(upper.includes(t.toUpperCase()), `PDF contains "${t}"`);
const flat = execFileSync("pdftotext", [file, "-"]).toString().replace(/\s+/g, " ");
check(/THE KEEPER ODETTE MARSH LIED/.test(flat), "solutions reveal the final answer");
check((text.match(/MISSING EVIDENCE/gi) ?? []).length >= 24, "every case has a missing-evidence clue");
check((text.match(/HIDDEN MESSAGE/gi) ?? []).length >= 24, "every case has hidden-message blanks");
const n = pages(file);
check(n >= 40 && n % 2 === 0, `PDF page count looks right (${n})`);
// Render the key pages for review.
const pageOf = (needle) => text.split("\f").findIndex((p) => p.toUpperCase().includes(needle.toUpperCase()) && !/CONTENTS/i.test(p)) + 1;
const render = (pg, name) => pg > 0 && execFileSync("pdftoppm", ["-r", "110", "-png", "-singlefile", "-f", String(pg), "-l", String(pg), file, `${OUT}/${name}`]);
render(pageOf("The Harbormaster's Last Watch"), "08_pdf_case_page");
render(pageOf("SOLUTIONS"), "09_pdf_solution_page");
render(pageOf("THE SUSPECT FILE"), "10_pdf_case_board");
render(pageOf("THE LAST QUESTION"), "11_pdf_final_reveal");
render(pageOf("HOW TO SOLVE"), "12_pdf_how_to");

// ---- 5. pasted cases
await page.goto(BASE + "/word-search?type=mystery", { waitUntil: "networkidle" });
await hideToasts();
await click("my-source-paste");
await click("my-paste-example");
await click("my-paste-next");
const rows = await page.$$eval('[data-testid="my-review-case"]', (els) => els.length);
check(rows === 2, `pasted example gives 2 cases (${rows})`);
await shot("13_paste_review");
await click("my-paste-apply");
await next(); // difficulty
check((await q()) === "features", "pasted: layers question");
const blocked = !(await page.isEnabled('[data-testid="wizard-next"]'));
check(blocked, "a final answer longer than the number of cases is blocked");
await page.fill('[data-testid="my-phrase"]', "OK");
await pause();
check(await page.isEnabled('[data-testid="wizard-next"]'), "a 2-letter answer for 2 cases is accepted");
await next();
await click("my-settings-done");
await buildCases();
check(!(await page.$('[data-testid="my-problems"]')), "pasted cases build and pass every check");

// ---- 6. 120 templated cases
await page.goto(BASE + "/word-search?type=mystery", { waitUntil: "networkidle" });
await hideToasts();
await click("my-source-theme");
await page.fill('[data-testid="my-theme-count"]', "120");
await pause();
await shot("14_theme_settings");
await click("my-theme-next");
await next(); // difficulty
await page.fill('[data-testid="my-phrase"]', "THE BUTLER KNEW");
await next();
await click("my-settings-done");
const t1 = Date.now();
await buildCases();
stamp(`built 120 templated cases in ${((Date.now() - t1) / 1000).toFixed(1)}s`);
const pos = await page.textContent('[data-testid="my-view-pos"]');
check(/of 120/.test(pos ?? ""), `120 templated cases built (${pos})`);
check(!(await page.$('[data-testid="my-problems"]')), "templated cases pass every check");

// ---- 7. narrow screen
const m = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mp = await m.newPage();
await mp.goto(BASE + "/word-search", { waitUntil: "networkidle" });
await mp.screenshot({ path: `${OUT}/15_type_cards_narrow.png`, fullPage: true });
await m.close();

await browser.close();
finish();
