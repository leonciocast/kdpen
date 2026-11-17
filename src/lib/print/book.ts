/**
 * Shared KDP book renderer (jsPDF, vector only). Plans the page order, draws
 * front/back matter in the chosen design, numbers pages and pads the book to
 * an even KDP page count (with lined notes pages instead of empty pages).
 */
import { jsPDF } from "jspdf";
import { FrontMatter, copyrightDetails, resolveNotice } from "./frontMatter";
import { PT, PageSpec, TrimKey, contentBox, makePageSpec } from "./kdp";
import { FontData, familiesFor, registerFonts } from "./fonts";
import { PRINT_MIN_LINE_PT, Box, Look, drawHeader, drawIcon, drawPageNumber, drawPattern, panel, paint, patternArea, poly, resolveLook } from "../design/paint";
import { DEFAULT_DESIGN } from "../design/templates";
import type { Design } from "../design/types";
import { BookPageKind, PlanInput, Slot, TOC_LINES_PER_PAGE, coreKinds, pad } from "./arrange";

export type { Box } from "../design/paint";
export const SANS = "DejaVuSans";
export const SERIF = "DejaVuSerif";

export const DEFAULT_THANK_YOU =
  "Thank you for choosing this book! We hope you enjoyed every puzzle.\n\nIf you did, would you leave a short review on Amazon? It takes a minute, helps other puzzle lovers find this book, and means a lot to a small publisher.";

export interface BookExtras {
  belongsTo: boolean;
  howTo: boolean;
  toc: boolean;
  /** Intro page text; empty = no intro page. */
  intro: string;
  thankYou: boolean;
  thankYouText: string;
  notesPages: number;
  /** Use lined notes pages (not empty pages) to reach the KDP page count. */
  padWithNotes: boolean;
}

export const DEFAULT_EXTRAS: BookExtras = {
  belongsTo: true,
  howTo: true,
  toc: true,
  intro: "",
  thankYou: true,
  thankYouText: DEFAULT_THANK_YOU,
  notesPages: 2,
  padWithNotes: true,
};

export const NO_EXTRAS: BookExtras = { belongsTo: false, howTo: false, toc: false, intro: "", thankYou: false, thankYouText: "", notesPages: 0, padWithNotes: false };

export interface PageContext {
  pdf: jsPDF;
  box: Box;
  page: number;
  spec: PageSpec;
  /** Typography scale: 1 for 8.5x11 / A4, smaller for 6x9. */
  s: number;
  pageW: number;
  pageH: number;
  look: Look;
  /** First page of the solutions section (for "solutions start on page N"). */
  solutionsPage: number;
}

export type PageRenderer = (ctx: PageContext) => void;

export interface Section {
  title: string;
  /** Index into `pages`. */
  index: number;
}

export interface BookContent {
  pages: PageRenderer[];
  /** Table-of-contents entries pointing at content pages. */
  sections: Section[];
  /** Index of the first solutions page in `pages`. */
  solutionsIndex: number;
  howTo?: PageRenderer;
  /** Contents entry for the how-to page (default "How to Play"). */
  howToTitle?: string;
  /** Short line on the title page, e.g. "100 Word Search Puzzles". */
  titleDetail: string;
}

export interface RenderBookOptions {
  trim: TrimKey;
  bleed: boolean;
  frontMatter: FrontMatter | null;
  extras: BookExtras;
  design?: Design;
  content: BookContent;
  padForKdp?: boolean;
  fonts: FontData;
  volume?: { n: number; of: number };
  /** Progress callback, called after each page. */
  onPage?: (done: number, total: number) => void;
  /**
   * Custom page order (from the preview). Puzzle slots map, in order, to the
   * content's puzzle pages; solution slots to its solutions pages. The caller
   * must already have built `content` from the arranged items.
   */
  slots?: Slot[];
}

export type PageKind = BookPageKind;

export interface RenderedBook {
  pdf: jsPDF;
  kinds: PageKind[];
  pageCount: number;
  contentPages: number;
  spec: PageSpec;
}

export { TOC_LINES_PER_PAGE, tocEntryCount } from "./arrange";
export type { PlanInput } from "./arrange";

export function scaleFor(trim: TrimKey): number {
  return trim === "6x9" ? 0.78 : 1;
}

/** The page order of a book. Pure, so it doubles as the page-count estimate. */
export function planKinds(p: PlanInput): PageKind[] {
  // No throw here: estimates may exceed the KDP limit (the page spec enforces it when building).
  return pad(coreKinds(p).map((kind) => ({ item: null, kind })), p.extras, p.padForKdp).map((x) => x.kind);
}

export function centered(pdf: jsPDF, text: string, cx: number, y: number) {
  pdf.text(text, cx, y, { align: "center", baseline: "middle" });
}

/** Wrap and draw a paragraph; returns the y after the last line. */
export function paragraph(pdf: jsPDF, text: string, x: number, y: number, width: number, size: number, leading: number, align: "left" | "center" = "left"): number {
  pdf.setFontSize(size);
  const lines = pdf.splitTextToSize(text, width) as string[];
  lines.forEach((l, i) => {
    if (align === "center") pdf.text(l, x + width / 2, y + i * leading, { align: "center" });
    else pdf.text(l, x, y + i * leading);
  });
  return y + lines.length * leading;
}

/** Page header in the book's design; returns the y where content can start. */
/**
 * A subtitle that needs two or more lines breaks after a colon when it can ("…to Solve:" / "A Whodunit…"),
 * otherwise the lines are balanced so no word sits alone on the last line.
 */
export function subtitleLines(pdf: jsPDF, text: string, maxW: number): string[] {
  const plain = pdf.splitTextToSize(text, maxW) as string[];
  if (plain.length < 2) return plain;
  const colon = text.indexOf(": ");
  if (colon > 0) {
    const parts = [text.slice(0, colon + 1), text.slice(colon + 2)];
    const lines = parts.flatMap((t) => pdf.splitTextToSize(t, maxW) as string[]);
    if (lines.length === parts.length) return lines;
  }
  let lo = maxW * 0.4, hi = maxW;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if ((pdf.splitTextToSize(text, mid) as string[]).length > plain.length) lo = mid;
    else hi = mid;
  }
  return pdf.splitTextToSize(text, hi) as string[];
}

export function heading(ctx: PageContext, text: string, number?: number, subtitle?: string): number {
  return drawHeader(ctx.pdf, ctx.box, ctx.look, { text, number, subtitle }, ctx.s);
}

// ---------------------------------------------------------------- front & back matter

function drawTitlePage(ctx: PageContext, fm: FrontMatter, detail: string, volume?: { n: number; of: number }) {
  const { pdf, box, s, look } = ctx;
  const cx = box.x + box.w / 2;
  const innerW = box.w * 0.86;
  const hf = look.font(look.design.fonts.heading);
  paint.stroke(pdf, look.accent);
  pdf.setLineWidth(1.4);
  pdf.line(cx - box.w * 0.32, box.y + box.h * 0.16, cx + box.w * 0.32, box.y + box.h * 0.16);
  pdf.setLineWidth(0.5);
  pdf.line(cx - box.w * 0.32, box.y + box.h * 0.16 + 4, cx + box.w * 0.32, box.y + box.h * 0.16 + 4);

  pdf.setFont(hf, "bold");
  const titleSize = 34 * s;
  pdf.setFontSize(titleSize);
  pdf.setTextColor(0, 0, 0);
  const titleLines = pdf.splitTextToSize(fm.title.trim() || "Puzzle Book", innerW) as string[];
  let y = box.y + box.h * 0.3;
  titleLines.forEach((l) => {
    centered(pdf, l, cx, y);
    y += titleSize * 1.18;
  });
  if (fm.subtitle.trim()) {
    pdf.setFont(SERIF, "normal");
    pdf.setFontSize(15 * s);
    pdf.setTextColor(70, 70, 70);
    y += 4 * s;
    subtitleLines(pdf, fm.subtitle.trim(), innerW).forEach((l) => {
      centered(pdf, l, cx, y);
      y += 20 * s;
    });
  }
  if (volume && volume.of > 1) {
    pdf.setFont(hf, "bold");
    pdf.setFontSize(16 * s);
    paint.textColor(pdf, look.ink);
    centered(pdf, `Volume ${volume.n}`, cx, y + 8 * s);
    y += 26 * s;
  }
  y += 14 * s;
  paint.stroke(pdf, look.accent);
  paint.fill(pdf, look.accent);
  pdf.setLineWidth(0.6);
  pdf.line(cx - 60 * s, y, cx - 8 * s, y);
  pdf.line(cx + 8 * s, y, cx + 60 * s, y);
  poly(pdf, [[cx, y - 4 * s], [cx + 4 * s, y], [cx, y + 4 * s], [cx - 4 * s, y]], "F");
  // "24 Detective Cases to Solve" already says how many; don't repeat it as "24 … Cases".
  const count = detail.match(/^(\d+) /)?.[1];
  if (detail && !(count && fm.subtitle.trim().startsWith(`${count} `))) {
    pdf.setFont(SANS, "normal");
    const up = detail.toUpperCase();
    let size = 11 * s;
    pdf.setFontSize(size);
    // A long story title shrinks to fit the line rather than running into the margins.
    while (size > 7 * s && pdf.getTextWidth(up) + up.length * 1.2 * s > innerW) pdf.setFontSize((size -= 0.5));
    pdf.setTextColor(90, 90, 90);
    pdf.setCharSpace(1.2 * s);
    centered(pdf, up, cx, y + 26 * s);
    pdf.setCharSpace(0);
  }
  if (look.design.header.icon !== "none") drawIcon(pdf, look.design.header.icon, cx, box.y + box.h * 0.66, 30 * s, look.accent);
  pdf.setTextColor(0, 0, 0);
  if (fm.author.trim()) {
    pdf.setFont(SERIF, "normal");
    pdf.setFontSize(17 * s);
    centered(pdf, fm.author.trim(), cx, box.y + box.h * 0.8);
  }
  if (fm.imprint.trim()) {
    pdf.setFont(SANS, "normal");
    pdf.setFontSize(9.5 * s);
    pdf.setTextColor(100, 100, 100);
    pdf.setCharSpace(1.5 * s);
    centered(pdf, fm.imprint.trim().toUpperCase(), cx, box.y + box.h * 0.95);
    pdf.setCharSpace(0);
  }
  pdf.setTextColor(0, 0, 0);
}

function drawCopyrightPage(ctx: PageContext, fm: FrontMatter, volume?: { n: number; of: number }) {
  const { pdf, box, s } = ctx;
  const size = 9 * s;
  const leading = size * 1.5;
  const paras = resolveNotice(fm).split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
  const details = copyrightDetails(fm);
  pdf.setFont(SERIF, "normal");
  pdf.setFontSize(size);
  const measure = (t: string) => (pdf.splitTextToSize(t, box.w) as string[]).length * leading;
  let blockH = 30 * s;
  paras.forEach((p) => (blockH += measure(p) + leading * 0.6));
  blockH += details.length * leading + leading;
  let y = Math.max(box.y + 10, box.y + box.h - blockH);
  pdf.setFont(SERIF, "bold");
  pdf.setFontSize(11 * s);
  pdf.setTextColor(0, 0, 0);
  const title = (fm.title.trim() || "Puzzle Book") + (volume && volume.of > 1 ? ` (Volume ${volume.n})` : "");
  pdf.text(title, box.x, y);
  y += 20 * s;
  pdf.setFont(SERIF, "normal");
  pdf.setTextColor(40, 40, 40);
  paras.forEach((p) => (y = paragraph(pdf, p, box.x, y, box.w, size, leading) + leading * 0.6));
  y += leading * 0.4;
  pdf.setFontSize(size);
  details.forEach((d) => {
    pdf.text(d, box.x, y);
    y += leading;
  });
  pdf.setTextColor(0, 0, 0);
}

function drawDedicationPage(ctx: PageContext, fm: FrontMatter) {
  const { pdf, box, s } = ctx;
  pdf.setFont(SERIF, "normal");
  pdf.setTextColor(40, 40, 40);
  paragraph(pdf, fm.dedication.trim(), box.x + box.w * 0.1, box.y + box.h * 0.32, box.w * 0.8, 14 * s, 21 * s, "center");
  pdf.setTextColor(0, 0, 0);
}

function drawBelongsPage(ctx: PageContext) {
  const { pdf, box, s, look } = ctx;
  const hf = look.font(look.design.fonts.heading);
  const w = box.w * 0.84;
  const h = box.h * 0.46;
  const x = box.x + (box.w - w) / 2;
  const y = box.y + box.h * 0.18;
  paint.fill(pdf, [255, 255, 255]);
  paint.stroke(pdf, look.accent);
  pdf.setLineWidth(2.2);
  pdf.roundedRect(x, y, w, h, 22 * s, 22 * s, "FD");
  pdf.setLineWidth(0.6);
  pdf.roundedRect(x + 8 * s, y + 8 * s, w - 16 * s, h - 16 * s, 16 * s, 16 * s, "S");
  const icon = look.design.header.icon === "none" ? "star" : look.design.header.icon;
  paint.fill(pdf, [255, 255, 255]);
  pdf.circle(x + w / 2, y, 22 * s, "FD");
  drawIcon(pdf, icon, x + w / 2, y, 24 * s, look.accent);
  pdf.setFont(hf, "bold");
  pdf.setFontSize(28 * s);
  paint.textColor(pdf, look.ink);
  centered(pdf, "This Book Belongs To", x + w / 2, y + h * 0.27);
  paint.stroke(pdf, [60, 60, 60]);
  pdf.setLineWidth(0.8);
  pdf.line(x + w * 0.14, y + h * 0.5, x + w * 0.86, y + h * 0.5);
  pdf.setFont(SANS, "normal");
  pdf.setFontSize(10 * s);
  pdf.setTextColor(110, 110, 110);
  pdf.text("Name", x + w * 0.14, y + h * 0.5 + 13 * s);
  const lw = w * 0.3;
  pdf.line(x + w * 0.14, y + h * 0.75, x + w * 0.14 + lw, y + h * 0.75);
  pdf.line(x + w * 0.86 - lw, y + h * 0.75, x + w * 0.86, y + h * 0.75);
  pdf.text("Started on", x + w * 0.14, y + h * 0.75 + 13 * s);
  pdf.text("Finished on", x + w * 0.86 - lw, y + h * 0.75 + 13 * s);
  pdf.setFont(hf, "normal");
  pdf.setFontSize(13 * s);
  paint.textColor(pdf, look.ink);
  centered(pdf, "Happy puzzling!", box.x + box.w / 2, y + h + 46 * s);
  pdf.setTextColor(0, 0, 0);
}

function drawNotesPage(ctx: PageContext) {
  const { pdf, box, s } = ctx;
  const top = heading(ctx, "NOTES") + 10 * s;
  panel(pdf, { x: box.x - 6, y: top - 6, w: box.w + 12, h: box.y + box.h - top + 6 }, ctx.look);
  paint.stroke(pdf, [185, 185, 185]);
  pdf.setLineWidth(0.5);
  for (let y = top + 24 * s; y < box.y + box.h - 6; y += 26 * s) pdf.line(box.x, y, box.x + box.w, y);
}

function drawThanksPage(ctx: PageContext, fm: FrontMatter | null, text: string) {
  const { pdf, box, s, look } = ctx;
  const cx = box.x + box.w / 2;
  const hf = look.font(look.design.fonts.heading);
  let y = box.y + box.h * 0.22;
  pdf.setFont(hf, "bold");
  pdf.setFontSize(32 * s);
  paint.textColor(pdf, look.ink);
  centered(pdf, "Thank You!", cx, y);
  y += 40 * s;
  // five outline stars, a gentle nudge toward a review
  paint.stroke(pdf, look.accent);
  pdf.setLineWidth(1.3);
  for (let i = -2; i <= 2; i++) {
    const sx = cx + i * 30 * s;
    const pts: [number, number][] = [];
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const r = k % 2 === 0 ? 11 * s : 5 * s;
      pts.push([sx + r * Math.cos(a), y + r * Math.sin(a)]);
    }
    poly(pdf, pts, "S");
  }
  y += 36 * s;
  pdf.setFont(SERIF, "normal");
  pdf.setTextColor(40, 40, 40);
  const paras = (text || DEFAULT_THANK_YOU).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  for (const p of paras) y = paragraph(pdf, p, box.x + box.w * 0.1, y, box.w * 0.8, 13 * s, 20 * s, "center") + 12 * s;
  const sign = fm?.imprint.trim() || fm?.author.trim();
  if (sign && sign !== "Your Name" && sign !== "Your Imprint") {
    pdf.setFont(hf, "normal");
    pdf.setFontSize(13 * s);
    centered(pdf, `— ${sign}`, cx, y + 10 * s);
    y += 26 * s;
  }
  if (fm?.website.trim()) {
    pdf.setFont(SANS, "normal");
    pdf.setFontSize(11 * s);
    pdf.setTextColor(90, 90, 90);
    centered(pdf, fm.website.trim(), cx, y + 10 * s);
  }
  pdf.setTextColor(0, 0, 0);
}

function drawIntroPage(ctx: PageContext, text: string) {
  const { pdf, box, s, look } = ctx;
  let y = heading(ctx, "INTRODUCTION") + 14 * s;
  panel(pdf, { x: box.x - 8, y: y - 10, w: box.w + 16, h: box.y + box.h - y + 4 }, look);
  pdf.setFont(SERIF, "normal");
  pdf.setTextColor(25, 25, 25);
  for (const p of text.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean)) y = paragraph(pdf, p, box.x, y + 4 * s, box.w, 12.5 * s, 19 * s) + 10 * s;
  pdf.setTextColor(0, 0, 0);
}

function drawTocPage(ctx: PageContext, entries: { title: string; page: number }[], first: boolean) {
  const { pdf, box, s, look } = ctx;
  const top = (first ? heading(ctx, "CONTENTS") : box.y) + 14 * s;
  panel(pdf, { x: box.x - 8, y: top - 10, w: box.w + 16, h: entries.length * 24 * s + 20 }, look);
  const f = look.font(look.design.fonts.list);
  entries.forEach((e, i) => {
    const y = top + i * 24 * s + 8 * s;
    pdf.setFont(f, "normal");
    pdf.setFontSize(12.5 * s);
    pdf.setTextColor(0, 0, 0);
    const title = (pdf.splitTextToSize(e.title, box.w * 0.78) as string[])[0];
    pdf.text(title, box.x, y);
    const num = String(e.page);
    pdf.text(num, box.x + box.w, y, { align: "right" });
    const tw = pdf.getTextWidth(title);
    const nw = pdf.getTextWidth(num);
    paint.stroke(pdf, [150, 150, 150]);
    pdf.setLineWidth(0.8);
    pdf.setLineDashPattern([0.8, 3], 0);
    pdf.line(box.x + tw + 6, y - 2, box.x + box.w - nw - 6, y - 2);
    pdf.setLineDashPattern([], 0);
  });
}

// ---------------------------------------------------------------- render

export function renderBook(opts: RenderBookOptions): RenderedBook {
  const c = opts.content;
  if (c.pages.length === 0) throw new Error("Nothing to export yet.");
  const design = opts.design ?? DEFAULT_DESIGN;
  const look = resolveLook(design);
  const plan: PlanInput = { frontMatter: opts.frontMatter, extras: opts.extras, contentCount: c.pages.length, sectionCount: c.sections.length, hasHowTo: !!c.howTo, padForKdp: opts.padForKdp };
  // One path for both the default and an arranged order: a list of page kinds
  // plus, for content pages, which content page they print.
  let core: { item: number | null; kind: PageKind }[];
  if (opts.slots) {
    const puzzles = opts.slots.filter((x) => x.kind === "puzzle").length;
    const sols = opts.slots.filter((x) => x.kind === "solution").length;
    if (puzzles !== c.solutionsIndex || sols !== c.pages.length - c.solutionsIndex) throw new Error("The page arrangement doesn't match the book; reopen the preview.");
    let p = 0;
    let q = 0;
    core = opts.slots.map((x) => (x.kind === "puzzle" ? { item: p++, kind: "content" } : x.kind === "solution" ? { item: c.solutionsIndex + q++, kind: "content" } : { item: null, kind: x.kind }));
  } else {
    let k = 0;
    core = coreKinds(plan).map((kind) => ({ item: kind === "content" ? k++ : null, kind }));
  }
  const pages = pad(core.map((x) => ({ item: x.item ?? -1, kind: x.kind })), opts.extras, opts.padForKdp);
  const kinds = pages.map((x) => x.kind);
  const contentAt: number[] = []; // content page index -> 1-based page number
  pages.forEach((x, i) => {
    if (x.kind === "content" && x.item !== null && x.item >= 0) contentAt[x.item] = i + 1;
  });
  const spec = makePageSpec(opts.trim, kinds.length, opts.bleed);
  const W = spec.pageWidth * PT;
  const H = spec.pageHeight * PT;
  const pdf = new jsPDF({ unit: "pt", format: [W, H], orientation: "portrait", compress: true, putOnlyUsedFonts: true, floatPrecision: 2 });
  // Every stroke at least KDP's 0.75 pt, whatever a layout asks for.
  const setWidth = pdf.setLineWidth.bind(pdf);
  pdf.setLineWidth = ((w: number) => setWidth(Math.max(w, PRINT_MIN_LINE_PT))) as typeof pdf.setLineWidth;
  pdf.setLineWidth(PRINT_MIN_LINE_PT);
  registerFonts(pdf, familiesFor(design), opts.fonts);
  pdf.setFont(SANS, "normal");
  const fm = opts.frontMatter;
  pdf.setProperties({ title: fm?.title || "Puzzle Book", author: fm?.author || "", subject: fm?.subtitle || "", creator: "Puzzle Generator" });

  // Page numbers for the table of contents.
  const pageOf = (kind: PageKind) => kinds.indexOf(kind) + 1;
  const toc: { title: string; page: number }[] = [];
  if (opts.extras.intro.trim() && kinds.includes("intro")) toc.push({ title: "Introduction", page: pageOf("intro") });
  if (kinds.includes("howto")) toc.push({ title: c.howToTitle ?? "How to Play", page: pageOf("howto") });
  c.sections.forEach((sct) => toc.push({ title: sct.title, page: contentAt[sct.index] }));
  if (opts.extras.notesPages > 0 && kinds.includes("notes")) toc.push({ title: "Notes", page: pageOf("notes") });
  const solutionsPage = contentAt[c.solutionsIndex];

  const s = scaleFor(opts.trim);
  // The background pattern is drawn once per page side as a PDF form object and reused (tiny files).
  const hasPattern = design.pattern.kind !== "none";
  if (hasPattern) {
    (["recto", "verso"] as const).forEach((side) => {
      (pdf as any).advancedAPI((p: any) => {
        p.beginFormObject(0, 0, W, H, p.unitMatrix);
        drawPattern(p, design.pattern.kind, patternArea(W, H, opts.bleed, spec.inside * PT, side), look, 7);
        p.endFormObject(`pg-pattern-${side}`);
      });
    });
  }
  const stamp = (page: number) => {
    (pdf as any).advancedAPI((p: any) => p.doFormObject(`pg-pattern-${page % 2 === 1 ? "recto" : "verso"}`, p.unitMatrix));
  };
  let tocIndex = 0;
  const numbered = new Set<PageKind>(["toc", "intro", "howto", "content", "notes"]);
  const patterned = new Set<PageKind>(["belongs", "toc", "intro", "howto", "content", "notes", "thanks"]);
  const tocPages = kinds.filter((k) => k === "toc").length;
  pages.forEach(({ kind, item }, i) => {
    const page = i + 1;
    if (i > 0) pdf.addPage([W, H], "portrait");
    const ctx: PageContext = { pdf, box: contentBox(spec, page), page, spec, s, pageW: W, pageH: H, look, solutionsPage };
    if (hasPattern && patterned.has(kind)) stamp(page);
    switch (kind) {
      case "title":
        if (fm) drawTitlePage(ctx, fm, c.titleDetail, opts.volume);
        break;
      case "copyright":
        if (fm) drawCopyrightPage(ctx, fm, opts.volume);
        break;
      case "belongs":
        drawBelongsPage(ctx);
        break;
      case "dedication":
        if (fm) drawDedicationPage(ctx, fm);
        break;
      case "toc":
        // The last contents page takes any overflow (only if the user removed a contents page).
        drawTocPage(ctx, toc.slice(tocIndex * TOC_LINES_PER_PAGE, tocIndex === tocPages - 1 ? undefined : (tocIndex + 1) * TOC_LINES_PER_PAGE), tocIndex === 0);
        tocIndex++;
        break;
      case "intro":
        drawIntroPage(ctx, opts.extras.intro);
        break;
      case "howto":
        c.howTo?.(ctx);
        break;
      case "content":
        if (item !== null && item >= 0) c.pages[item](ctx);
        break;
      case "notes":
        drawNotesPage(ctx);
        break;
      case "thanks":
        drawThanksPage(ctx, fm, opts.extras.thankYouText);
        break;
    }
    pdf.setTextColor(0, 0, 0);
    // Centred in the bottom margin, and at least 0.375" from the trim (KDP's minimum is 0.25" without bleed).
    const safe = 0.375 * PT + 10.5 * s;
    if (numbered.has(kind)) drawPageNumber(pdf, design.pageNumber, page, ctx.box.x + ctx.box.w / 2, H - Math.max((spec.bottom * PT) / 2, safe), look, s);
    opts.onPage?.(page, kinds.length);
  });
  return { pdf, kinds, pageCount: kinds.length, contentPages: kinds.filter((k) => k !== "blank").length, spec };
}
