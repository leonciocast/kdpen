/**
 * Every size limit in one place so they are easy to tune.
 * KDP paperback limits: https://kdp.amazon.com/help/topic/G201834180
 */
export const LIMITS = {
  /** Word search: entries in one book project. */
  maxWords: 20000,
  /** Word search: words in a single puzzle. */
  maxWordsPerPuzzle: 60,
  minGridSize: 8,
  maxGridSize: 30,
  /** Shaped word searches need a bigger canvas (only the cells inside the shape are used). */
  maxShapeGridSize: 56,
  /** Crossword: word/clue pairs in one project, and per crossword. */
  maxClues: 10000,
  maxCluesPerCrossword: 30,
  /** Sudoku: puzzles in one book. */
  maxSudokus: 1000,
  /** KDP paperback page limits (B&W interior, white or cream paper). */
  kdpMinPages: 24,
  kdpMaxPages: 828,
  /** Notes pages offered at the back. */
  maxNotesPages: 20,
} as const;
