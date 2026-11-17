/**
 * Sample books + template previews + a 10,000-word performance run (Node):
 *   npx tsx scripts/sample-book.ts [outDir] [--perf]
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { generatePuzzle, makePlacement, mulberry32 } from "../src/lib/wordsearch/engine";
import { buildWordSearchBook, BookPuzzle } from "../src/lib/wordsearch/pdf";
import { DEFAULT_FRONT_MATTER } from "../src/lib/print/frontMatter";
import { nodeFonts } from "../src/lib/print/nodeFonts";
import { DEFAULT_EXTRAS, NO_EXTRAS } from "../src/lib/print/book";
import { generateCrossword } from "../src/lib/crossword/engine";
import { buildCrosswordBook } from "../src/lib/crossword/pdf";
import { generateSudoku, mixPlan } from "../src/lib/sudoku";
import { buildSudokuBook } from "../src/lib/sudoku/pdf";
import { TEMPLATES, templateDesign } from "../src/lib/design/templates";
import { presetFor } from "../src/lib/wordsearch/difficulty";
import { splitIntoPuzzles } from "../src/lib/wordsearch/bulk";
import { generateOneWordSearch } from "../src/lib/jobs/run";
import { planVolumes, estimatePages } from "../src/lib/print/estimate";

const args = process.argv.slice(2);
const outDir = args.find((a) => !a.startsWith("--")) ?? "review";
mkdirSync(outDir, { recursive: true });
const fonts = nodeFonts();
const save = (name: string, bytes: ArrayBuffer) => {
  writeFileSync(join(outDir, name), Buffer.from(bytes));
  return (bytes.byteLength / 1024).toFixed(0) + " KB";
};
const fm = {
  ...DEFAULT_FRONT_MATTER,
  title: "Summer Fun Word Search",
  subtitle: "Large Print Puzzles for Adults and Seniors",
  dedication: "For everyone who loves a quiet moment with a good puzzle.",
  website: "www.example.com",
};

const themes: [string, string[]][] = [
  ["Ice Cream Shop", ["ICE CREAM", "SPRINKLES", "WAFFLE CONE", "SUNDAE", "VANILLA", "CHOCOLATE", "SCOOP", "BANANA SPLIT", "CHERRY", "FUDGE", "MINT", "SORBET", "CARAMEL", "TOPPING", "MILKSHAKE", "NAPKIN", "FREEZER", "SPOON", "STRAWBERRY", "PISTACHIO"]],
  ["Ocean", ["WHALE", "CORAL REEF", "DOLPHIN", "LOBSTER", "SEAWEED", "OCTOPUS", "TIDE", "HARBOR", "ANCHOR", "STARFISH", "LAGOON", "OYSTER", "SHARK", "TURTLE", "JELLYFISH", "PLANKTON", "CURRENT", "WAVES", "SEAHORSE", "PEARL"]],
  ["Garden", ["TULIP", "GARDEN HOSE", "SHOVEL", "COMPOST", "SUNFLOWER", "DAISY", "MULCH", "SEEDS", "RAKE", "BASIL", "TOMATO", "CARROT", "LAVENDER", "PUMPKIN", "BEETLE", "WORM", "FENCE", "TROWEL", "WATERING CAN", "ROSES"]],
  ["En Español", ["NIÑO", "MAÑANA", "PIÑATA", "SEÑOR", "ESPAÑA", "OTOÑO", "MONTAÑA", "SUEÑO", "CAMPAÑA", "PEQUEÑO", "BAÑO", "AÑO"]],
];

const preset = presetFor("medium");
const puzzles: BookPuzzle[] = themes.map(([title, words], i) => {
  const fixed = i === 0 ? [makePlacement("ICE CREAM", 0, 0, "E")] : [];
  const g = generatePuzzle(words, 18, preset.dirs, mulberry32(100 + i), fixed);
  return { title, theme: title, size: g.size, grid: g.grid, words, placements: g.placements };
});

const extras = { ...DEFAULT_EXTRAS, intro: "Welcome! Inside you will find themed word search puzzles in large, easy-to-read print.\n\nSharpen a pencil, find a comfy chair and enjoy.", notesPages: 2 };
const ws = buildWordSearchBook(puzzles, { trim: "8.5x11", bleed: false, answersPerPage: 4, frontMatter: fm, extras, design: templateDesign("banner") }, fonts);
console.log(`sample_book.pdf: ${ws.pageCount} pages [${ws.kinds.slice(0, 12).join(", ")}...], ${save("sample_book.pdf", ws.pdf.output("arraybuffer"))}`);

// One sample per template: just the first puzzle + its solution, no front matter.
for (const t of TEMPLATES) {
  const b = buildWordSearchBook(puzzles.slice(0, 2), { trim: "8.5x11", bleed: false, answersPerPage: 2, frontMatter: null, extras: NO_EXTRAS, design: t.design, padForKdp: false }, fonts);
  save(`template_${t.id}.pdf`, b.pdf.output("arraybuffer"));
}
console.log(`template_*.pdf: ${TEMPLATES.map((t) => t.id).join(", ")}`);

const cwEntries = [
  ["LION", "King of the jungle"], ["ICE CREAM", "Frozen summer treat"], ["PIANO", "Instrument with 88 keys"], ["ORANGE", "Citrus fruit and a color"],
  ["EAGLE", "Bird with sharp eyes"], ["CANDLE", "Wax light"], ["NORTH", "Compass direction"], ["GARDEN", "Where flowers grow"], ["RAINBOW", "Arc of colors after rain"], ["APPLE", "Keeps the doctor away"],
].map(([answer, clue]) => ({ answer, clue }));
const cw = generateCrossword(cwEntries, mulberry32(5));
const cwBook = buildCrosswordBook([{ cw, title: "Everyday Things" }, { cw: generateCrossword(cwEntries, mulberry32(9)), title: "More Everyday Things" }], { trim: "8.5x11", bleed: false, frontMatter: { ...fm, title: "Easy Crosswords", subtitle: "Large Print" }, extras, design: templateDesign("elegant") }, fonts);
console.log(`sample_crossword.pdf: ${cwBook.pageCount} pages, ${save("sample_crossword.pdf", cwBook.pdf.output("arraybuffer"))}, left out: ${cw.leftOut.join(", ") || "none"}`);

const sd = mixPlan({ easy: 4, medium: 4, hard: 2, expert: 2 }).map(generateSudoku);
const sdBook = buildSudokuBook(sd, { trim: "8.5x11", bleed: false, frontMatter: { ...fm, title: "Sudoku for Everyone", subtitle: "Easy to Expert" }, extras, design: templateDesign("largeprint"), puzzlesPerPage: 2, answersPerPage: 6 }, fonts);
console.log(`sample_sudoku.pdf: ${sdBook.pageCount} pages, ${save("sample_sudoku.pdf", sdBook.pdf.output("arraybuffer"))}`);

if (args.includes("--perf")) {
  // WORDS distinct pseudo-words (default 10,000; 5–11 letters), PER per puzzle (default 36), auto grid size.
  const WORDS = Number(process.env.WORDS ?? 10000);
  const PER = Number(process.env.PER ?? 36);
  const rng = mulberry32(42);
  const letters = "AEIOUBCDFGHLMNPRSTVWY";
  const set = new Set<string>();
  while (set.size < WORDS) {
    const len = 5 + Math.floor(rng() * 7);
    let w = "";
    for (let i = 0; i < len; i++) w += letters[Math.floor(rng() * letters.length)];
    set.add(w);
  }
  const entries = Array.from(set).map((word) => ({ word }));
  const hard = presetFor("medium");
  let t = Date.now();
  const specs = splitIntoPuzzles(entries, { wordsPerPuzzle: PER, size: "auto", density: hard.density, groupByTheme: false });
  const gen = specs.map((s) => generateOneWordSearch({ ...s }, { dirs: hard.dirs, overlapWeight: hard.overlapWeight, decoys: hard.decoys }));
  const genMs = Date.now() - t;
  const missing = gen.reduce((a, g) => a + g.unplaced.length, 0);
  const items: BookPuzzle[] = gen.map((g) => ({ title: g.title, size: g.size, grid: g.grid, words: g.words.filter((w) => g.placements.some((p) => p.word === w)), placements: g.placements }));
  const pagesFor = (n: number) => estimatePages({ items: n, layout: { perPage: 1, answersPerPage: 6 }, frontMatter: fm, extras: DEFAULT_EXTRAS, padForKdp: true });
  const vols = planVolumes(items.length, pagesFor);
  t = Date.now();
  const sizes: string[] = [];
  let pages = 0;
  vols.ranges.forEach(([a, b], v) => {
    const book = buildWordSearchBook(items.slice(a, b), { trim: "8.5x11", bleed: false, answersPerPage: 6, frontMatter: { ...fm, title: "Big Word Search" }, extras: DEFAULT_EXTRAS, design: templateDesign("banner"), volume: vols.ranges.length > 1 ? { n: v + 1, of: vols.ranges.length } : undefined }, fonts);
    pages += book.pageCount;
    sizes.push(save(`perf_${WORDS}_vol${v + 1}.pdf`, book.pdf.output("arraybuffer")));
  });
  const pdfMs = Date.now() - t;
  const sizesTxt = sizes.join(" + ");
  console.log(`PERF ${WORDS.toLocaleString()} words -> ${specs.length} puzzles (grid ${Math.min(...specs.map((s) => s.size))}-${Math.max(...specs.map((s) => s.size))}), generation ${genMs} ms, words left out: ${missing}`);
  console.log(`PERF PDF: ${vols.ranges.length} volume(s), ${pages} pages total (estimated ${vols.pages.reduce((a, b) => a + b, 0)}), ${pdfMs} ms, size ${sizesTxt}`);
}
