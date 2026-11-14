/**
 * Review renders for every grid shape and frame style (Node):
 *   npx tsx scripts/shape-review.ts [outDir=review/shapes]
 * Writes one PDF per group, PNGs of every page (via pdftoppm) and an overview montage (Python/PIL).
 */
import { writeFileSync, mkdirSync, readdirSync, rmSync } from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { SHAPES, CROSSWORD_SHAPES, SUDOKU_SHAPES, ShapeKey } from "../src/lib/shapes/shapes";
import { generateOneWordSearch } from "../src/lib/jobs/run";
import { presetFor, suggestGridSize } from "../src/lib/wordsearch/difficulty";
import { buildWordSearchBook, BookPuzzle } from "../src/lib/wordsearch/pdf";
import { buildCrosswordBook } from "../src/lib/crossword/pdf";
import { buildSudokuBook } from "../src/lib/sudoku/pdf";
import { generateCrossword } from "../src/lib/crossword/engine";
import { generateSudoku } from "../src/lib/sudoku";
import { mulberry32 } from "../src/lib/wordsearch/engine";
import { nodeFonts } from "../src/lib/print/nodeFonts";
import { NO_EXTRAS } from "../src/lib/print/book";
import { templateDesign } from "../src/lib/design/templates";
import { FRAMES } from "../src/components/ui/ShapePicker";
import type { Design } from "../src/lib/design/types";

const out = process.argv[2] ?? "review/shapes";
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const fonts = nodeFonts();
const WORDS = ["BUTTERFLY", "LADYBUG", "SUNFLOWER", "MEADOW", "PICNIC", "BLOSSOM", "RAINBOW", "TULIP", "BUMBLEBEE", "GARDEN", "SPRING", "PUDDLE", "BREEZE", "CLOVER", "DAISY", "SEEDLING"];
const d = presetFor("medium");

const ws = (shape: ShapeKey, i: number): BookPuzzle => {
  const g = generateOneWordSearch({ title: SHAPES.find((s) => s.key === shape)!.label, theme: "", words: WORDS, size: suggestGridSize(WORDS, d.density), shape }, d, 100 + i);
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

const base = (): Design => templateDesign("classic");

// 1. Every word-search shape (one puzzle page each) + solutions, classic design.
const shapes = SHAPES.map((s) => s.key);
const pz = shapes.map(ws);
const wsBook = buildWordSearchBook(pz, { trim: "8.5x11", bleed: false, answersPerPage: 4, frontMatter: null, extras: NO_EXTRAS, design: base() }, fonts);
render("ws-shapes", wsBook.pdf.output("arraybuffer"), [1, pz.length + Math.ceil(pz.length / 4)]);
console.log("word search sizes:", pz.map((p) => `${p.shape ?? "square"} ${p.size}`).join(", "));

// 2. Every frame style on a circle and a heart, plus cell and list-box styles.
const frameDesigns: [string, Design][] = FRAMES.map((f) => {
  const x = base();
  x.grid = { ...x.grid, ...f.grid };
  return [f.id, x];
});
const extras: [string, (x: Design) => void][] = [
  ["cells-boxed", (x) => (x.grid.cells = "boxed")],
  ["cells-rounded", (x) => (x.grid.cells = "rounded")],
  ["cells-circles", (x) => (x.grid.cells = "circles")],
  ["inner-lines", (x) => (x.grid.lines = true)],
  ["list-solid", (x) => (x.list.box = "solid")],
  ["list-rounded", (x) => (x.list.box = "rounded")],
  ["list-dashed", (x) => (x.list.box = "dashed")],
  ["list-double", (x) => (x.list.box = "double")],
  ["kids-pattern-shadow", (x) => Object.assign(x, { ...templateDesign("kids"), grid: { ...templateDesign("kids").grid, shadow: true } })],
];
for (const [id, fn] of extras) {
  const x = base();
  fn(x);
  frameDesigns.push([id, x]);
}
const circle = ws("circle", 3);
const heart = ws("heart", 4);
const square = ws("square", 5);
frameDesigns.forEach(([id, design], k) => {
  const p = [circle, heart, square][k % 3];
  const b = buildWordSearchBook([p], { trim: "8.5x11", bleed: false, answersPerPage: 1, frontMatter: null, extras: NO_EXTRAS, design }, fonts);
  render(`frame-${id}`, b.pdf.output("arraybuffer"), [1, 1]);
});

// 3. Crossword shapes.
const clues = "APPLE BANANA CHERRY GRAPE LEMON MANGO ORANGE PEACH PEAR PLUM MELON LIME APRICOT COCONUT".split(" ").map((a, i) => ({ answer: a, clue: `Fruit number ${i + 1}` }));
const cws = CROSSWORD_SHAPES.map((k, i) => ({ cw: generateCrossword(clues, mulberry32(20 + i), 40, k), title: SHAPES.find((s) => s.key === k)!.label }));
cws.forEach((c) => c.cw.leftOut.length && console.log("crossword", c.cw.shape, "left out", c.cw.leftOut));
const cwd = templateDesign("elegant");
cwd.grid = { ...cwd.grid, border: "square", frame: 1.6, line: "solid" };
const cwBook = buildCrosswordBook(cws, { trim: "8.5x11", bleed: false, frontMatter: null, extras: NO_EXTRAS, design: cwd, answersPerPage: 4 }, fonts);
render("cw-shapes", cwBook.pdf.output("arraybuffer"), [1, cws.length]);

// 4. Sudoku frames × cell styles.
SUDOKU_SHAPES.forEach((k, i) => {
  const sd = base();
  sd.shape.kind = k;
  sd.grid.cells = (["plain", "rounded", "circles"] as const)[i % 3];
  if (i === 4) sd.grid = { ...sd.grid, border: "double" };
  const b = buildSudokuBook([generateSudoku("easy"), generateSudoku("medium")], { trim: "8.5x11", bleed: false, frontMatter: null, extras: NO_EXTRAS, design: sd, puzzlesPerPage: 1, answersPerPage: 4 }, fonts);
  render(`sudoku-${k}-${sd.grid.cells}`, b.pdf.output("arraybuffer"), [1, 1]);
});

// 5. Overview montage.
const pngs = readdirSync(out).filter((f) => f.endsWith(".png")).sort();
writeFileSync(join(out, "_list.txt"), pngs.join("\n"));
execFileSync("python3", [
  "-c",
  `
import sys
from PIL import Image, ImageDraw
out=sys.argv[1]
names=open(out+"/_list.txt").read().split()
ims=[Image.open(out+"/"+n).convert("RGB") for n in names]
tw=300
tiles=[]
for n,im in zip(names,ims):
    h=int(im.height*tw/im.width)
    t=Image.new("RGB",(tw,h+18),"white"); t.paste(im.resize((tw,h)),(0,18))
    ImageDraw.Draw(t).text((4,3),n[:-4],fill=(60,60,60)); tiles.append(t)
cols=8; th=max(t.height for t in tiles)
rows=(len(tiles)+cols-1)//cols
m=Image.new("RGB",(cols*(tw+8)+8,rows*(th+8)+8),(230,230,236))
for i,t in enumerate(tiles): m.paste(t,(8+(i%cols)*(tw+8),8+(i//cols)*(th+8)))
m.save(out+"/_overview-montage.png")
print(len(tiles),"tiles")
`,
  out,
], { stdio: "inherit" });
console.log("done:", out);
