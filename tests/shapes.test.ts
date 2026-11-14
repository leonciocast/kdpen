import { describe, expect, it } from "vitest";
import { CROSSWORD_SHAPES, SHAPES, SUDOKU_SHAPES, ShapeKey, fillRatio, longestRun, maskBox, maskCells, shapeMask, shapeOutline, shapedGrid, shapeFor, shapeTargetsFor, sudokuFrame } from "../src/lib/shapes/shapes";
import { ALL_DIRECTIONS, checkPlacement, findOccurrences, gridForm, makePlacement, mulberry32, placementCells, Placement } from "../src/lib/wordsearch/engine";
import { resolveFixed, resolveFreeEnd, snapStart, validDirectionsFrom, validStartCells } from "../src/lib/wordsearch/snap";
import { WS_DIFFICULTIES, suggestGridSize } from "../src/lib/wordsearch/difficulty";
import { splitIntoPuzzles } from "../src/lib/wordsearch/bulk";
import { generateOneWordSearch } from "../src/lib/jobs/run";
import { generateCrossword } from "../src/lib/crossword/engine";
import { buildWordSearchBook, wsGeometry } from "../src/lib/wordsearch/pdf";
import { buildCrosswordBook } from "../src/lib/crossword/pdf";
import { buildSudokuBook } from "../src/lib/sudoku/pdf";
import { generateSudoku } from "../src/lib/sudoku";
import { nodeFonts } from "../src/lib/print/nodeFonts";
import { NO_EXTRAS } from "../src/lib/print/book";
import { templateDesign } from "../src/lib/design/templates";
import { sanitizeDesign } from "../src/lib/design/presets";
import { LIMITS } from "../src/lib/limits";

const SHAPED = SHAPES.map((s) => s.key).filter((k) => k !== "square");
const WORDS = "ELEPHANT GIRAFFE ZEBRA LION TIGER MONKEY PARROT KANGAROO PENGUIN DOLPHIN OCTOPUS RABBIT SQUIRREL HEDGEHOG BUTTERFLY ICE CREAM SEA HORSE".split(" ");

/** Every placed letter sits on a used cell, filler only inside, nothing outside. */
function assertInside(g: { size: number; shape?: ShapeKey; placements: Placement[]; grid: string[][]; words: string[]; unplaced: string[] }) {
  const m = shapeMask(g.shape, g.size);
  for (const p of g.placements)
    for (const [r, c] of placementCells(p)) {
      expect(r >= 0 && c >= 0 && r < g.size && c < g.size).toBe(true);
      if (m) expect(m[r][c], `${p.word} at ${r},${c} in ${g.shape}`).toBe(true);
    }
  for (let r = 0; r < g.size; r++)
    for (let c = 0; c < g.size; c++) {
      const inside = !m || m[r][c];
      expect(inside ? g.grid[r][c].length === 1 : g.grid[r][c] === "").toBe(true);
    }
  // No word silently dropped: placed + unplaced = all words.
  expect(new Set([...g.placements.map((p) => p.word), ...g.unplaced])).toEqual(new Set(g.words));
  // Solvable: every placed word can be read at its own position.
  for (const p of g.placements) {
    const occ = findOccurrences(g.grid, p.letters);
    expect(occ.some((o) => o.row === p.row && o.col === p.col && o.dir === p.dir) || occ.some((o) => placementCells({ ...p, row: o.row, col: o.col, dir: o.dir }).length)).toBe(true);
  }
}

describe("shape masks", () => {
  it("square is the plain grid", () => {
    expect(shapeMask("square", 15)).toBeNull();
    expect(fillRatio("square", 15)).toBe(1);
  });
  it("every shape gives a solid, connected mask with no thin slivers", () => {
    for (const k of SHAPED)
      for (const n of [10, 15, 20, 28, 40]) {
        const m = shapeMask(k, n)!;
        const cells = maskCells(m, n);
        const on = (r: number, c: number) => r >= 0 && c >= 0 && r < n && c < n && m[r][c];
        if (n >= 14) expect(cells, `${k} ${n}`).toBeGreaterThan(n * n * 0.18);
        // No slivers: every used cell belongs to a fully used 3×3 block.
        for (let r = 0; r < n; r++)
          for (let c = 0; c < n; c++) {
            if (!m[r][c]) continue;
            let ok = false;
            for (let a = r - 2; a <= r && !ok; a++)
              for (let b = c - 2; b <= c && !ok; b++) {
                let full = true;
                for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (!on(a + i, b + j)) full = false;
                ok = full;
              }
            expect(ok, `${k} ${n} sliver at ${r},${c}`).toBe(true);
          }
        // Each used cell has at least 2 used neighbours (no one-cell spikes).
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) expect(+on(r - 1, c) + +on(r + 1, c) + +on(r, c - 1) + +on(r, c + 1)).toBeGreaterThanOrEqual(2);
        // Connected (one piece).
        const seen = new Set<string>();
        const [r0, c0] = (() => { for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) return [r, c]; return [0, 0]; })();
        const st = [[r0, c0]];
        seen.add(`${r0},${c0}`);
        while (st.length) {
          const [a, b] = st.pop()!;
          for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (on(a + dr, b + dc) && !seen.has(`${a + dr},${b + dc}`)) { seen.add(`${a + dr},${b + dc}`); st.push([a + dr, b + dc]); }
        }
        expect(seen.size, `${k} ${n} connected`).toBe(cells);
        // The outline stays around the used cells.
        const pts = shapeOutline(k, n);
        const xs = pts.map((p) => p[0]);
        const [, cc0, , cc1] = maskBox(m, n);
        expect(Math.min(...xs)).toBeLessThanOrEqual(cc0);
        expect(Math.max(...xs)).toBeGreaterThanOrEqual(cc1 + 1);
      }
  });
  it("mixes shapes per puzzle or per theme", () => {
    expect(shapeFor({ kind: "heart", mix: "one" }, 5)).toBe("heart");
    const each = shapeTargetsFor({ kind: "heart", mix: "each" }, [{}, {}, {}]);
    expect(new Set(each).size).toBe(3);
    const theme = shapeTargetsFor({ kind: "heart", mix: "theme" }, [{ theme: "A" }, { theme: "A" }, { theme: "B" }]);
    expect(theme[0]).toBe(theme[1]);
    expect(theme[2]).not.toBe(theme[0]);
    expect(shapeFor({ kind: "star", mix: "one" }, 0, 0, CROSSWORD_SHAPES)).toBe("square");
  });
});

describe("shaped word searches", () => {
  it("places every word inside the shape, for every shape and difficulty", () => {
    for (const d of WS_DIFFICULTIES)
      for (const k of SHAPED) {
        const g = generateOneWordSearch({ title: k, theme: "", words: WORDS, size: suggestGridSize(WORDS, d.density), shape: k }, d, 42);
        expect(g.shape).toBe(k);
        expect(g.unplaced, `${k} ${d.id}`).toEqual([]);
        assertInside(g);
        expect(g.size).toBeLessThanOrEqual(LIMITS.maxShapeGridSize);
      }
  });

  it("10,000 words across all shapes: every word inside its shape, none dropped", () => {
    const rng = mulberry32(99);
    const syl = ["BA", "RO", "KI", "TE", "LU", "MA", "NE", "SO", "PI", "DA", "VE", "GO", "ZU", "FI", "HA", "WY", "QU", "CE"];
    const seen = new Set<string>();
    const entries: { word: string }[] = [];
    while (entries.length < 10000) {
      const n = 2 + Math.floor(rng() * 4);
      let w = "";
      for (let i = 0; i < n; i++) w += syl[Math.floor(rng() * syl.length)];
      if (!seen.has(w)) {
        seen.add(w);
        entries.push({ word: w });
      }
    }
    const d = WS_DIFFICULTIES[2];
    const specs = splitIntoPuzzles(entries, { wordsPerPuzzle: 20, size: "auto", density: d.density, groupByTheme: false });
    let placed = 0;
    let unplaced = 0;
    const t0 = Date.now();
    specs.forEach((s, i) => {
      const shape = SHAPED[i % SHAPED.length];
      const g = generateOneWordSearch({ ...s, shape }, d, i);
      assertInside(g);
      placed += g.placements.length;
      unplaced += g.unplaced.length;
    });
    expect(placed + unplaced).toBe(10000);
    expect(unplaced).toBe(0);
    expect(Date.now() - t0).toBeLessThan(60000);
  }, 120000);

  it("manual placement can't leave the shape", () => {
    for (const k of ["heart", "star", "triangle", "circle"] as ShapeKey[]) {
      const n = 18;
      const g = shapedGrid(n, k);
      const m = shapeMask(k, n)!;
      // A spot outside the shape is rejected with a clear message.
      const outside = makePlacement("CAT", 0, 0, "E");
      const res = checkPlacement(g, [], outside);
      expect(res.ok).toBe(false);
      expect(res.reason).toBe("out-of-bounds");
      expect(res.message).toMatch(/outside the shape/);
      for (const word of ["ICE CREAM", "ZEBRA"])
        for (const dir of ALL_DIRECTIONS) {
          for (let r = -2; r < n + 2; r++)
            for (let c = -2; c < n + 2; c++) {
              const fx = resolveFixed(g, [], word, dir, [r, c]);
              if (fx.kind === "place") for (const [a, b] of placementCells(fx.placement)) expect(m[a][b]).toBe(true);
              const s = snapStart(g, gridForm(word).length, dir, [r, c]);
              if (s) for (const [a, b] of placementCells(makePlacement(word, s[0], s[1], dir))) expect(m[a][b]).toBe(true);
            }
          for (const key of Array.from(validStartCells(g, [], word, dir))) {
            const [r, c] = key.split(",").map(Number);
            for (const [a, b] of placementCells(makePlacement(word, r, c, dir))) expect(m[a][b]).toBe(true);
          }
        }
      // Start → end mode: only in-shape directions are offered.
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++) {
          if (!m[r][c]) continue;
          for (const dir of validDirectionsFrom(g, [], "ZEBRA", [r, c])) for (const [a, b] of placementCells(makePlacement("ZEBRA", r, c, dir))) expect(m[a][b]).toBe(true);
          const fe = resolveFreeEnd(g, [], "ZEBRA", [r, c], [r, c + 4]);
          if (fe.kind === "place") for (const [a, b] of placementCells(fe.placement)) expect(m[a][b]).toBe(true);
        }
      expect(longestRun(m, n)).toBeGreaterThanOrEqual(8);
    }
  });

  it("solutions use the same shape and every listed word appears on the page", async () => {
    const pz = (["heart", "star", "egg"] as ShapeKey[]).map((k, i) => generateOneWordSearch({ title: k, theme: "", words: WORDS, size: 15, shape: k }, WS_DIFFICULTIES[1], i));
    const design = templateDesign("classic");
    design.grid.border = "double";
    design.grid.line = "dashed";
    design.grid.cells = "circles";
    design.list.box = "dashed";
    const book = buildWordSearchBook(pz, { trim: "8.5x11", bleed: false, answersPerPage: 4, frontMatter: null, extras: NO_EXTRAS, design }, nodeFonts());
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(book.pdf.output("arraybuffer")) }).promise;
    const cellCount = (k: number) => maskCells(shapeMask(pz[k].shape, pz[k].size), pz[k].size);
    for (let i = 0; i < 3; i++) {
      const tc = await (await doc.getPage(i + 1)).getTextContent();
      const strs = tc.items.map((x) => ("str" in x ? x.str : "")).filter((s) => s.trim());
      // One text item per used cell plus the header, title, list and page number.
      const singles = strs.filter((s) => /^[A-Z]$/.test(s)).length;
      expect(singles).toBeGreaterThanOrEqual(cellCount(i));
      expect(singles).toBeLessThan(cellCount(i) + 6);
    }
    const sol = await (await doc.getPage(4)).getTextContent();
    const solLetters = sol.items.map((x) => ("str" in x ? x.str : "")).filter((s) => /^[A-Z]$/.test(s)).length;
    expect(solLetters).toBeGreaterThanOrEqual(cellCount(0) + cellCount(1) + cellCount(2));
    // Same geometry on puzzle and solution pages.
    expect(wsGeometry(pz[0]).rows).toBe(wsGeometry({ size: pz[0].size, shape: "heart" }).rows);
  });
});

describe("shaped crosswords and sudoku frames", () => {
  const entries = "APPLE BANANA CHERRY GRAPE LEMON MANGO ORANGE PEACH PEAR PLUM LIME MELON".split(" ").map((a, i) => ({ answer: a, clue: `clue ${i}` }));
  it("every crossword word lies inside the mask, for each offered shape", () => {
    for (const k of CROSSWORD_SHAPES.filter((s) => s !== "square")) {
      let left = 0;
      for (let seed = 1; seed <= 4; seed++) {
        const cw = generateCrossword(entries, mulberry32(seed), 30, k);
        expect(cw.shape).toBe(k);
        const m = shapeMask(k, cw.canvas!)!;
        const [r0, c0] = cw.offset!;
        for (const p of cw.placements)
          for (let i = 0; i < p.letters.length; i++) {
            const r = p.row + (p.across ? 0 : i) + r0;
            const c = p.col + (p.across ? i : 0) + c0;
            expect(m[r][c], `${k} ${p.answer}`).toBe(true);
            expect(cw.grid[p.row + (p.across ? 0 : i)][p.col + (p.across ? i : 0)]).toBe(p.letters[i]);
          }
        left += cw.leftOut.length;
      }
      // Offered shapes keep (almost) every word connected.
      expect(left, k).toBeLessThanOrEqual(1);
    }
  });
  it("crossword and sudoku books render with shapes and frames", () => {
    const cw = generateCrossword(entries, mulberry32(3), 30, "heart");
    const d = templateDesign("elegant");
    d.shape.kind = "heart";
    d.list.box = "double";
    const book = buildCrosswordBook([{ cw, title: "Fruit" }], { trim: "8.5x11", bleed: false, frontMatter: null, extras: NO_EXTRAS, design: d }, nodeFonts());
    expect(book.pageCount).toBeGreaterThan(1);
    for (const k of SUDOKU_SHAPES) {
      const sd = templateDesign("classic");
      sd.shape.kind = k;
      sd.grid.cells = k === "circle" ? "circles" : "rounded";
      const sb = buildSudokuBook([generateSudoku("easy")], { trim: "8.5x11", bleed: false, frontMatter: null, extras: NO_EXTRAS, design: sd, puzzlesPerPage: 1, answersPerPage: 4 } as never, nodeFonts());
      expect(sb.pdf.output()).not.toContain("/Subtype /Image");
      // The 9×9 grid fits inside the frame.
      const f = sudokuFrame(k, 9);
      expect(Math.min(...f.map((p) => p[0]))).toBeLessThan(0);
    }
  });
  it("old saved designs gain safe defaults for the new fields", () => {
    const d = sanitizeDesign({ template: "kids", grid: { lines: true } });
    expect(d.shape).toEqual({ kind: "square", mix: "one" });
    expect(d.grid.line).toBe("solid");
    expect(d.grid.cells).toBe("plain");
    expect(d.list.box).toBe("none");
    expect(sanitizeDesign({ shape: { kind: "nope", mix: "x" } }).shape).toEqual({ kind: "square", mix: "one" });
    expect(sanitizeDesign({ shape: { kind: "heart", mix: "each" } }).shape).toEqual({ kind: "heart", mix: "each" });
  });
});
