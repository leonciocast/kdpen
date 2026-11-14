/** Sudoku puzzles (via sudoku-gen) as 9x9 number grids; 0 = blank. */
import { getSudoku } from "sudoku-gen";
import { LIMITS } from "../limits";

export type SudokuDifficulty = "easy" | "medium" | "hard" | "expert";
export const SUDOKU_DIFFICULTIES: SudokuDifficulty[] = ["easy", "medium", "hard", "expert"];
export const SUDOKU_MAX_PUZZLES = LIMITS.maxSudokus;

export interface SudokuPuzzle {
  difficulty: SudokuDifficulty;
  board: number[][];
  solution: number[][];
}

const toGrid = (s: string) =>
  Array.from({ length: 9 }, (_, r) => s.slice(r * 9, r * 9 + 9).split("").map((ch) => (ch === "-" ? 0 : Number(ch))));

export function generateSudoku(difficulty: SudokuDifficulty): SudokuPuzzle {
  const s = getSudoku(difficulty);
  return { difficulty, board: toGrid(s.puzzle), solution: toGrid(s.solution) };
}

export function generateSudokus(count: number, difficulty: SudokuDifficulty): SudokuPuzzle[] {
  const n = Math.max(1, Math.min(SUDOKU_MAX_PUZZLES, Math.floor(count)));
  return Array.from({ length: n }, () => generateSudoku(difficulty));
}

/** Every row, column and box holds 1-9 exactly once. */
export function isValidSolution(g: number[][]): boolean {
  const ok = (vals: number[]) => vals.slice().sort().join("") === "123456789";
  for (let i = 0; i < 9; i++) {
    if (!ok(g[i])) return false;
    if (!ok(g.map((row) => row[i]))) return false;
    const br = Math.floor(i / 3) * 3;
    const bc = (i % 3) * 3;
    const box: number[] = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) box.push(g[br + r][bc + c]);
    if (!ok(box)) return false;
  }
  return true;
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type SudokuMix = Record<SudokuDifficulty, number>;

/** Difficulty for each puzzle of a mixed book, easiest first (a gentle learning curve). */
export function mixPlan(mix: SudokuMix): SudokuDifficulty[] {
  const out: SudokuDifficulty[] = [];
  for (const d of SUDOKU_DIFFICULTIES) for (let i = 0; i < Math.max(0, Math.floor(mix[d] || 0)); i++) out.push(d);
  return out.slice(0, SUDOKU_MAX_PUZZLES);
}
