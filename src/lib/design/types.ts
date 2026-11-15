import type { FontKey } from "./fonts";
import type { OutlineStyle, ShapeKey, ShapeMix } from "../shapes/shapes";
import type { ThemeMode } from "../shapes/plan";

export type HeaderStyle = "rule" | "banner" | "ribbon" | "underline" | "boxed" | "tab" | "minimal";
export type BadgeShape = "circle" | "rounded" | "diamond" | "hexagon";
export type IconKey = "none" | "magnifier" | "star" | "heart" | "leaf" | "sun" | "snowflake" | "flower" | "pencil";
export type PatternKey = "none" | "dots" | "diagonal" | "waves" | "confetti" | "grid" | "corners" | "snow";
export type GridBorder = "square" | "rounded" | "double" | "none";
export type GridShade = "none" | "rows" | "checker";
/** Line style of the outline around the grid. */
export type LineStyle = "solid" | "dashed" | "dotted";
/** How each letter / number cell is drawn. */
export type CellStyle = "plain" | "boxed" | "rounded" | "circles";
/** Box around the word list. */
export type ListBox = "none" | "solid" | "rounded" | "dashed" | "double";
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
    /** Outline line style. */
    line: LineStyle;
    /** Soft offset shadow behind the outline. */
    shadow: boolean;
    /** Letter cells: plain, a small box, a rounded box or a circle behind each one. */
    cells: CellStyle;
  };
  /** Grid shape (word search: the letters fill the shape; crossword: words stay inside it; sudoku: a frame around the 9×9). */
  shape: {
    kind: ShapeKey;
    /** Shape plan: "one" = every puzzle uses `kind`; "each" = surprise me; "pick" = random from `cats`; "manual" = page by page (`pins`, else `kind`). */
    mix: ShapeMix;
    /** Seed of the random plans, so the preview and the PDF always match. */
    seed?: number;
    /** Categories / animal groups for "pick" ("food", "animals:farm"). */
    cats?: string[];
    /** Shapes chosen for single puzzles (0-based index as string); kept when the plan is shuffled. */
    pins?: Record<string, ShapeKey>;
    /** How themes steer random plans. */
    themes?: ThemeMode;
    /** Light shaded silhouette behind the letters (the grey fill of a shaped word search). */
    shade: boolean;
    /** smooth = the exact artist silhouette; stepped = a thin cell-edge stroke; snug hugs letters; blocky is a padded pixel outline. */
    outline: OutlineStyle;
    /** Stroke colour for the stepped cell-edge outline (ignored in grayscale books, converted to grey). */
    outlineColor?: string;
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
    /** Box around the word list / clues. */
    box: ListBox;
  };
}

export type ToolKind = "word-search" | "crossword" | "sudoku" | "mystery";

export const TOOL_HEADER: Record<ToolKind, string> = {
  "word-search": "WORD SEARCH PUZZLE",
  crossword: "CROSSWORD PUZZLE",
  sudoku: "SUDOKU PUZZLE",
  mystery: "CASE FILE",
};
