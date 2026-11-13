/**
 * Build sample KDP books from the CLI:
 *   npx tsx scripts/sample-book.ts [outDir]
 * Writes sample_book.pdf (word search), sample_crossword.pdf, sample_sudoku.pdf.
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { allowedDirections, generatePuzzle, makePlacement, mulberry32 } from "../src/lib/wordsearch/engine";
import { buildWordSearchBook, BookPuzzle } from "../src/lib/wordsearch/pdf";
import { DEFAULT_FRONT_MATTER } from "../src/lib/print/frontMatter";
import { nodeFonts } from "../src/lib/print/nodeFonts";
import { generateCrossword } from "../src/lib/crossword/engine";
import { buildCrosswordBook } from "../src/lib/crossword/pdf";
import { generateSudokus } from "../src/lib/sudoku";
import { buildSudokuBook } from "../src/lib/sudoku/pdf";

const outDir = process.argv[2] ?? "review";
mkdirSync(outDir, { recursive: true });
const fonts = nodeFonts();
const fm = {
  ...DEFAULT_FRONT_MATTER,
  title: "Summer Fun Word Search",
  subtitle: "Large Print Puzzles for Adults and Seniors",
  dedication: "For everyone who loves a quiet moment with a good puzzle.",
  website: "www.example.com",
};

const themes: [string, string[]][] = [
  ["Ice Cream Shop", ["ICE CREAM", "SPRINKLES", "WAFFLE CONE", "SUNDAE", "VANILLA", "CHOCOLATE", "SCOOP", "BANANA SPLIT", "CHERRY", "FUDGE", "MINT", "SORBET"]],
  ["Ocean", ["WHALE", "CORAL REEF", "DOLPHIN", "LOBSTER", "SEAWEED", "OCTOPUS", "TIDE", "HARBOR", "ANCHOR", "STARFISH", "LAGOON", "OYSTER"]],
  ["Garden", ["TOMATO", "BASIL", "SHOVEL", "COMPOST", "SEEDLING", "TRELLIS", "PUMPKIN", "SUNFLOWER", "GARDEN HOSE", "TULIP", "CARROT", "MULCH"]],
  ["En Español", ["MAÑANA", "NIÑO", "ESPAÑA", "PIÑATA", "SEÑOR", "AÑO", "MONTAÑA", "CAÑON", "T-REX", "PEQUEÑO", "OTOÑO", "BAÑO"]],
];
const dirs = allowedDirections({ horizontal: true, vertical: true, diagonalDown: true, diagonalUp: true, reversed: true });
const puzzles: BookPuzzle[] = themes.map(([title, words], i) => {
  const fixed = i === 0 ? [makePlacement("ICE CREAM", 0, 0, "E"), makePlacement("SPRINKLES", 1, 0, "S")] : [];
  const g = generatePuzzle(words, 15, dirs, mulberry32(1000 + i), fixed);
  if (g.unplaced.length) console.warn(`${title}: unplaced ${g.unplaced.join(", ")}`);
  return { title: `Puzzle ${i + 1}: ${title}`, size: g.size, grid: g.grid, words: words.filter((w) => g.placements.some((p) => p.word === w)), placements: g.placements };
});
const ws = buildWordSearchBook(puzzles, { trim: "8.5x11", bleed: false, answersPerPage: 4, frontMatter: fm }, fonts);
writeFileSync(join(outDir, "sample_book.pdf"), Buffer.from(ws.pdf.output("arraybuffer")));
console.log(`sample_book.pdf: ${ws.pageCount} pages [${ws.kinds.filter((k) => k !== "blank").join(", ")}], gutter ${ws.spec.inside}"`);

const clues = [
  ["LION", "King of the jungle"], ["ORANGE", "Citrus fruit"], ["PIANO", "Instrument with 88 keys"], ["EAGLE", "Bird on many flags"],
  ["ICE CREAM", "Frozen summer treat"], ["RAINBOW", "Arc of colors after rain"], ["CANDLE", "Wax light"], ["APPLE", "Keeps the doctor away"],
  ["NORTH", "Compass direction"], ["GARDEN", "Where flowers grow"],
];
const cw = generateCrossword(clues.map(([answer, clue]) => ({ answer, clue })), mulberry32(7));
const cwBook = buildCrosswordBook([{ cw, title: "Crossword 1" }], { trim: "8.5x11", bleed: false, frontMatter: { ...fm, title: "Crossword Puzzle Book", subtitle: "Easy Crosswords for Every Day" } }, fonts);
writeFileSync(join(outDir, "sample_crossword.pdf"), Buffer.from(cwBook.pdf.output("arraybuffer")));
console.log(`sample_crossword.pdf: ${cwBook.pageCount} pages, left out: ${cw.leftOut.join(", ") || "none"}`);

const sd = buildSudokuBook(generateSudokus(4, "medium"), { trim: "8.5x11", bleed: false, frontMatter: { ...fm, title: "Sudoku Puzzle Book", subtitle: "Medium Puzzles" }, puzzlesPerPage: 1 }, fonts);
writeFileSync(join(outDir, "sample_sudoku.pdf"), Buffer.from(sd.pdf.output("arraybuffer")));
console.log(`sample_sudoku.pdf: ${sd.pageCount} pages`);
