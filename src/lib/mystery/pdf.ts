/** Murder-mystery word search book pages (case files) on the shared KDP renderer. */
import type { jsPDF } from "jspdf";
import type { Slot } from "../print/arrange";
import type { FrontMatter } from "../print/frontMatter";
import type { TrimKey } from "../print/kdp";
import type { FontData } from "../print/fonts";
import { BookContent, BookExtras, PageContext, PageRenderer, RenderedBook, SANS, SERIF, Section, heading, renderBook } from "../print/book";
import { Look, drawCheckbox, drawList, layoutList, paint, sortList } from "../design/paint";
import { DEFAULT_DESIGN } from "../design/templates";
import type { Design } from "../design/types";
import { BookPuzzle, drawWordSearchGrid, puzzleOutline, wsGeometry } from "../wordsearch/pdf";
import type { Placement } from "../wordsearch/engine";
import type { ShapeKey } from "../shapes/shapes";
import { generateCaseGrid } from "./engine";
import { keyInstruction } from "./model";
import type { CaseStyle, MysteryCase, MysteryItem, Person } from "./types";

export const MYSTERY_HEADER = "CASE FILE";

export interface MysteryBookOptions {
  trim: TrimKey;
  bleed: boolean;
  answersPerPage: 1 | 2 | 4 | 6;
  frontMatter: FrontMatter | null;
  extras: BookExtras;
  design?: Design;
  padForKdp?: boolean;
  onPage?: (done: number, total: number) => void;
  slots?: Slot[];
  style?: CaseStyle;
}

type RGB = [number, number, number];
type Rect = { x: number; y: number; w: number; h: number };

export function casePuzzle(c: MysteryCase): BookPuzzle {
  return { title: c.title, size: c.size, grid: c.grid, words: c.words, placements: c.placements as Placement[], shape: c.shape as ShapeKey | undefined };
}

const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] * (1 - t) + b[i] * t)) as RGB;
const WHITE: RGB = [255, 255, 255];
/** Casebook palette: a calm warm-neutral surface, hairlines, near-black ink; the accent is used sparingly. */
const SURFACE: RGB = [248, 246, 242];
const CHIP: RGB = [241, 238, 233];
const INK: RGB = [28, 28, 32];
const BODY: RGB = [58, 58, 64];
const MUTED: RGB = [118, 116, 122];
const paper = (look: Look): RGB => (look.design.color.grayscale ? [246, 246, 246] : SURFACE);
const rule = (look: Look): RGB => (look.design.color.grayscale ? [205, 205, 205] : [224, 220, 213]);
const ink = (pdf: jsPDF, c: RGB) => pdf.setTextColor(c[0], c[1], c[2]);
/** Small print never drops below 6.2pt, even on 6x9 pages. */
const small = (v: number, s: number) => Math.max(6.2, v * s);
void mix;

/** Answer grids: a thin outline instead of tiles, so the loops read clearly. */
export function answerLook(look: Look): Look {
  const l = caseLook(look);
  if (look.design.grid.cells !== "tiles") return l;
  return { ...l, soft: look.design.color.grayscale ? l.soft : [238, 234, 228], design: { ...l.design, grid: { ...l.design.grid, cells: "plain", border: l.design.grid.border === "none" ? "rounded" : l.design.grid.border, frame: 0.6 } } };
}

/** On case pages with soft tiles, the tiles draw the shape: no stepped or smooth outline on top. */
export function caseLook(look: Look): Look {
  if (look.design.grid.cells !== "tiles") return look;
  return { ...look, design: { ...look.design, shape: { ...look.design.shape, mix: "one", outline: "smooth", shade: false } } };
}

function card(pdf: jsPDF, r: Rect, look: Look, s: number, fill: RGB | null = paper(look), border = true) {
  if (fill) paint.fill(pdf, fill);
  paint.stroke(pdf, rule(look));
  pdf.setLineWidth(0.6);
  pdf.roundedRect(r.x, r.y, r.w, r.h, 6 * s, 6 * s, fill ? (border ? "FD" : "F") : "S");
}

/** Small letter-spaced label ("EVIDENCE"). */
function label(pdf: jsPDF, text: string, x: number, y: number, look: Look, s: number, color?: RGB, align: "left" | "center" | "right" = "left") {
  pdf.setFont(SANS, "bold");
  pdf.setFontSize(small(7.2, s));
  pdf.setCharSpace(1.4 * s);
  paint.textColor(pdf, color ?? look.ink);
  // jsPDF centers / right-aligns without the letter spacing; shift by it.
  const extra = text.length * 1.4 * s;
  const ax = align === "center" ? x - extra / 2 : align === "right" ? x - extra : x;
  pdf.text(text, ax, y, { align, baseline: "middle" });
  pdf.setCharSpace(0);
  pdf.setTextColor(0, 0, 0);
}

/** Folder tab sitting on the top edge of a card. */
function tab(pdf: jsPDF, text: string, x: number, y: number, look: Look, s: number) {
  pdf.setFont(SANS, "bold");
  pdf.setFontSize(7.4 * s);
  pdf.setCharSpace(1.1 * s);
  const w = pdf.getTextWidth(text) + 18 * s;
  const h = 13 * s;
  paint.fill(pdf, look.accent);
  pdf.roundedRect(x, y - h + 3 * s, w, h, 3.5 * s, 3.5 * s, "F");
  pdf.rect(x, y - 2 * s, w, 5 * s, "F");
  paint.textColor(pdf, look.onAccent);
  pdf.text(text, x + 9 * s, y - h / 2 + 3 * s, { baseline: "middle" });
  pdf.setCharSpace(0);
  pdf.setTextColor(0, 0, 0);
}

function stamp(pdf: jsPDF, text: string, rx: number, y: number, look: Look, s: number) {
  pdf.setFont(SANS, "bold");
  pdf.setFontSize(7 * s);
  pdf.setCharSpace(1.4 * s);
  const w = pdf.getTextWidth(text) + 12 * s;
  const h = 13 * s;
  paint.stroke(pdf, look.accent);
  pdf.setLineWidth(0.9);
  pdf.roundedRect(rx - w, y - h / 2, w, h, 2 * s, 2 * s, "S");
  paint.textColor(pdf, look.accent);
  pdf.text(text, rx - w / 2 + 0.7 * s, y + 0.3 * s, { align: "center", baseline: "middle" });
  pdf.setCharSpace(0);
  pdf.setTextColor(0, 0, 0);
}

/** Letter blanks grouped by word, wrapped to `w`. Fills them in when `fill`. Returns the bottom y. */
function blanks(pdf: jsPDF, text: string, x: number, y: number, w: number, s: number, look: Look, fill = false, cellW = 10 * s): number {
  const words = text.trim().toUpperCase().split(/\s+/).map((t) => t.replace(/[^A-ZÑ]/g, "")).filter(Boolean);
  const gap = cellW * 0.75;
  const rowH = cellW * 1.65;
  let cx = x;
  let cy = y;
  pdf.setFont(SANS, "bold");
  pdf.setFontSize(cellW * 0.86);
  for (const word of words) {
    const ww = word.length * cellW;
    if (cx > x && cx + ww > x + w) {
      cx = x;
      cy += rowH;
    }
    for (let i = 0; i < word.length; i++) {
      const lx = cx + i * cellW;
      paint.stroke(pdf, [110, 110, 114]);
      pdf.setLineWidth(0.7);
      pdf.line(lx + cellW * 0.14, cy, lx + cellW * 0.86, cy);
      if (fill) {
        paint.textColor(pdf, look.ink);
        pdf.text(word[i], lx + cellW / 2, cy - 2 * s, { align: "center" });
      }
    }
    cx += ww + gap;
  }
  pdf.setTextColor(0, 0, 0);
  return cy + 3 * s;
}

function blanksHeight(pdf: jsPDF, text: string, w: number, s: number, cellW = 10 * s): number {
  const words = text.trim().split(/\s+/).map((t) => t.replace(/[^A-Za-zÑñ]/g, "")).filter(Boolean);
  const gap = cellW * 0.75;
  let cx = 0;
  let rows = words.length ? 1 : 0;
  for (const word of words) {
    const ww = word.length * cellW;
    if (cx > 0 && cx + ww > w) {
      cx = 0;
      rows++;
    }
    cx += ww + gap;
  }
  return rows * cellW * 1.65;
}

/** Numbered key box. */
function keyBox(pdf: jsPDF, x: number, y: number, size: number, n: number, look: Look, s: number, letter?: string) {
  paint.fill(pdf, WHITE);
  paint.stroke(pdf, look.accent);
  pdf.setLineWidth(1.1);
  pdf.roundedRect(x, y, size, size, 2.5 * s, 2.5 * s, "FD");
  pdf.setFont(SANS, "bold");
  pdf.setFontSize(Math.max(7, size * 0.28));
  paint.textColor(pdf, look.ink);
  pdf.text(String(n), x + size * 0.1, y + size * 0.1, { baseline: "top" });
  if (letter) {
    pdf.setFontSize(size * 0.56);
    pdf.setTextColor(0, 0, 0);
    pdf.text(letter, x + size / 2, y + size * 0.6, { align: "center", baseline: "middle" });
  }
  pdf.setTextColor(0, 0, 0);
}

function lines(pdf: jsPDF, text: string, w: number, font: string, style: "normal" | "bold", size: number): string[] {
  pdf.setFont(font, style);
  pdf.setFontSize(size);
  return pdf.splitTextToSize(text, w) as string[];
}

/** Trait chips wrapped to `w`; returns their rows (each chip text with its width). */
function chipRows(pdf: jsPDF, traits: string[], w: number, s: number): { t: string; w: number }[][] {
  pdf.setFont(SANS, "normal");
  pdf.setFontSize(small(7, s));
  const padX = 4.2 * s;
  const gap = 3 * s;
  const rows: { t: string; w: number }[][] = [[]];
  let x = 0;
  for (const raw of traits) {
    const t = (pdf.splitTextToSize(raw, w - padX * 2) as string[])[0];
    const cw = pdf.getTextWidth(t) + padX * 2;
    if (x > 0 && x + cw > w) {
      rows.push([]);
      x = 0;
    }
    rows[rows.length - 1].push({ t, w: cw });
    x += cw + gap;
  }
  return rows.filter((r) => r.length);
}
const chipH = (s: number) => Math.max(11 * s, small(7, s) + 3.8);

/** A suspect card's content: name, role, trait chips. Returns the bottom y. */
function suspectBlock(pdf: jsPDF, p: Person, x: number, y: number, w: number, s: number, look: Look, culprit = false): number {
  const nameL = lines(pdf, p.name, w, SANS, "bold", 9.4 * s);
  let yy = y;
  ink(pdf, INK);
  nameL.forEach((l) => {
    pdf.text(l, x, yy, { baseline: "top" });
    yy += 11.5 * s;
  });
  if (culprit) {
    paint.stroke(pdf, look.accent);
    pdf.setLineWidth(1);
    pdf.line(x, yy + 0.5 * s, x + Math.min(w, pdf.getTextWidth(nameL[0])), yy + 0.5 * s);
  }
  if (p.role) {
    pdf.setFont(SANS, "normal");
    pdf.setFontSize(small(7.4, s));
    ink(pdf, MUTED);
    pdf.text((pdf.splitTextToSize(p.role, w) as string[])[0], x, yy, { baseline: "top" });
    yy += 10 * s;
  }
  yy += 4 * s;
  const ch = chipH(s);
  for (const row of chipRows(pdf, p.traits, w, s)) {
    let cx = x;
    for (const c of row) {
      paint.fill(pdf, look.design.color.grayscale ? [238, 238, 238] : CHIP);
      pdf.roundedRect(cx, yy, c.w, ch, ch / 2, ch / 2, "F");
      pdf.setFont(SANS, "normal");
      pdf.setFontSize(small(7, s));
      ink(pdf, [70, 70, 76]);
      pdf.text(c.t, cx + c.w / 2, yy + ch / 2 + 0.2 * s, { align: "center", baseline: "middle" });
      cx += c.w + 3 * s;
    }
    yy += ch + 3 * s;
  }
  pdf.setTextColor(0, 0, 0);
  return yy - 3 * s;
}

function suspectHeight(pdf: jsPDF, p: Person, w: number, s: number): number {
  let h = lines(pdf, p.name, w, SANS, "bold", 9.4 * s).length * 11.5 * s;
  if (p.role) h += 10 * s;
  const rows = chipRows(pdf, p.traits, w, s).length;
  return h + 4 * s + rows * (chipH(s) + 3 * s) - (rows ? 3 * s : 0);
}

// ---------------------------------------------------------------- case page

function casePage(c: MysteryCase, style: CaseStyle, headerText: string): PageRenderer {
  return (ctx: PageContext) => {
    const { pdf, box, s } = ctx;
    const look = caseLook(ctx.look);
    const d = look.design;
    void style;
    let y = heading(ctx, headerText, c.number, c.title);

    // ---- the story: a quiet lead paragraph
    const storySize = 10.2 * s;
    const storyLead = 14.4 * s;
    const storyL = lines(pdf, c.story, box.w * 0.92, SERIF, "normal", storySize);
    pdf.setFont(SERIF, "normal");
    pdf.setFontSize(storySize);
    ink(pdf, BODY);
    storyL.forEach((l, i) => pdf.text(l, box.x, y + storySize * 0.8 + i * storyLead));
    y += storyL.length * storyLead + 12 * s;

    // ---- suspects: three even cards
    const n = c.suspects.length;
    if (n) {
      label(pdf, "SUSPECTS", box.x, y, look, s, MUTED);
      y += 9 * s;
      const gap = 8 * s;
      const pad = 8 * s;
      const colW = (box.w - gap * (n - 1)) / n;
      const h = Math.max(...c.suspects.map((p) => suspectHeight(pdf, p, colW - pad * 2, s))) + pad * 2;
      c.suspects.forEach((p, i) => {
        const r = { x: box.x + i * (colW + gap), y, w: colW, h };
        card(pdf, r, look, s, WHITE);
        suspectBlock(pdf, p, r.x + pad, r.y + pad, colW - pad * 2, s, look);
      });
      y += h + 14 * s;
    }

    // ---- bottom: evidence list + detective notes
    const gap = 16 * s;
    const leftW = (box.w - gap) * 0.54;
    const rightW = box.w - gap - leftW;
    const pad = 10 * s;
    const items = sortList(c.words, d.list.sort);
    const lf = look.font(d.fonts.list);
    const base = Math.min(10, Math.max(8, 11 - items.length / 8)) * s * d.fonts.listScale;
    const layout = layoutList(pdf, items, leftW, lf, base, { columns: items.length > 6 ? 2 : 1, checkbox: d.list.checkbox, minSize: 7 });
    const leftH = 16 * s + layout.height;
    const cellW = 10.4 * s;
    const inner = rightW - pad * 2;
    const k = c.missing ? c.missing.word.replace(/[^A-ZÑ]/g, "").length : 0;
    const clueL = c.missing ? lines(pdf, c.missing.clue ? `${c.missing.clue} (${k} letters)` : `${k} letters`, inner, SERIF, "normal", 8.6 * s) : [];
    /** Detective notes: measured first (draw = false), then drawn at (rx, top). Returns the height. */
    const notes = (draw: boolean, rx: number, top: number): number => {
      let ry = top + pad + 4 * s;
      if (draw) label(pdf, "DETECTIVE NOTES", rx, ry, look, s);
      ry += 18 * s;
      const sub = (t: string) => {
        if (!draw) return;
        pdf.setFont(SANS, "bold");
        pdf.setFontSize(7.6 * s);
        ink(pdf, INK);
        pdf.text(t, rx, ry, { baseline: "middle" });
      };
      const blanksAt = (text: string, y0: number) => (draw ? blanks(pdf, text, rx, y0, inner, s, look, false, cellW) : y0 + blanksHeight(pdf, text, inner, s, cellW) - cellW * 1.65 + 3 * s);
      if (c.missing) {
        sub("Missing evidence");
        if (draw) {
          pdf.setFont(SERIF, "normal");
          pdf.setFontSize(8.6 * s);
          ink(pdf, BODY);
          clueL.forEach((l, i) => pdf.text(l, rx, ry + 12 * s + i * 11 * s));
        }
        ry += 12 * s + (clueL.length - 1) * 11 * s + cellW * 1.5;
        ry = blanksAt(c.missing.word, ry) + 14 * s;
      }
      if (c.message) {
        sub("Hidden message");
        ry += cellW * 1.6;
        ry = blanksAt(c.message, ry) + 14 * s;
      }
      if (c.culprit) {
        sub("Culprit");
        if (draw) {
          paint.stroke(pdf, [160, 160, 160]);
          pdf.setLineWidth(0.6);
          pdf.line(rx + 36 * s, ry + 3 * s, rx + inner, ry + 3 * s);
        }
        ry += 18 * s;
      }
      if (c.key) {
        const kb = 20 * s;
        if (draw) {
          paint.stroke(pdf, rule(look));
          pdf.setLineWidth(0.5);
          pdf.line(rx, ry - 4 * s, rx + inner, ry - 4 * s);
          keyBox(pdf, rx, ry + 4 * s, kb, c.key.box, look, s);
          pdf.setFont(SANS, "bold");
          pdf.setFontSize(7.8 * s);
          ink(pdf, INK);
          pdf.text(`Case Board · box ${c.key.box}`, rx + kb + 7 * s, ry + 10 * s, { baseline: "middle" });
          pdf.setFont(SERIF, "normal");
          pdf.setFontSize(8.2 * s);
          ink(pdf, BODY);
          pdf.text((pdf.splitTextToSize(keyInstruction(c.key), inner - kb - 7 * s) as string[])[0], rx + kb + 7 * s, ry + 19.5 * s, { baseline: "middle" });
        }
        ry += 4 * s + kb;
      }
      return ry + pad - top;
    };
    const rightH = notes(false, 0, 0);
    const bottomH = Math.max(leftH, rightH);
    const leadH = c.lead ? 24 * s : 0;
    const bottomY = box.y + box.h - bottomH - leadH;

    // ---- the puzzle: centered in the space that's left, tiles in an even rhythm
    const pz = casePuzzle(c);
    const geo = wsGeometry(pz, puzzleOutline(look, pz));
    const tiles = d.grid.cells === "tiles" && d.grid.border === "none";
    const extW = tiles ? geo.cols : geo.ext.x1 - geo.ext.x0;
    const extH = tiles ? geo.rows : geo.ext.y1 - geo.ext.y0;
    const ox0 = tiles ? 0 : geo.ext.x0;
    const oy0 = tiles ? 0 : geo.ext.y0;
    const gTop = y + 2 * s;
    const availH = bottomY - 16 * s - gTop;
    const cell = Math.min((box.w * 0.9) / extW, availH / extH, 27 * s);
    const gx = box.x + (box.w - extW * cell) / 2 - ox0 * cell;
    const gy = gTop + (availH - extH * cell) / 2 - oy0 * cell;
    drawWordSearchGrid(pdf, look, pz, gx, gy, cell, { answers: false, backing: true });

    // ---- evidence
    label(pdf, "EVIDENCE", box.x, bottomY + 4 * s, look, s);
    paint.stroke(pdf, rule(look));
    pdf.setLineWidth(0.6);
    pdf.line(box.x, bottomY + 10 * s, box.x + leftW, bottomY + 10 * s);
    drawList(pdf, items, box.x, bottomY + 18 * s + layout.fontSize * 0.4, leftW, lf, layout, d.list.checkbox);

    // ---- detective notes
    const right = { x: box.x + leftW + gap, y: bottomY - 6 * s, w: rightW, h: bottomH + 6 * s };
    card(pdf, right, look, s, paper(look), false);
    notes(true, right.x + pad, right.y);

    // ---- next lead: a refined footer line
    if (c.lead) {
      const fy = box.y + box.h - 4 * s;
      paint.stroke(pdf, rule(look));
      pdf.setLineWidth(0.6);
      pdf.line(box.x, fy - 14 * s, box.x + box.w, fy - 14 * s);
      pdf.setFont(SANS, "bold");
      pdf.setFontSize(7.2 * s);
      const kw = pdf.getTextWidth("NEXT LEAD") + 9 * 1.4 * s;
      pdf.setFont(SERIF, "normal");
      pdf.setFontSize(8.8 * s);
      const t = (pdf.splitTextToSize(c.lead, box.w - kw - 14 * s) as string[])[0];
      const tw = pdf.getTextWidth(t);
      const x0 = box.x + (box.w - kw - 10 * s - tw) / 2;
      label(pdf, "NEXT LEAD", x0, fy - 2.6 * s, look, s);
      pdf.setFont(SERIF, "normal");
      pdf.setFontSize(8.8 * s);
      ink(pdf, BODY);
      pdf.text(t, x0 + kw + 10 * s, fy);
    }
    pdf.setTextColor(0, 0, 0);
  };
}

// ---------------------------------------------------------------- board & finale

type BoardItem = Extract<MysteryItem, { kind: "board" }>;
type FinaleItem = Extract<MysteryItem, { kind: "finale" }>;

function boardPage(b: BoardItem): PageRenderer {
  return (ctx: PageContext) => {
    const { pdf, box, s, look } = ctx;
    let y = heading(ctx, "CASE BOARD", undefined, b.title) + 10 * s;
    pdf.setFont(SERIF, "normal");
    pdf.setFontSize(10 * s);
    pdf.setTextColor(30, 30, 30);
    const introL = pdf.splitTextToSize(b.intro, box.w) as string[];
    introL.forEach((l, i) => pdf.text(l, box.x, y + i * 14 * s + 8 * s));
    y += introL.length * 14 * s + 18 * s;

    // Suspect file
    label(pdf, "THE SUSPECT FILE", box.x, y, look, s);
    y += 10 * s;
    const cols = b.cast.length > 9 ? 4 : 3;
    const gap = 8 * s;
    const cw = (box.w - gap * (cols - 1)) / cols;
    const pad = 7 * s;
    const rows = Math.ceil(b.cast.length / cols);
    for (let r = 0; r < rows; r++) {
      const row = b.cast.slice(r * cols, r * cols + cols);
      const h = Math.max(...row.map((p) => suspectHeight(pdf, p, cw - pad * 2, s))) + pad * 2;
      row.forEach((p, i) => {
        const x = box.x + i * (cw + gap);
        card(pdf, { x, y, w: cw, h }, look, s, WHITE);
        suspectBlock(pdf, p, x + pad, y + pad, cw - pad * 2, s, look);
      });
      y += h + gap;
    }

    // Confession boxes
    y += 10 * s;
    const remaining = box.y + box.h - y;
    label(pdf, "THE FINAL ANSWER", box.x, y, look, s);
    pdf.setFont(SERIF, "normal");
    pdf.setFontSize(8.8 * s);
    pdf.setTextColor(80, 80, 80);
    pdf.text("Write each case key in its numbered box.", box.x + box.w, y, { align: "right", baseline: "middle" });
    pdf.setTextColor(0, 0, 0);
    y += 12 * s;
    const per = Math.min(12, b.boxes);
    const bgap = 5 * s;
    let size = Math.min(34 * s, (box.w - bgap * (per - 1)) / per);
    const rowsB = Math.ceil(b.boxes / per);
    if (rowsB * (size + bgap) > remaining - 24 * s) size = Math.max(14 * s, (remaining - 24 * s) / rowsB - bgap);
    const rowW = per * size + (per - 1) * bgap;
    for (let i = 0; i < b.boxes; i++) {
      const r = Math.floor(i / per);
      const c = i % per;
      keyBox(pdf, box.x + (box.w - rowW) / 2 + c * (size + bgap), y + r * (size + bgap), size, i + 1, look, s);
    }
    y += rowsB * (size + bgap) + 24 * s;

    // Case log: one line per case for the culprit's name.
    const cases = b.cases ?? 0;
    const rowH = 17 * s;
    const avail = box.y + box.h - y - 14 * s;
    const logCols = cases > 48 ? 4 : cases > 16 ? 3 : 2;
    if (cases > 0 && Math.ceil(cases / logCols) * rowH <= avail) {
      label(pdf, "CASE LOG", box.x, y, look, s);
      pdf.setFont(SERIF, "normal");
      pdf.setFontSize(8.8 * s);
      pdf.setTextColor(80, 80, 80);
      pdf.text("Note each culprit as you go.", box.x + box.w, y, { align: "right", baseline: "middle" });
      y += 16 * s;
      const per2 = Math.ceil(cases / logCols);
      const lgap = 16 * s;
      const lw = (box.w - lgap * (logCols - 1)) / logCols;
      for (let i = 0; i < cases; i++) {
        const x = box.x + Math.floor(i / per2) * (lw + lgap);
        const yy = y + (i % per2) * rowH + 8 * s;
        pdf.setFont(SANS, "bold");
        pdf.setFontSize(8 * s);
        paint.textColor(pdf, look.ink);
        pdf.text(String(i + 1).padStart(2, " "), x + 12 * s, yy, { align: "right" });
        paint.stroke(pdf, [170, 170, 170]);
        pdf.setLineWidth(0.5);
        pdf.line(x + 18 * s, yy + 1.5 * s, x + lw, yy + 1.5 * s);
      }
      pdf.setTextColor(0, 0, 0);
    }
  };
}

function finalePage(f: FinaleItem): PageRenderer {
  return (ctx: PageContext) => {
    const { pdf, box, s, look } = ctx;
    let y = heading(ctx, "CASE CLOSED") + 14 * s;
    pdf.setFont(SERIF, "normal");
    pdf.setFontSize(10.5 * s);
    pdf.setTextColor(30, 30, 30);
    const intro = "Copy the letters from your Case Board into the boxes below, in order. Read them together to reveal the truth behind every case.";
    const introL = pdf.splitTextToSize(intro, box.w * 0.9) as string[];
    introL.forEach((l, i) => pdf.text(l, box.x + box.w / 2, y + i * 15 * s + 8 * s, { align: "center" }));
    y += introL.length * 15 * s + 22 * s;
    // Boxes grouped by word.
    const words = f.phrase.split(/\s+/).map((w) => w.replace(/[^A-ZÑ]/g, "")).filter(Boolean);
    const bgap = 4 * s;
    const wgap = 16 * s;
    let size = 30 * s;
    const fits = (sz: number) => {
      const rows: string[][] = [[]];
      let w = 0;
      for (const word of words) {
        const ww = word.length * (sz + bgap) - bgap;
        if (w > 0 && w + wgap + ww > box.w) {
          rows.push([]);
          w = 0;
        }
        w += (w > 0 ? wgap : 0) + ww;
        rows[rows.length - 1].push(word);
      }
      return rows;
    };
    let rows = fits(size);
    while (rows.length > 3 && size > 16 * s) rows = fits((size -= 2 * s));
    let n = 0;
    const card0 = { x: box.x, y: y - 16 * s, w: box.w, h: rows.length * (size + 14 * s) + 18 * s };
    card(pdf, card0, look, s, paper(look), false);
    for (const row of rows) {
      const rw = row.reduce((a, w) => a + w.length * (size + bgap) - bgap, 0) + wgap * (row.length - 1);
      let x = box.x + (box.w - rw) / 2;
      for (const word of row) {
        for (let i = 0; i < word.length; i++) keyBox(pdf, x + i * (size + bgap), y, size, ++n, look, s);
        x += word.length * (size + bgap) - bgap + wgap;
      }
      y += size + 14 * s;
    }
    y = card0.y + card0.h + 28 * s;
    label(pdf, "THE LAST QUESTION", box.x + box.w / 2, y, look, s, undefined, "center");
    y += 22 * s;
    pdf.setFont(look.font(look.design.fonts.heading), "bold");
    pdf.setFontSize(13 * s);
    ink(pdf, INK);
    (pdf.splitTextToSize(f.question, box.w * 0.85) as string[]).forEach((l) => {
      pdf.text(l, box.x + box.w / 2, y, { align: "center" });
      y += 17 * s;
    });
    pdf.setTextColor(0, 0, 0);
    y += 8 * s;
    paint.stroke(pdf, [150, 150, 150]);
    pdf.setLineWidth(0.6);
    const bottom = box.y + box.h - 70 * s;
    for (let ly = y + 20 * s; ly < bottom; ly += 24 * s) pdf.line(box.x + box.w * 0.06, ly, box.x + box.w * 0.94, ly);
    // Sign-off
    const sy = box.y + box.h - 26 * s;
    pdf.setFont(SANS, "normal");
    pdf.setFontSize(8.5 * s);
    pdf.setTextColor(100, 100, 100);
    paint.stroke(pdf, [70, 70, 70]);
    const half = box.w * 0.38;
    pdf.line(box.x + box.w * 0.06, sy, box.x + box.w * 0.06 + half, sy);
    pdf.line(box.x + box.w * 0.94 - half * 0.6, sy, box.x + box.w * 0.94, sy);
    pdf.text("Case closed by", box.x + box.w * 0.06, sy + 11 * s);
    pdf.text("Date", box.x + box.w * 0.94 - half * 0.6, sy + 11 * s);
    pdf.setTextColor(0, 0, 0);
  };
}

// ---------------------------------------------------------------- solutions

type Entry = MysteryItem;

function solutionLines(c: MysteryCase): [string, string][] {
  const out: [string, string][] = [];
  if (c.message) out.push(["Message", c.message.toUpperCase()]);
  if (c.culprit) out.push(["Culprit", c.culprit.name + (c.trait ? ` (${c.trait})` : "")]);
  if (c.missing) out.push(["Missing", c.missing.word]);
  if (c.key) out.push(["Key", `Box ${c.key.box} = ${c.key.letter}`]);
  return out;
}

function answersPage(entries: Entry[], first: boolean, per: number): PageRenderer {
  return (ctx: PageContext) => {
    const { pdf, box, s } = ctx;
    const look = answerLook(ctx.look);
    const top = first ? heading(ctx, "SOLUTIONS") + 4 * s : box.y;
    const cols = per <= 2 ? 1 : 2;
    const rows = per === 1 ? 1 : per === 2 ? 2 : per === 4 ? 2 : 3;
    const gap = 14 * s;
    const slotW = (box.w - gap * (cols - 1)) / cols;
    const slotH = (box.y + box.h - top - gap * (rows - 1)) / rows;
    const hf = look.font(look.design.fonts.heading);
    entries.forEach((e, k) => {
      const sx = box.x + (k % cols) * (slotW + gap);
      const sy = top + Math.floor(k / cols) * (slotH + gap);
      const fs = (per >= 6 ? 7.2 : per >= 4 ? 7.8 : 9) * s;
      const lead = fs * 1.35;
      const ttl = (text: string) => {
        pdf.setFont(hf, "bold");
        pdf.setFontSize(10 * s);
        ink(pdf, INK);
        pdf.text((pdf.splitTextToSize(text, slotW - 10 * s) as string[])[0], sx + slotW / 2, sy + 9 * s, { align: "center", baseline: "middle" });
        pdf.setTextColor(0, 0, 0);
      };
      if (e.kind === "case") {
        const c = e.case;
        const info = solutionLines(c);
        // Wrap each line to measure.
        pdf.setFont(SANS, "bold");
        pdf.setFontSize(fs);
        const kw = Math.max(...info.map(([k2]) => pdf.getTextWidth(k2.toUpperCase()))) + 6 * s;
        pdf.setFont(SANS, "normal");
        const wrapAt = (kx0: number) => info.map(([k2, v]) => [k2, pdf.splitTextToSize(v, sx + slotW - (kx0 + kw) - 2 * s) as string[]] as const);
        let wrapped = wrapAt(sx + 2 * s);
        const infoH = wrapped.reduce((a, [, l]) => a + l.length * lead, 0) + 6 * s;
        const labelH = 18 * s;
        const pz = casePuzzle(c);
        const geo = wsGeometry(pz, puzzleOutline(look, pz));
        const extW = geo.ext.x1 - geo.ext.x0;
        const extH = geo.ext.y1 - geo.ext.y0;
        const cell = Math.min(slotW / (extW + 0.16), (slotH - labelH - infoH) / (extH + 0.16), 26);
        const gx = sx + (slotW - extW * cell) / 2 - geo.ext.x0 * cell;
        const gy = sy + labelH + (0.08 - geo.ext.y0) * cell;
        ttl(`#${c.number}  ${c.title}`);
        const em = new Set(c.messageCells.map(([r, cc]) => `${r},${cc}`));
        drawWordSearchGrid(pdf, look, pz, gx, gy, cell, { answers: true, dashed: c.extra ? [c.extra as Placement] : [], emphasis: em });
        let y = gy + geo.ext.y1 * cell + 4 * s + fs;
        // Line the labels up with the grid's left edge when the values still fit there.
        let kx = sx + Math.max(0, (slotW - extW * cell) / 2) + 2 * s;
        pdf.setFont(SANS, "normal");
        pdf.setFontSize(fs);
        const aligned = wrapAt(kx);
        if (aligned.every(([, l], i) => l.length === wrapped[i][1].length)) wrapped = aligned;
        else kx = sx + 2 * s;
        const vx = kx + kw;
        for (const [k2, l] of wrapped) {
          pdf.setFont(SANS, "bold");
          pdf.setFontSize(fs);
          paint.textColor(pdf, look.ink);
          pdf.text(k2.toUpperCase(), kx, y);
          pdf.setFont(SANS, "normal");
          pdf.setTextColor(20, 20, 20);
          l.forEach((line, i) => pdf.text(line, vx, y + i * lead));
          y += l.length * lead;
        }
        pdf.setTextColor(0, 0, 0);
      } else if (e.kind === "board") {
        ttl("The Case Board");
        let y = sy + 30 * s;
        pdf.setFont(SANS, "normal");
        pdf.setFontSize(fs);
        pdf.setTextColor(60, 60, 60);
        pdf.text("The boxes spell:", sx + slotW / 2, y, { align: "center" });
        y += 18 * s;
        pdf.setFont(hf, "bold");
        pdf.setFontSize(13 * s);
        paint.textColor(pdf, look.ink);
        (pdf.splitTextToSize(e.phrase, slotW - 10 * s) as string[]).forEach((l) => {
          pdf.text(l, sx + slotW / 2, y, { align: "center" });
          y += 16 * s;
        });
        y += 8 * s;
        const keys = e.keys.slice().sort((a, b2) => a.box - b2.box);
        pdf.setFont(SANS, "normal");
        pdf.setFontSize(fs * 0.95);
        // As many columns as the widest entry allows, so nothing runs past the slot.
        const widest = Math.max(...keys.map((kk) => pdf.getTextWidth(`${kk.box}. ${kk.letter}  (case ${kk.case})`))) + 10 * s;
        const cc = Math.max(1, Math.min(4, Math.floor((slotW - 6 * s) / widest)));
        const cw = (slotW - 6 * s) / cc;
        pdf.setTextColor(40, 40, 40);
        const rh = Math.min(lead * 1.15, (sy + slotH - y) / Math.ceil(keys.length / cc));
        keys.forEach((kk, i) => pdf.text(`${kk.box}. ${kk.letter}  (case ${kk.case})`, sx + (i % cc) * cw + 6 * s, y + Math.floor(i / cc) * rh));
        pdf.setTextColor(0, 0, 0);
      } else {
        ttl("Case Closed");
        let y = sy + 32 * s;
        pdf.setFont(hf, "bold");
        pdf.setFontSize(13 * s);
        paint.textColor(pdf, look.ink);
        (pdf.splitTextToSize(e.phrase, slotW - 10 * s) as string[]).forEach((l) => {
          pdf.text(l, sx + slotW / 2, y, { align: "center" });
          y += 16 * s;
        });
        y += 8 * s;
        pdf.setFont(SERIF, "normal");
        pdf.setFontSize(fs);
        pdf.setTextColor(30, 30, 30);
        const ll = pdf.splitTextToSize(e.epilogue, slotW - 12 * s) as string[];
        const maxL = Math.floor((sy + slotH - y) / lead);
        ll.slice(0, maxL).forEach((l, i) => pdf.text(l, sx + 6 * s, y + i * lead));
        pdf.setTextColor(0, 0, 0);
      }
    });
  };
}

// ---------------------------------------------------------------- how to solve

let demoCache: MysteryCase | null = null;
export function demoCase(): MysteryCase {
  if (demoCache) return demoCache;
  const words = ["CLUE", "LAMP", "NOTE", "KEY", "MAP"];
  const g = generateCaseGrid({ words, extra: "INK", message: ["THE COOK KNOWS WHY", "ASK THE GARDENER", "THE COOK DID IT", "IT WAS THE GARDENER", "ASK THE COOK"], dirs: ["E", "S", "SE"], seed: 11, minSize: 6, maxSize: 7 });
  demoCache = {
    number: 0,
    title: "Example",
    story: "",
    words,
    missing: { word: "INK", clue: "What a pen leaves behind" },
    suspects: [],
    message: g.message,
    size: g.size,
    mask: g.mask,
    grid: g.grid,
    placements: g.placements,
    extra: g.extra,
    messageCells: g.messageCells,
    blanks: g.blanks,
  };
  return demoCache;
}

export interface HowToFlags {
  missing: boolean;
  message: boolean;
  board: boolean;
  checkbox: boolean;
}

export function mysteryHowTo(f: HowToFlags): PageRenderer {
  return (ctx: PageContext) => {
    const { pdf, box, s } = ctx;
    const look = answerLook(ctx.look);
    const hf = look.font(look.design.fonts.heading);
    let y = heading(ctx, "HOW TO SOLVE") + 12 * s;
    const steps: [string, string][] = [["Read the brief", "Each case starts with a short story and its suspects. Note their traits."]];
    steps.push(["Find the evidence", `Every word on the evidence list is hidden once in the grid, in a straight line. Loop it and ${f.checkbox ? "tick its box" : "cross it off"}.`]);
    if (f.missing) steps.push(["Find the missing evidence", "One more word is hidden but not listed. The clue and its letter count point you to it."]);
    if (f.message) {
      steps.push(["Read the hidden message", "Cross out every word you found. The letters that are left, read left to right and top to bottom, spell a message. Dotted squares are empty."]);
      steps.push(["Name the culprit", "The message describes the culprit. Only one suspect fits it."]);
    }
    if (f.board) steps.push(["Fill the Case Board", "Each case tells you which letter of its answer goes into a numbered box. When the board is full, it reveals who was behind it all."]);
    const numR = 10 * s;
    const textX = box.x + numR * 2 + 10 * s;
    const textW = box.w - (textX - box.x);
    steps.forEach(([t, body], i) => {
      paint.fill(pdf, WHITE);
      paint.stroke(pdf, look.accent);
      pdf.setLineWidth(0.9);
      pdf.circle(box.x + numR, y + numR * 0.4, numR, "FD");
      pdf.setFont(SANS, "bold");
      pdf.setFontSize(9.5 * s);
      paint.textColor(pdf, look.ink);
      pdf.text(String(i + 1), box.x + numR, y + numR * 0.45, { align: "center", baseline: "middle" });
      pdf.setFont(hf, "bold");
      pdf.setFontSize(11.5 * s);
      ink(pdf, INK);
      pdf.text(t, textX, y + 3 * s);
      pdf.setFont(SANS, "normal");
      pdf.setFontSize(9.2 * s);
      ink(pdf, BODY);
      const bl = pdf.splitTextToSize(body, textW) as string[];
      bl.forEach((l, k) => pdf.text(l, textX, y + 17 * s + k * 13.4 * s));
      y += 17 * s + bl.length * 13.4 * s + 12 * s;
    });
    pdf.setTextColor(0, 0, 0);

    // Solved example
    const demo = demoCase();
    const pz = casePuzzle(demo);
    const avail = box.y + box.h - y - 60 * s;
    const cell = Math.max(12 * s, Math.min(27 * s, (avail - 40 * s) / (demo.size + 0.6)));
    const gw = demo.size * cell;
    const ex = { x: box.x, y: y, w: box.w, h: gw + cell * 0.6 + 44 * s };
    card(pdf, ex, look, s, paper(look), false);
    label(pdf, "A SOLVED EXAMPLE", ex.x + 14 * s, ex.y + 14 * s, look, s);
    const gx = ex.x + 16 * s + cell * 0.3;
    const gy = ex.y + 28 * s + cell * 0.3;
    drawWordSearchGrid(pdf, look, pz, gx, gy, cell, { answers: true, dashed: demo.extra ? [demo.extra as Placement] : [], emphasis: new Set(demo.messageCells.map(([r, c]) => `${r},${c}`)) });
    const tx = gx + gw + cell * 0.6 + 14 * s;
    const tw = ex.x + ex.w - 12 * s - tx;
    let ty = gy + 6 * s;
    const row = (k: string, v: string) => {
      label(pdf, k, tx, ty - 2.5 * s, look, s);
      pdf.setFont(SANS, "normal");
      pdf.setFontSize(9 * s);
      ink(pdf, BODY);
      const l = pdf.splitTextToSize(v, tw) as string[];
      l.forEach((x, i) => pdf.text(x, tx, ty + 12 * s + i * 12.5 * s));
      ty += 12 * s + l.length * 12.5 * s + 9 * s;
    };
    row("EVIDENCE", demo.words.join(", "));
    if (f.missing) row("MISSING EVIDENCE", `"What a pen leaves behind" (3 letters): INK, looped with a dashed line.`);
    if (f.message) row("LEFTOVER LETTERS", `The letters in color, read in order, spell ${demo.message.toUpperCase()}.`);
    if (f.message) row("THE CULPRIT", `Only one suspect is a ${/GARDENER/.test(demo.message.toUpperCase()) ? "gardener" : "cook"}, so that suspect is the culprit.`);
    if (f.board) row("CASE KEY", "\"Box 3: letter 2 of the culprit's first name\". Write that letter in box 3 of the Case Board.");
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(SERIF, "normal");
    pdf.setFontSize(10 * s);
    ink(pdf, BODY);
    pdf.text(`Solutions start on page ${ctx.solutionsPage}.`, box.x + box.w / 2, box.y + box.h - 8 * s, { align: "center" });
    pdf.setTextColor(0, 0, 0);
    void drawCheckbox;
  };
}

// ---------------------------------------------------------------- assembly

export function mysteryContent(items: MysteryItem[], answersPerPage: number, style: CaseStyle = "dossier", design: Design = DEFAULT_DESIGN): BookContent {
  const headerText = design.header.text.trim() || MYSTERY_HEADER;
  const pages: PageRenderer[] = items.map((it) => (it.kind === "case" ? casePage(it.case, style, headerText) : it.kind === "board" ? boardPage(it) : finalePage(it)));
  const sections: Section[] = [];
  let casesAdded = false;
  items.forEach((it, i) => {
    if (it.kind === "board") sections.push({ title: "The Case Board", index: i });
    else if (it.kind === "finale") sections.push({ title: "Case Closed", index: i });
    else if (!casesAdded) {
      sections.push({ title: "The Cases", index: i });
      casesAdded = true;
    }
  });
  const solutionsIndex = pages.length;
  for (let i = 0; i < items.length; i += answersPerPage) pages.push(answersPage(items.slice(i, i + answersPerPage), i === 0, answersPerPage));
  sections.push({ title: "Solutions", index: solutionsIndex });
  const cases = items.filter((i) => i.kind === "case").map((i) => (i as { case: MysteryCase }).case);
  return {
    pages,
    sections,
    solutionsIndex,
    howTo: mysteryHowTo({ missing: cases.some((c) => c.missing), message: cases.some((c) => c.message), board: items.some((i) => i.kind === "board"), checkbox: design.list.checkbox }),
    titleDetail: `${cases.length} Murder Mystery Case${cases.length === 1 ? "" : "s"}`,
  };
}

export function buildMysteryBook(items: MysteryItem[], opts: MysteryBookOptions, fonts: FontData): RenderedBook {
  if (!items.some((i) => i.kind === "case")) throw new Error("No finished cases to export.");
  const design = opts.design ?? DEFAULT_DESIGN;
  return renderBook({
    trim: opts.trim,
    bleed: opts.bleed,
    frontMatter: opts.frontMatter,
    extras: opts.extras,
    design,
    content: mysteryContent(items, opts.answersPerPage, opts.style ?? "dossier", design),
    padForKdp: opts.padForKdp,
    fonts,
    onPage: opts.onPage,
    slots: opts.slots,
  });
}

/** Default look for case files: a bright casebook. Serif titles, clean sans body and grid on soft tiles, one oxblood accent. */
export const CASEBOOK_NAME = "Casebook";
export function mysteryDesign(): Design {
  const d: Design = JSON.parse(JSON.stringify(DEFAULT_DESIGN));
  d.template = "elegant";
  d.name = CASEBOOK_NAME;
  d.header = { style: "casebook", text: "", showPuzzleTitle: true, badge: true, badgeShape: "circle", icon: "magnifier" };
  d.fonts = { heading: "serif", grid: "sans", list: "sans", gridScale: 1, listScale: 1 };
  d.grid = { ...d.grid, lines: false, border: "none", shade: "none", frame: 0.8, cells: "tiles", shadow: false, line: "solid" };
  d.shape = { ...d.shape, shade: false };
  d.pageNumber = "plain";
  d.color = { accent: "#7a2331", grayscale: false };
  d.list = { ...d.list, columns: 2, checkbox: true, sort: "alpha", box: "none" };
  return d;
}

/** Designs saved before the casebook redesign (the old "Case file" default) move to the new look, keeping the shapes. */
export function upgradeMysteryDesign(d: Design): Design {
  if (d.name !== "Case file" || d.header.style !== "underline" || d.grid.border !== "double") return d;
  const n = mysteryDesign();
  return { ...n, shape: { ...d.shape, shade: false }, list: { ...n.list, checkbox: d.list.checkbox }, color: { ...n.color, grayscale: d.color.grayscale } };
}
