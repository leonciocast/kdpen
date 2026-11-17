/**
 * Blocked words in puzzle grids (profanity, slurs, violence). Every row, column and diagonal
 * is read in all 8 directions. A hole in a shaped grid (or a dotted blank) ends the reading,
 * since nobody reads a word across it; "join" mode reads across holes like the shared
 * Python scanner, for comparison.
 *
 * The list itself ships only as hashes (blocklistData.ts) and is never shown in the app.
 */
import {
  BLOCKED_TOKEN_HASHES,
  BLOCKED_TOKEN_LENGTHS,
  INNOCENT_STEMS,
} from "./blocklistData";

type Cell = [number, number];
const HASHES = new Set(BLOCKED_TOKEN_HASHES);
const MAX_LEN = Math.max(...BLOCKED_TOKEN_LENGTHS);
const LENGTHS = new Set(BLOCKED_TOKEN_LENGTHS);
const STEMS = INNOCENT_STEMS;

/** FNV-1a with the length mixed in (must match scripts/blocklist-hashes.mjs). */
export function tokenHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++)
    h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return (h ^ Math.imul(s.length, 0x9e3779b1)) >>> 0;
}

/** Blocked tokens inside one reading of letters: [start, end) spans, innocent stems excused. */
export function blockedSpans(text: string): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < text.length; i++) {
    let h = 0x811c9dc5;
    for (let j = i; j < Math.min(text.length, i + MAX_LEN); j++) {
      h = Math.imul(h ^ text.charCodeAt(j), 0x01000193) >>> 0;
      const len = j - i + 1;
      if (
        LENGTHS.has(len) &&
        HASHES.has((h ^ Math.imul(len, 0x9e3779b1)) >>> 0) &&
        !inStem(text, i, j + 1)
      )
        out.push([i, j + 1]);
    }
  }
  return out;
}

function inStem(text: string, a: number, b: number): boolean {
  for (const s of STEMS) {
    for (
      let k = text.indexOf(s, Math.max(0, b - s.length));
      k >= 0 && k <= a;
      k = text.indexOf(s, k + 1)
    )
      if (k + s.length >= b) return true;
  }
  return false;
}

/** True when a word (or phrase) contains a blocked token forwards or backwards. */
export function wordIsBlocked(word: string): boolean {
  const w = word.toUpperCase().replace(/[^A-Z]/g, "");
  return (
    blockedSpans(w).length > 0 ||
    blockedSpans([...w].reverse().join("")).length > 0
  );
}

export interface BlockedHit {
  /** The grid cells that spell it, in reading order. */
  cells: Cell[];
}

const ORIENT: Cell[] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [-1, 1],
];

/**
 * Every blocked token readable in a grid. `words` are the placed answers' cells: a token that
 * lies wholly inside one answer (PARCEL read backwards) can't be fixed by moving letters, so it
 * is left to the word list check and not reported here.
 */
export function scanGrid(
  grid: readonly (readonly (string | null | undefined)[])[],
  words: Cell[][] = [],
  gaps: "join" | "break" = "break",
): BlockedHit[] {
  const rows = grid.length;
  const cols = Math.max(0, ...grid.map((r) => r.length));
  const letter = (r: number, c: number) => {
    const v = (grid[r]?.[c] ?? "").toUpperCase();
    return v.length === 1 && v >= "A" && v <= "Z" ? v : "";
  };
  const owner = new Map<string, number[]>();
  words.forEach((cells, i) =>
    cells.forEach(([r, c]) =>
      owner.set(`${r},${c}`, [...(owner.get(`${r},${c}`) ?? []), i]),
    ),
  );
  const hits: BlockedHit[] = [];
  const seen = new Set<string>();
  for (const [dr, dc] of ORIENT) {
    for (let r0 = 0; r0 < rows; r0++)
      for (let c0 = 0; c0 < cols; c0++) {
        const pr = r0 - dr;
        const pc = c0 - dc;
        if (pr >= 0 && pr < rows && pc >= 0 && pc < cols) continue; // not the start of a line
        // "join" skips empty cells like the shared scanner; "break" (a half-built grid) splits the line there.
        const runs: Cell[][] = [[]];
        for (
          let r = r0, c = c0;
          r >= 0 && r < rows && c >= 0 && c < cols;
          r += dr, c += dc
        ) {
          if (letter(r, c)) runs[runs.length - 1].push([r, c]);
          else if (gaps === "break" && runs[runs.length - 1].length)
            runs.push([]);
        }
        for (const cells of runs) {
          if (cells.length < 3) continue;
          for (const seq of [cells, cells.slice().reverse()]) {
            const text = seq.map(([r, c]) => letter(r, c)).join("");
            for (const [a, b] of blockedSpans(text)) {
              const span = seq.slice(a, b);
              const key = span
                .map(([r, c]) => `${r},${c}`)
                .sort()
                .join(" ");
              if (seen.has(key)) continue;
              seen.add(key);
              const shared = span
                .map(([r, c]) => owner.get(`${r},${c}`) ?? [])
                .reduce((acc, ids) => acc.filter((x) => ids.includes(x)));
              if (shared.length) continue; // inside one answer word
              hits.push({ cells: span });
            }
          }
        }
      }
  }
  return hits;
}

/** Directions a word reads forwards in the usual way (left to right, downwards). */
const NATURAL = new Set(["E", "S", "SE", "NE"]);
/**
 * A word whose reversal holds a blocked token (PARCEL backwards is LECRAP) may only run in a
 * natural direction, so the token can only be read backwards against the usual flow.
 */
export function allowedWordDirections<D extends string>(letters: string, dirs: D[]): D[] {
  const w = letters.toUpperCase().replace(/[^A-Z]/g, "");
  if (!blockedSpans([...w].reverse().join("")).length) return dirs;
  const ok = dirs.filter((d) => NATURAL.has(d));
  return ok.length ? ok : dirs;
}

