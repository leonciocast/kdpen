import { describe, expect, it } from "vitest";
import { clueLists, generateCrossword, parseClueLine, validateEntries, cwLetters } from "../src/lib/crossword/engine";
import { mulberry32 } from "../src/lib/wordsearch/engine";
import { buildCrosswordBook } from "../src/lib/crossword/pdf";
import { nodeFonts } from "../src/lib/print/nodeFonts";

const ENTRIES = [
  ["LION", "King of the jungle"], ["ORANGE", "Citrus fruit"], ["PIANO", "Instrument with 88 keys"], ["EAGLE", "Bird"],
  ["ICE CREAM", "Frozen treat"], ["RAINBOW", "Colors after rain"], ["CANDLE", "Wax light"], ["APPLE", "Red fruit"],
].map(([answer, clue]) => ({ answer, clue }));

/** All maximal runs of 2+ letters, across and down. */
function runs(grid: (string | null)[][]) {
  const out: string[] = [];
  const h = grid.length, w = grid[0]?.length ?? 0;
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    if (grid[r][c] && (c === 0 || !grid[r][c - 1]) && c + 1 < w && grid[r][c + 1]) {
      let s = ""; for (let k = c; k < w && grid[r][k]; k++) s += grid[r][k]; out.push(`A${r},${c}:${s}`);
    }
    if (grid[r][c] && (r === 0 || !grid[r - 1][c]) && r + 1 < h && grid[r + 1][c]) {
      let s = ""; for (let k = r; k < h && grid[k][c]; k++) s += grid[k][c]; out.push(`D${r},${c}:${s}`);
    }
  }
  return out.sort();
}

describe("crossword parsing", () => {
  it("accepts several separators and keeps hyphenated/phrase answers", () => {
    expect(parseClueLine("Lion - King of the jungle")).toEqual({ answer: "LION", clue: "King of the jungle" });
    expect(parseClueLine("ice cream: Frozen treat")).toEqual({ answer: "ICE CREAM", clue: "Frozen treat" });
    expect(parseClueLine("T-REX - Big dinosaur")).toEqual({ answer: "T-REX", clue: "Big dinosaur" });
    expect(parseClueLine("Lion-king of jungle")).toEqual({ answer: "LION", clue: "king of jungle" });
    expect("error" in parseClueLine("LION")).toBe(true);
  });
  it("validates entries", () => {
    const r = validateEntries([{ answer: "LION", clue: "x" }, { answer: "LI0N!", clue: "x" }, { answer: "LION", clue: "y" }], []);
    expect(r.added).toHaveLength(1);
    expect(r.errors).toHaveLength(1);
    expect(r.skipped).toHaveLength(1);
  });
});

describe("crossword layout", () => {
  it("is consistent: every letter run is exactly one placed answer", () => {
    for (let seed = 1; seed <= 15; seed++) {
      const cw = generateCrossword(ENTRIES, mulberry32(seed));
      const expected = cw.placements.map((p) => `${p.across ? "A" : "D"}${p.row},${p.col}:${p.letters}`).sort();
      expect(runs(cw.grid)).toEqual(expected);
      expect(cw.placements.length + cw.leftOut.length).toBe(ENTRIES.length);
      expect(cw.placements.find((p) => p.answer === "ICE CREAM")?.letters ?? "ICECREAM").toBe("ICECREAM");
    }
  });
  it("numbers clues in reading order", () => {
    const cw = generateCrossword(ENTRIES, mulberry32(3));
    const nums = cw.placements.map((p) => p.number);
    expect(Math.min(...nums)).toBe(1);
    const { across, down } = clueLists(cw);
    expect(across.length + down.length).toBe(cw.placements.length);
  });
  it("reports words that share no letters instead of hanging", () => {
    const cw = generateCrossword([{ answer: "AAB", clue: "x" }, { answer: "XYZ", clue: "y" }], mulberry32(1));
    expect(cw.leftOut).toHaveLength(1);
    expect(cwLetters("A-B C")).toBe("ABC");
  });
  it("renders a book", () => {
    const cw = generateCrossword(ENTRIES, mulberry32(2));
    const book = buildCrosswordBook([{ cw, title: "Crossword 1" }], { trim: "8.5x11", bleed: false, frontMatter: null }, nodeFonts());
    expect(book.pageCount).toBe(24);
  });
});
