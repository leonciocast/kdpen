// Category picker e2e: node scripts/categories-e2e.mjs  (server on :3000)
// Tabs, animal sub-groups, search, recently used, suggested-for-theme, mix from
// category. Screenshots of each category -> review/categories/.
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "review/categories";
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
  await pause(200);
  const loc = el ? page.locator(el).first() : page.locator("body");
  if (el) await loc.screenshot({ path: `${OUT}/${name}.png` });
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
  await pause(400);
};

const CATS = ["basic", "stepped", "hollow", "clusters", "letters", "animals", "nature", "holiday", "food", "objects"];
const GROUPS = ["farm", "safari", "pets", "forest", "birds", "ocean", "bugs", "fantasy"];
const cardSel = '[data-testid="shape-picker"] [data-testid^="shape-"]:not([data-testid^="shape-mix"]):not([data-testid^="shape-cat"]):not([data-testid^="shape-subcat"]):not([data-testid="shape-picker"]):not([data-testid="shape-search"]):not([data-testid="shape-shade"]):not([data-testid^="shape-suggest"]):not([data-testid="shape-recent"])';

await page.goto(BASE + "/word-search", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await hideToasts();
const WORDS = "CLOUD RAIN SUN WIND STORM THUNDER LIGHTNING RAINBOW BREEZE SNOWFLAKE PUDDLE SKY".split(" ");
await page.click('[data-testid="choose-type"]');
await page.fill("#wordInput", WORDS.join("\n"));
await page.press("#wordInput", "Control+Enter");
await pause();
if ((await q()) === "theme" || (await page.$("#themeInput"))) {
  await page.fill("#themeInput", "Weather");
  await next();
}
await next();
for (let i = 0; i < 6 && !(await page.$('[data-testid="mode-auto"]')); i++) await next();
await page.click('[data-testid="mode-auto"]');
await page.waitForSelector('#active-grid, [data-testid="puzzle-pager"]', { timeout: 60000 });
await next();
await next();
await waitPreview();
await next(); // shape
check((await q()) === "shape", "ws: Pick a shape");

for (const id of CATS) {
  check((await page.$(`[data-testid="shape-cat-${id}"]`)) !== null, `category tab ${id} is shown`);
}
check((await page.$('[data-testid="shape-search"]')) !== null, "search box is shown");
check((await page.$('[data-testid="shape-mix-category"]')) !== null, "mix from category is offered");
check((await page.$('[data-testid="shape-suggest"]')) !== null, "Weather theme suggests shapes");
if (await page.$('[data-testid="shape-suggest"]')) {
  check((await page.$('[data-testid="shape-suggest"] [data-testid="shape-sunburst"], [data-testid="shape-suggest"] [data-testid="shape-cloud"]')) !== null, "Weather suggests a cloud or sun cluster");
}

for (const id of CATS) {
  await page.click(`[data-testid="shape-cat-${id}"]`);
  await pause(250);
  if (id === "animals") {
    for (const g of GROUPS) {
      if (await page.$(`[data-testid="shape-subcat-${g}"]`)) {
        await page.click(`[data-testid="shape-subcat-${g}"]`);
        await pause(120);
      }
    }
    await page.click('[data-testid="shape-subcat-farm"]').catch(() => {});
    await pause(150);
  }
  const n = await page.$$eval(`${cardSel}`, (els) => new Set(els.map((e) => e.dataset.testid)).size);
  check(n > 0, `${id} shows ${n} shape card(s)`);
  await shot(`picker-${id}`, '[data-testid="shape-picker"]');
}

await page.click('[data-testid="shape-cat-animals"]');
await pause(150);
for (const g of GROUPS) {
  if (await page.$(`[data-testid="shape-subcat-${g}"]`)) {
    await page.click(`[data-testid="shape-subcat-${g}"]`);
    await pause(120);
    await shot(`picker-animals-${g}`, '[data-testid="shape-picker"]');
  }
}

await page.fill('[data-testid="shape-search"]', "arch");
await pause(250);
check((await page.$('[data-testid="shape-arch"]')) !== null, "search finds the arch");
check((await page.$('[data-testid="shape-elephant"]')) === null, "search hides non-matches");
await shot("picker-search-arch", '[data-testid="shape-picker"]');

let sig = await previewSig();
await page.click('[data-testid="shape-arch"]');
await page.waitForSelector('[data-testid="reshape-done"]:has-text("arch")', { timeout: 60000 });
await waitPreview(sig);
check((await page.getAttribute('[data-testid="shape-arch"]', "aria-checked")) === "true", "arch selected");
if (await page.$('[data-testid="outline-colors"]')) {
  check(true, "stepped outline colour picker is shown");
  await shot("outline-colors");
}

await page.fill('[data-testid="shape-search"]', "");
await pause(200);
check((await page.$('[data-testid="shape-recent"]')) !== null, "recently used row appears after a pick");
if (await page.$('[data-testid="shape-recent"]')) {
  check((await page.$('[data-testid="shape-recent"] [data-testid="shape-arch"]')) !== null, "arch is in recently used");
  await shot("picker-recent", '[data-testid="shape-recent"]');
}

await page.click('[data-testid="shape-mix-category"]');
await pause(300);
check((await page.getAttribute('[data-testid="shape-mix-category"]', "aria-checked")) === "true", "mix from category is selected");
await shot("picker-mix-category", '[data-testid="shape-picker"]');

await page.click('[data-testid="shape-mix-one"]');
await pause(200);
await page.fill('[data-testid="shape-search"]', "arch");
await pause(150);
await page.click('[data-testid="shape-arch"]');
await page.waitForSelector('[data-testid="reshape-done"]:has-text("arch")', { timeout: 60000 });

stamp("done");
await browser.close();
finish(errors.length ? 1 : 0);
