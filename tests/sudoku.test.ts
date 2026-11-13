import { describe, expect, it } from "vitest";
import { generateSudokus, isValidSolution } from "../src/lib/sudoku";
import { buildSudokuBook } from "../src/lib/sudoku/pdf";
import { nodeFonts } from "../src/lib/print/nodeFonts";

describe("sudoku", () => {
  it("puzzles are consistent with valid solutions", () => {
    for (const p of generateSudokus(5, "hard")) {
      expect(isValidSolution(p.solution)).toBe(true);
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (p.board[r][c]) expect(p.board[r][c]).toBe(p.solution[r][c]);
      expect(p.board.flat().filter((v) => v === 0).length).toBeGreaterThan(30);
    }
  });
  it("clamps count", () => {
    expect(generateSudokus(0, "easy")).toHaveLength(1);
  });
  it("renders a book with solutions", () => {
    const book = buildSudokuBook(generateSudokus(6, "easy"), { trim: "6x9", bleed: false, frontMatter: null, puzzlesPerPage: 2 }, nodeFonts());
    expect(book.kinds.filter((k) => k === "content")).toHaveLength(3 + 2);
  });
});
