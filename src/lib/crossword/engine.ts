/** Pure crossword layout engine: free-form, connected, numbered. Always terminates. */
import { Rng, mulberry32 } from "../wordsearch/engine";
import { tidySpaces } from "../text";
import { LIMITS } from "../limits";
import { Mask, ShapeKey, isSquare, longestRun, maskBox, maskCells, shapeMask } from "../shapes/shapes";

export interface ClueEntry {
  answer: string; // as typed (uppercase); spaces/hyphens allowed
  clue: string;
  /** Optional theme / section from the CSV's 3rd column. */
  theme?: string;
}

export interface CwPlacement {
  answer: string;
  letters: string;
  clue: string;
  row: number;
  col: number;
  across: boolean;
  number: number;
}

export interface Crossword {
  width: number;
  height: number;
  grid: (string | null)[][];
  placements: CwPlacement[];
  leftOut: string[];
  /** Shaped crosswords: the shape, its square canvas size and where the grid's (0,0) sits on that canvas. */
  shape?: ShapeKey;
  canvas?: number;
  offset?: [number, number];
}

export const CROSSWORD_MAX_WORDS = LIMITS.maxClues;
export const CROSSWORD_MAX_LETTERS = 15;
const VALID = /^[A-Za-z0-9Ññ -]+$/;
const SEPARATORS = ["\t", " - ", " – ", " — ", ":", "|", "=", ","];

export const cwLetters = (answer: string) => answer.toUpperCase().replace(/[\s-]/g, "");

/** "LION - King of the jungle", "LION: King…", or the legacy "LION-King…". */
export function parseClueLine(line: string): { answer: string; clue: string } | { error: string } {
  const text = line.trim();
  if (!text) return { error: "empty" };
  let idx = -1;
  let sepLen = 0;
  for (const sep of SEPARATORS) {
    const i = text.indexOf(sep);
    if (i > 0) {
      idx = i;
      sepLen = sep.length;
      break;
    }
  }
  if (idx < 0) {
    const i = text.indexOf("-");
    if (i > 0) {
      idx = i;
      sepLen = 1;
    }
  }
  if (idx < 0) return { error: `"${text}" needs a clue. Write it as WORD - clue.` };
  const answer = tidySpaces(text.slice(0, idx)).toUpperCase();
  const clue = tidySpaces(text.slice(idx + sepLen));
  if (!answer || !clue) return { error: `"${text}" needs both a word and a clue.` };
  return { answer, clue };
}

export interface ClueParseResult {
  added: ClueEntry[];
  errors: string[];
  skipped: string[];
  limitReached: boolean;
}

export function validateEntries(candidates: { answer: string; clue: string; theme?: string }[], existing: ClueEntry[], max = CROSSWORD_MAX_WORDS): ClueParseResult {
  const res: ClueParseResult = { added: [], errors: [], skipped: [], limitReached: false };
  const seen = new Set(existing.map((e) => cwLetters(e.answer)));
  for (const { answer, clue, theme } of candidates) {
    const letters = cwLetters(answer);
    if (!VALID.test(answer)) {
      res.errors.push(`"${answer}" has characters that can't go in a grid. Use letters, numbers, Ñ, spaces or hyphens.`);
      continue;
    }
    if (letters.length < 2) {
      res.errors.push(`"${answer}" is too short (at least 2 letters).`);
      continue;
    }
    if (letters.length > CROSSWORD_MAX_LETTERS) {
      res.errors.push(`"${answer}" is longer than ${CROSSWORD_MAX_LETTERS} letters.`);
      continue;
    }
    if (/(.)\1{3}/.test(letters)) {
      res.skipped.push(`"${answer}" repeats a character 4 or more times and was skipped.`);
      continue;
    }
    if (seen.has(letters)) {
      res.skipped.push(`"${answer}" is already in your list.`);
      continue;
    }
    if (existing.length + res.added.length >= max) {
      res.limitReached = true;
      break;
    }
    seen.add(letters);
    res.added.push(theme ? { answer, clue: clue.trim(), theme } : { answer, clue: clue.trim() });
  }
  return res;
}

// ---------------------------------------------------------------- layout

interface Placed {
  entry: ClueEntry;
  letters: string;
  row: number;
  col: number;
  across: boolean;
}

class Board {
  cells = new Map<string, string>();
  dirs = new Map<string, { a: boolean; d: boolean }>();
  minR = 0;
  maxR = 0;
  minC = 0;
  maxC = 0;
  placed: Placed[] = [];
  /** Shaped layout: every letter must land on a used cell of this mask. */
  constructor(public mask: Mask | null = null) {}

  get(r: number, c: number) {
    return this.cells.get(`${r},${c}`);
  }

  /** Number of crossings if valid, else -1. */
  check(letters: string, row: number, col: number, across: boolean): number {
    const dr = across ? 0 : 1;
    const dc = across ? 1 : 0;
    if (this.get(row - dr, col - dc) !== undefined) return -1;
    if (this.get(row + dr * letters.length, col + dc * letters.length) !== undefined) return -1;
    let crossings = 0;
    const m = this.mask;
    for (let i = 0; i < letters.length; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (m && !m[r]?.[c]) return -1;
      const existing = this.get(r, c);
      if (existing !== undefined) {
        if (existing !== letters[i]) return -1;
        const d = this.dirs.get(`${r},${c}`)!;
        if ((across && d.a) || (!across && d.d)) return -1;
        crossings++;
      } else {
        // Side neighbours must be empty so no accidental words form.
        if (this.get(r + dc, c + dr) !== undefined || this.get(r - dc, c - dr) !== undefined) return -1;
      }
    }
    if (crossings === letters.length) return -1;
    return crossings;
  }

  place(entry: ClueEntry, letters: string, row: number, col: number, across: boolean) {
    const dr = across ? 0 : 1;
    const dc = across ? 1 : 0;
    for (let i = 0; i < letters.length; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      const key = `${r},${c}`;
      this.cells.set(key, letters[i]);
      const d = this.dirs.get(key) ?? { a: false, d: false };
      if (across) d.a = true;
      else d.d = true;
      this.dirs.set(key, d);
      this.minR = Math.min(this.minR, r);
      this.maxR = Math.max(this.maxR, r);
      this.minC = Math.min(this.minC, c);
      this.maxC = Math.max(this.maxC, c);
    }
    this.placed.push({ entry, letters, row, col, across });
  }

  area(extraR = 0, extraC = 0) {
    return (this.maxR - this.minR + 1 + extraR) * (this.maxC - this.minC + 1 + extraC);
  }
}

function bestSpot(board: Board, letters: string, rng: Rng) {
  let best: { row: number; col: number; across: boolean; score: number } | null = null;
  for (const [key, ch] of Array.from(board.cells.entries())) {
    const [r, c] = key.split(",").map(Number);
    for (let i = 0; i < letters.length; i++) {
      if (letters[i] !== ch) continue;
      for (const across of [true, false]) {
        const row = across ? r : r - i;
        const col = across ? c - i : c;
        const crossings = board.check(letters, row, col, across);
        if (crossings < 1) continue;
        const endR = across ? row : row + letters.length - 1;
        const endC = across ? col + letters.length - 1 : col;
        const h = Math.max(board.maxR, endR) - Math.min(board.minR, row) + 1;
        const w = Math.max(board.maxC, endC) - Math.min(board.minC, col) + 1;
        // Prefer crossings, compact and roughly square layouts.
        const score = board.mask ? crossings * 12 - (h * w) / 18 + rng() * 3 : crossings * 12 - (h * w) / 8 - Math.abs(h - w) * 0.8 + rng() * 3;
        if (!best || score > best.score) best = { row, col, across, score };
      }
    }
  }
  return best;
}

function layoutOnce(entries: ClueEntry[], rng: Rng, mask: Mask | null = null): Board {
  const board = new Board(mask);
  const order = entries
    .map((e) => ({ e, letters: cwLetters(e.answer), k: rng() }))
    .sort((a, b) => b.letters.length - a.letters.length + (a.k - b.k) * 1.5);
  const [first, ...rest] = order;
  if (!first) return board;
  if (mask) {
    // Start in the middle of the shape, on the row/column closest to the centre where the word fits.
    const n = mask.length;
    const across = rng() < 0.5;
    let spot: [number, number] | null = null;
    let bestD = Infinity;
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        if (board.check(first.letters, r, c, across) < 0) continue;
        const mr = across ? r : r + (first.letters.length - 1) / 2;
        const mc = across ? c + (first.letters.length - 1) / 2 : c;
        const d = (mr - (n - 1) / 2) ** 2 + (mc - (n - 1) / 2) ** 2;
        if (d < bestD) {
          bestD = d;
          spot = [r, c];
        }
      }
    if (!spot) return board;
    board.place(first.e, first.letters, spot[0], spot[1], across);
  } else board.place(first.e, first.letters, 0, 0, rng() < 0.5);
  let pending = rest;
  for (let pass = 0; pass < 4 && pending.length; pass++) {
    const next: typeof pending = [];
    for (const item of pending) {
      const spot = bestSpot(board, item.letters, rng);
      if (spot) board.place(item.e, item.letters, spot.row, spot.col, spot.across);
      else next.push(item);
    }
    if (next.length === pending.length) break;
    pending = next;
  }
  return board;
}

/** Lay out a connected crossword; words that cannot connect are returned in leftOut. */
export function generateCrossword(entries: ClueEntry[], rng: Rng = mulberry32(Date.now() & 0xffff), attempts = 40, shape?: ShapeKey): Crossword {
  if (!isSquare(shape)) return generateShapedCrossword(entries, rng, shape!, attempts);
  return layoutCrossword(entries, rng, attempts, null);
}

/** Smallest canvas whose shape has room for these words, then grow until every word connects. */
export function generateShapedCrossword(entries: ClueEntry[], rng: Rng, shape: ShapeKey, attempts = 30): Crossword {
  const lens = entries.map((e) => cwLetters(e.answer).length);
  const letters = lens.reduce((a, b) => a + b, 0);
  const longest = Math.max(2, ...lens);
  let n = Math.max(7, longest);
  while (n < LIMITS.maxShapeGridSize) {
    const m = shapeMask(shape, n);
    if (maskCells(m, n) >= letters * 1.7 && longestRun(m, n) >= longest) break;
    n++;
  }
  let best: Crossword | null = null;
  let stale = 0;
  for (let k = 0; k < 8 && n <= LIMITS.maxShapeGridSize; k++, n++) {
    const cw = layoutCrossword(entries, rng, attempts, { shape, n });
    if (!best || cw.leftOut.length < best.leftOut.length) {
      best = cw;
      stale = 0;
    } else stale++;
    // Stop when every word is in, or growing stopped helping (some words share no letters with the rest).
    if (!cw.leftOut.length || stale >= 3) break;
  }
  return best!;
}

function layoutCrossword(entries: ClueEntry[], rng: Rng, attempts: number, shaped: { shape: ShapeKey; n: number } | null): Crossword {
  const mask = shaped ? shapeMask(shaped.shape, shaped.n) : null;
  let best: Board | null = null;
  for (let i = 0; i < attempts; i++) {
    const b = layoutOnce(entries, rng, mask);
    if (!best || b.placed.length > best.placed.length || (b.placed.length === best.placed.length && b.area() < best.area())) best = b;
    if (best.placed.length === entries.length && i >= 10) break;
  }
  const board = best ?? new Board();
  if (mask && shaped) {
    // Shaped: keep the whole shape (not just the words' box) so the outline lines up.
    const [r0, c0, r1, c1] = maskBox(mask, shaped.n);
    board.minR = r0;
    board.minC = c0;
    board.maxR = r1;
    board.maxC = c1;
  }
  const height = board.placed.length ? board.maxR - board.minR + 1 : 0;
  const width = board.placed.length ? board.maxC - board.minC + 1 : 0;
  const grid: (string | null)[][] = Array.from({ length: height }, () => Array<string | null>(width).fill(null));
  board.cells.forEach((ch, key) => {
    const [r, c] = key.split(",").map(Number);
    grid[r - board.minR][c - board.minC] = ch;
  });
  // Number start cells in reading order.
  const starts = board.placed
    .map((p) => ({ p, row: p.row - board.minR, col: p.col - board.minC }))
    .sort((a, b) => a.row - b.row || a.col - b.col);
  const numbers = new Map<string, number>();
  let n = 0;
  for (const s of starts) {
    const key = `${s.row},${s.col}`;
    if (!numbers.has(key)) numbers.set(key, ++n);
  }
  const placements: CwPlacement[] = starts.map(({ p, row, col }) => ({
    answer: p.entry.answer,
    letters: p.letters,
    clue: p.entry.clue,
    row,
    col,
    across: p.across,
    number: numbers.get(`${row},${col}`)!,
  }));
  const placedSet = new Set(board.placed.map((p) => p.entry.answer));
  const leftOut = entries.filter((e) => !placedSet.has(e.answer)).map((e) => e.answer);
  if (mask && shaped) return { width, height, grid, placements, leftOut, shape: shaped.shape, canvas: shaped.n, offset: [board.minR, board.minC] };
  return { width, height, grid, placements, leftOut };
}

export function cellNumbers(cw: Crossword): Map<string, number> {
  const m = new Map<string, number>();
  cw.placements.forEach((p) => m.set(`${p.row},${p.col}`, p.number));
  return m;
}

export function clueLists(cw: Crossword) {
  const sort = (a: CwPlacement, b: CwPlacement) => a.number - b.number;
  return {
    across: cw.placements.filter((p) => p.across).sort(sort),
    down: cw.placements.filter((p) => !p.across).sort(sort),
  };
}

export function chunkEntries<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += Math.max(1, n)) out.push(arr.slice(i, i + Math.max(1, n)));
  return out;
}
