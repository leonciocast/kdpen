import { describe, expect, it } from "vitest";
import { balancedChunks, splitIntoPuzzles } from "../src/lib/wordsearch/bulk";
import { estimatePages, planVolumes, contentPagesFor } from "../src/lib/print/estimate";
import { DEFAULT_EXTRAS, NO_EXTRAS } from "../src/lib/print/book";
import { DEFAULT_FRONT_MATTER } from "../src/lib/print/frontMatter";
import { suggestGridSize, presetFor } from "../src/lib/wordsearch/difficulty";
import { generatePuzzle, mulberry32, gridForm, findOccurrences } from "../src/lib/wordsearch/engine";
import { LIMITS } from "../src/lib/limits";
import { mixPlan } from "../src/lib/sudoku";

describe("splitting", () => {
  it("balances chunks without a tiny last chunk", () => {
    const sizes = balancedChunks(Array.from({ length: 73 }, (_, i) => i), 36).map((c) => c.length);
    expect(sizes).toEqual([25, 25, 23]);
    expect(balancedChunks([], 10)).toEqual([]);
  });
  it("splits 10,000 words into puzzles of at most N and keeps every word", () => {
    const entries = Array.from({ length: 10000 }, (_, i) => ({ word: `WORD${i}`.replace(/\d/g, (d) => "ABCDEFGHIJ"[+d]) }));
    const specs = splitIntoPuzzles(entries, { wordsPerPuzzle: 36, size: "auto", density: 0.55, groupByTheme: false });
    expect(specs.length).toBe(Math.ceil(10000 / 36));
    expect(specs.every((s) => s.words.length <= 36)).toBe(true);
    expect(specs.reduce((a, s) => a + s.words.length, 0)).toBe(10000);
    expect(specs[0].title).toBe("Puzzle 1");
  });
  it("groups by theme and titles puzzles", () => {
    const entries = [
      ...Array.from({ length: 50 }, (_, i) => ({ word: "OCEAN" + "ABCDEFGHIJ"[i % 10] + "ABCDE"[Math.floor(i / 10)], theme: "Ocean" })),
      { word: "TULIP", theme: "Garden" },
      { word: "ROSE", theme: "Garden" },
    ];
    const specs = splitIntoPuzzles(entries, { wordsPerPuzzle: 30, size: 15, density: 0.5, groupByTheme: true });
    expect(specs.map((s) => s.title)).toEqual(["Ocean 1", "Ocean 2", "Garden"]);
    expect(specs.every((s) => s.size >= 15)).toBe(true);
  });
  it("caps words per puzzle at the configured limit", () => {
    const entries = Array.from({ length: 200 }, (_, i) => ({ word: "W" + i }));
    const specs = splitIntoPuzzles(entries, { wordsPerPuzzle: 500, size: "auto", density: 0.5, groupByTheme: false });
    expect(Math.max(...specs.map((s) => s.words.length))).toBeLessThanOrEqual(LIMITS.maxWordsPerPuzzle);
  });
  it("suggests a grid that fits the longest word and grows with letters", () => {
    expect(suggestGridSize(["SUPERCALIFRAGILISTIC"], 0.5)).toBeGreaterThanOrEqual(20);
    const small = suggestGridSize(Array(10).fill("APPLE"), 0.5);
    const big = suggestGridSize(Array(40).fill("APPLESAUCE"), 0.5);
    expect(big).toBeGreaterThan(small);
    expect(big).toBeLessThanOrEqual(LIMITS.maxGridSize);
  });
});

describe("page estimates and volumes", () => {
  const layout = { perPage: 1, answersPerPage: 6 };
  it("counts puzzle and answer pages", () => {
    expect(contentPagesFor(13, layout)).toBe(13 + 3);
    expect(contentPagesFor(0, layout)).toBe(0);
  });
  it("estimates even KDP page counts of at least 24", () => {
    const p = estimatePages({ items: 3, layout, frontMatter: DEFAULT_FRONT_MATTER, extras: NO_EXTRAS });
    expect(p).toBe(24);
    const big = estimatePages({ items: 300, layout, frontMatter: DEFAULT_FRONT_MATTER, extras: DEFAULT_EXTRAS });
    expect(big % 2).toBe(0);
    expect(big).toBeGreaterThan(350);
  });
  it("splits a 10,000-word book into balanced volumes under 828 pages", () => {
    const pagesFor = (n: number) => estimatePages({ items: n, layout, frontMatter: DEFAULT_FRONT_MATTER, extras: DEFAULT_EXTRAS });
    const plan = planVolumes(278, pagesFor);
    expect(plan.ranges.length).toBe(1);
    const huge = planVolumes(2000, pagesFor);
    expect(huge.ranges.length).toBeGreaterThan(1);
    expect(huge.pages.every((p) => p <= LIMITS.kdpMaxPages)).toBe(true);
    expect(huge.ranges[huge.ranges.length - 1][1]).toBe(2000);
    const sizes = huge.ranges.map(([a, b]) => b - a);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });
});

describe("difficulty and decoys", () => {
  it("presets get harder", () => {
    expect(presetFor("easy").dirs.length).toBeLessThan(presetFor("hard").dirs.length);
    expect(presetFor("expert").decoys).toBe("fragments");
  });
  it("decoys never create a second copy of a hidden word", () => {
    const words = ["TIGER", "LION", "ZEBRA", "HIPPO", "PANDA", "KOALA", "OTTER", "BISON"];
    for (const level of ["letters", "fragments"] as const) {
      for (let seed = 1; seed <= 5; seed++) {
        const g = generatePuzzle(words, 12, presetFor("expert").dirs, mulberry32(seed), [], { decoys: level });
        expect(g.unplaced).toEqual([]);
        for (const w of words) expect(findOccurrences(g.grid, gridForm(w)).length).toBe(1);
      }
    }
  });
});

describe("sudoku mix", () => {
  it("orders easiest first and keeps counts", () => {
    const plan = mixPlan({ easy: 2, medium: 1, hard: 0, expert: 3 });
    expect(plan).toEqual(["easy", "easy", "medium", "expert", "expert", "expert"]);
  });
});
