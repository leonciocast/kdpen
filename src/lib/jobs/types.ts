import type { ShapeKey } from "../shapes/shapes";
import type { DecoyLevel, DirectionKey, Placement } from "../wordsearch/engine";
import type { PuzzleSpec } from "../wordsearch/bulk";
import type { ClueEntry, Crossword } from "../crossword/engine";
import type { SudokuDifficulty, SudokuPuzzle } from "../sudoku";
import type { BookPuzzle } from "../wordsearch/pdf";
import type { FrontMatter } from "../print/frontMatter";
import type { TrimKey } from "../print/kdp";
import type { BookExtras } from "../print/book";
import type { Design } from "../design/types";
import type { Slot } from "../print/arrange";
import type { CrosswordItem } from "../crossword/pdf";
import type { CaseStyle, MysteryItem } from "../mystery/types";
import type { GenerateMysteryInput, GeneratedMystery } from "../mystery/model";

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
  /** Grid shape (square when missing). Cells outside it hold "". */
  shape?: ShapeKey;
  /** The size the puzzle would have as a plain square (used when the shape changes). */
  baseSize?: number;
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

export type BuildItems = { tool: "word-search"; items: BookPuzzle[] } | { tool: "crossword"; items: CrosswordItem[] } | { tool: "sudoku"; items: SudokuPuzzle[] } | { tool: "mystery"; items: MysteryItem[]; style?: CaseStyle };

export type Job =
  | { type: "ws-generate"; specs: PuzzleSpec[]; settings: WsGenSettings }
  | { type: "cw-generate"; groups: { title: string; theme?: string; entries: ClueEntry[]; shape?: ShapeKey }[] }
  | { type: "sd-generate"; plan: SudokuDifficulty[] }
  | { type: "my-generate"; input: GenerateMysteryInput }
  | ({ type: "build"; settings: BookSettings; volumes: [number, number][]; fileBase: string; /** Custom page order (single-volume books only). */ slots?: Slot[] } & BuildItems);

export interface BuiltFile {
  name: string;
  pages: number;
  bytes: ArrayBuffer;
}

export interface JobResultMap {
  "ws-generate": GeneratedWs[];
  "cw-generate": { title: string; theme?: string; cw: Crossword }[];
  "sd-generate": SudokuPuzzle[];
  "my-generate": GeneratedMystery;
  build: BuiltFile[];
}

export interface Progress {
  phase: string;
  done: number;
  total: number;
}
