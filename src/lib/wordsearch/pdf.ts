/** Word search book pages in the chosen design, on the shared KDP renderer. */
import type { Slot } from "../print/arrange";
import { OUTLINE_PAD, OutlineStyle, ShapeKey, maskBox, letteredOutlines, shapeMask } from "../shapes/shapes";
import type { jsPDF } from "jspdf";
import { Placement, fillGrid, makePlacement, mulberry32, placementCells } from "./engine";
import { placementCapsule } from "./geometry";
import { FrontMatter } from "../print/frontMatter";
import { TrimKey } from "../print/kdp";
import { FontData } from "../print/fonts";
import { BookContent, BookExtras, PageContext, PageRenderer, RenderedBook, Section, SANS, heading, paragraph, renderBook } from "../print/book";
import { Look, drawArrow, drawCheckbox, drawFrame, drawFrameShadow, drawGridBody, drawList, drawListBox, drawOutline, drawOutlineBacking, layoutList, listBoxPad, panel, paint, poly, sortList } from "../design/paint";
import { DEFAULT_DESIGN } from "../design/templates";
import { Design, TOOL_HEADER } from "../design/types";

export interface BookPuzzle {
  title: string;
  /** Theme / section name (optional). */
  theme?: string;
  size: number;
  grid: string[][];
  words: string[]; // words as listed on the page (may contain spaces / hyphens)
  placements: Placement[];
  /** Grid shape (square when missing); grid cells outside it are "". */
  shape?: ShapeKey;
}

export interface WordSearchBookOptions {
  trim: TrimKey;
  bleed: boolean;
  answersPerPage: 1 | 2 | 4 | 6;
  frontMatter: FrontMatter | null;
  extras: BookExtras;
  design?: Design;
  padForKdp?: boolean;
  volume?: { n: number; of: number };
  onPage?: (done: number, total: number) => void;
  /** Custom page order from the preview (items must already be in arranged order). */
  slots?: Slot[];
  /** Number of the first puzzle (for volumes that continue numbering). */
  firstNumber?: number;
}

function capsuleFill(look: Look): [number, number, number] {
  return look.design.color.grayscale ? [218, 218, 218] : look.soft;
}

export interface GridDrawOptions {
  answers: boolean;
  /** Draw a white panel behind the grid (patterned pages). */
  backing?: boolean;
}

/** Letter font size in points for a grid whose cells are `cell` points wide. */
export function wsLetterSize(cell: number, design: Design): number {
  const cellsScale = design.grid.cells === "plain" ? 1 : 0.9;
  const sized = Math.min(cell * 0.6 * design.fonts.gridScale, cell * 0.82) * cellsScale;
  // On large, tight-fitting animal grids the 0.6× cell size can dip under 7pt;
  // keep letters readable whenever the cell itself can hold a 7pt glyph.
  const floor = 7 * cellsScale * Math.min(1, design.fonts.gridScale);
  if (sized < floor && cell * 0.82 * cellsScale >= floor) return floor;
  return sized;
}

/**
 * Where a puzzle sits, in cell units: the used rows/cols (shapes are cropped
 * to their cells) and the outline around them. (0,0) is the first used cell.
 */
export interface WsGeometry {
  rows: number;
  cols: number;
  r0: number;
  c0: number;
  isCell: (r: number, c: number) => boolean;
  /** Outline rings in cell units relative to the crop (holes after the first), or null for the plain square frame. */
  outline: [number, number][][] | null;
  /** Drawing extent (cells + outline) in cell units. */
  ext: { x0: number; y0: number; x1: number; y1: number };
}

export function wsGeometry(pz: Pick<BookPuzzle, "size" | "shape">, outlineStyle: OutlineStyle = "smooth"): WsGeometry {
  const n = pz.size;
  const mask = shapeMask(pz.shape, n);
  if (!mask) return { rows: n, cols: n, r0: 0, c0: 0, isCell: () => true, outline: null, ext: { x0: -OUTLINE_PAD, y0: -OUTLINE_PAD, x1: n + OUTLINE_PAD, y1: n + OUTLINE_PAD } };
  const [r0, c0, r1, c1] = maskBox(mask, n);
  const outline = letteredOutlines(pz.shape, n, outlineStyle).map((ring) => ring.map(([x, y]) => [x - c0, y - r0] as [number, number]));
  const rows = r1 - r0 + 1;
  const cols = c1 - c0 + 1;
  const xs = outline.flatMap((ring) => ring.map((p) => p[0]));
  const ys = outline.flatMap((ring) => ring.map((p) => p[1]));
  return {
    rows,
    cols,
    r0,
    c0,
    isCell: (r, c) => !!mask[r + r0]?.[c + c0],
    outline,
    ext: { x0: Math.min(-OUTLINE_PAD, ...xs), y0: Math.min(-OUTLINE_PAD, ...ys), x1: Math.max(cols + OUTLINE_PAD, ...xs), y1: Math.max(rows + OUTLINE_PAD, ...ys) },
  };
}

/** Draw a word search grid with its first used cell at (x, y). */
export function drawWordSearchGrid(pdf: jsPDF, look: Look, puzzle: BookPuzzle, x: number, y: number, cell: number, o: GridDrawOptions) {
  const geo = wsGeometry(puzzle, look.design.shape.outline ?? "smooth");
  const { rows, cols, r0, c0 } = geo;
  const pad = cell * OUTLINE_PAD;
  const frameBox = { x: x - pad, y: y - pad, w: cols * cell + 2 * pad, h: rows * cell + 2 * pad };
  const outline = geo.outline?.map((ring) => ring.map(([px, py]) => [x + px * cell, y + py * cell] as [number, number])) ?? null;
  if (outline) drawOutlineBacking(pdf, outline, look, cell);
  else {
    if (o.backing) panel(pdf, { x: frameBox.x - 4, y: frameBox.y - 4, w: frameBox.w + 8, h: frameBox.h + 8 }, look, 10);
    drawFrameShadow(pdf, frameBox, look, cell);
  }
  drawGridBody(pdf, x, y, cell, rows, cols, look, geo.isCell);
  // Placements use full-grid coordinates; (ox, oy) is where cell (0,0) of the full grid would be.
  const ox = x - c0 * cell;
  const oy = y - r0 * cell;
  const solution = new Set<string>();
  if (o.answers) {
    pdf.setLineWidth(Math.max(0.45, cell * 0.04));
    paint.stroke(pdf, [60, 60, 60]);
    paint.fill(pdf, capsuleFill(look));
    for (const p of puzzle.placements) {
      const pts = placementCapsule(p, ox, oy, cell);
      poly(pdf, pts, "FD");
      for (const [r, c] of placementCells(p)) solution.add(`${r},${c}`);
    }
  }
  const gf = look.font(look.design.fonts.grid);
  const size = wsLetterSize(cell, look.design);
  pdf.setFontSize(size);
  let current = "";
  for (let r = r0; r < r0 + rows; r++) {
    for (let c = c0; c < c0 + cols; c++) {
      const ch = puzzle.grid[r]?.[c];
      if (!ch) continue;
      const on = !o.answers || solution.has(`${r},${c}`);
      const style = o.answers && on ? "bold" : "normal";
      const key = style + (on ? 1 : 0);
      if (key !== current) {
        pdf.setFont(gf, style);
        if (o.answers && !on) pdf.setTextColor(165, 165, 165);
        else pdf.setTextColor(0, 0, 0);
        current = key;
      }
      pdf.text(ch, ox + (c + 0.5) * cell, oy + (r + 0.5) * cell + size * 0.04, { align: "center", baseline: "middle" });
    }
  }
  pdf.setTextColor(0, 0, 0);
  if (outline) drawOutline(pdf, outline, look, cell);
  else drawFrame(pdf, frameBox, look, cell);
}

function puzzlePage(pz: BookPuzzle, number: number, headerText: string): PageRenderer {
  return (ctx: PageContext) => {
    const { pdf, box, s, look } = ctx;
    const d = look.design;
    const top = heading(ctx, headerText, number, pz.title) + 6 * s;
    const items = sortList(pz.words, d.list.sort);
    const lf = look.font(d.fonts.list);
    const lpad = listBoxPad(look);
    const listW = box.w - 16 - lpad * 2;
    const base = Math.max(8.5, Math.min(13, 13.5 - items.length / 10)) * s * d.fonts.listScale;
    let layout = layoutList(pdf, items, listW, lf, base, { columns: d.list.columns, checkbox: d.list.checkbox });
    const gapH = 22 * s + lpad;
    let availH = box.y + box.h - top - layout.height - gapH - 14 - lpad;
    while (availH < box.h * 0.55 && layout.fontSize > 7) {
      layout = layoutList(pdf, items, listW, lf, layout.fontSize - 0.5, { columns: d.list.columns, checkbox: d.list.checkbox });
      availH = box.y + box.h - top - layout.height - gapH - 14 - lpad;
    }
    const geo = wsGeometry(pz, look.design.shape.outline ?? "smooth");
    const extW = geo.ext.x1 - geo.ext.x0;
    const extH = geo.ext.y1 - geo.ext.y0;
    const cell = Math.min((box.w - 10) / (extW + 0.06), availH / (extH + 0.06), 36 * s);
    const gx = box.x + (box.w - extW * cell) / 2 - geo.ext.x0 * cell;
    const gy = top + (0.08 - geo.ext.y0) * cell;
    drawWordSearchGrid(pdf, look, pz, gx, gy, cell, { answers: false, backing: true });
    const listTop = gy + geo.ext.y1 * cell + cell * 0.08 + gapH;
    panel(pdf, { x: box.x, y: listTop - 10 - lpad, w: box.w, h: layout.height + 18 + lpad * 2 }, look, 10);
    drawListBox(pdf, { x: box.x + 2, y: listTop - 10 - lpad + 2, w: box.w - 4, h: layout.height + 14 + lpad * 2 }, look);
    drawList(pdf, items, box.x + 8 + lpad, listTop - 2, listW, lf, layout, d.list.checkbox);
  };
}

function answersPage(puzzles: { pz: BookPuzzle; number: number }[], first: boolean, per: number): PageRenderer {
  return (ctx: PageContext) => {
    const { pdf, box, s, look } = ctx;
    const top = first ? heading(ctx, "SOLUTIONS") + 4 * s : box.y;
    const cols = per <= 2 ? 1 : 2;
    const rows = per === 1 ? 1 : per === 2 ? 2 : per === 4 ? 2 : 3;
    const gap = 16 * s;
    const slotW = (box.w - gap * (cols - 1)) / cols;
    const slotH = (box.y + box.h - top - gap * (rows - 1)) / rows;
    const hf = look.font(look.design.fonts.heading);
    puzzles.forEach(({ pz, number }, k) => {
      const col = k % cols;
      const row = Math.floor(k / cols);
      const sx = box.x + col * (slotW + gap);
      const sy = top + row * (slotH + gap);
      const labelH = 18 * s;
      const geo = wsGeometry(pz, look.design.shape.outline ?? "smooth");
      const extW = geo.ext.x1 - geo.ext.x0;
      const extH = geo.ext.y1 - geo.ext.y0;
      const cell = Math.min(slotW / (extW + 0.16), (slotH - labelH) / (extH + 0.16), 30);
      const gx = sx + (slotW - extW * cell) / 2 - geo.ext.x0 * cell;
      const gy = sy + labelH + (0.08 - geo.ext.y0) * cell;
      const pw = extW * cell + cell * 0.56;
      panel(pdf, { x: sx + (slotW - pw) / 2, y: sy - 2, w: pw, h: extH * cell + labelH + cell * 0.36 }, look, 8);
      pdf.setFont(hf, "bold");
      pdf.setFontSize(10.5 * s);
      paint.textColor(pdf, look.ink);
      const label = pz.title && !/^Puzzle \d+$/.test(pz.title) ? `#${number}  ${pz.title}` : `Puzzle #${number}`;
      pdf.text((pdf.splitTextToSize(label, slotW) as string[])[0], sx + slotW / 2, sy + 8 * s, { align: "center", baseline: "middle" });
      pdf.setTextColor(0, 0, 0);
      drawWordSearchGrid(pdf, look, pz, gx, gy, cell, { answers: true });
    });
  };
}

// ---------------------------------------------------------------- how to play

const DEMO: [string, number, number, "E" | "S" | "SE" | "W" | "N"][] = [
  ["PUZZLE", 0, 1, "E"],
  ["FIND", 1, 0, "S"],
  ["LOOK", 2, 2, "SE"],
  ["WORD", 7, 6, "W"],
  ["GRID", 6, 7, "N"],
];

export function demoPuzzle(): BookPuzzle {
  const placements = DEMO.map(([w, r, c, d]) => makePlacement(w, r, c, d));
  const { grid } = fillGrid(8, placements, mulberry32(2026));
  return { title: "Example", size: 8, grid, words: DEMO.map((d) => d[0]), placements };
}

export function wordSearchHowTo(checkbox: boolean): PageRenderer {
  return (ctx: PageContext) => {
    const { pdf, box, s, look } = ctx;
    const hf = look.font(look.design.fonts.heading);
    const lf = look.font(look.design.fonts.list);
    let y = heading(ctx, "HOW TO PLAY") + 10 * s;
    panel(pdf, { x: box.x - 8, y: y - 8, w: box.w + 16, h: box.y + box.h - y }, look, 12);
    pdf.setFont(SANS, "normal");
    pdf.setTextColor(25, 25, 25);
    y = paragraph(pdf, "Every puzzle hides the words from its list inside the letter grid. Words run in straight lines and never bend. When you find one, draw a loop around it" + (checkbox ? " and tick its box on the list." : " and cross it off the list."), box.x, y + 4 * s, box.w, 12 * s, 18 * s) + 16 * s;

    // Legend (left) + real mini puzzle with its solution (right)
    const demo = demoPuzzle();
    const cell = Math.min(24 * s, (box.w * 0.5) / 8.6);
    const gx = box.x + box.w - cell * 8 - cell * 0.4;
    const gy = y + 6;
    drawWordSearchGrid(pdf, look, demo, gx, gy, cell, { answers: true });
    const lx = box.x;
    pdf.setFont(hf, "bold");
    pdf.setFontSize(13 * s);
    pdf.text("Words can run:", lx, y + 10 * s);
    const rows: [string, number, number][] = [
      ["Across", 1, 0],
      ["Down", 0, 1],
      ["Diagonally", 1, 1],
      ["Backwards or upwards", -1, 0],
    ];
    rows.forEach(([label, dx, dy], i) => {
      const ry = y + 38 * s + i * 30 * s;
      const ax = lx + 14 * s;
      const len = 11 * s;
      drawArrow(pdf, ax - dx * len, ry - dy * len, ax + dx * len, ry + dy * len, look.accent, 1.6);
      if (label.startsWith("Backwards")) drawArrow(pdf, ax + 22 * s, ry + len, ax + 22 * s, ry - len, look.accent, 1.6);
      pdf.setFont(lf, "normal");
      pdf.setFontSize(12 * s);
      pdf.setTextColor(0, 0, 0);
      pdf.text(label, lx + 44 * s, ry, { baseline: "middle" });
    });
    // Mini word list under the grid, ticked
    let wy = gy + cell * 8 + cell * 0.6 + 14 * s;
    pdf.setFont(lf, "normal");
    pdf.setFontSize(10 * s);
    const colW = (cell * 8) / 2;
    demo.words.forEach((w, i) => {
      const wx = gx + (i % 2) * colW;
      const yy = wy + Math.floor(i / 2) * 15 * s;
      if (checkbox) drawCheckbox(pdf, wx, yy - 4.5 * s, 8 * s, true);
      pdf.text(w, wx + (checkbox ? 12 * s : 0), yy, { baseline: "middle" });
    });
    wy += Math.ceil(demo.words.length / 2) * 15 * s;
    y = Math.max(wy, y + 38 * s + 4 * 30 * s) + 20 * s;

    // Tips
    pdf.setFont(hf, "bold");
    pdf.setFontSize(13 * s);
    pdf.text("Tips", box.x, y);
    y += 8 * s;
    pdf.setFont(SANS, "normal");
    pdf.setTextColor(25, 25, 25);
    const tips = [
      "Start with words that contain rare letters such as Q, X, Z, J or K: they are easier to spot.",
      "Scan one row at a time for the first letter of a word, then check all eight directions around it.",
      "Phrases are hidden without spaces or hyphens: ICE CREAM appears as ICECREAM.",
      "Words may cross and share letters.",
    ];
    for (const t of tips) {
      paint.fill(pdf, look.accent);
      pdf.circle(box.x + 4, y + 9 * s, 2 * s, "F");
      y = paragraph(pdf, t, box.x + 14, y + 12 * s, box.w - 14, 11.5 * s, 16 * s) + 2 * s;
    }
    pdf.setFont(hf, "bold");
    pdf.setFontSize(12 * s);
    paint.textColor(pdf, look.ink);
    pdf.text(`Solutions start on page ${ctx.solutionsPage}.`, box.x + box.w / 2, box.y + box.h - 10 * s, { align: "center" });
    pdf.setTextColor(0, 0, 0);
  };
}

// ---------------------------------------------------------------- assembly

export function wordSearchContent(puzzles: BookPuzzle[], answersPerPage: number, design: Design = DEFAULT_DESIGN, firstNumber = 1): BookContent {
  const headerText = design.header.text.trim() || TOOL_HEADER["word-search"];
  const pages: PageRenderer[] = puzzles.map((pz, i) => puzzlePage(pz, firstNumber + i, headerText));
  const sections: Section[] = [];
  let lastTheme: string | undefined;
  const themed = puzzles.some((p) => p.theme);
  if (!themed) sections.push({ title: "Puzzles", index: 0 });
  puzzles.forEach((p, i) => {
    if (themed && p.theme !== lastTheme) {
      sections.push({ title: p.theme || "More puzzles", index: i });
      lastTheme = p.theme;
    }
  });
  const solutionsIndex = pages.length;
  for (let i = 0; i < puzzles.length; i += answersPerPage) {
    pages.push(answersPage(puzzles.slice(i, i + answersPerPage).map((pz, k) => ({ pz, number: firstNumber + i + k })), i === 0, answersPerPage));
  }
  sections.push({ title: "Solutions", index: solutionsIndex });
  return {
    pages,
    sections,
    solutionsIndex,
    howTo: wordSearchHowTo(design.list.checkbox),
    titleDetail: `${puzzles.length} Word Search Puzzle${puzzles.length === 1 ? "" : "s"}`,
  };
}

export function buildWordSearchBook(puzzles: BookPuzzle[], opts: WordSearchBookOptions, fonts: FontData): RenderedBook {
  if (puzzles.length === 0) throw new Error("No finished puzzles to export.");
  const design = opts.design ?? DEFAULT_DESIGN;
  return renderBook({
    trim: opts.trim,
    bleed: opts.bleed,
    frontMatter: opts.frontMatter,
    extras: opts.extras,
    design,
    content: wordSearchContent(puzzles, opts.answersPerPage, design, opts.firstNumber ?? 1),
    padForKdp: opts.padForKdp,
    fonts,
    volume: opts.volume,
    onPage: opts.onPage,
    slots: opts.slots,
  });
}
