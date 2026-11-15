/**
 * Shape plan checks in Node:
 *   npx tsx scripts/shapeplan-review.ts [outDir=review/shapeplan]
 * 1. Every word search shape renders in a mixed-shape book (all templates' outline rules).
 * 2. A 10k-word "Surprise me" book: every word placed, every word readable at its
 *    placement (solvable), neighbouring puzzles never share a shape, PDF builds.
 * 3. Crossword and sudoku surprise books build with their own shape lists.
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { CROSSWORD_SHAPES, SHAPE_KEYS, SUDOKU_SHAPES, ShapeKey, shapeCategory } from "../src/lib/shapes/shapes";
import { shapeTargetsFor } from "../src/lib/shapes/plan";
import { generateOneWordSearch } from "../src/lib/jobs/run";
import { presetFor, suggestGridSize } from "../src/lib/wordsearch/difficulty";
import { splitIntoPuzzles } from "../src/lib/wordsearch/bulk";
import { buildWordSearchBook, BookPuzzle } from "../src/lib/wordsearch/pdf";
import { gridForm, mulberry32, placementCells } from "../src/lib/wordsearch/engine";
import { generateCrossword } from "../src/lib/crossword/engine";
import { buildCrosswordBook } from "../src/lib/crossword/pdf";
import { buildSudokuBook, demoSudoku } from "../src/lib/sudoku/pdf";
import { nodeFonts } from "../src/lib/print/nodeFonts";
import { NO_EXTRAS } from "../src/lib/print/book";
import { templateDesign } from "../src/lib/design/templates";
import type { Design } from "../src/lib/design/types";

const out = process.argv[2] ?? "review/shapeplan";
mkdirSync(out, { recursive: true });
const fonts = nodeFonts();
const d = presetFor("medium");
const fail: string[] = [];
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? "✓" : "✗"} ${what}`);
  if (!cond) fail.push(what);
};

const design = (template: Parameters<typeof templateDesign>[0], mix: Design["shape"]["mix"], seed = 7): Design => {
  const x = templateDesign(template);
  x.shape = { ...x.shape, kind: "square", mix, seed, shade: true, outline: "smooth" };
  return x;
};

/** A word is solvable when its letters read out of the grid along its placement. */
const solvable = (p: BookPuzzle) =>
  p.placements.every((pl) => {
    const letters = placementCells(pl).map(([r, c]) => p.grid[r]?.[c] ?? "").join("");
    return letters === gridForm(pl.word);
  });

// 1. Every shape in a mixed book.
const WORDS = ["CLOUD", "RAINBOW", "THUNDER", "BREEZE", "PUDDLE", "SUNSHINE", "SNOWFLAKE", "LIGHTNING", "STORM", "SKY", "WIND", "SHOWER"];
const every: BookPuzzle[] = [];
const bad: string[] = [];
SHAPE_KEYS.forEach((shape, i) => {
  try {
    const g = generateOneWordSearch({ title: shape, theme: "", words: WORDS, size: suggestGridSize(WORDS, d.density), shape }, d, 500 + i);
    if (g.unplaced.length || !solvable(g)) bad.push(`${shape}: ${g.unplaced.join(",") || "unsolvable"}`);
    every.push(g);
  } catch (e) {
    bad.push(`${shape}: ${(e as Error).message}`);
  }
});
ok(!bad.length, `all ${SHAPE_KEYS.length} shapes place and solve the words${bad.length ? `: ${bad.join("; ")}` : ""}`);
for (const t of ["banner", "classic", "kids", "elegant", "largeprint", "modern", "seasonal"] as const) {
  try {
    const b = buildWordSearchBook(every, { trim: "8.5x11", bleed: false, answersPerPage: 4, frontMatter: null, extras: NO_EXTRAS, design: design(t, "each") }, fonts);
    ok(b.pageCount >= every.length, `mixed book renders every shape with the ${t} template (${b.pageCount} pages)`);
  } catch (e) {
    ok(false, `mixed book with ${t}: ${(e as Error).message}`);
  }
}

// 2. 10k words, surprise me.
const rng = mulberry32(21);
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
const tenkDesign = design("banner", "each", 2026);
const targets = shapeTargetsFor(tenkDesign.shape, specs);
const t0 = Date.now();
const tenk = specs.map((s, i) => generateOneWordSearch({ ...s, shape: targets[i] }, d, i + 31));
const genS = (Date.now() - t0) / 1000;
const unplaced = tenk.reduce((a, g) => a + g.unplaced.length, 0);
const placed = tenk.reduce((a, g) => a + g.placements.length, 0);
ok(unplaced === 0 && placed === 10000, `10k surprise book: ${tenk.length} puzzles, ${placed} words placed, ${unplaced} left out (${genS.toFixed(1)}s)`);
ok(tenk.every(solvable), "10k surprise book: every word reads out of its grid (solvable)");
ok(tenk.every((g, i) => (g.shape ?? "square") === targets[i]), "10k surprise book: every puzzle is built in its planned shape");
ok(targets.every((k, i) => i === 0 || k !== targets[i - 1]), "10k surprise book: no two neighbouring puzzles share a shape");
const distinct = new Set(targets).size;
const cats = new Set(targets.map(shapeCategory));
ok(distinct >= 130 && cats.size === 9 && !cats.has("letters"), `10k surprise book uses ${distinct} different shapes from ${cats.size} categories`);
const t1 = Date.now();
const book = buildWordSearchBook(tenk, { trim: "8.5x11", bleed: false, answersPerPage: 4, frontMatter: null, extras: NO_EXTRAS, design: tenkDesign }, fonts);
const bytes = Buffer.from(book.pdf.output("arraybuffer"));
writeFileSync(join(out, "ws_10k_surprise.pdf"), bytes);
ok(book.pageCount > tenk.length, `10k surprise PDF: ${book.pageCount} pages, ${(bytes.length / 1e6).toFixed(1)} MB, ${((Date.now() - t1) / 1000).toFixed(1)}s`);

// 3. Crossword + sudoku surprise books.
const CW = ["APPLE", "PEAR", "PLUM", "GRAPE", "LEMON", "MELON", "MANGO", "OLIVE", "PEACH", "BERRY", "LIME", "CHERRY"].map((answer) => ({ answer, clue: `A fruit: ${answer.toLowerCase()}` }));
const cwTargets = shapeTargetsFor({ kind: "square", mix: "each", seed: 5 }, Array.from({ length: 30 }, () => ({})), CROSSWORD_SHAPES);
const cws = cwTargets.map((shape, i) => ({ cw: generateCrossword(CW, mulberry32(9 + i), 30, shape), title: `Fruit ${i + 1}` }));
ok(cws.every((c, i) => (c.cw.shape ?? "square") === cwTargets[i] && c.cw.placements.length > 1), `30 crosswords built in 30 planned shapes`);
const cwBook = buildCrosswordBook(cws, { trim: "8.5x11", bleed: false, frontMatter: null, extras: NO_EXTRAS, design: design("elegant", "each") }, fonts);
ok(cwBook.pageCount >= 30, `crossword surprise PDF: ${cwBook.pageCount} pages`);
const sdTargets = shapeTargetsFor({ kind: "square", mix: "pick", cats: ["animals", "food"], seed: 5 }, Array.from({ length: 40 }, () => ({})), SUDOKU_SHAPES);
ok(sdTargets.every((k) => SUDOKU_SHAPES.includes(k)), "sudoku plan only uses sudoku frames");
const sdBook = buildSudokuBook(sdTargets.map((shape) => ({ ...demoSudoku(), shape })), { trim: "8.5x11", bleed: false, frontMatter: null, extras: NO_EXTRAS, design: design("classic", "pick"), puzzlesPerPage: 1 }, fonts);
ok(sdBook.pageCount >= 40, `sudoku plan PDF: ${sdBook.pageCount} pages`);

console.log(fail.length ? `\n${fail.length} FAILED` : "\nall shape plan checks passed");
process.exit(fail.length ? 1 : 0);
