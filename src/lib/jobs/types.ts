import type { DecoyLevel, DirectionKey, Placement } from "../wordsearch/engine";
import type { PuzzleSpec } from "../wordsearch/bulk";
import type { ClueEntry, Crossword } from "../crossword/engine";
import type { SudokuDifficulty, SudokuPuzzle } from "../sudoku";
import type { BookPuzzle } from "../wordsearch/pdf";
import type { FrontMatter } from "../print/frontMatter";
import type { TrimKey } from "../print/kdp";
import type { BookExtras } from "../print/book";
import type { Design } from "../design/types";
import type { CrosswordItem } from "../crossword/pdf";

export interface WsGenSettings {
  dirs: DirectionKey[];
  overlapWeight: number;
  decoys: DecoyLevel;
}

export interface GeneratedWs {
  title: string;
  theme: string;
  size: number;
  words: string[];
  placements: Placement[];
  grid: string[][];
  unplaced: string[];
  warnings: string[];
}

export interface BookSettings {
  trim: TrimKey;
  bleed: boolean;
  padForKdp: boolean;
  frontMatter: FrontMatter | null;
  extras: BookExtras;
  design: Design;
  answersPerPage: 1 | 2 | 4 | 6;
  /** Sudoku only. */
  perPage?: 1 | 2 | 4 | 6;
}

export type BuildItems = { tool: "word-search"; items: BookPuzzle[] } | { tool: "crossword"; items: CrosswordItem[] } | { tool: "sudoku"; items: SudokuPuzzle[] };

export type Job =
  | { type: "ws-generate"; specs: PuzzleSpec[]; settings: WsGenSettings }
  | { type: "cw-generate"; groups: { title: string; theme?: string; entries: ClueEntry[] }[] }
  | { type: "sd-generate"; plan: SudokuDifficulty[] }
  | ({ type: "build"; settings: BookSettings; volumes: [number, number][]; fileBase: string } & BuildItems);

export interface BuiltFile {
  name: string;
  pages: number;
  bytes: ArrayBuffer;
}

export interface JobResultMap {
  "ws-generate": GeneratedWs[];
  "cw-generate": { title: string; theme?: string; cw: Crossword }[];
  "sd-generate": SudokuPuzzle[];
  build: BuiltFile[];
}

export interface Progress {
  phase: string;
  done: number;
  total: number;
}
