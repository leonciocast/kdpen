import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { generatePuzzle, allowedDirections, mulberry32 } from "../src/lib/wordsearch/engine";
import { insideMargin, makePageSpec, marginsForPage, paddedPageCount, outsideMargin } from "../src/lib/wordsearch/kdp";
import { buildBookPdf, planBook, BookPuzzle } from "../src/lib/wordsearch/pdf";

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

describe("book PDF", () => {
  const dirs = allowedDirections({ horizontal: true, vertical: true, diagonalDown: true, diagonalUp: true, reversed: false });
  const puzzles: BookPuzzle[] = [0, 1, 2].map((i) => {
    const g = generatePuzzle(["APPLE", "BANANA", "CHERRY", "GRAPE", "LEMON", "MANGO"], 12, dirs, mulberry32(i + 1));
    return { title: `Puzzle ${i + 1}`, size: 12, grid: g.grid, words: g.placements.map((p) => p.word), placements: g.placements };
  });
  const opts = { trim: "6x9" as const, bleed: false, title: "Test", author: "Me", answersPerPage: 2 as const, includeFrontMatter: true };

  it("plans puzzle pages then answer pages, padded", () => {
    const plan = planBook(puzzles, opts);
    expect(plan.pages.map((p) => p.kind).slice(0, 7)).toEqual(["title", "intro", "puzzle", "puzzle", "puzzle", "answers", "answers"]);
    expect(plan.pageCount).toBe(24);
  });

  it("renders a vector PDF with the right page size and embedded font", () => {
    const dir = join(__dirname, "..", "public", "fonts");
    const fonts = {
      regular: readFileSync(join(dir, "DejaVuSans.ttf")).toString("base64"),
      bold: readFileSync(join(dir, "DejaVuSans-Bold.ttf")).toString("base64"),
    };
    const { pdf } = buildBookPdf(puzzles, { ...opts, bleed: true }, fonts);
    expect(pdf.getNumberOfPages()).toBe(24);
    expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(6.125 * 72);
    expect(pdf.internal.pageSize.getHeight()).toBeCloseTo(9.25 * 72);
    const raw = pdf.output();
    expect(raw).toContain("/FontFile2");
    expect(raw).not.toContain("/Helvetica");
    expect(raw).not.toContain("/Subtype /Image");
  });
});
