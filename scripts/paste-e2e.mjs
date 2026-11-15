// Smart paste e2e: node scripts/paste-e2e.mjs  (server on :3000; poppler on PATH)
// Word search: paste Leoncio's ice cream list → review (themes, duplicates, shared word,
// long words, split note) → edit tools → generate → export; the PDF has puzzles titled with
// both themes and every word placed. Also messy formats, a dropped .txt/.docx file, and
// crossword WORD - clue pasting. Screenshots -> review/paste/.
import { chromium } from "playwright";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "review/paste";
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
const shot = async (name, opts = {}) => {
  await pause(300);
  await page.screenshot({ path: `${OUT}/${name}.png`, ...opts });
  stamp(name);
};
const themes = () => page.$$eval('[data-testid="paste-theme"]', (els) => els.map((e) => ({ name: e.querySelector('[data-testid="paste-theme-name"]').value, count: Number(e.dataset.count), chips: [...e.querySelectorAll('[data-testid="paste-chip"] .pg-chip-text')].map((c) => c.firstChild.textContent.trim()), notes: [...e.querySelectorAll(".pg-paste-note")].map((n) => n.dataset.testid) })));
const summary = () => page.textContent('[data-testid="paste-summary"] .pg-paste-total');
const card = (i) => page.locator('[data-testid="paste-theme"]').nth(i);
const menu = async (i, item) => {
  await card(i).locator('[data-testid="paste-menu"]').click();
  await card(i).locator(`[data-testid="${item}"]`).click();
};
const pdfText = (file) => execFileSync("pdftotext", ["-layout", file, "-"]).toString();
async function exportPdf(name) {
  for (let i = 0; i < 14 && (await q()) !== "create"; i++) {
    if (await page.$('[data-testid="design-keep"]')) {
      await page.click('[data-testid="design-keep"]');
      await pause();
    } else if (await page.isEnabled('[data-testid="wizard-next"]').catch(() => false)) await next();
    else await page.click('[data-testid="wizard-skip"]');
  }
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 600000 }), page.click('[data-testid="download-pdf"]')]);
  const file = `${OUT}/${name}.pdf`;
  await dl.saveAs(file);
  return file;
}

const SAMPLE = fs.readFileSync("src/lib/paste/parse.ts", "utf8").match(/PASTE_EXAMPLE = `([\s\S]*?)`;/)[1];
const WORDS1 = SAMPLE.split("\n").filter((l) => /^\d+\. /.test(l)).map((l) => l.replace(/^\d+\. /, ""));
const WORDS2 = SAMPLE.split("\n").filter((l) => /^- /.test(l)).map((l) => l.slice(2));

// ================= Word search: the ice cream sample =================
await page.goto(BASE + "/word-search?type=classic", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await hideToasts();
check((await page.$$('[data-question="how"] .pg-choice-card')).length === 3, "ws: three ways to add words");
check((await page.textContent('[data-testid="choose-paste"]')).includes("Recommended"), "ws: paste is the recommended way");
await shot("01_choice_cards");
await page.click('[data-testid="choose-paste"]');
check((await q()) === "paste", "ws: paste question");
check(!(await page.isEnabled('[data-testid="paste-next"]')), "ws: Next waits for a paste");
await page.fill('[data-testid="paste-input"]', SAMPLE);
await pause(300);
const found = await page.textContent('[data-testid="paste-found"]');
check(/2 themes and 49 words/.test(found), `ws: live count while pasting (${found.trim()})`);
await shot("02_pasted_text");
await page.click('[data-testid="paste-next"]');
await pause(500);
check((await q()) === "review", "ws: review question");
let th = await themes();
check(th.map((t) => t.name).join("|") === "Ice Cream Word Search Vocabulary|Ice Cream Shop Words", `ws: two themes found (${th.map((t) => t.name).join(" | ")})`);
check(th[0].count === 39 && th[1].count === 10, `ws: 39 + 10 words (${th[0].count} + ${th[1].count})`);
check((await summary()).replace(/\s+/g, " ").trim() === "2 themes · 49 words · 3 puzzles", `ws: summary line (${(await summary()).trim()})`);
check(th[0].notes.includes("paste-note-dups") && (await card(0).locator('[data-testid="paste-note-dups"]').textContent()).includes("SUNDAE"), "ws: SUNDAE duplicate removed and shown");
check(th[0].notes.includes("paste-note-split"), "ws: long theme will be split into 2 puzzles");
check((await card(0).locator('[data-testid="paste-note-split"]').textContent()).includes("Ice Cream Word Search Vocabulary 2"), "ws: split note names the numbered puzzles");
check(th[0].notes.includes("paste-note-long") && /CHOCOLATECHIP/.test(await card(0).locator('[data-testid="paste-note-long"]').textContent()), "ws: long words flagged (CHOCOLATECHIP)");
check(!th[0].notes.includes("paste-note-shared") && th[1].notes.includes("paste-note-shared") && /CONE/.test(await card(1).locator('[data-testid="paste-note-shared"]').textContent()), "ws: CONE in both themes is kept with a friendly note");
check(th[1].chips.includes("CONE"), "ws: CONE stays in the shop theme");
check(!(await card(0).locator(".pg-theme-notes").isVisible()) && (await card(0).locator('[data-testid="paste-notes-toggle"]').textContent()).includes("3 notes"), "ws: notes start collapsed behind “3 notes”");
check((await card(0).locator('[data-testid="paste-chip"]').count()) === 24 && (await card(0).locator('[data-testid="paste-show-all"]').textContent()).includes("Show all 39"), "ws: long theme shows 24 words plus “Show all 39”");
await card(0).locator('[data-testid="paste-show-all"]').click();
check((await card(0).locator('[data-testid="paste-chip"]').count()) === 39 && (await card(0).locator('[data-testid="paste-chip"].long').count()) >= 3, "ws: Show all reveals every word, long ones marked");
await card(0).locator('[data-testid="paste-show-all"]').click();
check((await card(1).locator('[data-testid="paste-chip"].shared').count()) === 1, "ws: shared CONE is marked on its chip");
check((await page.textContent('[data-testid="wizard-hint"]')).trim() === "", "ws: footer has no repeated summary");
// keyboard: open the ⋯ menu with Enter, Escape closes it
await card(1).locator('[data-testid="paste-menu"]').focus();
await page.keyboard.press("Enter");
await pause(150);
const menuOpen = await card(1).locator('[role="menu"]').isVisible();
await page.keyboard.press("Escape");
await pause(150);
check(menuOpen && !(await card(1).locator('[role="menu"]').isVisible()), "ws: ⋯ menu works from the keyboard");
await card(0).locator('[data-testid="paste-notes-toggle"]').click();
check(await card(0).locator(".pg-theme-notes").isVisible(), "ws: notes expand on click");
await card(0).locator('[data-testid="paste-notes-toggle"]').click();
await shot("03_parsed_review", { fullPage: true });
await page.locator('[data-testid="paste-theme"]').nth(1).screenshot({ path: `${OUT}/03b_theme_card.png` });

// Edit tools: rename, edit a chip, remove a chip, add words, merge, split, delete
await card(1).locator('[data-testid="paste-theme-name"]').fill("Ice Cream Shop");
await card(1).locator('[data-testid="paste-chip"]').filter({ hasText: "NAPKIN" }).locator(".pg-chip-text").click();
await page.fill(".pg-chip-edit", "napkins");
await page.keyboard.press("Enter");
await pause(200);
await card(1).locator('[data-testid="paste-chip"]').filter({ hasText: "COLD" }).locator(".pg-chip-x").click();
await card(1).locator('[data-testid="paste-add-chip"]').click();
await card(1).locator('[data-testid="paste-add-words"]').fill("waffle cone, sprinkle");
await page.keyboard.press("Enter");
await pause(250);
th = await themes();
check(th[1].name === "Ice Cream Shop" && th[1].chips.includes("NAPKINS") && !th[1].chips.includes("COLD") && th[1].chips.includes("WAFFLE CONE") && th[1].count === 11, `ws: rename, edit, remove and add words (${th[1].chips.join(" ")})`);
await menu(1, "paste-merge");
await pause(250);
th = await themes();
check(th.length === 1 && th[0].count === 49, `ws: merge with previous (1 theme, ${th[0]?.count} words; CONE merged once)`);
await menu(0, "paste-split");
await pause(250);
th = await themes();
check(th.length === 3 && th.map((t) => t.name).join("|").includes("Ice Cream Word Search Vocabulary 2"), `ws: split into ${th.length} themes`);
await menu(2, "paste-delete");
await pause(250);
check((await themes()).length === 2, "ws: delete a theme");
// Start again from the text: back, then find themes again
await back();
check((await q()) === "paste", "ws: back to the pasted text");
await page.click('[data-testid="paste-next"]');
await pause(400);
th = await themes();
check(th.length === 2 && th[0].count === 39, "ws: finding themes again resets the review");
await page.click('[data-testid="paste-apply"]');
await pause(600);
check((await page.textContent(".pg-stepper, nav[aria-label='Progress']")).length > 0 && (await q()) !== "review", "ws: Add words goes on to puzzle settings");

// Settings → automatic placement
for (let i = 0; i < 8 && !(await page.$('[data-testid="mode-auto"]')); i++) await next();
await page.click('[data-testid="mode-auto"]');
await page.waitForSelector('#active-grid, [data-testid="puzzle-pager"]', { timeout: 120000 });
await pause(500);
const titles = await page.$$eval('select[aria-label="Choose a puzzle"] option', (os) => os.map((o) => o.textContent)).catch(() => []);
stamp("puzzles: " + titles.join(" | "));
await next(); // review
await next(); // design
await page.waitForFunction(() => document.querySelector('[data-testid="design-preview"]')?.width > 50, null, { timeout: 60000 });
await pause(600);
const pdf = await exportPdf("ws_icecream_book");
const text = pdfText(pdf);
const t1 = (text.match(/Ice Cream Word Search Vocabulary 1/g) ?? []).length;
const t2 = (text.match(/Ice Cream Word Search Vocabulary 2/g) ?? []).length;
const t3 = (text.match(/Ice Cream Shop Words/g) ?? []).length;
check(t1 > 0 && t2 > 0 && t3 > 0, `ws: PDF has puzzles titled with both themes (${t1}/${t2}/${t3} mentions)`);
// Every word in a printed word list = every word placed (lists only show placed words).
const tokens = new Set(text.split(/[^A-Z]+/).filter(Boolean));
const missing = [...new Set([...WORDS1, ...WORDS2])].filter((w) => !tokens.has(w));
check(missing.length === 0, `ws: all ${new Set([...WORDS1, ...WORDS2]).size} words placed and listed${missing.length ? ` (missing ${missing.join(", ")})` : ""}`);
const coneLists = (text.match(/\bCONE\b/g) ?? []).length;
check(coneLists >= 2, `ws: CONE is in both themes' puzzles (${coneLists} mentions)`);
// Final puzzle page as a PNG
const pages = Number(/Pages:\s+(\d+)/.exec(execFileSync("pdfinfo", [pdf]).toString())[1]);
for (let p = 1; p <= pages; p++) {
  const t = execFileSync("pdftotext", ["-f", String(p), "-l", String(p), "-layout", pdf, "-"]).toString();
  if (/Ice Cream Shop Words/.test(t) && !/SOLUTION|CONTENTS/i.test(t)) {
    execFileSync("pdftoppm", ["-f", String(p), "-l", String(p), "-r", "110", "-png", "-singlefile", pdf, `${OUT}/04_final_page`]);
    break;
  }
}
stamp("04_final_page");

// ================= Word search: messy formats + a dropped file =================
await page.goto(BASE + "/word-search?type=classic", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await hideToasts();
await page.click('[data-testid="choose-paste"]');
const MESSY = [
  "# Ocean Animals",
  "• Whale (biggest!)",
  "• Shark – sharp teeth",
  "• Dolphin",
  "• Octopus",
  "• Sea Horse",
  "• Crab",
  "",
  "Farm: cow, pig, goat, hen",
  "",
  "Theme: Fruits",
  "a) Apple",
  "b) Piña Colada",
  "c) \u201CMango\u201D",
  "d) Crème Brûlée",
  "e) Kiwi",
  "f) Kiwi",
].join("\n");
await page.fill('[data-testid="paste-input"]', MESSY);
await page.click('[data-testid="paste-next"]');
await pause(400);
th = await themes();
check(th.map((t) => t.name).join("|") === "Ocean Animals|Farm|Fruits", `messy: markdown, inline and Theme: headings (${th.map((t) => t.name).join(" | ")})`);
check(th[0].chips.join(",") === "WHALE,SHARK,DOLPHIN,OCTOPUS,SEA HORSE,CRAB", `messy: notes stripped, phrases kept (${th[0].chips.join(",")})`);
check(th[2].chips.includes("PIÑA COLADA") && th[2].chips.includes("CREME BRULEE") && th[2].chips.includes("MANGO"), "messy: accents, Ñ and smart quotes");
check(th[1].notes.includes("paste-note-small"), "messy: a 4-word theme suggests merging");
await shot("05_messy_review", { fullPage: true });
await card(1).locator('[data-testid="paste-notes-toggle"]').click();
await card(1).locator('[data-testid="paste-merge-suggest"]').click();
await pause(250);
check((await themes()).length === 2 && (await themes())[0].count === 10, "messy: one-click merge of the small theme");
await back();
// A dropped/opened .txt file (no headings → suggested name)
fs.writeFileSync("/tmp/paste_ws.txt", "whale\nshark\ndolphin\noctopus\nseal\ncrab\n");
await page.fill('[data-testid="paste-input"]', "");
await page.setInputFiles('[data-testid="paste-file"]', "/tmp/paste_ws.txt");
await pause(500);
check((await page.inputValue('[data-testid="paste-input"]')).includes("dolphin"), "file: a .txt file fills the paste box");
await page.click('[data-testid="paste-next"]');
await pause(400);
th = await themes();
check(th.length === 1 && th[0].name === "Ocean Life" && (await page.$('[data-testid="paste-note-name"]')) !== null, `file: no heading → suggested name (${th[0]?.name})`);
await shot("06_no_heading_review");
await back();
// A .docx file
execFileSync("python3", ["-c", `
import zipfile
x='<?xml version="1.0"?><w:document xmlns:w="w"><w:body>' + ''.join('<w:p><w:r><w:t>%s</w:t></w:r></w:p>' % l for l in ['Space Words','1. Planet','2. Comet','3. Rocket','4. Orbit','5. Galaxy','6. Nebula']) + '</w:body></w:document>'
z=zipfile.ZipFile('/tmp/paste_ws.docx','w',zipfile.ZIP_DEFLATED)
z.writestr('[Content_Types].xml','<Types/>'); z.writestr('word/document.xml', x); z.close()
`]);
await page.fill('[data-testid="paste-input"]', "");
await page.setInputFiles('[data-testid="paste-file"]', "/tmp/paste_ws.docx");
await pause(600);
await page.click('[data-testid="paste-next"]');
await pause(400);
th = await themes();
check(th.length === 1 && th[0].name === "Space Words" && th[0].count === 6, `file: a .docx file is read (${th[0]?.name}, ${th[0]?.count})`);
// CSV pasted from a spreadsheet
await back();
await page.fill('[data-testid="paste-input"]', "Theme\tWord\nPets\tdog\nPets\tcat\nPets\thamster\nBirds\trobin\nBirds\towl\n");
await page.click('[data-testid="paste-next"]');
await pause(400);
th = await themes();
check(th.map((t) => `${t.name}:${t.count}`).join(",") === "Pets:3,Birds:2", `csv: spreadsheet paste with a header (${th.map((t) => `${t.name}:${t.count}`).join(",")})`);
// One theme for everything
await page.click('[data-testid="paste-one-theme"]');
await pause(250);
th = await themes();
check(th.length === 1 && th[0].count === 5, "review: one theme for everything");

// ================= Crossword: WORD - clue pasting =================
await page.goto(BASE + "/cross-word", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await hideToasts();
check((await page.textContent('[data-testid="choose-paste"]')).includes("Recommended"), "cw: paste is the recommended way");
await page.click('[data-testid="choose-paste"]');
await page.click('[data-testid="paste-example"]');
await pause(300);
await shot("07_cw_pasted");
await page.click('[data-testid="paste-next"]');
await pause(400);
th = await themes();
check(th.map((t) => `${t.name}:${t.count}`).join(",") === "Ice Cream Shop:10,Frozen Treats:6", `cw: clue example → 2 themes (${th.map((t) => `${t.name}:${t.count}`).join(",")})`);
const clue = await card(0).locator(".pg-chip-clue").first().textContent();
check(clue === "Crunchy holder for a scoop", `cw: chips carry the clue (${clue})`);
await shot("08_cw_review", { fullPage: true });
await page.click('[data-testid="paste-apply"]');
await pause(500);
await page.click('[data-testid="build-crosswords"]');
await page.waitForSelector("#cw-grid", { timeout: 300000 });
await pause(500);
const cwTabs = await page.$$eval('[role="tab"]', (ts) => ts.map((t) => t.textContent));
const cwTitles = (await page.content()).match(/Ice Cream Shop|Frozen Treats/g) ?? [];
check(new Set(cwTitles).size === 2, `cw: crosswords titled with both themes (${[...new Set(cwTitles)].join(", ")}; ${cwTabs.length} tabs)`);

await browser.close();
if (!errors.length) console.log("No console errors.");
finish();
