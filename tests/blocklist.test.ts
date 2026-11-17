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
  it("hard-blocks the mild NOB, SOD, PRAT and HORE too, even inside KNOB or SHORE filler", () => {
    for (const t of ["NOB", "SOD", "PRAT", "HORE"]) {
      expect(blockedSpans(`Q${t}Q`), t).toHaveLength(1);
      expect(scanGrid(grid([`Q${[...t].reverse().join("")}Q`, "QQQQQQ"])), t).toHaveLength(1); // read right to left
      expect(scanGrid(grid(["Q" + "Q".repeat(t.length), ...[...t].map((ch) => `Q${ch}`.padEnd(t.length + 1, "Q"))])), `${t} down`).toHaveLength(1);
    }
    expect(scanGrid(grid(["NO.B", "QQQQ"]))).toHaveLength(0); // split at a hole
    // Not excused by a look-alike word in the filler: a grid reading "…KNOB…" still shows NOB.
    for (const w of ["KNOB", "SODA", "SHORE"]) expect(blockedSpans(w), w).toHaveLength(1);
    // ...but an answer word that holds one is fine where it is placed (the hit lies inside its own cells).
    const shore = [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]] as [number, number][];
    expect(scanGrid(grid(["SHORE"]), [shore])).toHaveLength(0);
    expect(wordIsBlocked("RIBBON")).toBe(true); // reversed: NOBBIR
    expect(wordIsBlocked("TARP")).toBe(true); // reversed: PRAT
    expect(allowedWordDirections("RIBBON", ["E", "W", "S", "N", "SE", "NW"])).toEqual(["E", "S", "SE"]);
  });
  it("blocks the shared list's newer tokens in all 8 directions (kept ROT13 here so the test file stays clean)", () => {
    const rot = (w: string) => w.replace(/[A-Z]/g, (ch) => String.fromCharCode(((ch.charCodeAt(0) - 52) % 26) + 65));
    const newer = ["XBX", "XBPX", "OGPU", "OVPU", "XHAG", "SIPX", "XLXR", "CNAGL"].map(rot);
    const D: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]];
    for (const t of newer) {
      expect(blockedSpans(`Q${t}Q`), rot(t)).toHaveLength(1);
      for (const [dr, dc] of D) {
        const n = t.length + 2;
        const g = Array.from({ length: n }, () => Array.from({ length: n }, () => "Q"));
        const r0 = dr < 0 ? n - 2 : 1, c0 = dc < 0 ? n - 2 : 1;
        [...t].forEach((ch, i) => (g[r0 + dr * i][c0 + dc * i] = ch));
        expect(scanGrid(g), `${rot(t)} ${dr},${dc}`).toHaveLength(1);
      }
    }
    // Case 11 of the v4 book: K-O-K ran down-right through three different answer words, so no word excuses it.
    const k = grid(["KQQ", "QOQ", "QQK"]);
    expect(scanGrid(k, [[[0, 0]], [[1, 1]], [[2, 2]]])).toHaveLength(1);
    // The shared tool's innocent stems excuse the same readings ours do.
    for (const w of ["BICHON", "PRATTLE", "PRATFALL", "SPRAT"]) expect(blockedSpans(w), w).toEqual([]);
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
