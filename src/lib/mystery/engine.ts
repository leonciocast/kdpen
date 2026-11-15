/**
 * Murder-mystery word search grids: every evidence word plus the missing
 * evidence is hidden once, and the cells left over spell the hidden message
 * exactly (read left to right, top to bottom).
 */
import {
  ALL_DIRECTIONS,
  autoPlace,
  buildLetterGrid,
  cellsOf,
  fillGrid,
  findOccurrences,
  gridForm,
  gsize,
  inBounds,
  longestLine,
  mulberry32,
  OUTSIDE,
  placementCells,
  type DirectionKey,
  type GridArg,
  type LetterGrid,
  type Placement,
  type Rng,
} from "../wordsearch/engine";
import { shapedGrid, type ShapeKey } from "../shapes/shapes";

/** A cell that is part of the grid but holds no letter (only when an exact fit was impossible). */
export const BLANK = "·";

export type Difficulty = "easy" | "medium" | "hard";

export function directionsFor(d: Difficulty): DirectionKey[] {
  if (d === "easy") return ["E", "S"];
  if (d === "medium") return ["E", "S", "SE", "NE"];
  return ALL_DIRECTIONS.slice();
}

export interface CaseGridInput {
  /** Words on the evidence list. */
  words: string[];
  /** Hidden but not listed (missing evidence). */
  extra?: string;
  /**
   * What the leftover cells must spell (letters only are used). Several
   * wordings of the same message can be given; the one that fits the grid
   * exactly wins.
   */
  message: string | string[];
  dirs: DirectionKey[];
  seed: number;
  shape?: ShapeKey;
  /** Smallest/largest grid side to try. */
  minSize?: number;
  maxSize?: number;
  /** Give up after this long (ms). */
  timeLimitMs?: number;
}

export interface CaseGrid {
  size: number;
  /** Mask for shaped grids (null = full square). */
  mask: boolean[][] | null;
  grid: string[][];
  /** Evidence placements, then the missing evidence (if any) last. */
  placements: Placement[];
  extra: Placement | null;
  /** Cells holding the message, in reading order. */
  messageCells: [number, number][];
  /** Dotted cells (no letter). */
  blanks: [number, number][];
  seed: number;
  /** The wording that was used (index into the input messages). */
  messageIndex: number;
  message: string;
}

export const messageLetters = (s: string) => gridForm(s).replace(/[^A-ZÑ]/g, "");

const key = (r: number, c: number) => `${r},${c}`;

/** Free (unused) cells of the grid in reading order. */
export function readingOrderFree(g: GridArg, grid: LetterGrid): [number, number][] {
  const n = gsize(g);
  const out: [number, number][] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (grid[r][c] === null) out.push([r, c]);
  return out;
}

function countCells(g: GridArg): number {
  const n = gsize(g);
  let k = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (inBounds(g, [r, c])) k++;
  return k;
}

/** Placements of `word` on top of `grid`, grouped by how many cells they reuse. */
function flexOptions(g: GridArg, grid: LetterGrid, word: string, dirs: DirectionKey[], rng: Rng): Map<number, Placement[]> {
  const n = gsize(g);
  const letters = gridForm(word);
  const byNew = new Map<number, Placement[]>();
  for (const dir of dirs) {
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const cells = cellsOf(r, c, dir, letters.length);
        if (!cells.every((cell) => inBounds(g, cell))) continue;
        let fresh = 0;
        let ok = true;
        for (let i = 0; i < cells.length; i++) {
          const v = grid[cells[i][0]][cells[i][1]];
          if (v === null) fresh++;
          else if (v !== letters[i]) {
            ok = false;
            break;
          }
        }
        if (!ok || fresh === 0) continue;
        const list = byNew.get(fresh) ?? [];
        list.push({ word, letters, row: r, col: c, dir });
        byNew.set(fresh, list);
      }
    }
  }
  for (const list of byNew.values()) list.sort(() => rng() - 0.5);
  return byNew;
}

function finish(g: GridArg, placements: Placement[], message: string, blanksAllowed: number): Omit<CaseGrid, "extra" | "seed" | "messageIndex" | "message"> | null {
  const base = buildLetterGrid(g, placements);
  const free = readingOrderFree(g, base);
  const extraCells = free.length - message.length;
  if (extraCells < 0 || extraCells > blanksAllowed) return null;
  const grid = base.map((row) => row.slice()) as string[][];
  const messageCells = free.slice(0, message.length);
  const blanks = free.slice(message.length);
  messageCells.forEach(([r, c], i) => (grid[r][c] = message[i]));
  blanks.forEach(([r, c]) => (grid[r][c] = BLANK));
  // Every hidden word must read exactly once in the finished grid.
  for (const p of placements) if (findOccurrences(grid, p.letters).length !== 1) return null;
  return { size: gsize(g), mask: typeof g === "number" ? null : g.mask, grid, placements, messageCells, blanks };
}

/**
 * Build one case grid. Tries grid sizes around the natural one; for each,
 * places all words but a "flex" word, then puts the flex word where the
 * number of free cells becomes exactly the message length. Falls back to the
 * closest fit with a few dotted blank cells.
 */
export function generateCaseGrid(input: CaseGridInput): CaseGrid {
  const wordings = (Array.isArray(input.message) ? input.message : [input.message]).map((m) => ({ text: m, letters: messageLetters(m) }));
  if (!wordings.length) wordings.push({ text: "", letters: "" });
  const shortest = Math.min(...wordings.map((w) => w.letters.length));
  const words = input.words.map((w) => w.trim()).filter((w) => gridForm(w).length > 0);
  const all = input.extra ? [...words, input.extra] : words.slice();
  if (all.length === 0) throw new Error("A case needs at least one evidence word.");
  const lengths = all.map((w) => gridForm(w).length);
  const letters = lengths.reduce((a, b) => a + b, 0);
  const longest = Math.max(...lengths);
  const minSize = Math.max(input.minSize ?? 6, longest);
  const maxSize = input.maxSize ?? 26;
  const shaped = !!input.shape && input.shape !== "square";
  const longestMsg = Math.max(...wordings.map((w) => w.letters.length));
  if (longestMsg === 0) return fillerCase(input, all, words, letters, longest, minSize, maxSize, shaped);
  // Cells the grid needs: at least the word letters (with some overlap) plus the shortest
  // message, and not so many that the leftover letters can't be filled by the longest one.
  const fewest = shortest + Math.ceil(letters * 0.55);
  const most = letters + longestMsg + 14;
  const sizes: number[] = [];
  for (let n = minSize; n <= maxSize && sizes.length < (shaped ? 10 : 5); n++) {
    const g = shapedGrid(n, input.shape) as GridArg;
    const cells = countCells(g);
    if (cells < fewest || longestLine(g) < longest) continue;
    if (cells > most && sizes.length) break;
    sizes.push(n);
  }
  if (!sizes.length) throw new Error("Couldn't fit this case's words and message into a grid. Try fewer or shorter words.");
  // Roughly the natural size first, then the others nearest to it.
  const ideal = Math.sqrt(letters * 0.85 + shortest);
  const natural = sizes.find((n) => countCells(shapedGrid(n, input.shape) as GridArg) >= ideal * ideal) ?? sizes[0];
  sizes.sort((a, b) => Math.abs(a - natural) - Math.abs(b - natural) || a - b);
  const t0 = Date.now();
  const limit = input.timeLimitMs ?? (shaped ? 2500 : 4000);
  const rng = mulberry32(input.seed);
  let fallback: CaseGrid | null = null;

  // Flex candidates: short-to-medium listed words (the missing evidence stays put).
  const flexPool = words
    .map((w, i) => ({ w, i, len: gridForm(w).length }))
    .filter((x) => x.len >= 3)
    .sort((a, b) => a.len - b.len);

  for (const blanksAllowed of [12, 400]) {
    // Most of the time goes to exact fits; the rest to the "a few dotted squares" rescue.
    const deadline = t0 + limit * (blanksAllowed === 12 ? 0.7 : 1);
    for (const n of sizes) {
      if (Date.now() > deadline) break;
      const g = shapedGrid(n, input.shape) as GridArg;
      const cells = countCells(g);
      for (let attempt = 0; attempt < 10 && Date.now() <= deadline; attempt++) {
        const flex = flexPool.length ? flexPool[Math.floor(rng() * Math.min(flexPool.length, 4))] : null;
        const rest = flex ? all.filter((_, i) => i !== flex.i) : all;
        // Overlaps free up cells: share letters when the grid is tight, avoid it when roomy.
        const spare = cells - letters - shortest;
        const placed = autoPlace(g, [], rest, input.dirs, rng, { overlapWeight: spare > 0 ? -0.6 : 0.8, timeLimitMs: 250, maxSteps: 4000 });
        if (placed.unplaced.length) continue;
        const tryFinish = (ps: Placement[], b: number) => {
          for (let wi = 0; wi < wordings.length; wi++) {
            const done = finish(g, orderPlacements(ps, words, input.extra), wordings[wi].letters, b);
            if (done) return { ...done, ...split(done.placements, input.extra), seed: input.seed, messageIndex: wi, message: wordings[wi].text };
          }
          return null;
        };
        if (!flex) {
          for (let b = 0; b <= blanksAllowed; b++) {
            const out = tryFinish(placed.placements, b);
            if (out && b === 0) return out;
            if (out && (!fallback || out.blanks.length < fallback.blanks.length)) fallback = out;
            if (out) break;
          }
          continue;
        }
        const grid = buildLetterGrid(g, placed.placements);
        const free = readingOrderFree(g, grid).length;
        const opts = flexOptions(g, grid, flex.w, input.dirs, rng);
        // Prefer an exact fit (any wording), then the fewest blanks.
        let found = false;
        for (let b = 0; b <= blanksAllowed && !found; b++) {
          for (let wi = 0; wi < wordings.length && !found; wi++) {
            const need = free - wordings[wi].letters.length - b;
            for (const p of (opts.get(need) ?? []).slice(0, 12)) {
              const done = finish(g, orderPlacements([...placed.placements, p], words, input.extra), wordings[wi].letters, b);
              if (!done) continue;
              const out: CaseGrid = { ...done, ...split(done.placements, input.extra), seed: input.seed, messageIndex: wi, message: wordings[wi].text };
              if (b === 0) return out;
              if (!fallback || out.blanks.length < fallback.blanks.length) fallback = out;
              found = true;
              break;
            }
          }
        }
      }
    }
    if (fallback) return fallback;
  }
  throw new Error("Couldn't fit this case's words and message into a grid. Try fewer or shorter words.");
}

/**
 * No hidden message: a normal word search. Every word (and the missing evidence) is
 * hidden once and the other cells get random letters that don't spell a second copy.
 */
function fillerCase(input: CaseGridInput, all: string[], words: string[], letters: number, longest: number, minSize: number, maxSize: number, shaped: boolean): CaseGrid {
  const rng = mulberry32(input.seed);
  const t0 = Date.now();
  const limit = input.timeLimitMs ?? (shaped ? 2500 : 4000);
  // Roomy enough to place everything comfortably, like a classic puzzle.
  for (let n = minSize; n <= maxSize && Date.now() - t0 < limit; n++) {
    const g = shapedGrid(n, input.shape) as GridArg;
    if (longestLine(g) < longest || countCells(g) < letters * 1.25) continue;
    for (let attempt = 0; attempt < 4 && Date.now() - t0 < limit; attempt++) {
      const placed = autoPlace(g, [], all, input.dirs, rng, { overlapWeight: 0.2, timeLimitMs: 250, maxSteps: 4000 });
      if (placed.unplaced.length) continue;
      const ps = orderPlacements(placed.placements, words, input.extra);
      const filled = fillGrid(g, ps, rng);
      const grid = filled.grid.map((row) => row.slice());
      if (!ps.every((p) => findOccurrences(grid as LetterGrid, p.letters).length === 1)) continue;
      return { size: gsize(g), mask: typeof g === "number" ? null : g.mask, grid, ...split(ps, input.extra), messageCells: [], blanks: [], seed: input.seed, messageIndex: 0, message: "" };
    }
  }
  throw new Error("Couldn't fit this case's words into a grid. Try fewer or shorter words.");
}

function orderPlacements(ps: Placement[], words: string[], extra?: string): Placement[] {
  const pos = (w: string) => (extra !== undefined && w === extra ? words.length : words.indexOf(w));
  return ps.slice().sort((a, b) => pos(a.word) - pos(b.word));
}

function split(ps: Placement[], extra?: string): { placements: Placement[]; extra: Placement | null } {
  if (!extra) return { placements: ps, extra: null };
  const i = ps.findIndex((p) => p.word === extra);
  return { placements: ps.filter((_, j) => j !== i), extra: i >= 0 ? ps[i] : null };
}

// ---------------------------------------------------------------- validation

export interface GridCheck {
  ok: boolean;
  problems: string[];
  /** Letters left over after crossing out every hidden word, in reading order. */
  leftover: string;
}

/**
 * Independent check of a finished grid: finds each word from scratch
 * (exactly once), crosses it out, and reads what is left.
 */
export function checkCaseGrid(grid: string[][], words: string[], extra: string | undefined, message: string): GridCheck {
  const problems: string[] = [];
  const used = new Set<string>();
  for (const w of extra ? [...words, extra] : words) {
    const occ = findOccurrences(grid as LetterGrid, gridForm(w));
    if (occ.length !== 1) problems.push(`${w} is found ${occ.length} times.`);
    occ.slice(0, 1).forEach((o) => placementCells({ word: w, letters: gridForm(w), row: o.row, col: o.col, dir: o.dir }).forEach(([r, c]) => used.add(key(r, c))));
  }
  let leftover = "";
  grid.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v === OUTSIDE || v === BLANK || used.has(key(r, c))) return;
      leftover += v;
    }),
  );
  const want = messageLetters(message);
  // No hidden message: the leftover cells are ordinary filler letters.
  if (want && leftover !== want) problems.push(`Leftover letters read "${leftover}", expected "${want}".`);
  return { ok: problems.length === 0, problems, leftover };
}
