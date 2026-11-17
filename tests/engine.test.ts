import { describe, expect, it } from "vitest";
import {
  ALL_DIRECTIONS,
  DIRECTIONS,
  allowedDirections,
  autoPlace,
  buildLetterGrid,
  checkPlacement,
  countWords,
  fillGrid,
  findOccurrences,
  generatePuzzle,
  gridForm,
  lineBetween,
  makePlacement,
  mulberry32,
  placementCells,
} from "../src/lib/wordsearch/engine";

const ALL = allowedDirections({ horizontal: true, vertical: true, diagonalDown: true, diagonalUp: true, reversed: true });
const WORDS = ["TOMATO", "BASIL", "SHOVEL", "COMPOST", "SEEDLING", "TRELLIS", "PUMPKIN", "SUNFLOWER", "HOSE", "TULIP", "CARROT", "MULCH"];

describe("directions", () => {
  it("maps toggles to directions", () => {
    expect(allowedDirections({ horizontal: true, vertical: false, diagonalDown: false, diagonalUp: false, reversed: false })).toEqual(["E"]);
    expect(allowedDirections({ horizontal: true, vertical: true, diagonalDown: false, diagonalUp: false, reversed: true }).sort()).toEqual(["E", "N", "S", "W"]);
    expect(ALL.length).toBe(8);
  });
  it("derives direction from start and end cells", () => {
    expect(lineBetween([2, 2], [2, 6])).toEqual({ dir: "E", length: 5 });
    expect(lineBetween([5, 5], [1, 1])).toEqual({ dir: "NW", length: 5 });
    expect(lineBetween([5, 0], [0, 5])).toEqual({ dir: "NE", length: 6 });
    expect(lineBetween([0, 0], [1, 3])).toBeNull();
    expect(lineBetween([1, 1], [1, 1])).toBeNull();
  });
});

describe("checkPlacement", () => {
  it("rejects out-of-bounds placements", () => {
    expect(checkPlacement(8, [], makePlacement("SUNFLOWER", 0, 0, "E")).reason).toBe("out-of-bounds");
    expect(checkPlacement(8, [], makePlacement("BASIL", 0, 0, "N")).reason).toBe("out-of-bounds");
    expect(checkPlacement(8, [], makePlacement("BASIL", 7, 3, "E")).ok).toBe(true);
  });
  it("rejects letter conflicts but allows matching overlaps", () => {
    const placed = [makePlacement("BASIL", 0, 0, "E")];
    expect(checkPlacement(10, placed, makePlacement("SHOVEL", 0, 2, "S")).ok).toBe(true); // shares S
    const bad = checkPlacement(10, placed, makePlacement("TULIP", 0, 1, "S"));
    expect(bad.reason).toBe("conflict");
    expect(bad.conflictAt).toEqual([0, 1]);
  });
  it("rejects a word sitting exactly on another word's cells", () => {
    const placed = [makePlacement("TAP", 0, 0, "E")];
    expect(checkPlacement(8, placed, makePlacement("PAT", 0, 2, "W")).reason).toBe("same-cells");
  });
});

describe("autoPlace", () => {
  it("keeps every placement in bounds and in an allowed direction", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const dirs = seed % 2 ? (["E", "S"] as const) : (["SE", "NE", "W"] as const);
      const res = autoPlace(12, [], WORDS, [...dirs], mulberry32(seed));
      for (const p of res.placements) {
        expect(dirs).toContain(p.dir);
        for (const [r, c] of placementCells(p)) {
          expect(r).toBeGreaterThanOrEqual(0);
          expect(c).toBeGreaterThanOrEqual(0);
          expect(r).toBeLessThan(12);
          expect(c).toBeLessThan(12);
        }
      }
      expect(res.placements.length + res.unplaced.length).toBe(WORDS.length);
    }
  });

  it("never writes conflicting letters", () => {
    const res = autoPlace(10, [], WORDS, ALL, mulberry32(7));
    const grid = buildLetterGrid(10, []);
    for (const p of res.placements) {
      placementCells(p).forEach(([r, c], i) => {
        if (grid[r][c] !== null) expect(grid[r][c]).toBe(p.letters[i]);
        grid[r][c] = p.letters[i];
      });
    }
  });

  it("keeps manually placed words where they are", () => {
    const fixed = [makePlacement("SUNFLOWER", 3, 3, "S")];
    const res = generatePuzzle(WORDS, 15, ALL, mulberry32(3), fixed);
    expect(res.placements[0]).toEqual(fixed[0]);
    expect(res.placements.filter((p) => p.word === "SUNFLOWER")).toHaveLength(1);
  });

  it("does not hang on impossible input and reports what did not fit", () => {
    const impossible = ["ABCDEFGH", "IJKLMNOP", "QRSTUVWX", "YZABCDEF", "GHIJKLMN", "OPQRSTUV", "WXYZABCD", "EFGHIJKL", "MNOPQRST", "UVWXYZAB", "CDEFGHIJ", "KLMNOPQR"];
    const t0 = Date.now();
    const res = autoPlace(8, [], impossible, ["E", "S"], mulberry32(1));
    expect(Date.now() - t0).toBeLessThan(5000);
    expect(res.unplaced.length).toBeGreaterThan(0);
    expect(res.placements.length + res.unplaced.length).toBe(impossible.length);
  });

  it("reports words longer than the grid and handles no directions", () => {
    expect(autoPlace(8, [], ["SUNFLOWERS"], ALL, mulberry32(1)).unplaced).toEqual(["SUNFLOWERS"]);
    expect(autoPlace(8, [], ["BASIL"], [], mulberry32(1)).unplaced).toEqual(["BASIL"]);
  });
});

describe("solvability", () => {
  it("every listed word is found exactly once in the filled grid", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const size = 10 + (seed % 10);
      const res = generatePuzzle(WORDS, size, ALL, mulberry32(seed));
      expect(res.unplaced).toEqual([]);
      for (const { word, count } of countWords(res.grid, res.placements)) {
        expect(count, `${word} (seed ${seed})`).toBe(1);
      }
      // Grid is completely filled with single characters
      for (const row of res.grid) for (const ch of row) expect(ch).toMatch(/^[A-Z0-9Ñ]$/);
    }
  });

  it("fill avoids accidental copies even for short words", () => {
    const placements = [makePlacement("CAT", 0, 0, "E"), makePlacement("DOG", 2, 0, "E"), makePlacement("ANA", 4, 0, "E")];
    for (let seed = 1; seed <= 30; seed++) {
      const { grid } = fillGrid(8, placements, mulberry32(seed));
      for (const p of placements) expect(findOccurrences(grid, p.letters)).toHaveLength(1);
    }
  });

  it("counts palindromes once and supports Ñ / hyphen words", () => {
    const p = makePlacement("LEVEL", 0, 0, "E");
    const grid = buildLetterGrid(8, [p]);
    expect(findOccurrences(grid, "LEVEL")).toHaveLength(1);
    expect(gridForm("t-rex")).toBe("TREX");
    const res = generatePuzzle(["MAÑANA", "T-REX", "NIÑO"], 10, ALL, mulberry32(5));
    expect(countWords(res.grid, res.placements).every((c) => c.count === 1)).toBe(true);
  });

  it("direction vectors are unit steps", () => {
    for (const k of ALL_DIRECTIONS) {
      const d = DIRECTIONS[k];
      expect(Math.abs(d.dr) <= 1 && Math.abs(d.dc) <= 1 && (d.dr !== 0 || d.dc !== 0)).toBe(true);
    }
  });
});
