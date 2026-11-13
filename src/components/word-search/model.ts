import { DirectionKey, Placement } from "@/lib/wordsearch/engine";

export interface PuzzleModel {
  id: number;
  title: string;
  size: number;
  words: string[];
  placements: Placement[];
  /** Filled grid (placed words + random letters), or null while editing. */
  grid: string[][] | null;
  unplaced: string[];
  warnings: string[];
}

/** "free" = click start cell, then any cell toward the end. */
export type DirMode = "free" | DirectionKey;

export const PALETTE = ["#ffd6a5", "#caffbf", "#9bf6ff", "#bdb2ff", "#ffc6ff", "#fdffb6", "#a0c4ff", "#ffadad", "#b5e48c", "#f1c0e8", "#cfbaf0", "#90dbf4"];

export function colorsFor(pz: PuzzleModel): Record<string, string> {
  const map: Record<string, string> = {};
  pz.words.forEach((w, i) => (map[w] = PALETTE[i % PALETTE.length]));
  return map;
}

/** Placed words, in the order the user listed them. */
export function listedWords(pz: PuzzleModel): string[] {
  const placed = new Set(pz.placements.map((p) => p.word));
  return pz.words.filter((w) => placed.has(w));
}

export const SAMPLE_WORDS = ["ICE CREAM", "SUNSHINE", "BEACH BALL", "SANDCASTLE", "SEASHELL", "PICNIC", "LEMONADE", "SWIMMING", "FLIP FLOPS", "VACATION", "SUNSCREEN", "WATERMELON"];

export const DIR_ARROWS: Record<DirectionKey, string> = { E: "→", W: "←", S: "↓", N: "↑", SE: "↘", NW: "↖", NE: "↗", SW: "↙" };
export const DIR_NAMES: Record<DirectionKey, string> = {
  E: "Across (left to right)",
  W: "Across, backwards (right to left)",
  S: "Down (top to bottom)",
  N: "Up (bottom to top)",
  SE: "Diagonal down-right",
  NW: "Diagonal up-left",
  NE: "Diagonal up-right",
  SW: "Diagonal down-left",
};
