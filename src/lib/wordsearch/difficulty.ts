/** Book-wide difficulty presets for word search. */
import { LIMITS } from "../limits";
import { DecoyLevel, DirectionKey, gridForm } from "./engine";

export type WsDifficulty = "easy" | "medium" | "hard" | "expert";

export interface DifficultyPreset {
  id: WsDifficulty;
  label: string;
  description: string;
  dirs: DirectionKey[];
  /** Share of grid cells filled by words; higher = smaller, denser grid. */
  density: number;
  overlapWeight: number;
  decoys: DecoyLevel;
}

export const WS_DIFFICULTIES: DifficultyPreset[] = [
  { id: "easy", label: "Easy", description: "Across and down only, roomy grid, no tricks.", dirs: ["E", "S"], density: 0.42, overlapWeight: -0.3, decoys: "none" },
  { id: "medium", label: "Medium", description: "Adds diagonals. Normal grid size.", dirs: ["E", "S", "SE", "NE"], density: 0.52, overlapWeight: 0.15, decoys: "none" },
  { id: "hard", label: "Hard", description: "All 8 directions incl. backwards, more shared letters, look-alike filler.", dirs: ["E", "S", "SE", "NE", "W", "N", "NW", "SW"], density: 0.6, overlapWeight: 0.5, decoys: "letters" },
  { id: "expert", label: "Expert", description: "All directions, tight grid, heavy overlaps and decoy word fragments.", dirs: ["E", "S", "SE", "NE", "W", "N", "NW", "SW"], density: 0.66, overlapWeight: 0.9, decoys: "fragments" },
];

export const presetFor = (id: WsDifficulty) => WS_DIFFICULTIES.find((d) => d.id === id) ?? WS_DIFFICULTIES[1];

/** Smallest sensible square grid for these words at the preset's density. */
export function suggestGridSize(words: string[], density: number): number {
  const lens = words.map((w) => gridForm(w).length);
  if (!lens.length) return 15;
  const longest = Math.max(...lens);
  const letters = lens.reduce((a, b) => a + b, 0);
  const bySpace = Math.ceil(Math.sqrt(letters / Math.max(0.2, density)));
  return Math.max(LIMITS.minGridSize, Math.min(LIMITS.maxGridSize, Math.max(longest, bySpace)));
}
