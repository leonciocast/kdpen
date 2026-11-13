import { describe, expect, it } from "vitest";
import { generatePuzzle, allowedDirections, mulberry32 } from "../src/lib/wordsearch/engine";
import { insideMargin, makePageSpec, marginsForPage, paddedPageCount, outsideMargin } from "../src/lib/print/kdp";
import { buildWordSearchBook, BookPuzzle } from "../src/lib/wordsearch/pdf";
import { DEFAULT_FRONT_MATTER } from "../src/lib/print/frontMatter";
import { planKinds } from "../src/lib/print/book";
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
  const noop = () => {};
  it("puts title, copyright, dedication, how-to before content and pads", () => {
    const kinds = planKinds({ frontMatter: { ...DEFAULT_FRONT_MATTER, dedication: "For Mom" }, howTo: { heading: "x", paragraphs: [] }, content: [noop, noop, noop] });
    expect(kinds.slice(0, 7)).toEqual(["title", "copyright", "dedication", "howto", "content", "content", "content"]);
    expect(kinds.length).toBe(24);
  });
  it("skips dedication when empty and front matter when off", () => {
    expect(planKinds({ frontMatter: DEFAULT_FRONT_MATTER, content: [noop] }).slice(0, 3)).toEqual(["title", "copyright", "content"]);
    expect(planKinds({ frontMatter: null, content: [noop], padForKdp: false })).toEqual(["content", "blank"]);
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
    const book = buildWordSearchBook(puzzles, { trim: "6x9", bleed: true, answersPerPage: 2, frontMatter: fm }, nodeFonts());
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
});
