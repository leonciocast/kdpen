import { describe, expect, it } from "vitest";
import { generatePuzzle, allowedDirections, mulberry32 } from "../src/lib/wordsearch/engine";
import { insideMargin, makePageSpec, marginsForPage, paddedPageCount, outsideMargin, contentBox, PT } from "../src/lib/print/kdp";
import { patternArea } from "../src/lib/design/paint";
import { buildWordSearchBook, BookPuzzle } from "../src/lib/wordsearch/pdf";
import { DEFAULT_FRONT_MATTER } from "../src/lib/print/frontMatter";
import { planKinds, NO_EXTRAS, DEFAULT_EXTRAS } from "../src/lib/print/book";
import { nodeFonts } from "../src/lib/print/nodeFonts";

describe("KDP rules", () => {
  it("gutter follows page-count brackets", () => {
    expect(insideMargin(24)).toBe(0.375);
    expect(insideMargin(150)).toBe(0.375);
    expect(insideMargin(151)).toBe(0.5);
    expect(insideMargin(301)).toBe(0.625);
    expect(insideMargin(600)).toBe(0.75);
    expect(insideMargin(828)).toBe(0.875);
    expect(() => insideMargin(900)).toThrow();
  });
  it("pads to an even count of at least 24", () => {
    expect(paddedPageCount(5)).toBe(24);
    expect(paddedPageCount(25)).toBe(26);
    expect(paddedPageCount(30)).toBe(30);
  });
  it("bleed grows the page and margins mirror", () => {
    const s = makePageSpec("8.5x11", 24, true);
    expect(s.pageWidth).toBeCloseTo(8.625);
    expect(s.pageHeight).toBeCloseTo(11.25);
    expect(s.outside).toBeGreaterThanOrEqual(0.375);
    expect(() => outsideMargin(true, 0.3)).toThrow();
    expect(marginsForPage(s, 1).left).toBe(s.inside);
    expect(marginsForPage(s, 2).right).toBe(s.inside);
  });
});

describe("book plan", () => {
  const base = { extras: NO_EXTRAS, sectionCount: 2, hasHowTo: true };
  it("puts title, copyright, dedication, how-to before content and pads", () => {
    const kinds = planKinds({ ...base, extras: { ...NO_EXTRAS, howTo: true }, frontMatter: { ...DEFAULT_FRONT_MATTER, dedication: "For Mom" }, contentCount: 3 });
    expect(kinds.slice(0, 7)).toEqual(["title", "copyright", "dedication", "howto", "content", "content", "content"]);
    expect(kinds.length).toBe(24);
  });
  it("skips dedication when empty and front matter when off", () => {
    expect(planKinds({ ...base, frontMatter: DEFAULT_FRONT_MATTER, contentCount: 1 }).slice(0, 3)).toEqual(["title", "copyright", "content"]);
    expect(planKinds({ ...base, frontMatter: null, contentCount: 1, padForKdp: false })).toEqual(["content", "blank"]);
  });
  it("orders all extras and pads with notes before the thank-you page", () => {
    const kinds = planKinds({ ...base, extras: { ...DEFAULT_EXTRAS, intro: "Hi" }, frontMatter: DEFAULT_FRONT_MATTER, contentCount: 4 });
    expect(kinds.slice(0, 7)).toEqual(["title", "copyright", "belongs", "toc", "intro", "howto", "content"]);
    expect(kinds[kinds.length - 1]).toBe("thanks");
    expect(kinds.length).toBe(24);
    expect(kinds.includes("blank")).toBe(false);
    expect(kinds.filter((k) => k === "notes").length).toBe(24 - 11);
  });
  it("adds TOC pages for many sections", () => {
    const kinds = planKinds({ ...base, extras: { ...NO_EXTRAS, toc: true }, frontMatter: null, contentCount: 2, sectionCount: 60 });
    expect(kinds.filter((k) => k === "toc").length).toBe(3);
  });
});

describe("word search book PDF", () => {
  const dirs = allowedDirections({ horizontal: true, vertical: true, diagonalDown: true, diagonalUp: true, reversed: false });
  const puzzles: BookPuzzle[] = [0, 1, 2].map((i) => {
    const words = ["ICE CREAM", "BANANA", "CHERRY", "GRAPE", "LEMON", "MANGO"];
    const g = generatePuzzle(words, 12, dirs, mulberry32(i + 1));
    return { title: `Puzzle ${i + 1}`, size: 12, grid: g.grid, words, placements: g.placements };
  });

  it("renders a vector PDF with front matter, right page size and embedded fonts", () => {
    const fm = { ...DEFAULT_FRONT_MATTER, title: "My Test Book", author: "Test Author", isbn: "978-1-23456-789-7" };
    const book = buildWordSearchBook(puzzles, { trim: "6x9", bleed: true, answersPerPage: 2, frontMatter: fm, extras: { ...NO_EXTRAS, howTo: true } }, nodeFonts());
    expect(book.pageCount).toBe(24);
    expect(book.kinds.slice(0, 3)).toEqual(["title", "copyright", "howto"]);
    const pdf = book.pdf;
    expect(pdf.getNumberOfPages()).toBe(24);
    expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(6.125 * 72);
    expect(pdf.internal.pageSize.getHeight()).toBeCloseTo(9.25 * 72);
    const raw = pdf.output();
    expect(raw).toContain("/FontFile2");
    expect(raw).not.toContain("/Helvetica");
    expect(raw).not.toContain("/Subtype /Image");
    expect(raw).toContain("My Test Book"); // document info title
  });
  it("every template renders with all extras", async () => {
    const { TEMPLATES } = await import("../src/lib/design/templates");
    for (const t of TEMPLATES) {
      const book = buildWordSearchBook(puzzles, { trim: "8.5x11", bleed: false, answersPerPage: 4, frontMatter: DEFAULT_FRONT_MATTER, extras: { ...DEFAULT_EXTRAS, intro: "Hello" }, design: t.design }, nodeFonts());
      expect(book.pageCount % 2).toBe(0);
      expect(book.pdf.output()).not.toContain("/Helvetica");
    }
  });
});

describe("ink stays inside KDP's margins (no bleed)", () => {
  it("strokes on the content box edge can't cross the gutter", () => {
    const spec = makePageSpec("8.5x11", 42, false);
    const odd = contentBox(spec, 7);
    const even = contentBox(spec, 8);
    // A 2pt stroke centred on the edge still clears 0.375" on the spine side.
    expect(odd.x - 1).toBeGreaterThanOrEqual(0.375 * PT);
    expect(8.5 * PT - (even.x + even.w) - 1).toBeGreaterThanOrEqual(0.375 * PT);
  });
  it("the background pattern keeps the full gutter on the spine side and 0.25\" elsewhere", () => {
    const W = 8.5 * PT, H = 11 * PT;
    const recto = patternArea(W, H, false, 0.375 * PT, "recto");
    const verso = patternArea(W, H, false, 0.375 * PT, "verso");
    expect(recto.x).toBeGreaterThan(0.375 * PT);
    expect(W - (recto.x + recto.w)).toBeGreaterThan(0.25 * PT);
    expect(W - (verso.x + verso.w)).toBeGreaterThan(0.375 * PT);
    expect(verso.x).toBeGreaterThan(0.25 * PT);
    expect(recto.y).toBeGreaterThan(0.25 * PT);
    expect(patternArea(W, H, true)).toEqual({ x: 0, y: 0, w: W, h: H });
  });
});

