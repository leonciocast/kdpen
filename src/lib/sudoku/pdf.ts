/** Sudoku book pages in the chosen design. */
import type { Slot } from "../print/arrange";
import type { jsPDF } from "jspdf";
import { SudokuPuzzle, capitalize } from "./index";
import { FrontMatter } from "../print/frontMatter";
import { TrimKey } from "../print/kdp";
import { FontData } from "../print/fonts";
import { BookContent, BookExtras, PageContext, PageRenderer, RenderedBook, SANS, Section, heading, paragraph, renderBook } from "../print/book";
import { Box, Look, drawFrame, drawFrameShadow, drawOutline, drawOutlineBacking, panel, paint } from "../design/paint";
import { SUDOKU_SHAPES, sudokuFrame } from "../shapes/shapes";
import { tint } from "../design/color";
import { DEFAULT_DESIGN } from "../design/templates";
import { Design, TOOL_HEADER } from "../design/types";

export type PerPage = 1 | 2 | 4 | 6;

export interface SudokuBookOptions {
  trim: TrimKey;
  bleed: boolean;
  frontMatter: FrontMatter | null;
  extras: BookExtras;
  design?: Design;
  puzzlesPerPage: PerPage;
  answersPerPage?: PerPage;
  padForKdp?: boolean;
  volume?: { n: number; of: number };
  onPage?: (done: number, total: number) => void;
  /** Puzzles on each puzzle page (arranged books; default: puzzlesPerPage each). */
  pageSizes?: number[];
  /** Custom page order from the preview (items must already be in arranged order). */
  slots?: Slot[];
  /** Number of the first puzzle (design preview of a later puzzle). */
  firstNumber?: number;
}

/** Highlight sets for the how-to diagram. */
export interface SudokuHighlight {
  row?: number;
  col?: number;
  box?: number;
}

/**
 * Sudoku in the area (x, y, size×size). A 9×9 sudoku can't change shape, so a
 * circle / octagon / hexagon is drawn as a frame around it (the grid shrinks
 * to fit inside); "rounded" rounds the grid's corners.
 */
export function drawSudokuGrid(pdf: jsPDF, look: Look, p: SudokuPuzzle, x0: number, y0: number, area: number, answers: boolean, hl?: SudokuHighlight) {
  const want = p.shape ?? look.design.shape.kind;
  const kind = SUDOKU_SHAPES.includes(want) ? want : "square";
  const framed = kind !== "square" && kind !== "rounded";
  let x = x0;
  let y = y0;
  let size = area;
  let outline: [number, number][] | null = null;
  if (framed) {
    const pts = sudokuFrame(kind, 9);
    const xs = pts.map((q) => q[0]);
    const ys = pts.map((q) => q[1]);
    const ext = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) + 0.2;
    const cellF = area / ext;
    size = cellF * 9;
    x = x0 + (area - size) / 2;
    y = y0 + (area - size) / 2;
    outline = pts.map(([px, py]) => [x + px * cellF, y + py * cellF]);
  }
  const cell = size / 9;
  const g0 = look.design.grid;
  const g = kind === "rounded" ? { ...g0, border: "rounded" as const } : g0;
  // The frame is drawn first; the white 9×9 then sits on top, so no outline line ever crosses the numbers
  // (animals peek out around the grid: head, legs and tail).
  const outlineLook: Look = { ...look, design: { ...look.design, grid: { ...g, border: g.border === "none" ? "square" : g.border, frame: Math.max(1, g.frame) } } };
  if (outline) {
    drawOutlineBacking(pdf, outline, look, cell);
    drawOutline(pdf, outline, outlineLook, cell);
  } else drawFrameShadow(pdf, { x, y, w: size, h: size }, { ...look, design: { ...look.design, grid: g } }, cell);
  const shade = look.design.color.grayscale ? ([236, 236, 236] as [number, number, number]) : tint(look.accent, 0.88);
  paint.fill(pdf, [255, 255, 255]);
  pdf.rect(x, y, size, size, "F");
  paint.fill(pdf, shade);
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++) {
      const boxIdx = Math.floor(r / 3) * 3 + Math.floor(c / 3);
      const on = hl ? hl.row === r || hl.col === c || hl.box === boxIdx : g.shade === "checker" ? boxIdx % 2 === 1 : g.shade === "rows" ? r % 2 === 1 : false;
      if (on) pdf.rect(x + c * cell, y + r * cell, cell, cell, "F");
    }
  paint.stroke(pdf, [0, 0, 0]);
  const thick = Math.max(1, Math.min(3, g.frame || 1.2) * Math.min(1, size / 300) + 0.4);
  const cellStyle = g.cells === "rounded" || g.cells === "circles" ? g.cells : "plain";
  for (let i = 1; i < 9; i++) {
    if (cellStyle !== "plain" && i % 3 !== 0) continue;
    pdf.setLineWidth(i % 3 === 0 ? thick : Math.max(0.35, size * 0.0016));
    if (i % 3 !== 0) paint.stroke(pdf, [110, 110, 110]);
    else paint.stroke(pdf, [0, 0, 0]);
    pdf.line(x + i * cell, y, x + i * cell, y + size);
    pdf.line(x, y + i * cell, x + size, y + i * cell);
  }
  if (cellStyle !== "plain") {
    // Each cell drawn as its own rounded box or circle; the 3×3 boxes keep their bold lines.
    paint.stroke(pdf, [120, 120, 120]);
    pdf.setLineWidth(Math.max(0.35, size * 0.0016));
    const ins = cell * 0.1;
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++) {
        if (cellStyle === "circles") pdf.circle(x + (c + 0.5) * cell, y + (r + 0.5) * cell, cell / 2 - ins, "S");
        else pdf.roundedRect(x + c * cell + ins, y + r * cell + ins, cell - ins * 2, cell - ins * 2, cell * 0.2, cell * 0.2, "S");
      }
  }
  if (outline) {
    // The 9×9 square keeps a solid edge so the puzzle stays easy to read; the shape is the decorative frame.
    paint.stroke(pdf, [0, 0, 0]);
    pdf.setLineWidth(thick);
    pdf.rect(x, y, size, size, "S");
  } else {
    const frameLook: Look = { ...look, design: { ...look.design, grid: { ...g, border: g.border === "none" ? "square" : g.border, frame: Math.max(thick, g.frame) } } };
    drawFrame(pdf, { x, y, w: size, h: size }, frameLook, cell);
  }
  const gf = look.font(look.design.fonts.grid);
  const fs = Math.min(cell * 0.6 * look.design.fonts.gridScale, cell * 0.8);
  pdf.setFontSize(fs);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const given = p.board[r][c];
      const v = given || (answers ? p.solution[r][c] : 0);
      if (!v) continue;
      pdf.setFont(gf, given ? "bold" : "normal");
      if (!given) pdf.setTextColor(120, 120, 120);
      else pdf.setTextColor(0, 0, 0);
      pdf.text(String(v), x + (c + 0.5) * cell, y + (r + 0.5) * cell + fs * 0.04, { align: "center", baseline: "middle" });
    }
  }
  pdf.setTextColor(0, 0, 0);
}

export function slotLayout(box: Box, top: number, per: number, labelH: number, gap: number) {
  const cols = per >= 4 ? 2 : 1;
  const rows = per === 1 ? 1 : per === 2 || per === 4 ? 2 : 3;
  const slotW = (box.w - gap * (cols - 1)) / cols;
  const slotH = (box.y + box.h - top - gap * (rows - 1)) / rows;
  const size = Math.min(slotW - 8, slotH - labelH - 8, 6.2 * 72);
  return Array.from({ length: per }, (_, k) => {
    const col = k % cols;
    const row = Math.floor(k / cols);
    const sx = box.x + col * (slotW + gap);
    const sy = top + row * (slotH + gap);
    const extra = per === 1 ? (slotH - labelH - size) / 3 : (slotH - labelH - size) / 2;
    return { cx: sx + slotW / 2, ly: sy + extra, gx: sx + (slotW - size) / 2, gy: sy + labelH + extra, size };
  });
}

function page(items: { p: SudokuPuzzle; n: number }[], per: number, headerText: string, answers: boolean, first: boolean): PageRenderer {
  return (ctx: PageContext) => {
    const { pdf, box, s, look } = ctx;
    const single = per === 1 && !answers;
    const top = (answers ? (first ? heading(ctx, "SOLUTIONS") : box.y) : single ? heading(ctx, headerText, items[0].n, capitalize(items[0].p.difficulty)) : heading(ctx, headerText)) + 6 * s;
    const spots = slotLayout(box, top, per, single ? 0 : 20 * s, 18 * s);
    const hf = look.font(look.design.fonts.heading);
    items.forEach(({ p, n }, k) => {
      const sp = spots[k];
      panel(pdf, { x: sp.gx - 8, y: sp.ly - (single ? 8 : 4), w: sp.size + 16, h: sp.gy - sp.ly + sp.size + (single ? 16 : 12) }, look, 10);
      if (!single) {
        pdf.setFont(hf, "bold");
        pdf.setFontSize(11 * s);
        paint.textColor(pdf, look.ink);
        pdf.text(`#${n} · ${capitalize(p.difficulty)}`, sp.cx, sp.ly + 7 * s, { align: "center", baseline: "middle" });
        pdf.setTextColor(0, 0, 0);
      }
      drawSudokuGrid(pdf, look, p, sp.gx, sp.gy, sp.size, answers);
    });
  };
}

// A fixed, valid example for the how-to page.
const DEMO_SOLUTION = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
const DEMO_MASK = "110010000100111000011000010100010001100101001100010001010000110000111001000010011";

export function demoSudoku(): SudokuPuzzle {
  const solution = Array.from({ length: 9 }, (_, r) => DEMO_SOLUTION.slice(r * 9, r * 9 + 9).split("").map(Number));
  const board = solution.map((row, r) => row.map((v, c) => (DEMO_MASK[r * 9 + c] === "1" ? v : 0)));
  return { difficulty: "easy", board, solution };
}

export function sudokuHowTo(): PageRenderer {
  return (ctx: PageContext) => {
    const { pdf, box, s, look } = ctx;
    let y = heading(ctx, "HOW TO PLAY") + 10 * s;
    panel(pdf, { x: box.x - 8, y: y - 8, w: box.w + 16, h: box.y + box.h - y }, look, 12);
    pdf.setFont(SANS, "normal");
    pdf.setTextColor(25, 25, 25);
    y = paragraph(pdf, "Fill every empty square with a number from 1 to 9. Each ROW, each COLUMN and each of the nine 3×3 BOXES must contain every number exactly once. Every puzzle has exactly one solution.", box.x, y + 4 * s, box.w, 12 * s, 18 * s) + 14 * s;
    const size = Math.min(box.w * 0.55, 250 * s);
    const demo = demoSudoku();
    drawSudokuGrid(pdf, look, demo, box.x + box.w - size, y, size, false, { row: 4, col: 4, box: 4 });
    const lines = [
      ["Row", "9 squares across"],
      ["Column", "9 squares down"],
      ["Box", "the 3×3 block in the middle"],
    ];
    let ly = y + 14 * s;
    pdf.setFont(look.font(look.design.fonts.heading), "bold");
    pdf.setFontSize(13 * s);
    pdf.text("The shaded areas show:", box.x, ly);
    ly += 26 * s;
    for (const [a, b] of lines) {
      pdf.setFont(SANS, "bold");
      pdf.setFontSize(12 * s);
      pdf.text(`${a}:`, box.x, ly);
      pdf.setFont(SANS, "normal");
      pdf.text(b, box.x + 58 * s, ly);
      ly += 22 * s;
    }
    y += size + 26 * s;
    const tips = [
      "Look for a row, column or box that is almost full and find the missing number.",
      "For each number, check where it can still go in a box: often there is only one square left.",
      "Use a pencil and write small candidate numbers in the corner of a square.",
    ];
    pdf.setFont(SANS, "normal");
    for (const t of tips) {
      paint.fill(pdf, look.accent);
      pdf.circle(box.x + 4, y - 3 * s, 2 * s, "F");
      y = paragraph(pdf, t, box.x + 14, y, box.w - 14, 11.5 * s, 16 * s) + 6 * s;
    }
    pdf.setFont(look.font(look.design.fonts.heading), "bold");
    pdf.setFontSize(12 * s);
    paint.textColor(pdf, look.ink);
    pdf.text(`Solutions start on page ${ctx.solutionsPage}.`, box.x + box.w / 2, box.y + box.h - 10 * s, { align: "center" });
    pdf.setTextColor(0, 0, 0);
  };
}

export function sudokuContent(puzzles: SudokuPuzzle[], design: Design = DEFAULT_DESIGN, per: PerPage = 1, answersPer: PerPage = 4, pageSizes?: number[], firstNumber = 1): BookContent {
  const headerText = design.header.text.trim() || TOOL_HEADER.sudoku;
  const items = puzzles.map((p, i) => ({ p, n: firstNumber + i }));
  const pages: PageRenderer[] = [];
  const sections: Section[] = [];
  let last = "";
  const sizes = pageSizes ?? [];
  for (let i = 0, g = 0; i < items.length; i += sizes[g - 1] ?? per) {
    const size = sizes[g++] ?? per;
    const d = items[i].p.difficulty;
    if (d !== last) {
      sections.push({ title: `${capitalize(d)} puzzles`, index: pages.length });
      last = d;
    }
    pages.push(page(items.slice(i, i + size), per, headerText, false, false));
  }
  const solutionsIndex = pages.length;
  for (let i = 0; i < items.length; i += answersPer) pages.push(page(items.slice(i, i + answersPer), answersPer, headerText, true, i === 0));
  sections.push({ title: "Solutions", index: solutionsIndex });
  return { pages, sections, solutionsIndex, howTo: sudokuHowTo(), titleDetail: `${puzzles.length} Sudoku Puzzle${puzzles.length === 1 ? "" : "s"}` };
}

export function buildSudokuBook(puzzles: SudokuPuzzle[], opts: SudokuBookOptions, fonts: FontData): RenderedBook {
  if (!puzzles.length) throw new Error("No sudoku puzzles to export.");
  const design = opts.design ?? DEFAULT_DESIGN;
  return renderBook({
    trim: opts.trim,
    bleed: opts.bleed,
    frontMatter: opts.frontMatter,
    extras: opts.extras,
    design,
    content: sudokuContent(puzzles, design, opts.puzzlesPerPage, opts.answersPerPage ?? 4, opts.pageSizes, opts.firstNumber ?? 1),
    padForKdp: opts.padForKdp,
    fonts,
    volume: opts.volume,
    onPage: opts.onPage,
    slots: opts.slots,
  });
}
