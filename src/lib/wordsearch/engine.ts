/**
 * Pure word search placement engine (no React / DOM).
 *
 * Coordinates are (row, col) with row 0 at the top. A placement is a word
 * written from its start cell in one of eight directions.
 */

export type DirectionKey = "E" | "W" | "S" | "N" | "SE" | "NW" | "NE" | "SW";

export interface Direction {
  key: DirectionKey;
  dr: number;
  dc: number;
  label: string;
}

export const DIRECTIONS: Record<DirectionKey, Direction> = {
  E: { key: "E", dr: 0, dc: 1, label: "Horizontal →" },
  W: { key: "W", dr: 0, dc: -1, label: "Horizontal ← (reversed)" },
  S: { key: "S", dr: 1, dc: 0, label: "Vertical ↓" },
  N: { key: "N", dr: -1, dc: 0, label: "Vertical ↑ (reversed)" },
  SE: { key: "SE", dr: 1, dc: 1, label: "Diagonal ↘ (top-left to bottom-right)" },
  NW: { key: "NW", dr: -1, dc: -1, label: "Diagonal ↖ (reversed)" },
  NE: { key: "NE", dr: -1, dc: 1, label: "Diagonal ↗ (bottom-left to top-right)" },
  SW: { key: "SW", dr: 1, dc: -1, label: "Diagonal ↙ (reversed)" },
};

export const ALL_DIRECTIONS: DirectionKey[] = ["E", "S", "SE", "NE", "W", "N", "NW", "SW"];

export interface DirectionOptions {
  horizontal: boolean;
  vertical: boolean;
  diagonalDown: boolean; // top-left to bottom-right
  diagonalUp: boolean; // bottom-left to top-right
  reversed: boolean; // also allow each enabled direction backwards
}

export const MIN_GRID_SIZE = 8;
export const MAX_GRID_SIZE = 30;

export function allowedDirections(opts: DirectionOptions): DirectionKey[] {
  const out: DirectionKey[] = [];
  if (opts.horizontal) out.push("E");
  if (opts.vertical) out.push("S");
  if (opts.diagonalDown) out.push("SE");
  if (opts.diagonalUp) out.push("NE");
  if (opts.reversed) {
    if (opts.horizontal) out.push("W");
    if (opts.vertical) out.push("N");
    if (opts.diagonalDown) out.push("NW");
    if (opts.diagonalUp) out.push("SW");
  }
  return out;
}

export interface Placement {
  /** The word as shown in the word list (e.g. "T-REX"). */
  word: string;
  /** Letters actually written into the grid (e.g. "TREX"). */
  letters: string;
  row: number;
  col: number;
  dir: DirectionKey;
}

export type Cell = [number, number];
export type LetterGrid = (string | null)[][];

/** Letters that go into the grid: uppercase, spaces and hyphens removed. */
export function gridForm(word: string): string {
  return word.toUpperCase().replace(/[\s-]/g, "");
}

export function cellsOf(row: number, col: number, dir: DirectionKey, length: number): Cell[] {
  const d = DIRECTIONS[dir];
  const cells: Cell[] = [];
  for (let i = 0; i < length; i++) cells.push([row + d.dr * i, col + d.dc * i]);
  return cells;
}

export function placementCells(p: Placement): Cell[] {
  return cellsOf(p.row, p.col, p.dir, p.letters.length);
}

export function placementEnd(p: Placement): Cell {
  const cells = placementCells(p);
  return cells[cells.length - 1];
}

export function inBounds(size: number, [r, c]: Cell): boolean {
  return r >= 0 && c >= 0 && r < size && c < size;
}

export function emptyGrid(size: number): LetterGrid {
  return Array.from({ length: size }, () => Array<string | null>(size).fill(null));
}

export function buildLetterGrid(size: number, placements: Placement[]): LetterGrid {
  const grid = emptyGrid(size);
  for (const p of placements) {
    placementCells(p).forEach(([r, c], i) => {
      if (inBounds(size, [r, c])) grid[r][c] = p.letters[i];
    });
  }
  return grid;
}

export function makePlacement(word: string, row: number, col: number, dir: DirectionKey): Placement {
  return { word, letters: gridForm(word), row, col, dir };
}

function cellKey(cells: Cell[]): string {
  return cells
    .map(([r, c]) => `${r},${c}`)
    .sort()
    .join("|");
}

export type PlacementProblem = "empty" | "out-of-bounds" | "conflict" | "same-cells";

export interface PlacementCheck {
  ok: boolean;
  reason?: PlacementProblem;
  message?: string;
  conflictAt?: Cell;
}

/**
 * Validate a candidate against existing placements: it must stay inside the
 * grid, and any overlap must share the same letter. A candidate covering the
 * exact same cells as another word (e.g. PAT over TAP) is rejected.
 */
export function checkPlacement(
  size: number,
  placements: Placement[],
  candidate: Placement,
  grid?: LetterGrid
): PlacementCheck {
  if (candidate.letters.length === 0) return { ok: false, reason: "empty", message: "Word has no letters." };
  const cells = placementCells(candidate);
  for (const cell of cells) {
    if (!inBounds(size, cell)) {
      return {
        ok: false,
        reason: "out-of-bounds",
        message: `"${candidate.word}" does not fit there: it runs off the grid.`,
      };
    }
  }
  const letters = grid ?? buildLetterGrid(size, placements);
  for (let i = 0; i < cells.length; i++) {
    const [r, c] = cells[i];
    const existing = letters[r][c];
    if (existing !== null && existing !== candidate.letters[i]) {
      return {
        ok: false,
        reason: "conflict",
        conflictAt: [r, c],
        message: `"${candidate.word}" conflicts with letter ${existing} at row ${r + 1}, column ${c + 1}.`,
      };
    }
  }
  const key = cellKey(cells);
  for (const p of placements) {
    if (p.letters.length === candidate.letters.length && cellKey(placementCells(p)) === key) {
      return {
        ok: false,
        reason: "same-cells",
        message: `"${candidate.word}" would sit exactly on top of "${p.word}".`,
      };
    }
  }
  return { ok: true };
}

/** Direction and length of a straight line from start to end, or null. */
export function lineBetween(start: Cell, end: Cell): { dir: DirectionKey; length: number } | null {
  const dr = end[0] - start[0];
  const dc = end[1] - start[1];
  if (dr === 0 && dc === 0) return null;
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;
  const sr = Math.sign(dr);
  const sc = Math.sign(dc);
  const dir = ALL_DIRECTIONS.find((k) => DIRECTIONS[k].dr === sr && DIRECTIONS[k].dc === sc)!;
  return { dir, length: Math.max(Math.abs(dr), Math.abs(dc)) + 1 };
}

// ---------------------------------------------------------------- random

export type Rng = () => number;

/** Small seeded PRNG so puzzles (and tests) are reproducible. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------- search

export interface Occurrence {
  row: number;
  col: number;
  dir: DirectionKey;
}

/**
 * Every place `letters` can be read in the grid, in all eight directions.
 * Palindromes read both ways over the same cells count once.
 */
export function findOccurrences(grid: LetterGrid, letters: string): Occurrence[] {
  const size = grid.length;
  const found: Occurrence[] = [];
  const seen = new Set<string>();
  if (!letters) return found;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] !== letters[0]) continue;
      for (const dir of ALL_DIRECTIONS) {
        const d = DIRECTIONS[dir];
        const er = r + d.dr * (letters.length - 1);
        const ec = c + d.dc * (letters.length - 1);
        if (er < 0 || ec < 0 || er >= size || ec >= size) continue;
        let match = true;
        for (let i = 1; i < letters.length; i++) {
          if (grid[r + d.dr * i][c + d.dc * i] !== letters[i]) {
            match = false;
            break;
          }
        }
        if (!match) continue;
        const key = cellKey(cellsOf(r, c, dir, letters.length));
        if (seen.has(key)) continue;
        seen.add(key);
        found.push({ row: r, col: c, dir });
      }
    }
  }
  return found;
}

export interface WordCount {
  word: string;
  count: number;
}

/** How many times each placed word can be found in a grid (1 = solvable & unambiguous). */
export function countWords(grid: LetterGrid, placements: Placement[]): WordCount[] {
  return placements.map((p) => ({ word: p.word, count: findOccurrences(grid, p.letters).length }));
}

/** Pairs where one word's letters are contained in another (forward or reversed). */
export function containedWordWarnings(words: string[]): string[] {
  const forms = words.map(gridForm);
  const warnings: string[] = [];
  for (let i = 0; i < forms.length; i++) {
    for (let j = 0; j < forms.length; j++) {
      if (i === j || forms[i].length >= forms[j].length) continue;
      const rev = forms[i].split("").reverse().join("");
      if (forms[j].includes(forms[i]) || forms[j].includes(rev)) {
        warnings.push(`"${words[i]}" is hidden inside "${words[j]}", so it can appear more than once.`);
      }
    }
  }
  return warnings;
}

// ---------------------------------------------------------------- auto placement

export interface AutoPlaceOptions {
  /** Max search nodes before giving up on a full solution. */
  maxSteps?: number;
  /** Wall-clock budget in ms. */
  timeLimitMs?: number;
  /** Candidate positions tried per word during backtracking. */
  branchLimit?: number;
  /** Preference for sharing letters: negative avoids overlaps, positive seeks them. Default 0.15. */
  overlapWeight?: number;
}

export interface AutoPlaceResult {
  placements: Placement[];
  unplaced: string[];
}

function candidatesFor(
  size: number,
  word: string,
  dirs: DirectionKey[],
  placements: Placement[],
  grid: LetterGrid,
  rng: Rng,
  overlapWeight = 0.15
): Placement[] {
  const letters = gridForm(word);
  const out: { p: Placement; score: number }[] = [];
  for (const dir of dirs) {
    const d = DIRECTIONS[dir];
    for (let r = 0; r < size; r++) {
      const er = r + d.dr * (letters.length - 1);
      if (er < 0 || er >= size) continue;
      for (let c = 0; c < size; c++) {
        const ec = c + d.dc * (letters.length - 1);
        if (ec < 0 || ec >= size) continue;
        let ok = true;
        let overlaps = 0;
        for (let i = 0; i < letters.length; i++) {
          const g = grid[r + d.dr * i][c + d.dc * i];
          if (g !== null) {
            if (g !== letters[i]) {
              ok = false;
              break;
            }
            overlaps++;
          }
        }
        if (!ok || overlaps === letters.length) continue;
        const p: Placement = { word, letters, row: r, col: c, dir };
        // Small random score with a mild preference for sharing letters.
        out.push({ p, score: rng() + overlaps * overlapWeight });
      }
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out.map((o) => o.p);
}

function applyToGrid(grid: LetterGrid, p: Placement): Cell[] {
  const written: Cell[] = [];
  placementCells(p).forEach(([r, c], i) => {
    if (grid[r][c] === null) {
      grid[r][c] = p.letters[i];
      written.push([r, c]);
    }
  });
  return written;
}

function hasPlacedDuplicates(grid: LetterGrid, placements: Placement[]): boolean {
  return placements.some((p) => findOccurrences(grid, p.letters).length > 1);
}

/**
 * Place `words` around the `fixed` placements (which are never moved) using
 * bounded backtracking. Always terminates; words that cannot fit are
 * returned in `unplaced`.
 */
export function autoPlace(
  size: number,
  fixed: Placement[],
  words: string[],
  dirs: DirectionKey[],
  rng: Rng,
  opts: AutoPlaceOptions = {}
): AutoPlaceResult {
  const maxSteps = opts.maxSteps ?? 20000;
  const timeLimit = opts.timeLimitMs ?? 1500;
  const branchLimit = opts.branchLimit ?? 30;
  const deadline = Date.now() + timeLimit;

  const tooLong: string[] = [];
  const pending: string[] = [];
  for (const w of words) {
    const len = gridForm(w).length;
    if (len === 0 || len > size || dirs.length === 0) tooLong.push(w);
    else pending.push(w);
  }
  // Longest words first: they are the hardest to fit.
  const order = shuffle(pending, rng).sort((a, b) => gridForm(b).length - gridForm(a).length);

  const grid = buildLetterGrid(size, fixed);
  const placed: Placement[] = [];
  let steps = 0;
  const outOfBudget = () => steps >= maxSteps || Date.now() > deadline;

  const dfs = (i: number): boolean => {
    if (i === order.length) return true;
    if (outOfBudget()) return false;
    const cands = candidatesFor(size, order[i], dirs, [...fixed, ...placed], grid, rng, opts.overlapWeight).slice(0, branchLimit);
    for (const cand of cands) {
      steps++;
      const written = applyToGrid(grid, cand);
      placed.push(cand);
      if (dfs(i + 1)) return true;
      placed.pop();
      for (const [r, c] of written) grid[r][c] = null;
      if (outOfBudget()) return false;
    }
    return false;
  };

  if (order.length > 0 && dfs(0)) {
    return { placements: placed.slice(), unplaced: tooLong };
  }

  // Backtracking could not place everything within budget: best of a few
  // greedy passes, so the user still gets a puzzle plus a list of misfits.
  let best: AutoPlaceResult = { placements: [], unplaced: [...tooLong, ...order] };
  for (let attempt = 0; attempt < 8; attempt++) {
    const g = buildLetterGrid(size, fixed);
    const ps: Placement[] = [];
    const miss: string[] = [];
    const attemptOrder = attempt === 0 ? order : shuffle(order, rng).sort((a, b) => gridForm(b).length - gridForm(a).length);
    for (const w of attemptOrder) {
      const cand = candidatesFor(size, w, dirs, [...fixed, ...ps], g, rng, opts.overlapWeight)[0];
      if (cand) {
        applyToGrid(g, cand);
        ps.push(cand);
      } else miss.push(w);
    }
    if (ps.length > best.placements.length) best = { placements: ps, unplaced: [...tooLong, ...miss] };
    if (miss.length === 0) break;
  }
  return best;
}

// ---------------------------------------------------------------- filling

export const BASE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** A–Z plus any other characters (Ñ, digits) used by the words, so they are not giveaways. */
export function fillAlphabet(placements: Placement[]): string {
  const extra = new Set<string>();
  for (const p of placements) for (const ch of p.letters) if (!BASE_ALPHABET.includes(ch)) extra.add(ch);
  return BASE_ALPHABET + Array.from(extra).join("");
}

export interface FillResult {
  grid: string[][];
  warnings: string[];
}

export type DecoyLevel = "none" | "letters" | "fragments";

/**
 * Fill every empty cell with a random letter, re-rolling filler cells that
 * would create an extra copy of any listed word.
 * Decoys make puzzles harder: "letters" draws filler mostly from the words'
 * own letters; "fragments" also plants partial words (e.g. "ELEPH").
 */
export function fillGrid(size: number, placements: Placement[], rng: Rng, maxRounds = 300, decoys: DecoyLevel = "none"): FillResult {
  const base = buildLetterGrid(size, placements);
  const alphabet = fillAlphabet(placements);
  const grid: LetterGrid = base.map((row) => row.slice());
  const isFiller = base.map((row) => row.map((v) => v === null));
  const wordLetters = placements.map((p) => p.letters).join("");
  const roll =
    decoys === "none" || !wordLetters
      ? () => alphabet[Math.floor(rng() * alphabet.length)]
      : () => (rng() < 0.65 ? wordLetters[Math.floor(rng() * wordLetters.length)] : alphabet[Math.floor(rng() * alphabet.length)]);
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (isFiller[r][c]) grid[r][c] = roll();
  if (decoys === "fragments") {
    // Plant partial words into filler-only lines; the re-roll pass below removes any accidental full copies.
    const tries = placements.length * 3;
    for (let t = 0; t < tries; t++) {
      const p = placements[Math.floor(rng() * placements.length)];
      if (p.letters.length < 4) continue;
      const frag = p.letters.slice(0, Math.max(2, p.letters.length - 1 - Math.floor(rng() * 2)));
      const dir = ALL_DIRECTIONS[Math.floor(rng() * ALL_DIRECTIONS.length)];
      const r0 = Math.floor(rng() * size);
      const c0 = Math.floor(rng() * size);
      const cells = cellsOf(r0, c0, dir, frag.length);
      if (cells.every((cell) => inBounds(size, cell) && isFiller[cell[0]][cell[1]])) cells.forEach(([r, c], i) => (grid[r][c] = frag[i]));
    }
  }

  const warnings = new Set<string>();
  for (let round = 0; round < maxRounds; round++) {
    const reroll = new Set<string>();
    for (const p of placements) {
      const own = cellKey(placementCells(p));
      for (const occ of findOccurrences(grid, p.letters)) {
        const cells = cellsOf(occ.row, occ.col, occ.dir, p.letters.length);
        if (cellKey(cells) === own) continue;
        const fillers = cells.filter(([r, c]) => isFiller[r][c]);
        if (fillers.length === 0) {
          warnings.add(`"${p.word}" appears more than once because of how the words overlap.`);
        } else {
          // Re-roll one random filler cell of the accidental copy.
          const [r, c] = fillers[Math.floor(rng() * fillers.length)];
          reroll.add(`${r},${c}`);
        }
      }
    }
    if (reroll.size === 0) break;
    for (const key of Array.from(reroll)) {
      const [r, c] = key.split(",").map(Number);
      grid[r][c] = roll();
    }
    if (round === maxRounds - 1) warnings.add("Could not remove every accidental extra copy of a word.");
  }
  return { grid: grid as string[][], warnings: Array.from(warnings) };
}

// ---------------------------------------------------------------- one-shot

export interface GeneratedPuzzle {
  size: number;
  words: string[];
  placements: Placement[];
  grid: string[][];
  unplaced: string[];
  warnings: string[];
}

/** Fully automatic: place all words (keeping any fixed ones) and fill the rest. */
export function generatePuzzle(
  words: string[],
  size: number,
  dirs: DirectionKey[],
  rng: Rng,
  fixed: Placement[] = [],
  opts?: AutoPlaceOptions & { decoys?: DecoyLevel }
): GeneratedPuzzle {
  const fixedWords = new Set(fixed.map((p) => p.word));
  const toPlace = words.filter((w) => !fixedWords.has(w));
  let result = autoPlace(size, fixed, toPlace, dirs, rng, opts);
  // Retry a few times if two placed words accidentally spell another listed word.
  for (let i = 0; i < 4; i++) {
    const all = [...fixed, ...result.placements];
    if (!hasPlacedDuplicates(buildLetterGrid(size, all), all)) break;
    const retry = autoPlace(size, fixed, toPlace, dirs, rng, opts);
    if (retry.placements.length >= result.placements.length) result = retry;
  }
  const placements = [...fixed, ...result.placements];
  const fill = fillGrid(size, placements, rng, 300, opts?.decoys ?? "none");
  const warnings = [...containedWordWarnings(words), ...fill.warnings];
  return { size, words, placements, grid: fill.grid, unplaced: result.unplaced, warnings };
}

export function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  const step = Math.max(1, Math.floor(n));
  for (let i = 0; i < arr.length; i += step) out.push(arr.slice(i, i + step));
  return out;
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
