/**
 * KDP-ready vector PDF interior for word search books, drawn with jsPDF
 * text and paths (no screenshots). Layout follows /workspace/wordsearch/pdf.py.
 */
import { jsPDF } from "jspdf";
import { Placement, placementCells } from "./engine";
import { placementCapsule } from "./geometry";
import { PT, PageSpec, TrimKey, contentBox, makePageSpec, paddedPageCount } from "./kdp";

export interface BookPuzzle {
  title: string;
  size: number;
  grid: string[][];
  words: string[]; // words listed on the page (placed words)
  placements: Placement[];
}

export interface BookOptions {
  trim: TrimKey;
  bleed: boolean;
  title: string;
  author?: string;
  answersPerPage: 1 | 2 | 4 | 6;
  includeFrontMatter: boolean;
  year?: number;
}

export interface FontData {
  /** Base64 TrueType data (embedded into the PDF). */
  regular: string;
  bold: string;
}

export type PagePlan =
  | { kind: "title" }
  | { kind: "intro" }
  | { kind: "puzzle"; index: number }
  | { kind: "answers"; indices: number[]; first: boolean }
  | { kind: "blank" };

export interface BookPlan {
  pages: PagePlan[];
  contentPages: number;
  pageCount: number;
  spec: PageSpec;
}

export const FONT = "DejaVuSans";

export function planBook(puzzles: BookPuzzle[], opts: BookOptions): BookPlan {
  const pages: PagePlan[] = [];
  if (opts.includeFrontMatter) pages.push({ kind: "title" }, { kind: "intro" });
  puzzles.forEach((_, index) => pages.push({ kind: "puzzle", index }));
  for (let i = 0; i < puzzles.length; i += opts.answersPerPage) {
    const indices = puzzles.slice(i, i + opts.answersPerPage).map((_, k) => i + k);
    pages.push({ kind: "answers", indices, first: i === 0 });
  }
  const contentPages = pages.length;
  const pageCount = paddedPageCount(contentPages);
  while (pages.length < pageCount) pages.push({ kind: "blank" });
  return { pages, contentPages, pageCount, spec: makePageSpec(opts.trim, pageCount, opts.bleed) };
}

function scaleFor(trim: TrimKey): number {
  return trim === "6x9" ? 0.8 : 1;
}

function drawCentered(pdf: jsPDF, text: string, cx: number, y: number) {
  pdf.text(text, cx, y, { align: "center", baseline: "middle" });
}

function drawPolygon(pdf: jsPDF, pts: [number, number][], style: "S" | "F" | "FD") {
  const deltas: number[][] = [];
  for (let i = 1; i < pts.length; i++) deltas.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
  pdf.lines(deltas, pts[0][0], pts[0][1], [1, 1], style, true);
}

function drawGrid(
  pdf: jsPDF,
  puzzle: BookPuzzle,
  x: number,
  y: number,
  cell: number,
  answers: boolean
) {
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
  // Frame
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(1.2);
  const pad = cell * 0.15;
  pdf.rect(x - pad, y - pad, side + 2 * pad, side + 2 * pad, "S");

  pdf.setFontSize(cell * 0.6);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const on = !answers || solution.has(`${r},${c}`);
      pdf.setFont(FONT, answers && on ? "bold" : "normal");
      if (answers && !on) pdf.setTextColor(150, 150, 150);
      else pdf.setTextColor(0, 0, 0);
      drawCentered(pdf, puzzle.grid[r][c], x + (c + 0.5) * cell, y + (r + 0.5) * cell + cell * 0.03);
    }
  }
  pdf.setTextColor(0, 0, 0);
  pdf.setFont(FONT, "normal");
}

function wordListLayout(pdf: jsPDF, words: string[], width: number, fontSize: number) {
  pdf.setFont(FONT, "normal");
  pdf.setFontSize(fontSize);
  const longest = Math.max(0, ...words.map((w) => pdf.getTextWidth(w)));
  let cols = words.length >= 12 ? 4 : 3;
  while (cols > 1 && longest + 10 > width / cols) cols--;
  const rows = Math.ceil(words.length / cols);
  return { cols, rows, colW: width / cols };
}

export function buildBookPdf(puzzles: BookPuzzle[], opts: BookOptions, fonts: FontData): { pdf: jsPDF; plan: BookPlan } {
  if (puzzles.length === 0) throw new Error("No puzzles to export.");
  const plan = planBook(puzzles, opts);
  const { spec } = plan;
  const W = spec.pageWidth * PT;
  const H = spec.pageHeight * PT;
  const s = scaleFor(opts.trim);

  const pdf = new jsPDF({ unit: "pt", format: [W, H], orientation: "portrait", compress: true, putOnlyUsedFonts: true });
  pdf.addFileToVFS("DejaVuSans.ttf", fonts.regular);
  pdf.addFont("DejaVuSans.ttf", FONT, "normal");
  pdf.addFileToVFS("DejaVuSans-Bold.ttf", fonts.bold);
  pdf.addFont("DejaVuSans-Bold.ttf", FONT, "bold");
  pdf.setFont(FONT, "normal");
  pdf.setProperties({ title: opts.title, author: opts.author ?? "", creator: "Puzzle Generator (kdpen)" });

  const pageNumber = (page: number) => {
    const box = contentBox(spec, page);
    pdf.setFont(FONT, "normal");
    pdf.setFontSize(10 * s);
    pdf.setTextColor(60, 60, 60);
    drawCentered(pdf, String(page), box.x + box.w / 2, H - (spec.bottom * PT) / 2);
    pdf.setTextColor(0, 0, 0);
  };

  plan.pages.forEach((pg, i) => {
    const page = i + 1;
    if (i > 0) pdf.addPage([W, H], "portrait");
    const box = contentBox(spec, page);
    const cx = box.x + box.w / 2;

    if (pg.kind === "blank") return;

    if (pg.kind === "title") {
      pdf.setFont(FONT, "bold");
      pdf.setFontSize(30 * s);
      const lines = pdf.splitTextToSize(opts.title || "Word Search", box.w) as string[];
      lines.forEach((l, k) => drawCentered(pdf, l, cx, box.y + box.h * 0.38 + k * 36 * s));
      pdf.setLineWidth(1);
      const ruleY = box.y + box.h * 0.38 + lines.length * 36 * s;
      pdf.line(cx - box.w * 0.18, ruleY, cx + box.w * 0.18, ruleY);
      pdf.setFont(FONT, "normal");
      pdf.setFontSize(14 * s);
      drawCentered(pdf, `${puzzles.length} Word Search Puzzles`, cx, ruleY + 28 * s);
      if (opts.author) drawCentered(pdf, opts.author, cx, box.y + box.h * 0.8);
      return;
    }

    if (pg.kind === "intro") {
      pdf.setFont(FONT, "bold");
      pdf.setFontSize(16 * s);
      pdf.text("How to Play", box.x, box.y + 16 * s);
      pdf.setFont(FONT, "normal");
      pdf.setFontSize(11 * s);
      const how =
        "Find every word from the list hidden in the grid. Words run in straight lines: across, down, or diagonally, and some may be backwards. Circle each word as you find it. Solutions are at the back of the book.";
      const lines = pdf.splitTextToSize(how, box.w) as string[];
      lines.forEach((l, k) => pdf.text(l, box.x, box.y + 40 * s + k * 16 * s));
      const year = opts.year ?? new Date().getFullYear();
      pdf.setFontSize(9 * s);
      pdf.setTextColor(80, 80, 80);
      pdf.text(`Copyright © ${year} ${opts.author || ""}. All rights reserved.`.replace(" .", "."), box.x, box.y + box.h - 10);
      pdf.setTextColor(0, 0, 0);
      return;
    }

    if (pg.kind === "puzzle") {
      const pz = puzzles[pg.index];
      pdf.setFont(FONT, "bold");
      pdf.setFontSize(18 * s);
      pdf.text(pz.title, box.x, box.y + 14 * s);
      pdf.setLineWidth(0.9);
      pdf.line(box.x, box.y + 24 * s, box.x + box.w, box.y + 24 * s);

      const fs = 12 * s;
      const leading = fs * 1.45;
      const layout = wordListLayout(pdf, pz.words, box.w, fs);
      const listH = layout.rows * leading + 22 * s;
      const gridTop = box.y + 40 * s;
      const availH = box.h - (gridTop - box.y) - listH - 12 * s;
      let cell = Math.min(box.w / (pz.size + 0.3), availH / (pz.size + 0.3));
      cell = Math.min(cell, 34);
      const side = cell * pz.size;
      const gx = box.x + (box.w - side) / 2;
      drawGrid(pdf, pz, gx, gridTop + cell * 0.15, cell, false);

      // Word list
      const listTop = gridTop + side + cell * 0.3 + 22 * s;
      pdf.setFont(FONT, "bold");
      pdf.setFontSize(11 * s);
      pdf.text("Find these words:", box.x, listTop);
      pdf.setFont(FONT, "normal");
      pdf.setFontSize(fs);
      pz.words.forEach((w, k) => {
        const col = Math.floor(k / layout.rows);
        const row = k % layout.rows;
        pdf.text(w, box.x + col * layout.colW, listTop + (row + 1) * leading);
      });
      pageNumber(page);
      return;
    }

    if (pg.kind === "answers") {
      let top = box.y;
      if (pg.first) {
        pdf.setFont(FONT, "bold");
        pdf.setFontSize(18 * s);
        pdf.text("Answers", box.x, box.y + 14 * s);
        pdf.setLineWidth(0.9);
        pdf.line(box.x, box.y + 24 * s, box.x + box.w, box.y + 24 * s);
        top = box.y + 34 * s;
      }
      const per = opts.answersPerPage;
      const cols = per <= 2 ? 1 : 2;
      const rows = per === 1 ? 1 : per === 2 ? 2 : per === 4 ? 2 : 3;
      const gap = 18 * s;
      const slotW = (box.w - gap * (cols - 1)) / cols;
      const slotH = (box.y + box.h - top - gap * (rows - 1)) / rows;
      pg.indices.forEach((pi, k) => {
        const pz = puzzles[pi];
        const col = k % cols;
        const row = Math.floor(k / cols);
        const sx = box.x + col * (slotW + gap);
        const sy = top + row * (slotH + gap);
        const labelH = 18 * s;
        pdf.setFont(FONT, "bold");
        pdf.setFontSize(11 * s);
        drawCentered(pdf, pz.title, sx + slotW / 2, sy + 8 * s);
        const cell = Math.min(slotW / (pz.size + 0.3), (slotH - labelH) / (pz.size + 0.3), 30);
        const side = cell * pz.size;
        drawGrid(pdf, pz, sx + (slotW - side) / 2, sy + labelH + cell * 0.15, cell, true);
      });
      pageNumber(page);
    }
  });

  return { pdf, plan };
}

/** Browser helper: fetch a font from /public and return base64. */
export async function fetchFontBase64(url: string): Promise<string> {
  const buf = await (await fetch(url)).arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}
