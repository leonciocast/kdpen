/**
 * Shared KDP book renderer (jsPDF, vector only): front matter, content pages,
 * page numbers, padding to an even page count of at least 24.
 */
import { jsPDF } from "jspdf";
import { FrontMatter, copyrightDetails, resolveNotice } from "./frontMatter";
import { PT, PageSpec, TrimKey, contentBox, makePageSpec, paddedPageCount } from "./kdp";

export interface PdfFonts {
  sans: string; // base64 TrueType
  sansBold: string;
  serif: string;
  serifBold: string;
}

export const SANS = "DejaVuSans";
export const SERIF = "DejaVuSerif";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PageContext {
  pdf: jsPDF;
  box: Box;
  page: number;
  spec: PageSpec;
  /** Typography scale: 1 for 8.5x11 / A4, smaller for 6x9. */
  s: number;
  pageW: number;
  pageH: number;
}

export type PageRenderer = (ctx: PageContext) => void;

export interface HowTo {
  heading: string;
  paragraphs: string[];
}

export interface RenderBookOptions {
  trim: TrimKey;
  bleed: boolean;
  frontMatter: FrontMatter | null;
  howTo?: HowTo | null;
  /** Short line on the title page, e.g. "100 Word Search Puzzles". */
  titleDetail?: string;
  content: PageRenderer[];
  /** Pad to an even count of at least 24 pages (KDP paperback minimum). */
  padForKdp?: boolean;
  fonts: PdfFonts;
}

export type PageKind = "title" | "copyright" | "dedication" | "howto" | "content" | "blank";

export interface RenderedBook {
  pdf: jsPDF;
  kinds: PageKind[];
  pageCount: number;
  contentPages: number;
  spec: PageSpec;
}

export function scaleFor(trim: TrimKey): number {
  return trim === "6x9" ? 0.78 : 1;
}

export function planKinds(opts: Pick<RenderBookOptions, "frontMatter" | "howTo" | "content" | "padForKdp">): PageKind[] {
  const kinds: PageKind[] = [];
  if (opts.frontMatter) {
    kinds.push("title", "copyright");
    if (opts.frontMatter.dedication.trim()) kinds.push("dedication");
  }
  if (opts.howTo) kinds.push("howto");
  opts.content.forEach(() => kinds.push("content"));
  const target = opts.padForKdp === false ? kinds.length + (kinds.length % 2) : paddedPageCount(kinds.length);
  while (kinds.length < target) kinds.push("blank");
  return kinds;
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

/** Page heading with a rule under it; returns the y where content can start. */
export function heading(ctx: PageContext, text: string): number {
  const { pdf, box, s } = ctx;
  pdf.setFont(SANS, "bold");
  pdf.setFontSize(18 * s);
  pdf.setTextColor(0, 0, 0);
  pdf.text(text, box.x, box.y + 14 * s);
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.9);
  pdf.line(box.x, box.y + 24 * s, box.x + box.w, box.y + 24 * s);
  return box.y + 36 * s;
}

function drawTitlePage(ctx: PageContext, fm: FrontMatter, detail?: string) {
  const { pdf, box, s } = ctx;
  const cx = box.x + box.w / 2;
  const innerW = box.w * 0.86;

  // Top ornament: thin double rule
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(1.4);
  pdf.line(cx - box.w * 0.32, box.y + box.h * 0.16, cx + box.w * 0.32, box.y + box.h * 0.16);
  pdf.setLineWidth(0.5);
  pdf.line(cx - box.w * 0.32, box.y + box.h * 0.16 + 4, cx + box.w * 0.32, box.y + box.h * 0.16 + 4);

  // Title
  pdf.setFont(SERIF, "bold");
  const titleSize = 34 * s;
  pdf.setFontSize(titleSize);
  pdf.setTextColor(0, 0, 0);
  const titleLines = pdf.splitTextToSize(fm.title.trim() || "Puzzle Book", innerW) as string[];
  const lead = titleSize * 1.18;
  let y = box.y + box.h * 0.3;
  titleLines.forEach((l) => {
    centered(pdf, l, cx, y);
    y += lead;
  });

  // Subtitle
  if (fm.subtitle.trim()) {
    pdf.setFont(SERIF, "normal");
    pdf.setFontSize(15 * s);
    pdf.setTextColor(70, 70, 70);
    const subLines = pdf.splitTextToSize(fm.subtitle.trim(), innerW) as string[];
    y += 4 * s;
    subLines.forEach((l) => {
      centered(pdf, l, cx, y);
      y += 20 * s;
    });
  }

  // Small diamond divider
  y += 14 * s;
  pdf.setDrawColor(0, 0, 0);
  pdf.setFillColor(0, 0, 0);
  pdf.setLineWidth(0.6);
  pdf.line(cx - 60 * s, y, cx - 8 * s, y);
  pdf.line(cx + 8 * s, y, cx + 60 * s, y);
  pdf.lines([[4 * s, -4 * s], [4 * s, 4 * s], [-4 * s, 4 * s], [-4 * s, -4 * s]], cx - 4 * s, y, [1, 1], "F", true);

  if (detail) {
    pdf.setFont(SANS, "normal");
    pdf.setFontSize(11 * s);
    pdf.setTextColor(90, 90, 90);
    pdf.setCharSpace(1.2 * s);
    centered(pdf, detail.toUpperCase(), cx, y + 26 * s);
    pdf.setCharSpace(0);
  }

  // Author and imprint near the bottom
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

function drawCopyrightPage(ctx: PageContext, fm: FrontMatter) {
  const { pdf, box, s } = ctx;
  const size = 9 * s;
  const leading = size * 1.5;
  const paras = resolveNotice(fm).split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
  const details = copyrightDetails(fm);
  // Measure, then bottom-align the block (classic copyright-page placement).
  pdf.setFont(SERIF, "normal");
  pdf.setFontSize(size);
  const measure = (t: string) => (pdf.splitTextToSize(t, box.w) as string[]).length * leading;
  let blockH = 30 * s; // title line
  paras.forEach((p) => (blockH += measure(p) + leading * 0.6));
  blockH += details.length * leading + leading;
  let y = Math.max(box.y + 10, box.y + box.h - blockH);

  pdf.setFont(SERIF, "bold");
  pdf.setFontSize(11 * s);
  pdf.setTextColor(0, 0, 0);
  pdf.text(fm.title.trim() || "Puzzle Book", box.x, y);
  y += 20 * s;
  pdf.setFont(SERIF, "normal");
  pdf.setTextColor(40, 40, 40);
  paras.forEach((p) => {
    y = paragraph(pdf, p, box.x, y, box.w, size, leading) + leading * 0.6;
  });
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

function drawHowToPage(ctx: PageContext, howTo: HowTo) {
  const { pdf, box, s } = ctx;
  let y = heading(ctx, howTo.heading) + 10 * s;
  pdf.setFont(SANS, "normal");
  pdf.setTextColor(20, 20, 20);
  howTo.paragraphs.forEach((p) => {
    y = paragraph(pdf, p, box.x, y, box.w, 12 * s, 18 * s) + 10 * s;
  });
}

export function drawPageNumber(ctx: PageContext) {
  const { pdf, box, spec, s, pageH, page } = ctx;
  pdf.setFont(SANS, "normal");
  pdf.setFontSize(10 * s);
  pdf.setTextColor(70, 70, 70);
  centered(pdf, String(page), box.x + box.w / 2, pageH - (spec.bottom * PT) / 2);
  pdf.setTextColor(0, 0, 0);
}

export function renderBook(opts: RenderBookOptions): RenderedBook {
  if (opts.content.length === 0) throw new Error("Nothing to export yet.");
  const kinds = planKinds(opts);
  const spec = makePageSpec(opts.trim, kinds.length, opts.bleed);
  const W = spec.pageWidth * PT;
  const H = spec.pageHeight * PT;
  const pdf = new jsPDF({ unit: "pt", format: [W, H], orientation: "portrait", compress: true, putOnlyUsedFonts: true });
  pdf.addFileToVFS("DejaVuSans.ttf", opts.fonts.sans);
  pdf.addFont("DejaVuSans.ttf", SANS, "normal");
  pdf.addFileToVFS("DejaVuSans-Bold.ttf", opts.fonts.sansBold);
  pdf.addFont("DejaVuSans-Bold.ttf", SANS, "bold");
  pdf.addFileToVFS("DejaVuSerif.ttf", opts.fonts.serif);
  pdf.addFont("DejaVuSerif.ttf", SERIF, "normal");
  pdf.addFileToVFS("DejaVuSerif-Bold.ttf", opts.fonts.serifBold);
  pdf.addFont("DejaVuSerif-Bold.ttf", SERIF, "bold");
  pdf.setFont(SANS, "normal");
  const fm = opts.frontMatter;
  pdf.setProperties({
    title: fm?.title || "Puzzle Book",
    author: fm?.author || "",
    subject: fm?.subtitle || "",
    creator: "Puzzle Generator",
  });

  const s = scaleFor(opts.trim);
  let contentIndex = 0;
  kinds.forEach((kind, i) => {
    const page = i + 1;
    if (i > 0) pdf.addPage([W, H], "portrait");
    const ctx: PageContext = { pdf, box: contentBox(spec, page), page, spec, s, pageW: W, pageH: H };
    if (kind === "title" && fm) drawTitlePage(ctx, fm, opts.titleDetail);
    else if (kind === "copyright" && fm) drawCopyrightPage(ctx, fm);
    else if (kind === "dedication" && fm) drawDedicationPage(ctx, fm);
    else if (kind === "howto" && opts.howTo) {
      drawHowToPage(ctx, opts.howTo);
      drawPageNumber(ctx);
    } else if (kind === "content") {
      opts.content[contentIndex++](ctx);
      pdf.setFont(SANS, "normal");
      pdf.setTextColor(0, 0, 0);
      drawPageNumber(ctx);
    }
  });
  return { pdf, kinds, pageCount: kinds.length, contentPages: kinds.filter((k) => k !== "blank").length, spec };
}

// ---------------------------------------------------------------- font loading (browser)

async function fetchBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load font ${url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  }
  return btoa(binary);
}

let fontCache: Promise<PdfFonts> | null = null;
export function loadPdfFonts(): Promise<PdfFonts> {
  if (!fontCache) {
    fontCache = Promise.all([
      fetchBase64("/fonts/DejaVuSans.ttf"),
      fetchBase64("/fonts/DejaVuSans-Bold.ttf"),
      fetchBase64("/fonts/DejaVuSerif.ttf"),
      fetchBase64("/fonts/DejaVuSerif-Bold.ttf"),
    ]).then(([sans, sansBold, serif, serifBold]) => ({ sans, sansBold, serif, serifBold }));
    fontCache.catch(() => (fontCache = null));
  }
  return fontCache;
}

/** Trigger a download of a PDF in the browser. */
export function savePdf(pdf: jsPDF, filename: string) {
  pdf.save(filename.replace(/[^\w.-]+/g, "_"));
}
