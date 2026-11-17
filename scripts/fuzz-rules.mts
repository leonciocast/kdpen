// Rule fuzzer: npx tsx scripts/fuzz-rules.mts [combosPerTool=50] [seed]
// Random option combos per tool, run through the same job code the web worker uses
// (generate + build PDF), then checked against the rules:
//  word search: every word placed, inside the shape, reads exactly once; no empty cells
//  mystery:     the book validator passes (exact message, missing word, keys), no raw errors
//  crossword:   one connected grid, letters agree at crossings, nothing silently dropped
//  sudoku:      the solution is valid, matches the givens and is the only one
//  every PDF:   KDP page size (+ bleed), even page count >= 24, text inside KDP margins,
//               and letters at least 7pt on 8.5x11 pages.
import { runJob } from "../src/lib/jobs/run";
import { nodeFonts } from "../src/lib/print/nodeFonts";
import { DEFAULT_EXTRAS } from "../src/lib/print/book";
import { DEFAULT_FRONT_MATTER } from "../src/lib/print/frontMatter";
import { TEMPLATES } from "../src/lib/design/templates";
import { TRIM_SIZES, insideMargin, OUTSIDE_MIN_IN, OUTSIDE_MIN_BLEED_IN, BLEED_WIDTH_IN, BLEED_HEIGHT_IN, type TrimKey } from "../src/lib/print/kdp";
import { allowedDirections, findOccurrences, gridForm, mulberry32, isActive } from "../src/lib/wordsearch/engine";
import { suggestGridSize } from "../src/lib/wordsearch/difficulty";
import { SHAPE_KEYS, CROSSWORD_SHAPES, SUDOKU_SHAPES, MYSTERY_SHAPES, shapedGrid, type ShapeKey } from "../src/lib/shapes/shapes";
import { SALTMERE, phraseFor, starterCases } from "../src/lib/mystery/starter";
import { SETTINGS, scaffoldBook } from "../src/lib/mystery/templates";
import { CASES_EXAMPLE, parseCases } from "../src/lib/mystery/parse";
import { validateBook } from "../src/lib/mystery/model";
import { mysteryDesign } from "../src/lib/mystery/pdf";
import { isValidSolution, type SudokuDifficulty } from "../src/lib/sudoku";
import type { Design } from "../src/lib/design/types";
import type { BookPuzzle } from "../src/lib/wordsearch/pdf";

const N = Number(process.argv[2] ?? 50);
const rng = mulberry32(Number(process.argv[3] ?? 20261115));
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rng() * a.length)];
const int = (a: number, b: number) => a + Math.floor(rng() * (b - a + 1));
const coin = (p = 0.5) => rng() < p;
const env = { progress: () => {}, loadFonts: async () => nodeFonts() };
const failures: string[] = [];
const stats: Record<string, { combos: number; pdfs: number; pages: number; notes: number }> = {};
const stat = (t: string) => (stats[t] ??= { combos: 0, pdfs: 0, pages: 0, notes: 0 });
const fail = (tool: string, i: number, what: string, combo: unknown) => failures.push(`${tool} #${i}: ${what}\n    combo: ${JSON.stringify(combo).slice(0, 400)}`);

const WORDS = "APPLE BANANA CHERRY MANGO LEMON GRAPE PEACH PLUM KIWI MELON ORANGE PAPAYA GUAVA LIME COCONUT APRICOT FIG DATE OLIVE PEAR TIGER LION ZEBRA HIPPO RHINO GIRAFFE MONKEY PANDA KOALA OTTER BEAVER RABBIT SQUIRREL FOX WOLF BEAR MOOSE DEER EAGLE HAWK ROBIN SPARROW PARROT PENGUIN DOLPHIN WHALE SHARK OCTOPUS CRAB LOBSTER STARFISH SEAHORSE JELLYFISH TURTLE SNAIL BEETLE BUTTERFLY DRAGONFLY LADYBUG SUNSHINE RAINBOW THUNDER LIGHTNING BLIZZARD TORNADO HURRICANE BREEZE CLOUD STORM PIANO GUITAR VIOLIN TRUMPET FLUTE DRUM HARP CELLO BANJO ICE CREAM HOT DOG BEACH BALL SAND CASTLE".split(" ");
const sample = (n: number) => [...new Set(Array.from({ length: n * 2 }, () => pick(WORDS)))].slice(0, n);
const anyShape = (list: ShapeKey[]) => (coin(0.3) ? undefined : pick(list));

// ---------------------------------------------------------------- PDF checks
type PdfDoc = { numPages: number; getPage: (i: number) => Promise<{ view: number[]; getTextContent: () => Promise<{ items: { str?: string; transform: number[]; width: number; height: number }[] }> }> };
async function checkPdf(tool: string, i: number, bytes: ArrayBuffer, trim: TrimKey, bleed: boolean, combo: unknown) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = (await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)), verbosity: 0 }).promise) as unknown as PdfDoc;
  const t = TRIM_SIZES[trim];
  const W = (t.width + (bleed ? BLEED_WIDTH_IN : 0)) * 72;
  const H = (t.height + (bleed ? BLEED_HEIGHT_IN : 0)) * 72;
  const n = doc.numPages;
  stat(tool).pdfs++;
  stat(tool).pages += n;
  if (n % 2 || n < 24) fail(tool, i, `page count ${n} (KDP needs an even count, at least 24)`, combo);
  const gutter = insideMargin(n) * 72;
  const outer = (bleed ? OUTSIDE_MIN_BLEED_IN : OUTSIDE_MIN_IN) * 72;
  const tb = (bleed ? 0.375 : 0.25) * 72;
  let small = 0, smallest = 99, outside = 0, firstOut = "";
  let answers = false;
  for (let p = 1; p <= n; p++) {
    const page = await doc.getPage(p);
    const [, , pw, ph] = page.view;
    if (Math.abs(pw - W) > 0.6 || Math.abs(ph - H) > 0.6) { fail(tool, i, `page ${p} is ${pw}x${ph}pt, expected ${W}x${H}`, combo); break; }
    const left = p % 2 === 1 ? gutter : outer;
    const right = p % 2 === 1 ? outer : gutter;
    const items = (await page.getTextContent()).items;
    // Answer pages may use small letters (solved grids are a key, not the puzzle).
    const flat = items.map((it) => it.str ?? "").join("").replace(/\s+/g, "");
    if (/SOLUTIONS/.test(flat)) answers = true;
    // Notes, thank-you and how-to pages (whose solved example is deliberately small) aren't puzzle pages.
    const notesOrBack = /^(#?\d*)?(NOTES|ThankYou|HOWTO(PLAY|SOLVE))/i.test(flat) || /HOWTO(PLAY|SOLVE)/.test(flat.slice(0, 40));
    for (const it of items) {
      if (!it.str || !it.str.trim()) continue;
      const size = Math.hypot(it.transform[2], it.transform[3]);
      if (trim === "8.5x11" && !answers && !notesOrBack && /^[A-Z]$/.test(it.str.trim()) && size < 7 - 1e-6) { small++; smallest = Math.min(smallest, size); }
      const x = it.transform[4], y = it.transform[5];
      const x1 = x + it.width, y0 = y - size * 0.22, y1 = y + size * 0.75;
      if (x < left - 1 || x1 > W - right + 1 || y0 < tb - 1 || y1 > H - tb + 1) {
        outside++;
        firstOut ||= `p${p} "${it.str.slice(0, 20)}" x ${x.toFixed(1)}–${x1.toFixed(1)} y ${y0.toFixed(1)}–${y1.toFixed(1)} (page ${W}x${H}, margins L${left.toFixed(0)} R${right.toFixed(0)} TB${tb.toFixed(0)})`;
      }
    }
  }
  if ((small || outside) && process.env.DUMP) (await import("node:fs")).writeFileSync(`${process.env.DUMP}/${tool}_${i}.pdf`, Buffer.from(bytes));
  if (small) fail(tool, i, `${small} puzzle-page letters below 7pt (smallest ${smallest.toFixed(2)}pt)`, combo);
  if (outside) fail(tool, i, `${outside} text items outside KDP margins, e.g. ${firstOut}`, combo);
}

function settingsFor(tool: string, design: Design, combo: Record<string, unknown>) {
  const trim = pick(Object.keys(TRIM_SIZES) as TrimKey[]);
  const bleed = coin(0.3);
  const answersPerPage = pick(tool === "crossword" ? ([1, 2, 4] as const) : ([1, 2, 4, 6] as const));
  const extras = { ...DEFAULT_EXTRAS, belongsTo: coin(), toc: coin(), howTo: coin(0.7), thankYou: coin(), notesPages: int(0, 2), intro: coin(0.2) ? "Welcome, reader." : "" };
  Object.assign(combo, { trim, bleed, answersPerPage, extras: Object.entries(extras).filter(([, v]) => v).map(([k]) => k).join(",") });
  return { trim, bleed, padForKdp: true, frontMatter: coin(0.8) ? { ...DEFAULT_FRONT_MATTER, title: "Fuzz Book", author: "Ana" } : null, extras, design, answersPerPage, perPage: tool === "sudoku" ? pick([1, 2, 4, 6] as const) : undefined };
}
const designFor = (tool: string, combo: Record<string, unknown>): Design => {
  if (tool === "mystery" && coin(0.6)) { combo.template = "mystery"; return mysteryDesign(); }
  const t = pick(TEMPLATES);
  combo.template = t.id;
  return structuredClone(t.design);
};

// ---------------------------------------------------------------- word search
async function wordSearch(i: number) {
  const dirOpts = { horizontal: true, vertical: coin(0.8), diagonalDown: coin(), diagonalUp: coin(), reversed: coin(0.3) };
  const dirs = allowedDirections(dirOpts);
  const count = int(1, 4);
  const specs = Array.from({ length: count }, (_, k) => {
    const words = sample(int(6, 22));
    return { title: `P${k + 1}`, theme: "Fuzz", words, size: suggestGridSize(words, pick([0.35, 0.5, 0.65])), shape: anyShape(SHAPE_KEYS) };
  });
  const combo: Record<string, unknown> = { dirOpts, shapes: specs.map((s) => s.shape ?? "square"), words: specs.map((s) => s.words.length), decoys: pick(["none", "some", "many"]) };
  stat("word-search").combos++;
  const out = await runJob({ type: "ws-generate", specs, settings: { dirs, overlapWeight: pick([-0.5, 0, 0.5]), decoys: combo.decoys as "none" } }, env);
  out.forEach((p, k) => {
    if (p.unplaced.length) fail("word-search", i, `puzzle ${k + 1} (${p.shape ?? "square"}, ${p.size}): unplaced ${p.unplaced.join(", ")}`, combo);
    const g = p.shape ? shapedGrid(p.size, p.shape) : p.size;
    for (const pl of p.placements) {
      const occ = findOccurrences(p.grid, pl.letters).length;
      if (occ !== 1) fail("word-search", i, `puzzle ${k + 1}: ${pl.word} reads ${occ} times`, combo);
    }
    for (let r = 0; r < p.size; r++) for (let c = 0; c < p.size; c++) {
      const on = isActive(g, r, c);
      if (on && !/^[A-ZÑ]$/.test(p.grid[r][c])) fail("word-search", i, `puzzle ${k + 1}: empty/odd cell ${r},${c} "${p.grid[r][c]}"`, combo);
      if (!on && p.grid[r][c]) fail("word-search", i, `puzzle ${k + 1}: letter outside the shape at ${r},${c}`, combo);
    }
    if (p.warnings.length) stat("word-search").notes++;
  });
  const design = designFor("word-search", combo);
  const st = settingsFor("word-search", design, combo);
  const items: BookPuzzle[] = out.map((p) => ({ title: p.title, theme: p.theme, size: p.size, grid: p.grid, words: p.words, placements: p.placements, shape: p.shape }));
  const files = await runJob({ type: "build", tool: "word-search", items, volumes: [[0, items.length]], fileBase: "f", settings: st }, env);
  await checkPdf("word-search", i, files[0].bytes, st.trim, st.bleed, combo);
}

// ---------------------------------------------------------------- crossword
async function crossword(i: number) {
  const groups = Array.from({ length: int(1, 3) }, (_, k) => ({ title: `C${k + 1}`, entries: sample(int(8, 22)).map((w) => ({ answer: w, clue: `Clue for ${w.toLowerCase()}` })), shape: anyShape(CROSSWORD_SHAPES) }));
  const combo: Record<string, unknown> = { shapes: groups.map((g) => g.shape ?? "square"), sizes: groups.map((g) => g.entries.length) };
  stat("crossword").combos++;
  const out = await runJob({ type: "cw-generate", groups }, env);
  out.forEach(({ cw }, k) => {
    const cells: [number, number][] = [];
    for (let r = 0; r < cw.height; r++) for (let c = 0; c < cw.width; c++) if (cw.grid[r][c]) cells.push([r, c]);
    if (!cells.length) { fail("crossword", i, `crossword ${k + 1} is empty`, combo); return; }
    const seen = new Set([`${cells[0][0]},${cells[0][1]}`]);
    const stack = [cells[0]];
    while (stack.length) {
      const [r, c] = stack.pop()!;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const rr = r + dr, cc = c + dc, key = `${rr},${cc}`;
        if (rr >= 0 && cc >= 0 && rr < cw.height && cc < cw.width && cw.grid[rr][cc] && !seen.has(key)) { seen.add(key); stack.push([rr, cc]); }
      }
    }
    if (seen.size !== cells.length) fail("crossword", i, `crossword ${k + 1} is not connected (${seen.size}/${cells.length} cells)`, combo);
    for (const p of cw.placements) {
      for (let j = 0; j < p.letters.length; j++) {
        const r = p.row + (p.across ? 0 : j), c = p.col + (p.across ? j : 0);
        if (cw.grid[r]?.[c] !== p.letters[j]) { fail("crossword", i, `crossword ${k + 1}: ${p.answer} disagrees with the grid`, combo); break; }
      }
    }
    if (cw.placements.length + cw.leftOut.length !== groups[k].entries.length) fail("crossword", i, `crossword ${k + 1}: ${groups[k].entries.length - cw.placements.length - cw.leftOut.length} words vanished`, combo);
    if (cw.leftOut.length) stat("crossword").notes++;
  });
  const design = designFor("crossword", combo);
  const st = settingsFor("crossword", design, combo);
  const items = out.map((o) => ({ title: o.title, cw: o.cw })) as never;
  const files = await runJob({ type: "build", tool: "crossword", items, volumes: [[0, out.length]], fileBase: "f", settings: st }, env);
  await checkPdf("crossword", i, files[0].bytes, st.trim, st.bleed, combo);
}

// ---------------------------------------------------------------- sudoku
function countSolutions(b: number[][], limit = 2): number {
  const g = b.map((r) => r.slice());
  let count = 0;
  const ok = (r: number, c: number, v: number) => {
    for (let k = 0; k < 9; k++) if (g[r][k] === v || g[k][c] === v) return false;
    const r0 = r - (r % 3), c0 = c - (c % 3);
    for (let a = 0; a < 3; a++) for (let d = 0; d < 3; d++) if (g[r0 + a][c0 + d] === v) return false;
    return true;
  };
  const solve = (): void => {
    if (count >= limit) return;
    let br = -1, bc = -1, best = 10;
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (!g[r][c]) {
      let n = 0;
      for (let v = 1; v <= 9; v++) if (ok(r, c, v)) n++;
      if (n < best) { best = n; br = r; bc = c; }
    }
    if (br < 0) { count++; return; }
    for (let v = 1; v <= 9; v++) if (ok(br, bc, v)) { g[br][bc] = v; solve(); g[br][bc] = 0; }
  };
  solve();
  return count;
}
async function sudoku(i: number) {
  const plan: SudokuDifficulty[] = Array.from({ length: int(1, 8) }, () => pick(["easy", "medium", "hard", "expert"] as const));
  const shapes = plan.map(() => anyShape(SUDOKU_SHAPES));
  const combo: Record<string, unknown> = { plan, shapes: shapes.map((s) => s ?? "square") };
  stat("sudoku").combos++;
  const out = await runJob({ type: "sd-generate", plan }, env);
  out.forEach((p, k) => {
    if (!isValidSolution(p.solution)) fail("sudoku", i, `puzzle ${k + 1}: invalid solution`, combo);
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (p.board[r][c] && p.board[r][c] !== p.solution[r][c]) fail("sudoku", i, `puzzle ${k + 1}: a given disagrees with the solution`, combo);
    const n = countSolutions(p.board);
    if (n !== 1) fail("sudoku", i, `puzzle ${k + 1} (${p.difficulty}) has ${n} solutions`, combo);
    p.shape = shapes[k];
  });
  const design = designFor("sudoku", combo);
  const st = settingsFor("sudoku", design, combo);
  const files = await runJob({ type: "build", tool: "sudoku", items: out, volumes: [[0, out.length]], fileBase: "f", settings: st }, env);
  await checkPdf("sudoku", i, files[0].bytes, st.trim, st.bleed, combo);
}

// ---------------------------------------------------------------- mystery
async function mystery(i: number) {
  const source = pick(["starter", "starter", "theme", "paste"] as const);
  const settings = { difficulty: pick(["easy", "medium", "hard"] as const), hiddenMessage: coin(0.8), missingEvidence: coin(0.8), storyline: coin(0.7), style: pick(["dossier", "clean"] as const) };
  let book = SALTMERE, cases = SALTMERE.cases, phrase = "";
  const combo: Record<string, unknown> = { source, ...settings };
  if (source === "starter") {
    const n = int(1, 24);
    cases = starterCases(n);
    phrase = phraseFor(n);
    combo.count = n;
  } else if (source === "theme") {
    const ids = SETTINGS.filter(() => coin(0.4)).map((s) => s.id);
    const count = int(2, 40);
    book = scaffoldBook({ settings: ids.length ? ids : [pick(SETTINGS).id], count, seed: int(1, 1e6) }, "CASE CLOSED");
    cases = book.cases;
    phrase = count >= 10 ? "CASE CLOSED" : "SOLVED".slice(0, Math.min(6, count));
    Object.assign(combo, { settings: ids, count });
  } else {
    const p = parseCases(CASES_EXAMPLE);
    book = { ...SALTMERE, cast: p.cast, cases: p.cases };
    cases = p.cases;
    phrase = "OK";
  }
  const mode = pick(["one", "surprise", "pick", "manual", "none"] as const);
  const one = pick(MYSTERY_SHAPES);
  const shapes = cases.map(() => (mode === "none" ? undefined : mode === "one" ? one : pick(MYSTERY_SHAPES))).map((k) => (k === "square" ? undefined : k));
  Object.assign(combo, { mode, shapes: [...new Set(shapes.map((s) => s ?? "square"))].slice(0, 12) });
  stat("mystery").combos++;
  let out;
  try {
    out = await runJob({ type: "my-generate", input: { book, cases, phrase, settings, shapes, seed: int(1, 1e8) } }, env);
  } catch (e) {
    fail("mystery", i, `build threw: ${(e as Error).message}`, combo);
    return;
  }
  if (out.problems.length) fail("mystery", i, `validator: ${out.problems.slice(0, 3).join(" | ")}`, combo);
  const again = validateBook(out.items);
  if (!again.ok) fail("mystery", i, `re-validate: ${again.problems[0]}`, combo);
  stat("mystery").notes += out.warnings.filter((w) => w.includes("square grid")).length;
  const design = designFor("mystery", combo);
  const st = settingsFor("mystery", design, combo);
  try {
    const files = await runJob({ type: "build", tool: "mystery", items: out.items, style: settings.style, volumes: [[0, out.items.length]], fileBase: "f", settings: st }, env);
    await checkPdf("mystery", i, files[0].bytes, st.trim, st.bleed, combo);
  } catch (e) {
    fail("mystery", i, `PDF threw: ${(e as Error).message}`, combo);
  }
}

async function main() {
  const tools = (process.env.TOOLS ?? "word-search,crossword,sudoku,mystery").split(",");
  const T0 = Date.now();
  for (const tool of tools) {
    const t = Date.now();
    for (let i = 1; i <= N; i++) {
      try {
        if (tool === "word-search") await wordSearch(i);
        else if (tool === "crossword") await crossword(i);
        else if (tool === "sudoku") await sudoku(i);
        else await mystery(i);
      } catch (e) {
        fail(tool, i, `threw: ${(e as Error).stack?.split("\n").slice(0, 3).join(" | ")}`, {});
      }
    }
    const s = stat(tool);
    console.log(`${tool}: ${s.combos} combos, ${s.pdfs} PDFs (${s.pages} pages), ${s.notes} notes, ${((Date.now() - t) / 1000).toFixed(0)}s`);
  }
  console.log(failures.length ? `\nFAILURES (${failures.length}):\n${failures.join("\n")}` : `\nAll rules hold (${((Date.now() - T0) / 1000).toFixed(0)}s).`);
  process.exit(failures.length ? 1 : 0);
}
void main();
