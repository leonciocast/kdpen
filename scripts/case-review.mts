/**
 * Case-file page review: a small Saltmere book with a square case, shaped cases and a
 * long-word case, rendered at 8.5x11 (with bleed) and 6x9, then selected pages as PNGs.
 *   npx tsx scripts/case-review.mts [outDir]
 */
import { mkdirSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";
import { join } from "path";
import { generateMystery } from "../src/lib/mystery/model";
import { SALTMERE, starterCases } from "../src/lib/mystery/starter";
import { DEFAULT_MYSTERY_SETTINGS } from "../src/lib/mystery/types";
import { buildMysteryBook, mysteryDesign } from "../src/lib/mystery/pdf";
import { nodeFonts } from "../src/lib/print/nodeFonts";
import { DEFAULT_EXTRAS } from "../src/lib/print/book";
import { DEFAULT_FRONT_MATTER } from "../src/lib/print/frontMatter";
import type { ShapeKey } from "../src/lib/shapes/shapes";

const out = process.argv[2] ?? "review/case-redesign/after";
mkdirSync(out, { recursive: true });
const specs = starterCases(6);
// Case 4: long evidence words.
specs[3] = { ...specs[3], words: ["LIGHTHOUSE", "SPYGLASSES", "SHIPWRECKED", "BAROMETER", "FOGHORN", "LANTERNS", "HARBOURS", "NAVIGATOR", "COASTLINE", "TELESCOPE"] };
const shapes: (ShapeKey | undefined)[] = [undefined, "heart", "letterB", undefined, "pear", "bee"];
const m = generateMystery({ book: SALTMERE, cases: specs, phrase: "MARSH", settings: DEFAULT_MYSTERY_SETTINGS, shapes, seed: 20261115 });
if (m.problems.length) console.log("problems", m.problems);
console.log("warnings", m.warnings);
const fonts = nodeFonts();
for (const [trim, bleed] of [["8.5x11", true], ["6x9", false]] as const) {
  const book = buildMysteryBook(m.items, { trim, bleed, answersPerPage: 4, frontMatter: DEFAULT_FRONT_MATTER, extras: DEFAULT_EXTRAS, design: mysteryDesign() }, fonts);
  const file = join(out, `book_${trim}.pdf`);
  writeFileSync(file, Buffer.from(book.pdf.output("arraybuffer")));
  const pages = execFileSync("pdftotext", ["-layout", file, "-"]).toString().split("\f");
  const find = (re: RegExp, nth = 0) => pages.map((p, i) => (re.test(p) ? i + 1 : 0)).filter(Boolean)[nth];
  const want: [string, number | undefined][] = [
    ["howto", find(/HOW TO SOLVE|How to Solve/)],
    ["case1_square", find(/CASE 0?1\b|Case 1\b/i, 0) && pages.findIndex((p) => p.includes(specs[0].title)) + 1],
    ["case2_heart", pages.findIndex((p) => p.includes(specs[1].title)) + 1],
    ["case3_letterB", pages.findIndex((p) => p.includes(specs[2].title)) + 1],
    ["case4_longwords", pages.findIndex((p) => p.includes(specs[3].title)) + 1],
    ["case6_bee", pages.findIndex((p) => p.includes(specs[5].title)) + 1],
    ["board", find(/CASE BOARD/)],
    ["closed", pages.findIndex((p, i) => /CASE CLOSED|Case Closed/.test(p) && !/SOLUTIONS|Solutions/.test(p) && !/CONTENTS|Contents/.test(p) && i > 3) + 1],
    ["solutions1", pages.findIndex((p, i) => /^\s*(SOLUTIONS|Solutions)\b/m.test(p) && i > 5) + 1],
  ];
  for (const [name, pg] of want) {
    if (!pg) {
      console.log(`  ${trim}: no page for ${name}`);
      continue;
    }
    execFileSync("pdftoppm", ["-r", trim === "6x9" ? "110" : "90", "-png", "-singlefile", "-f", String(pg), "-l", String(pg), file, join(out, `${trim}_${name}`)]);
  }
  console.log(`${trim}: ${book.pageCount} pages -> ${out}`);
}
