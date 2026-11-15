/**
 * Review renders for stepped shapes and the category picker extras (Node):
 *   npx tsx scripts/category-review.ts [outDir=review/categories]
 * Montage of every new shape, sample pages, and a 10k-word book with random
 * stepped / hollow / cluster / letter shapes.
 */
import { writeFileSync, mkdirSync, readdirSync, rmSync } from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { CATEGORIES, SHAPES, ShapeKey, isSteppedShape, shapeCategory, shapesInCategory } from "../src/lib/shapes/shapes";
import { generateOneWordSearch } from "../src/lib/jobs/run";
import { presetFor, suggestGridSize } from "../src/lib/wordsearch/difficulty";
import { splitIntoPuzzles } from "../src/lib/wordsearch/bulk";
import { buildWordSearchBook, BookPuzzle } from "../src/lib/wordsearch/pdf";
import { mulberry32 } from "../src/lib/wordsearch/engine";
import { nodeFonts } from "../src/lib/print/nodeFonts";
import { NO_EXTRAS } from "../src/lib/print/book";
import { templateDesign } from "../src/lib/design/templates";
import type { Design } from "../src/lib/design/types";

const out = process.argv[2] ?? "review/categories";
mkdirSync(out, { recursive: true });
for (const name of readdirSync(out)) {
  if (name.startsWith("picker-") || name.startsWith("outline-") || name === "_fail.png") continue;
  if (name.endsWith(".png") || name.endsWith(".pdf") || name === "_list.txt" || name === "_new.txt") rmSync(join(out, name), { recursive: true, force: true });
}

const fonts = nodeFonts();
const WORDS = ["CLOUD", "RAINBOW", "THUNDER", "BREEZE", "PUDDLE", "SUNSHINE", "SNOWFLAKE", "LIGHTNING", "STORM", "SKY", "WIND", "SHOWER"];
const d = presetFor("medium");
const NEW_KEYS = SHAPES.filter((s) => s.group === "stepped" || s.group === "objects").map((s) => s.key);
const STEPPED_POOL = SHAPES.filter((s) => isSteppedShape(s.key)).map((s) => s.key);

const ws = (shape: ShapeKey, i: number): BookPuzzle => {
  const g = generateOneWordSearch({ title: SHAPES.find((s) => s.key === shape)!.label, theme: "", words: WORDS, size: suggestGridSize(WORDS, d.density), shape }, d, 400 + i);
  if (g.unplaced.length) throw new Error(`${shape}: unplaced ${g.unplaced.join(",")}`);
  return { ...g };
};

function render(name: string, bytes: ArrayBuffer, pages?: [number, number], dpi = 80) {
  const pdf = join(out, `${name}.pdf`);
  writeFileSync(pdf, Buffer.from(bytes));
  const args = ["-r", String(dpi), "-png"];
  if (pages) args.push("-f", String(pages[0]), "-l", String(pages[1]));
  execFileSync("pdftoppm", [...args, pdf, join(out, name)]);
}

const steppedDesign = (): Design => {
  const x = templateDesign("classic");
  x.shape = { kind: "arch", mix: "one", shade: false, outline: "stepped", outlineColor: "#e67a2e" };
  x.grid = { ...x.grid, border: "none", frame: 1.6, line: "solid", shadow: false };
  x.color = { ...x.color, grayscale: false };
  return x;
};

const smoothDesign = (kind: ShapeKey): Design => {
  const x = templateDesign("classic");
  x.shape = { kind, mix: "one", shade: true, outline: "smooth" };
  x.grid = { ...x.grid, border: "square", frame: 1.6, line: "solid" };
  x.color = { ...x.color, grayscale: false };
  return x;
};

console.log("categories:", CATEGORIES.map((c) => `${c.label}=${shapesInCategory(c.id).length}`).join(", "));
console.log("new shapes:", NEW_KEYS.length, NEW_KEYS.join(", "));

const montagePz = NEW_KEYS.map((k, i) => ws(k, i));
const md = steppedDesign();
// Silhouettes in the new set should keep a smooth artist outline.
const mixed = buildWordSearchBook(
  montagePz.map((p) => ({ ...p })),
  { trim: "8.5x11", bleed: false, answersPerPage: 6, frontMatter: null, extras: NO_EXTRAS, design: md },
  fonts,
);
// Per-puzzle outline is taken from the book design, so silhouettes would be stepped.
// Render stepped keys with the stepped design, object silhouettes with smooth.
const steppedNew = montagePz.filter((p) => isSteppedShape(p.shape as ShapeKey));
const objectNew = montagePz.filter((p) => !isSteppedShape(p.shape as ShapeKey));
const steppedBook = buildWordSearchBook(steppedNew, { trim: "8.5x11", bleed: false, answersPerPage: 6, frontMatter: null, extras: NO_EXTRAS, design: md }, fonts);
render("ws-new-stepped", steppedBook.pdf.output("arraybuffer"), [1, steppedNew.length], 70);
if (objectNew.length) {
  const od = smoothDesign(objectNew[0].shape as ShapeKey);
  const objectBook = buildWordSearchBook(objectNew, { trim: "8.5x11", bleed: false, answersPerPage: 6, frontMatter: null, extras: NO_EXTRAS, design: od }, fonts);
  render("ws-new-objects", objectBook.pdf.output("arraybuffer"), [1, objectNew.length], 70);
}
void mixed;

const pageOf = (shape: ShapeKey, name: string, design: Design, dpi = 110) => {
  const pz = ws(shape, 900);
  const book = buildWordSearchBook([pz], { trim: "8.5x11", bleed: false, answersPerPage: 1, frontMatter: null, extras: NO_EXTRAS, design }, fonts);
  console.log(`page ${shape}: grid ${pz.size}`);
  render(name, book.pdf.output("arraybuffer"), [1, 1], dpi);
};

pageOf("sunburst", "page-sunburst", steppedDesign());
pageOf("arch", "page-arch", steppedDesign());
pageOf("ring", "page-ring", steppedDesign());
pageOf("letterS", "page-letterS", steppedDesign());
pageOf("apple", "page-apple", smoothDesign("apple"));
pageOf("car", "page-car", smoothDesign("car"));

// 10k-word book with random stepped / letter / cluster shapes.
const rng = mulberry32(13);
const syl = ["BA", "RO", "KI", "TE", "LU", "MA", "NE", "SO", "PI", "DA", "VE", "GO", "ZU", "FI", "HA", "WY"];
const seen = new Set<string>();
const entries: { word: string }[] = [];
while (entries.length < 10000) {
  const n = 2 + Math.floor(rng() * 4);
  let w = "";
  for (let i = 0; i < n; i++) w += syl[Math.floor(rng() * syl.length)];
  if (!seen.has(w)) {
    seen.add(w);
    entries.push({ word: w });
  }
}
const specs = splitIntoPuzzles(entries, { wordsPerPuzzle: 20, size: "auto", density: d.density, groupByTheme: false });
const t0 = Date.now();
const tenk = specs.map((s, i) => {
  const shape = STEPPED_POOL[Math.floor(rng() * STEPPED_POOL.length)] ?? STEPPED_POOL[i % STEPPED_POOL.length];
  const g = generateOneWordSearch({ ...s, shape }, d, i + 31);
  if (g.unplaced.length) throw new Error(`10k ${shape}: unplaced ${g.unplaced.join(",")}`);
  return g;
});
const genMs = Date.now() - t0;
const tenkDesign = steppedDesign();
tenkDesign.shape = { ...tenkDesign.shape, kind: "arch", mix: "category" };
const t1 = Date.now();
const tenkBook = buildWordSearchBook(tenk, { trim: "8.5x11", bleed: false, answersPerPage: 4, frontMatter: null, extras: NO_EXTRAS, design: tenkDesign }, fonts);
writeFileSync(join(out, "ws_10k_stepped.pdf"), Buffer.from(tenkBook.pdf.output("arraybuffer")));
console.log(`10k-word random-stepped book: ${tenk.length} puzzles, ${tenkBook.pageCount} pages, ${((Date.now() - t1) / 1000).toFixed(1)}s render, ${(genMs / 1000).toFixed(1)}s generate, ${(Buffer.from(tenkBook.pdf.output("arraybuffer")).length / 1e6).toFixed(2)} MB`);

const list = (prefix: string) => readdirSync(out).filter((f) => f.endsWith(".png") && f.startsWith(prefix)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const steppedPngs = list("ws-new-stepped");
const objectPngs = list("ws-new-objects");
writeFileSync(join(out, "_list.txt"), [...steppedPngs, ...objectPngs].join("\n"));
execFileSync("python3", [
  "-c",
  `
import sys
from PIL import Image, ImageDraw
out=sys.argv[1]
names=open(out+"/_list.txt").read().split()
ims=[Image.open(out+"/"+n).convert("RGB") for n in names]
tw=200
tiles=[]
for n,im in zip(names,ims):
    h=int(im.height*tw/im.width)
    t=Image.new("RGB",(tw,h+18),"white"); t.paste(im.resize((tw,h)),(0,18))
    ImageDraw.Draw(t).text((4,3),n.replace("ws-new-stepped-","").replace("ws-new-objects-","").replace(".png",""),fill=(60,60,60)); tiles.append(t)
cols=8; th=max(t.height for t in tiles)
rows=(len(tiles)+cols-1)//cols
m=Image.new("RGB",(cols*(tw+8)+8,rows*(th+8)+8),(230,230,236))
for i,t in enumerate(tiles): m.paste(t,(8+(i%cols)*(tw+8),8+(i//cols)*(th+8)))
m.save(out+"/ws-new-shapes-montage.png")
print(len(tiles),"tiles")
`,
  out,
], { stdio: "inherit" });
console.log("done:", out);
