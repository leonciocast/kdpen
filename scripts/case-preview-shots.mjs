// Case-file preview screenshots (Build & check step), desktop width:
//   BASE=http://localhost:3000 OUT=review/case-redesign/after node scripts/case-preview-shots.mjs
// A Saltmere book with "surprise me" shapes, so square, shaped and long-word cases all show.
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "review/case-redesign/after";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => {
  if (sessionStorage.getItem("seeded")) return;
  sessionStorage.setItem("seeded", "1");
  localStorage.setItem("puzzle-generator.design.v1.mystery", JSON.stringify({ version: 1, template: "elegant", name: "Shapes", shape: { kind: "heart", mix: "each", seed: 11, shade: false, outline: "smooth" } }));
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const click = (id) => page.click(`[data-testid="${id}"]`);
const NEXT = ".pg-wizard-footer .pg-footer-right > button.btn-primary";
await page.goto(BASE + "/word-search?type=mystery", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
if (await page.$('[data-testid="my-other-sources"]')) await page.click('[data-testid="my-other-sources"] > summary');
await click("my-source-starter");
await click("my-starter-next");
await click("my-count-24");
for (let i = 0; i < 6 && (await page.getAttribute("[data-question]", "data-question")) !== "style"; i++) {
  await page.click(NEXT);
  await page.waitForTimeout(250);
}
await click("my-style-dossier");
await click("my-settings-done");
await click("my-build");
await page.waitForSelector('[data-testid="my-checks"]', { state: "attached", timeout: 300000 });
await page.waitForTimeout(500);
const viewer = page.locator(".pg-my-viewer");
const shots = [];
for (let i = 0; i < 24; i++) {
  const pos = await page.textContent('[data-testid="my-view-pos"]');
  const grid = page.locator('[data-testid="my-case-view"]');
  const info = await grid.evaluate((el) => {
    const cells = el.querySelectorAll(".pg-cg-cell");
    const off = el.querySelectorAll(".pg-cg-cell.off");
    return { cells: cells.length, off: off.length, words: [...el.querySelectorAll(".pg-case-words li")].map((l) => l.textContent.trim().length) };
  });
  shots.push({ i, pos, ...info });
  if (i < 23) await page.click('[aria-label="Next case"]');
  await page.waitForTimeout(60);
}
const square = shots.find((s) => s.off === 0)?.i ?? 0;
const shaped = shots.filter((s) => s.off > 0).sort((a, b) => b.off / b.cells - a.off / a.cells)[0]?.i ?? 1;
const longw = shots.slice().sort((a, b) => Math.max(...b.words) - Math.max(...a.words))[0].i;
let at = 23;
const go = async (n) => {
  for (; at > n; at--) await page.click('[aria-label="Previous case"]');
  for (; at < n; at++) await page.click('[aria-label="Next case"]');
  await page.waitForTimeout(200);
};
for (const [name, n] of [["preview_square", square], ["preview_shaped", shaped], ["preview_longwords", longw]]) {
  await go(n);
  const shoot = async (file) => {
    const b = await viewer.boundingBox();
    const sy = await page.evaluate(() => window.scrollY);
    await page.screenshot({ path: file, fullPage: true, clip: { x: b.x - 8, y: b.y + sy - 8, width: b.width + 16, height: b.height + 16 } });
  };
  await shoot(`${OUT}/${name}.png`);
  if (name === "preview_shaped") {
    await page.screenshot({ path: `${OUT}/preview_desktop_full.png`, fullPage: true });
    await click("my-solution-toggle");
    await page.waitForTimeout(200);
    await shoot(`${OUT}/preview_shaped_solution.png`);
    await click("my-solution-toggle");
  }
}
console.log(JSON.stringify({ square, shaped, longw }), errors.length ? errors : "no errors");
await browser.close();
