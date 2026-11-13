/** Word search book: puzzle pages then answer keys, on the shared KDP renderer. */
import type { jsPDF } from "jspdf";
import { Placement, placementCells } from "./engine";
import { placementCapsule } from "./geometry";
import { FrontMatter } from "../print/frontMatter";
import { TrimKey } from "../print/kdp";
import { PageContext, PageRenderer, PdfFonts, RenderedBook, SANS, centered, heading, renderBook } from "../print/book";

export interface BookPuzzle {
  title: string;
  size: number;
  grid: string[][];
  words: string[]; // words as listed on the page (may contain spaces / hyphens)
  placements: Placement[];
}

export interface WordSearchBookOptions {
  trim: TrimKey;
  bleed: boolean;
  answersPerPage: 1 | 2 | 4 | 6;
  frontMatter: FrontMatter | null;
  includeHowTo?: boolean;
  padForKdp?: boolean;
}

export const WORD_SEARCH_HOW_TO = {
  heading: "How to Play",
  paragraphs: [
    "Find every word from the list hidden in the grid. Words run in straight lines: across, down, or diagonally, and some may be spelled backwards.",
    "Words and phrases are hidden without their spaces or hyphens, so ICE CREAM appears in the grid as ICECREAM.",
    "Circle each word as you find it and cross it off the list. Solutions are at the back of the book.",
  ],
};

function drawPolygon(pdf: jsPDF, pts: [number, number][], style: "S" | "F" | "FD") {
  const deltas: number[][] = [];
  for (let i = 1; i < pts.length; i++) deltas.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
  pdf.lines(deltas, pts[0][0], pts[0][1], [1, 1], style, true);
}

export function drawWordSearchGrid(pdf: jsPDF, puzzle: BookPuzzle, x: number, y: number, cell: number, answers: boolean) {
  const n = puzzle.size;
  const side = n * cell;
  const solution = new Set<string>();
  if (answers) {
    pdf.setLineWidth(Math.max(0.5, cell * 0.04));
    pdf.setDrawColor(40, 40, 40);
    pdf.setFillColor(222, 222, 222);
    for (const p of puzzle.placements) drawPolygon(pdf, placementCapsule(p, x, y, cell), "FD");
    for (const p of puzzle.placements) for (const [r, c] of placementCells(p)) solution.add(`${r},${c}`);
  }
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(1.2);
  const pad = cell * 0.15;
  pdf.rect(x - pad, y - pad, side + 2 * pad, side + 2 * pad, "S");
  pdf.setFontSize(cell * 0.6);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const on = !answers || solution.has(`${r},${c}`);
      pdf.setFont(SANS, answers && on ? "bold" : "normal");
      if (answers && !on) pdf.setTextColor(150, 150, 150);
      else pdf.setTextColor(0, 0, 0);
      centered(pdf, puzzle.grid[r][c], x + (c + 0.5) * cell, y + (r + 0.5) * cell + cell * 0.03);
    }
  }
  pdf.setTextColor(0, 0, 0);
  pdf.setFont(SANS, "normal");
}

function puzzlePage(pz: BookPuzzle): PageRenderer {
  return (ctx: PageContext) => {
    const { pdf, box, s } = ctx;
    const gridTop = heading(ctx, pz.title) + 4 * s;
    const fs = 12.5 * s;
    const leading = fs * 1.45;
    pdf.setFont(SANS, "normal");
    pdf.setFontSize(fs);
    const longest = Math.max(0, ...pz.words.map((w) => pdf.getTextWidth(w)));
    let cols = pz.words.length >= 12 ? 4 : 3;
    while (cols > 1 && longest + 12 > box.w / cols) cols--;
    const rows = Math.ceil(pz.words.length / cols);
    const colW = box.w / cols;
    const listH = rows * leading + 24 * s;
    const availH = box.h - (gridTop - box.y) - listH - 12 * s;
    const cell = Math.min(box.w / (pz.size + 0.3), availH / (pz.size + 0.3), 34);
    const side = cell * pz.size;
    drawWordSearchGrid(pdf, pz, box.x + (box.w - side) / 2, gridTop + cell * 0.15, cell, false);

    const listTop = gridTop + side + cell * 0.3 + 22 * s;
    pdf.setFont(SANS, "bold");
    pdf.setFontSize(11 * s);
    pdf.text("Find these words:", box.x, listTop);
    pdf.setFont(SANS, "normal");
    pdf.setFontSize(fs);
    pz.words.forEach((w, k) => {
      const col = Math.floor(k / rows);
      const row = k % rows;
      pdf.text(w, box.x + col * colW, listTop + (row + 1) * leading);
    });
  };
}

function answersPage(puzzles: BookPuzzle[], first: boolean, per: number): PageRenderer {
  return (ctx: PageContext) => {
    const { pdf, box, s } = ctx;
    const top = first ? heading(ctx, "Answers") : box.y;
    const cols = per <= 2 ? 1 : 2;
    const rows = per === 1 ? 1 : per === 2 ? 2 : per === 4 ? 2 : 3;
    const gap = 18 * s;
    const slotW = (box.w - gap * (cols - 1)) / cols;
    const slotH = (box.y + box.h - top - gap * (rows - 1)) / rows;
    puzzles.forEach((pz, k) => {
      const col = k % cols;
      const row = Math.floor(k / cols);
      const sx = box.x + col * (slotW + gap);
      const sy = top + row * (slotH + gap);
      const labelH = 18 * s;
      pdf.setFont(SANS, "bold");
      pdf.setFontSize(11 * s);
      centered(pdf, pz.title, sx + slotW / 2, sy + 8 * s);
      const cell = Math.min(slotW / (pz.size + 0.3), (slotH - labelH) / (pz.size + 0.3), 30);
      const side = cell * pz.size;
      drawWordSearchGrid(pdf, pz, sx + (slotW - side) / 2, sy + labelH + cell * 0.15, cell, true);
    });
  };
}

export function wordSearchContent(puzzles: BookPuzzle[], answersPerPage: number): { content: PageRenderer[]; puzzlePages: number; answerPages: number } {
  const content: PageRenderer[] = puzzles.map(puzzlePage);
  let answerPages = 0;
  for (let i = 0; i < puzzles.length; i += answersPerPage) {
    content.push(answersPage(puzzles.slice(i, i + answersPerPage), i === 0, answersPerPage));
    answerPages++;
  }
  return { content, puzzlePages: puzzles.length, answerPages };
}

export function buildWordSearchBook(puzzles: BookPuzzle[], opts: WordSearchBookOptions, fonts: PdfFonts): RenderedBook {
  if (puzzles.length === 0) throw new Error("No finished puzzles to export.");
  const { content } = wordSearchContent(puzzles, opts.answersPerPage);
  return renderBook({
    trim: opts.trim,
    bleed: opts.bleed,
    frontMatter: opts.frontMatter,
    howTo: opts.includeHowTo === false ? null : WORD_SEARCH_HOW_TO,
    titleDetail: `${puzzles.length} Word Search Puzzle${puzzles.length === 1 ? "" : "s"}`,
    content,
    padForKdp: opts.padForKdp,
    fonts,
  });
}
