/**
 * Error-proof manual placement: every preview and click is resolved to a
 * placement that lies completely inside the grid.
 */
import { ALL_DIRECTIONS, Cell, DIRECTIONS, DirectionKey, Placement, checkPlacement, gridForm, makePlacement } from "./engine";

export interface StartRange {
  rowMin: number;
  rowMax: number;
  colMin: number;
  colMax: number;
}

/** Rows/cols where a word of `length` letters going `dir` can start and stay inside the grid. */
export function startRange(size: number, length: number, dir: DirectionKey): StartRange | null {
  if (length < 1) return null;
  const { dr, dc } = DIRECTIONS[dir];
  const span = length - 1;
  const r: StartRange = {
    rowMin: dr < 0 ? span : 0,
    rowMax: dr > 0 ? size - 1 - span : size - 1,
    colMin: dc < 0 ? span : 0,
    colMax: dc > 0 ? size - 1 - span : size - 1,
  };
  return r.rowMin > r.rowMax || r.colMin > r.colMax ? null : r;
}

export function fitsInGrid(size: number, length: number, dir: DirectionKey, start: Cell): boolean {
  const r = startRange(size, length, dir);
  return !!r && start[0] >= r.rowMin && start[0] <= r.rowMax && start[1] >= r.colMin && start[1] <= r.colMax;
}

/**
 * Nearest start cell (to `cell`) from which the whole word fits. Off-grid
 * hovers near an edge are pulled back so the last letter sits on the edge.
 */
export function snapStart(size: number, length: number, dir: DirectionKey, cell: Cell): Cell | null {
  const r = startRange(size, length, dir);
  if (!r) return null;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return [clamp(cell[0], r.rowMin, r.rowMax), clamp(cell[1], r.colMin, r.colMax)];
}

/** The one of the 8 directions closest to the line from `start` toward `target`. */
export function nearestDirection(start: Cell, target: Cell): DirectionKey | null {
  const dr = target[0] - start[0];
  const dc = target[1] - start[1];
  if (dr === 0 && dc === 0) return null;
  const step = Math.round(Math.atan2(dr, dc) / (Math.PI / 4)); // -4..4
  const a = (step * Math.PI) / 4;
  const sr = Math.round(Math.sin(a));
  const sc = Math.round(Math.cos(a));
  return ALL_DIRECTIONS.find((k) => DIRECTIONS[k].dr === sr && DIRECTIONS[k].dc === sc) ?? null;
}

export type Resolution =
  | { kind: "place"; placement: Placement; snapped: boolean }
  | { kind: "conflict"; placement: Placement; message: string }
  | { kind: "none"; message: string };

function check(size: number, placements: Placement[], cand: Placement, snapped: boolean): Resolution {
  const res = checkPlacement(size, placements, cand);
  if (res.ok) return { kind: "place", placement: cand, snapped };
  return { kind: "conflict", placement: cand, message: `${res.message ?? "That spot doesn't work."} Try another square or direction.` };
}

/** Fixed direction: resolve a hovered/clicked cell to an in-grid placement. */
export function resolveFixed(size: number, placements: Placement[], word: string, dir: DirectionKey, cell: Cell): Resolution {
  const len = gridForm(word).length;
  const start = snapStart(size, len, dir, cell);
  if (!start) return { kind: "none", message: `"${word}" is too long to go this way in a ${size}×${size} grid. Pick another direction.` };
  const snapped = start[0] !== cell[0] || start[1] !== cell[1];
  return check(size, placements, makePlacement(word, start[0], start[1], dir), snapped);
}

/** Directions in which the word fits (in the grid, no letter clash) starting at `start`. */
export function validDirectionsFrom(size: number, placements: Placement[], word: string, start: Cell): DirectionKey[] {
  const len = gridForm(word).length;
  return ALL_DIRECTIONS.filter((d) => fitsInGrid(size, len, d, start) && checkPlacement(size, placements, makePlacement(word, start[0], start[1], d)).ok);
}

/** Start → end mode: the end click picks the nearest straight direction that stays in the grid. */
export function resolveFreeEnd(size: number, placements: Placement[], word: string, start: Cell, target: Cell): Resolution {
  const dir = nearestDirection(start, target);
  if (!dir) return { kind: "none", message: "Click a square in the direction the word should run." };
  const len = gridForm(word).length;
  if (!fitsInGrid(size, len, dir, start)) {
    return { kind: "none", message: `"${word}" would run off the grid that way. Pick one of the highlighted squares.` };
  }
  return check(size, placements, makePlacement(word, start[0], start[1], dir), false);
}

/** All cells that are exact valid start points for word + direction. */
export function validStartCells(size: number, placements: Placement[], word: string, dir: DirectionKey): Set<string> {
  const out = new Set<string>();
  const len = gridForm(word).length;
  const r = startRange(size, len, dir);
  if (!r) return out;
  for (let row = r.rowMin; row <= r.rowMax; row++) {
    for (let col = r.colMin; col <= r.colMax; col++) {
      if (checkPlacement(size, placements, makePlacement(word, row, col, dir)).ok) out.add(`${row},${col}`);
    }
  }
  return out;
}
