import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { allowedWordDirections, blockedSpans, scanGrid, wordIsBlocked } from "../src/lib/wordsearch/blocklist";
import { allowedDirections, generatePuzzle, mulberry32, placementCells } from "../src/lib/wordsearch/engine";
import { generateCaseGrid, directionsFor } from "../src/lib/mystery/engine";

// Mild tokens from the shared list are enough to exercise the scanner.
const grid = (rows: string[]) => rows.map((r) => [...r].map((ch) => (ch === "." ? "" : ch)));

describe("blocklist scanner", () => {
  it("finds a token in all 8 directions", () => {
    const g = grid(["CRAPQ", "QQQQQ", "QQQQQ", "QQQQQ", "QQQQQ"]);
    expect(scanGrid(g)).toHaveLength(1);
    expect(scanGrid(grid(["PARCQ", "QQQQQ"]))).toHaveLength(1); // read right to left
    expect(scanGrid(grid(["CQQQ", "RQQQ", "AQQQ", "PQQQ"]))).toHaveLength(1);
    expect(scanGrid(grid(["CQQQ", "QRQQ", "QQAQ", "QQQP"]))).toHaveLength(1);
    expect(scanGrid(grid(["QQQP", "QQAQ", "QRQQ", "CQQQ"]))).toHaveLength(1);
    expect(scanGrid(grid(["QQQQ", "QQQQ", "QQQQ", "QQQQ"]))).toHaveLength(0);
  });
  it("excuses innocent words and stops at holes in a shape", () => {
    expect(blockedSpans("SPOON")).toEqual([]);
    expect(blockedSpans("QPOOQ")).toHaveLength(1);
    expect(scanGrid(grid(["CR.AP"]))).toHaveLength(0);
    expect(scanGrid(grid(["CR.AP"]), [], "join")).toHaveLength(1);
  });
  it("leaves a token that lies inside one answer to the word check", () => {
    const g = grid(["PARCEL"]);
    const word = [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]] as [number, number][];
    expect(scanGrid(g)).toHaveLength(1);
    expect(scanGrid(g, [word])).toHaveLength(0);
    expect(wordIsBlocked("PARCEL")).toBe(true);
    expect(wordIsBlocked("LANTERN")).toBe(false);
    // ...so such a word only runs forwards, and the token reads only against the flow.
    expect(allowedWordDirections("PARCEL", ["E", "W", "S", "N"])).toEqual(["E", "S"]);
    expect(allowedWordDirections("LANTERN", ["E", "W"])).toEqual(["E", "W"]);
  });
  it("ships the list as hashes only, and no screen imports it", () => {
    const data = readFileSync("src/lib/wordsearch/blocklistData.ts", "utf8");
    const hashes = data.slice(data.indexOf("BLOCKED_TOKEN_HASHES"), data.indexOf("INNOCENT_STEMS"));
    expect(hashes).not.toMatch(/"[A-Z]{3,}"/);
    const files: string[] = [];
    const walk = (d: string) => readdirSync(d).forEach((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : files.push(join(d, f))));
    walk("src/components");
    walk("src/app");
    for (const f of files.filter((x) => /\.tsx?$/.test(x))) expect(readFileSync(f, "utf8"), f).not.toMatch(/blocklist/);
  });
});

describe("generators never leave a blocked word", () => {
  const ALL = allowedDirections({ horizontal: true, vertical: true, diagonalDown: true, diagonalUp: true, reversed: true });
  it("classic word search: random filler is re-rolled until clean", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const p = generatePuzzle(["LANTERN", "HARBOR", "FERRY", "PARCEL", "CLOCK", "ANCHOR"], 12, ALL, mulberry32(seed));
      expect(scanGrid(p.grid, p.placements.map(placementCells)), `seed ${seed}`).toEqual([]);
      const parcel = p.placements.find((x) => x.word === "PARCEL");
      if (parcel) expect(["E", "S", "SE", "NE"]).toContain(parcel.dir);
    }
  });
  it("mystery: words and message letters are re-placed until clean", () => {
    const words = ["KETTLE", "TEAPOT", "RIBBON", "WINDOW", "LEDGER", "WHISTLE", "CHAIR", "DESK", "HOOK", "ROPE", "BUOY", "MAP"];
    for (const seed of [1, 2, 3, 20261115]) {
      const g = generateCaseGrid({ words, extra: "PARCEL", message: "THE GUILTY ONE WEARS A STRIPED APRON", dirs: directionsFor("medium"), seed });
      expect(scanGrid(g.grid, [...g.placements, ...(g.extra ? [g.extra] : [])].map(placementCells))).toEqual([]);
    }
  });
});
