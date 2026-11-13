import type { jsPDF } from "jspdf";
import { SudokuPuzzle, capitalize } from "./index";
import { FrontMatter } from "../print/frontMatter";
import { TrimKey } from "../print/kdp";
import { PageContext, PageRenderer, PdfFonts, RenderedBook, SANS, centered, heading, renderBook } from "../print/book";

export interface SudokuBookOptions {
  trim: TrimKey;
  bleed: boolean;
  frontMatter: FrontMatter | null;
  puzzlesPerPage: 1 | 2 | 4;
  padForKdp?: boolean;
}

export const SUDOKU_HOW_TO = {
  heading: "How to Play",
  paragraphs: [
    "Fill every empty square with a number from 1 to 9 so that each row, each column and each of the nine 3×3 boxes contains every number exactly once.",
    "Every puzzle has a single solution. Solutions are at the back of the book.",
  ],
};

export function drawSudokuGrid(pdf: jsPDF, p: SudokuPuzzle, x: number, y: number, size: number, answers: boolean) {
  const cell = size / 9;
  pdf.setDrawColor(0, 0, 0);
  for (let i = 0; i <= 9; i++) {
    pdf.setLineWidth(i % 3 === 0 ? Math.max(1.2, size * 0.008) : Math.max(0.4, size * 0.002));
    pdf.line(x + i * cell, y, x + i * cell, y + size);
    pdf.line(x, y + i * cell, x + size, y + i * cell);
  }
  pdf.setFontSize(cell * 0.58);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const given = p.board[r][c];
      const v = given || (answers ? p.solution[r][c] : 0);
      if (!v) continue;
      pdf.setFont(SANS, given ? "bold" : "normal");
      if (!given) pdf.setTextColor(110, 110, 110);
      else pdf.setTextColor(0, 0, 0);
      centered(pdf, String(v), x + (c + 0.5) * cell, y + (r + 0.53) * cell);
    }
  }
  pdf.setTextColor(0, 0, 0);
}

function slots(box: { x: number; y: number; w: number; h: number }, top: number, per: number, labelH: number, gap: number) {
  const cols = per >= 4 ? 2 : 1;
  const rows = per === 1 ? 1 : 2;
  const slotW = (box.w - gap * (cols - 1)) / cols;
  const slotH = (box.y + box.h - top - gap * (rows - 1)) / rows;
  const size = Math.min(slotW, slotH - labelH);
  return Array.from({ length: per }, (_, k) => {
    const col = k % cols;
    const row = Math.floor(k / cols);
    const sx = box.x + col * (slotW + gap);
    const sy = top + row * (slotH + gap);
    const capped = Math.min(size, 6.2 * 72);
    const extra = per === 1 ? (slotH - labelH - capped) / 3 : 0;
    return { cx: sx + slotW / 2, sy: sy + extra, gx: sx + (slotW - capped) / 2, gy: sy + labelH + extra, size: capped };
  });
}

function page(items: { p: SudokuPuzzle; title: string }[], per: number, headingText: string | null, answers: boolean): PageRenderer {
  return (ctx: PageContext) => {
    const { pdf, box, s } = ctx;
    const top = headingText ? heading(ctx, headingText) : box.y;
    const spots = slots(box, top, per, 22 * s, 22 * s);
    items.forEach(({ p, title }, k) => {
      const sp = spots[k];
      pdf.setFont(SANS, "bold");
      pdf.setFontSize(12 * s);
      centered(pdf, `${title} · ${capitalize(p.difficulty)}`, sp.cx, sp.sy + 8 * s);
      drawSudokuGrid(pdf, p, sp.gx, sp.gy, sp.size, answers);
    });
  };
}

export function buildSudokuBook(puzzles: SudokuPuzzle[], opts: SudokuBookOptions, fonts: PdfFonts): RenderedBook {
  const items = puzzles.map((p, i) => ({ p, title: `Puzzle ${i + 1}` }));
  const content: PageRenderer[] = [];
  for (let i = 0; i < items.length; i += opts.puzzlesPerPage) {
    content.push(page(items.slice(i, i + opts.puzzlesPerPage), opts.puzzlesPerPage, null, false));
  }
  for (let i = 0; i < items.length; i += 4) content.push(page(items.slice(i, i + 4), 4, i === 0 ? "Solutions" : null, true));
  return renderBook({
    trim: opts.trim,
    bleed: opts.bleed,
    frontMatter: opts.frontMatter,
    howTo: SUDOKU_HOW_TO,
    titleDetail: `${puzzles.length} Sudoku Puzzle${puzzles.length === 1 ? "" : "s"}`,
    content,
    padForKdp: opts.padForKdp,
    fonts,
  });
}
