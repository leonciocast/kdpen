/** Build a sample KDP book from the CLI: npx tsx scripts/sample-book.ts [out.pdf] */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { allowedDirections, generatePuzzle, makePlacement, mulberry32 } from "../src/lib/wordsearch/engine";
import { buildBookPdf, BookPuzzle } from "../src/lib/wordsearch/pdf";

const out = process.argv[2] ?? "review/sample_book.pdf";
const fontDir = join(__dirname, "..", "public", "fonts");
const fonts = {
  regular: readFileSync(join(fontDir, "DejaVuSans.ttf")).toString("base64"),
  bold: readFileSync(join(fontDir, "DejaVuSans-Bold.ttf")).toString("base64"),
};

const themes: [string, string[]][] = [
  ["Garden", ["TOMATO", "BASIL", "SHOVEL", "COMPOST", "SEEDLING", "TRELLIS", "PUMPKIN", "SUNFLOWER", "HOSE", "TULIP", "CARROT", "MULCH"]],
  ["Ocean", ["WHALE", "CORAL", "DOLPHIN", "LOBSTER", "SEAWEED", "OCTOPUS", "TIDE", "HARBOR", "ANCHOR", "STARFISH", "LAGOON", "OYSTER"]],
  ["Kitchen", ["SPATULA", "KETTLE", "WHISK", "OVEN", "LADLE", "SKILLET", "COLANDER", "TOASTER", "APRON", "PEELER", "GRATER", "BLENDER"]],
  ["En Español", ["MAÑANA", "NIÑO", "ESPAÑA", "PIÑATA", "SEÑOR", "AÑO", "MONTAÑA", "CAÑON", "T-REX", "PEQUEÑO", "OTOÑO", "BAÑO"]],
];

const dirs = allowedDirections({ horizontal: true, vertical: true, diagonalDown: true, diagonalUp: true, reversed: true });
const puzzles: BookPuzzle[] = themes.map(([title, words], i) => {
  const rng = mulberry32(1000 + i);
  // Puzzle 1 shows a mix: two hand-placed words, the rest auto-placed.
  const fixed = i === 0 ? [makePlacement("SUNFLOWER", 0, 0, "E"), makePlacement("TOMATO", 1, 0, "S")] : [];
  const g = generatePuzzle(words, 15, dirs, rng, fixed);
  if (g.unplaced.length) console.warn(`${title}: unplaced ${g.unplaced.join(", ")}`);
  return { title: `Puzzle ${i + 1}: ${title}`, size: g.size, grid: g.grid, words: words.filter((w) => g.placements.some((p) => p.word === w)), placements: g.placements };
});

const { pdf, plan } = buildBookPdf(
  puzzles,
  { trim: "8.5x11", bleed: false, title: "Sample Word Search Book", author: "Leoncio Castillo", answersPerPage: 4, includeFrontMatter: true },
  fonts
);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Buffer.from(pdf.output("arraybuffer")));
console.log(`Wrote ${out}: ${plan.pageCount} pages (${plan.contentPages} content), gutter ${plan.spec.inside}"`);
