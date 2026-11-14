import type { ShapeKey } from "../shapes/shapes";
import type { Placement } from "./engine";
/** Turn a big word list into puzzle specs (grouped by theme, split by words-per-puzzle). */
import { LIMITS } from "../limits";
import { suggestGridSize } from "./difficulty";
import { gridForm } from "./engine";

export interface WordEntry {
  word: string;
  theme?: string;
}

export interface PuzzleSpec {
  title: string;
  theme: string;
  words: string[];
  size: number;
  /** Grid shape; the generator grows the canvas so every word fits inside it. */
  shape?: ShapeKey;
  /** Words already placed by hand (kept when they fit inside the shape). */
  fixed?: Placement[];
}

export interface SplitOptions {
  wordsPerPuzzle: number;
  /** Fixed grid size, or "auto" to suggest one per puzzle. */
  size: number | "auto";
  density: number;
  groupByTheme: boolean;
}

/** Split `n` items into chunks of at most `per`, keeping chunk sizes balanced (no tiny last chunk). */
export function balancedChunks<T>(items: T[], per: number): T[][] {
  const p = Math.max(1, Math.floor(per));
  if (items.length === 0) return [];
  const count = Math.ceil(items.length / p);
  const size = Math.ceil(items.length / count);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function splitIntoPuzzles(entries: WordEntry[], opts: SplitOptions): PuzzleSpec[] {
  const per = Math.max(1, Math.min(LIMITS.maxWordsPerPuzzle, opts.wordsPerPuzzle));
  const groups = new Map<string, string[]>();
  for (const e of entries) {
    const key = opts.groupByTheme ? (e.theme ?? "").trim() : "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e.word);
  }
  const specs: PuzzleSpec[] = [];
  for (const [theme, words] of Array.from(groups.entries())) {
    const chunks = balancedChunks(words, per);
    chunks.forEach((chunk, i) => {
      const longest = Math.max(...chunk.map((w) => gridForm(w).length));
      const size = opts.size === "auto" ? suggestGridSize(chunk, opts.density) : Math.max(opts.size, Math.min(LIMITS.maxGridSize, longest));
      const title = theme ? (chunks.length > 1 ? `${theme} ${i + 1}` : theme) : "";
      specs.push({ title, theme, words: chunk, size });
    });
  }
  return specs.map((s, i) => ({ ...s, title: s.title || `Puzzle ${i + 1}` }));
}
