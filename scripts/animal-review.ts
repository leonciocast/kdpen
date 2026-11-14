/**
 * Review renders for the animal silhouette library (Node):
 *   npx tsx scripts/animal-review.ts [outDir=review/animals]
 * Writes PDFs, PNGs (via pdftoppm) and an overview montage of every animal.
 */
import { writeFileSync, mkdirSync, readdirSync, rmSync } from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { ANIMAL_KEYS, CROSSWORD_SHAPES, SUDOKU_SHAPES, SHAPES, ShapeKey, isAnimal } from "../src/lib/shapes/shapes";
import { generateOneWordSearch } from "../src/lib/jobs/run";
import { presetFor, suggestGridSize } from "../src/lib/wordsearch/difficulty";
import { splitIntoPuzzles } from "../src/lib/wordsearch/bulk";
import { buildWordSearchBook, BookPuzzle } from "../src/lib/wordsearch/pdf";
import { buildCrosswordBook } from "../src/lib/crossword/pdf";
import { buildSudokuBook } from "../src/lib/sudoku/pdf";
import { generateCrossword } from "../src/lib/crossword/engine";
import { generateSudoku } from "../src/lib/sudoku";
import { mulberry32 } from "../src/lib/wordsearch/engine";
import { nodeFonts } from "../src/lib/print/nodeFonts";
import { NO_EXTRAS } from "../src/lib/print/book";
import { templateDesign } from "../src/lib/design/templates";
import type { Design } from "../src/lib/design/types";

const out = process.argv[2] ?? "review/animals";
mkdirSync(out, { recursive: true });
for (const name of readdirSync(out)) {
  if (!name.startsWith("silhouettes-")) rmSync(join(out, name), { recursive: true, force: true });
}
const fonts = nodeFonts();
const WORDS = ["ELEPHANT", "GIRAFFE", "PENGUIN", "DOLPHIN", "KANGAROO", "BUTTERFLY", "OCTOPUS", "FLAMINGO", "PANDA", "HEDGEHOG", "SQUIRREL", "RABBIT", "CHEETAH", "PELICAN", "WALRUS", "IBEX"];
const d = presetFor("medium");

const ws = (shape: ShapeKey, i: number): BookPuzzle => {
  const g = generateOneWordSearch({ title: SHAPES.find((s) => s.key === shape)!.label, theme: "", words: WORDS, size: suggestGridSize(WORDS, d.density), shape }, d, 200 + i);
  if (g.unplaced.length) throw new Error(`${shape}: unplaced ${g.unplaced.join(",")}`);
  return { ...g };
};

function render(name: string, bytes: ArrayBuffer, pages?: [number, number], dpi = 70) {
  const pdf = join(out, `${name}.pdf`);
  writeFileSync(pdf, Buffer.from(bytes));
  const args = ["-r", String(dpi), "-png"];
  if (pages) args.push("-f", String(pages[0]), "-l", String(pages[1]));
  execFileSync("pdftoppm", [...args, pdf, join(out, name)]);
}

const base = (): Design => {
  const x = templateDesign("classic");
  x.shape.shade = true;
  x.grid = { ...x.grid, border: "square", frame: 1.6, line: "solid" };
  return x;
};

console.log("animals:", ANIMAL_KEYS.length);
const pz = ANIMAL_KEYS.map((k, i) => ws(k, i));
const design = base();
const wsBook = buildWordSearchBook(pz, { trim: "8.5x11", bleed: false, answersPerPage: 4, frontMatter: null, extras: NO_EXTRAS, design }, fonts);
render("ws-animals", wsBook.pdf.output("arraybuffer"), [1, pz.length]);
// A close-up of the elephant page (the look from the reference product).
render("ws-elephant-page", buildWordSearchBook([pz[ANIMAL_KEYS.indexOf("elephant")]], { trim: "8.5x11", bleed: false, answersPerPage: 1, frontMatter: null, extras: NO_EXTRAS, design }, fonts).pdf.output("arraybuffer"), [1, 1], 110);
console.log("word search sizes:", pz.map((p) => `${p.shape} ${p.size}`).join(", "));

const cwAnimals = CROSSWORD_SHAPES.filter(isAnimal);
const clues = "APPLE BANANA CHERRY GRAPE LEMON MANGO ORANGE PEACH PEAR PLUM MELON LIME APRICOT COCONUT".split(" ").map((a, i) => ({ answer: a, clue: `Fruit number ${i + 1}` }));
const owl = generateCrossword(clues, mulberry32(21), 40, "owl");
console.log("crossword owl left out", owl.leftOut);
const cwd = templateDesign("elegant");
cwd.shape = { kind: "owl", mix: "one", shade: true };
cwd.grid = { ...cwd.grid, border: "square", frame: 1.6, line: "solid" };
const cwBook = buildCrosswordBook([{ cw: owl, title: "Owl" }], { trim: "8.5x11", bleed: false, frontMatter: null, extras: NO_EXTRAS, design: cwd, answersPerPage: 4 }, fonts);
render("cw-owl", cwBook.pdf.output("arraybuffer"), [1, 1], 90);

const sd = base();
sd.shape.kind = SUDOKU_SHAPES.includes("penguin") ? "penguin" : "owl";
sd.grid.cells = "rounded";
const sb = buildSudokuBook([generateSudoku("easy")], { trim: "8.5x11", bleed: false, frontMatter: null, extras: NO_EXTRAS, design: sd, puzzlesPerPage: 1, answersPerPage: 4 }, fonts);
render("sudoku-penguin", sb.pdf.output("arraybuffer"), [1, 1], 90);

// 10k-word book with random animals.
const rng = mulberry32(7);
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
  const shape = ANIMAL_KEYS[i % ANIMAL_KEYS.length];
  const g = generateOneWordSearch({ ...s, shape }, d, i + 11);
  if (g.unplaced.length) throw new Error(`10k ${shape}: unplaced ${g.unplaced.join(",")}`);
  return g;
});
const genMs = Date.now() - t0;
const tenkDesign = base();
tenkDesign.shape = { kind: "elephant", mix: "animals", shade: true };
const t1 = Date.now();
const tenkBook = buildWordSearchBook(tenk, { trim: "8.5x11", bleed: false, answersPerPage: 4, frontMatter: null, extras: NO_EXTRAS, design: tenkDesign }, fonts);
writeFileSync(join(out, "ws_10k_animals.pdf"), Buffer.from(tenkBook.pdf.output("arraybuffer")));
console.log(`10k-word random-animals book: ${tenk.length} puzzles, ${tenkBook.pageCount} pages, ${((Date.now() - t1) / 1000).toFixed(1)}s render, ${(genMs / 1000).toFixed(1)}s generate, ${(Buffer.from(tenkBook.pdf.output("arraybuffer")).length / 1e6).toFixed(2)} MB`);

const pngs = readdirSync(out).filter((f) => f.endsWith(".png") && f.startsWith("ws-animals")).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
writeFileSync(join(out, "_list.txt"), pngs.join("\n"));
execFileSync("python3", [
  "-c",
  `
import sys
from PIL import Image, ImageDraw, ImageFont
out=sys.argv[1]
names=open(out+"/_list.txt").read().split()
ims=[Image.open(out+"/"+n).convert("RGB") for n in names]
tw=240
tiles=[]
for n,im in zip(names,ims):
    h=int(im.height*tw/im.width)
    t=Image.new("RGB",(tw,h+18),"white"); t.paste(im.resize((tw,h)),(0,18))
    ImageDraw.Draw(t).text((4,3),n.replace("ws-animals-","").replace(".png",""),fill=(60,60,60)); tiles.append(t)
cols=8; th=max(t.height for t in tiles)
rows=(len(tiles)+cols-1)//cols
m=Image.new("RGB",(cols*(tw+8)+8,rows*(th+8)+8),(230,230,236))
for i,t in enumerate(tiles): m.paste(t,(8+(i%cols)*(tw+8),8+(i//cols)*(th+8)))
m.save(out+"/ws-animals-montage.png")
print(len(tiles),"tiles")
`,
  out,
], { stdio: "inherit" });
console.log("done:", out, "cw animals offered:", cwAnimals.length, "sudoku animals offered:", SUDOKU_SHAPES.filter(isAnimal).length);
