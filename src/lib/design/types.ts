import type { FontKey } from "./fonts";

export type HeaderStyle = "rule" | "banner" | "ribbon" | "underline" | "boxed" | "tab" | "minimal";
export type BadgeShape = "circle" | "rounded" | "diamond" | "hexagon";
export type IconKey = "none" | "magnifier" | "star" | "heart" | "leaf" | "sun" | "snowflake" | "flower" | "pencil";
export type PatternKey = "none" | "dots" | "diagonal" | "waves" | "confetti" | "grid" | "corners" | "snow";
export type GridBorder = "square" | "rounded" | "double" | "none";
export type GridShade = "none" | "rows" | "checker";
export type PageNumberStyle = "plain" | "dashes" | "circle" | "pill" | "none";
export type ListSort = "entered" | "alpha" | "length";
export type TemplateId = "classic" | "banner" | "elegant" | "kids" | "largeprint" | "seasonal" | "modern";

export interface Design {
  version: 1;
  template: TemplateId;
  /** Free name used for saved presets. */
  name: string;
  header: {
    style: HeaderStyle;
    /** Header text. Empty = tool default ("WORD SEARCH PUZZLE", "CROSSWORD", "SUDOKU"). */
    text: string;
    /** Show the puzzle's own title/theme under or beside the header. */
    showPuzzleTitle: boolean;
    badge: boolean;
    badgeShape: BadgeShape;
    icon: IconKey;
  };
  fonts: {
    heading: FontKey;
    grid: FontKey;
    list: FontKey;
    /** Multipliers on the automatic sizes (0.8–1.3). */
    gridScale: number;
    listScale: number;
  };
  grid: {
    lines: boolean;
    border: GridBorder;
    shade: GridShade;
    /** Frame thickness in points. */
    frame: number;
  };
  color: {
    accent: string;
    /** KDP black & white interior: every colour is converted to gray. */
    grayscale: boolean;
  };
  pattern: {
    kind: PatternKey;
    /** 0 (barely there) – 1 (visible). Always low ink. */
    strength: number;
  };
  pageNumber: PageNumberStyle;
  list: {
    /** 0 = automatic. */
    columns: number;
    checkbox: boolean;
    sort: ListSort;
  };
}

export type ToolKind = "word-search" | "crossword" | "sudoku";

export const TOOL_HEADER: Record<ToolKind, string> = {
  "word-search": "WORD SEARCH PUZZLE",
  crossword: "CROSSWORD PUZZLE",
  sudoku: "SUDOKU PUZZLE",
};
