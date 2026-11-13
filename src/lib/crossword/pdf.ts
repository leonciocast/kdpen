import type { jsPDF } from "jspdf";
import { Crossword, cellNumbers, clueLists } from "./engine";
import { FrontMatter } from "../print/frontMatter";
import { TrimKey } from "../print/kdp";
import { PageContext, PageRenderer, PdfFonts, RenderedBook, SANS, centered, heading, renderBook } from "../print/book";

export interface CrosswordBookOptions {
  trim: TrimKey;
  bleed: boolean;
  frontMatter: FrontMatter | null;
  padForKdp?: boolean;
}

export const CROSSWORD_HOW_TO = {
  heading: "How to Play",
  paragraphs: [
    "Read each clue and write the answer in the matching numbered squares, one letter per square. Across answers run left to right; Down answers run top to bottom.",
    "Answers that are phrases are written without spaces or hyphens. Solutions are at the back of the book.",
  ],
};

export function drawCrosswordGrid(pdf: jsPDF, cw: Crossword, x: number, y: number, cell: number, answers: boolean) {
  const nums = cellNumbers(cw);
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(Math.max(0.6, cell * 0.045));
  for (let r = 0; r < cw.height; r++) {
    for (let c = 0; c < cw.width; c++) {
      const ch = cw.grid[r][c];
      if (!ch) continue;
      const cx = x + c * cell;
      const cy = y + r * cell;
      pdf.rect(cx, cy, cell, cell, "S");
      const n = nums.get(`${r},${c}`);
      if (n) {
        pdf.setFont(SANS, "normal");
        pdf.setFontSize(Math.max(5, cell * 0.28));
        pdf.text(String(n), cx + cell * 0.08, cy + cell * 0.3);
      }
      if (answers) {
        pdf.setFont(SANS, "bold");
        pdf.setFontSize(cell * 0.55);
        centered(pdf, ch, cx + cell / 2, cy + cell * 0.6);
      }
    }
  }
}

/** Clue column layout: returns height used. Draws only when draw=true. */
function clueColumns(pdf: jsPDF, cw: Crossword, x: number, y: number, w: number, size: number, draw: boolean): number {
  const { across, down } = clueLists(cw);
  const gap = 16;
  const colW = (w - gap) / 2;
  const leading = size * 1.35;
  let maxH = 0;
  [
    { title: "Across", list: across, cx: x },
    { title: "Down", list: down, cx: x + colW + gap },
  ].forEach(({ title, list, cx }) => {
    let cy = y;
    pdf.setFont(SANS, "bold");
    pdf.setFontSize(size + 1);
    if (draw) pdf.text(title, cx, cy);
    cy += leading * 1.3;
    pdf.setFont(SANS, "normal");
    pdf.setFontSize(size);
    for (const p of list) {
      const numW = pdf.getTextWidth("00. ");
      const lines = pdf.splitTextToSize(p.clue, colW - numW) as string[];
      if (draw) {
        pdf.setFont(SANS, "bold");
        pdf.text(`${p.number}.`, cx, cy);
        pdf.setFont(SANS, "normal");
        lines.forEach((l, i) => pdf.text(l, cx + numW, cy + i * leading));
      }
      cy += lines.length * leading + size * 0.35;
    }
    maxH = Math.max(maxH, cy - y);
  });
  return maxH;
}

function puzzlePage(cw: Crossword, title: string): PageRenderer {
  return (ctx: PageContext) => {
    const { pdf, box, s } = ctx;
    const top = heading(ctx, title) + 6 * s;
    let size = 10.5 * s;
    let cluesH = clueColumns(pdf, cw, box.x, 0, box.w, size, false);
    // Leave the grid at least ~45% of the page; shrink clue text if needed.
    while (cluesH > box.h * 0.5 && size > 7) {
      size -= 0.5;
      cluesH = clueColumns(pdf, cw, box.x, 0, box.w, size, false);
    }
    const availH = box.y + box.h - top - cluesH - 24 * s;
    const cell = Math.max(10, Math.min(box.w / cw.width, availH / cw.height, 30));
    const gw = cell * cw.width;
    drawCrosswordGrid(pdf, cw, box.x + (box.w - gw) / 2, top, cell, false);
    clueColumns(pdf, cw, box.x, top + cell * cw.height + 24 * s, box.w, size, true);
  };
}

function answerPage(items: { cw: Crossword; title: string }[], first: boolean): PageRenderer {
  return (ctx: PageContext) => {
    const { pdf, box, s } = ctx;
    const top = first ? heading(ctx, "Answers") : box.y;
    const gap = 20 * s;
    const slotH = (box.y + box.h - top - gap) / 2;
    items.forEach(({ cw, title }, k) => {
      const sy = top + k * (slotH + gap);
      pdf.setFont(SANS, "bold");
      pdf.setFontSize(11 * s);
      centered(pdf, title, box.x + box.w / 2, sy + 8 * s);
      const cell = Math.min(box.w / cw.width, (slotH - 22 * s) / cw.height, 26);
      drawCrosswordGrid(pdf, cw, box.x + (box.w - cell * cw.width) / 2, sy + 22 * s, cell, true);
    });
  };
}

export function buildCrosswordBook(items: { cw: Crossword; title: string }[], opts: CrosswordBookOptions, fonts: PdfFonts): RenderedBook {
  const content: PageRenderer[] = items.map((it) => puzzlePage(it.cw, it.title));
  for (let i = 0; i < items.length; i += 2) content.push(answerPage(items.slice(i, i + 2), i === 0));
  return renderBook({
    trim: opts.trim,
    bleed: opts.bleed,
    frontMatter: opts.frontMatter,
    howTo: CROSSWORD_HOW_TO,
    titleDetail: `${items.length} Crossword Puzzle${items.length === 1 ? "" : "s"}`,
    content,
    padForKdp: opts.padForKdp,
    fonts,
  });
}
