/** Crossword book pages in the chosen design. */
import type { jsPDF } from "jspdf";
import { ClueEntry, Crossword, cellNumbers, clueLists, generateCrossword } from "./engine";
import { mulberry32 } from "../wordsearch/engine";
import { FrontMatter } from "../print/frontMatter";
import { TrimKey } from "../print/kdp";
import { FontData } from "../print/fonts";
import { BookContent, BookExtras, PageContext, PageRenderer, RenderedBook, SANS, Section, heading, paragraph, renderBook } from "../print/book";
import { Look, drawCheckbox, panel, paint } from "../design/paint";
import { tint } from "../design/color";
import { DEFAULT_DESIGN } from "../design/templates";
import { Design, TOOL_HEADER } from "../design/types";

export interface CrosswordItem {
  cw: Crossword;
  title: string;
  theme?: string;
}

export interface CrosswordBookOptions {
  trim: TrimKey;
  bleed: boolean;
  frontMatter: FrontMatter | null;
  extras: BookExtras;
  design?: Design;
  answersPerPage?: 1 | 2 | 4 | 6;
  padForKdp?: boolean;
  volume?: { n: number; of: number };
  onPage?: (done: number, total: number) => void;
}

export function drawCrosswordGrid(pdf: jsPDF, look: Look, cw: Crossword, x: number, y: number, cell: number, answers: boolean, filled?: Set<string>) {
  const nums = cellNumbers(cw);
  const g = look.design.grid;
  const rounded = g.border === "rounded";
  const shadeOn = (r: number, c: number) => (g.shade === "rows" ? r % 2 === 1 : g.shade === "checker" ? (r + c) % 2 === 1 : false);
  const shade = look.design.color.grayscale ? ([238, 238, 238] as [number, number, number]) : tint(look.accent, 0.9);
  const lw = Math.max(0.6, Math.min(2, (g.frame || 1) * 0.55, cell * 0.06));
  const gf = look.font(look.design.fonts.grid);
  const nf = look.font(look.design.fonts.list);
  for (let r = 0; r < cw.height; r++) {
    for (let c = 0; c < cw.width; c++) {
      const ch = cw.grid[r][c];
      if (!ch) continue;
      const cx = x + c * cell;
      const cy = y + r * cell;
      paint.fill(pdf, shadeOn(r, c) ? shade : [255, 255, 255]);
      paint.stroke(pdf, [0, 0, 0]);
      pdf.setLineWidth(lw);
      if (rounded) pdf.roundedRect(cx + 0.6, cy + 0.6, cell - 1.2, cell - 1.2, cell * 0.18, cell * 0.18, "FD");
      else pdf.rect(cx, cy, cell, cell, "FD");
      const n = nums.get(`${r},${c}`);
      if (n) {
        pdf.setFont(nf, "normal");
        pdf.setFontSize(Math.max(4.5, cell * 0.28));
        pdf.setTextColor(0, 0, 0);
        pdf.text(String(n), cx + cell * 0.09, cy + cell * 0.3);
      }
      if (answers || filled?.has(`${r},${c}`)) {
        pdf.setFont(gf, "bold");
        pdf.setFontSize(cell * 0.55 * look.design.fonts.gridScale);
        pdf.text(ch, cx + cell / 2, cy + cell * 0.6, { align: "center", baseline: "middle" });
      }
    }
  }
}

/** Clue columns; returns the height used. Draws only when draw=true. */
function clueColumns(pdf: jsPDF, look: Look, cw: Crossword, x: number, y: number, w: number, size: number, draw: boolean): number {
  const { across, down } = clueLists(cw);
  const checkbox = look.design.list.checkbox;
  const lf = look.font(look.design.fonts.list);
  const hf = look.font(look.design.fonts.heading);
  const gap = 16;
  const colW = (w - gap) / 2;
  const leading = size * 1.35;
  let maxH = 0;
  [
    { title: "ACROSS", list: across, cx: x },
    { title: "DOWN", list: down, cx: x + colW + gap },
  ].forEach(({ title, list, cx }) => {
    let cy = y;
    pdf.setFont(hf, "bold");
    pdf.setFontSize(size + 1.5);
    if (draw) {
      paint.textColor(pdf, look.ink);
      pdf.text(title, cx, cy);
      pdf.setTextColor(0, 0, 0);
    }
    cy += leading * 1.35;
    pdf.setFont(lf, "normal");
    pdf.setFontSize(size);
    const box = checkbox ? size * 0.85 + 4 : 0;
    for (const p of list) {
      const numW = pdf.getTextWidth("00. ") + box;
      const lines = pdf.splitTextToSize(`${p.clue} (${p.letters.length})`, colW - numW) as string[];
      if (draw) {
        if (checkbox) drawCheckbox(pdf, cx, cy - size * 0.72, size * 0.78);
        pdf.setFont(lf, "bold");
        pdf.text(`${p.number}.`, cx + box, cy);
        pdf.setFont(lf, "normal");
        lines.forEach((l, i) => pdf.text(l, cx + numW, cy + i * leading));
      }
      cy += lines.length * leading + size * 0.35;
    }
    maxH = Math.max(maxH, cy - y);
  });
  return maxH;
}

function puzzlePage(it: CrosswordItem, number: number, headerText: string): PageRenderer {
  return (ctx: PageContext) => {
    const { pdf, box, s, look } = ctx;
    const top = heading(ctx, headerText, number, it.title) + 6 * s;
    let size = 10.5 * s * look.design.fonts.listScale;
    let cluesH = clueColumns(pdf, look, it.cw, box.x, 0, box.w - 16, size, false);
    while (cluesH > box.h * 0.46 && size > 6.5) {
      size -= 0.5;
      cluesH = clueColumns(pdf, look, it.cw, box.x, 0, box.w - 16, size, false);
    }
    const availH = box.y + box.h - top - cluesH - 30 * s;
    const cell = Math.max(10, Math.min((box.w - 10) / it.cw.width, availH / it.cw.height, 34 * s));
    const gw = cell * it.cw.width;
    const gh = cell * it.cw.height;
    const gx = box.x + (box.w - gw) / 2;
    panel(pdf, { x: gx - 10, y: top - 6, w: gw + 20, h: gh + 12 }, look, 10);
    drawCrosswordGrid(pdf, look, it.cw, gx, top, cell, false);
    const cy = top + gh + 26 * s;
    panel(pdf, { x: box.x, y: cy - 16 * s, w: box.w, h: cluesH + 16 * s }, look, 10);
    clueColumns(pdf, look, it.cw, box.x + 8, cy, box.w - 16, size, true);
  };
}

function answerPage(items: { it: CrosswordItem; number: number }[], first: boolean, per: number): PageRenderer {
  return (ctx: PageContext) => {
    const { pdf, box, s, look } = ctx;
    const top = first ? heading(ctx, "SOLUTIONS") + 4 * s : box.y;
    const cols = per <= 2 ? 1 : 2;
    const rows = per === 1 ? 1 : per === 2 ? 2 : per === 4 ? 2 : 3;
    const gap = 18 * s;
    const slotW = (box.w - gap * (cols - 1)) / cols;
    const slotH = (box.y + box.h - top - gap * (rows - 1)) / rows;
    items.forEach(({ it, number }, k) => {
      const sx = box.x + (k % cols) * (slotW + gap);
      const sy = top + Math.floor(k / cols) * (slotH + gap);
      const cell = Math.min(slotW / it.cw.width, (slotH - 22 * s) / it.cw.height, 26);
      const gw = cell * it.cw.width;
      panel(pdf, { x: sx, y: sy - 2, w: slotW, h: slotH }, look, 8);
      pdf.setFont(look.font(look.design.fonts.heading), "bold");
      pdf.setFontSize(10.5 * s);
      paint.textColor(pdf, look.ink);
      pdf.text((pdf.splitTextToSize(`#${number}  ${it.title}`, slotW) as string[])[0], sx + slotW / 2, sy + 8 * s, { align: "center", baseline: "middle" });
      pdf.setTextColor(0, 0, 0);
      drawCrosswordGrid(pdf, look, it.cw, sx + (slotW - gw) / 2, sy + 22 * s, cell, true);
    });
  };
}

const DEMO: ClueEntry[] = [
  { answer: "PUZZLE", clue: "A game that makes you think" },
  { answer: "PEN", clue: "You write with it" },
  { answer: "ZEBRA", clue: "Striped animal" },
  { answer: "LEMON", clue: "Sour yellow fruit" },
];

export function crosswordHowTo(): PageRenderer {
  return (ctx: PageContext) => {
    const { pdf, box, s, look } = ctx;
    let y = heading(ctx, "HOW TO PLAY") + 10 * s;
    panel(pdf, { x: box.x - 8, y: y - 8, w: box.w + 16, h: box.y + box.h - y }, look, 12);
    pdf.setFont(SANS, "normal");
    pdf.setTextColor(25, 25, 25);
    y = paragraph(pdf, "Read each clue and write the answer in the squares that start at the matching number, one letter per square. ACROSS answers run left to right; DOWN answers run top to bottom. The number in brackets tells you how many letters the answer has.", box.x, y + 4 * s, box.w, 12 * s, 18 * s) + 14 * s;
    const cw = generateCrossword(DEMO, mulberry32(11), 30);
    const cell = Math.min(26 * s, (box.w * 0.5) / Math.max(1, cw.width));
    const gx = box.x + box.w - cw.width * cell;
    const first = cw.placements.find((p) => p.across) ?? cw.placements[0];
    const filled = new Set<string>();
    if (first) for (let i = 0; i < first.letters.length; i++) filled.add(first.across ? `${first.row},${first.col + i}` : `${first.row + i},${first.col}`);
    drawCrosswordGrid(pdf, look, cw, gx, y, cell, false, filled);
    clueColumns(pdf, look, cw, box.x, y + 12 * s, box.w - cw.width * cell - 20, 10 * s, true);
    y += Math.max(cw.height * cell, 120 * s) + 26 * s;
    pdf.setFont(SANS, "normal");
    const tips = [
      "Start with the clues you are sure about: their letters help with the crossing answers.",
      "Phrases are written without spaces or hyphens.",
      "Work in pencil so you can change your mind.",
    ];
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

export function crosswordContent(items: CrosswordItem[], design: Design = DEFAULT_DESIGN, answersPerPage = 2): BookContent {
  const headerText = design.header.text.trim() || TOOL_HEADER.crossword;
  const pages: PageRenderer[] = items.map((it, i) => puzzlePage(it, i + 1, headerText));
  const sections: Section[] = [];
  const themed = items.some((i) => i.theme);
  if (!themed) sections.push({ title: "Crosswords", index: 0 });
  let last: string | undefined;
  items.forEach((it, i) => {
    if (themed && it.theme !== last) {
      sections.push({ title: it.theme || "More crosswords", index: i });
      last = it.theme;
    }
  });
  const solutionsIndex = pages.length;
  for (let i = 0; i < items.length; i += answersPerPage) pages.push(answerPage(items.slice(i, i + answersPerPage).map((it, k) => ({ it, number: i + k + 1 })), i === 0, answersPerPage));
  sections.push({ title: "Solutions", index: solutionsIndex });
  return { pages, sections, solutionsIndex, howTo: crosswordHowTo(), titleDetail: `${items.length} Crossword Puzzle${items.length === 1 ? "" : "s"}` };
}

export function buildCrosswordBook(items: CrosswordItem[], opts: CrosswordBookOptions, fonts: FontData): RenderedBook {
  if (!items.length) throw new Error("No crosswords to export.");
  const design = opts.design ?? DEFAULT_DESIGN;
  return renderBook({
    trim: opts.trim,
    bleed: opts.bleed,
    frontMatter: opts.frontMatter,
    extras: opts.extras,
    design,
    content: crosswordContent(items, design, opts.answersPerPage ?? 2),
    padForKdp: opts.padForKdp,
    fonts,
    volume: opts.volume,
    onPage: opts.onPage,
  });
}
