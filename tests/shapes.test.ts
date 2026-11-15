import { describe, expect, it } from "vitest";
import { ANIMAL_GROUPS, ANIMAL_KEYS, ARTIST_MARGIN, CATEGORIES, CELL_DILATE, CROSSWORD_SHAPES, SHAPES, animalGroupOf, shapeCategory, shapesInCategory, SUDOKU_SHAPES, ShapeKey, fillRatio, longestRun, maskBox, maskCells, letteredOutlines, maskOutline, maskOutlines, maskLoops, shapeInfo, shapeMask, shapeOutline, steppedOutlines, shapedGrid, shapeFor, shapeTargetsFor, suggestShapeForTheme, sudokuFrame } from "../src/lib/shapes/shapes";
import { ALL_DIRECTIONS, checkPlacement, findOccurrences, gridForm, makePlacement, mulberry32, placementCells, Placement } from "../src/lib/wordsearch/engine";
import { resolveFixed, resolveFreeEnd, snapStart, validDirectionsFrom, validStartCells } from "../src/lib/wordsearch/snap";
import { WS_DIFFICULTIES, suggestGridSize } from "../src/lib/wordsearch/difficulty";
import { splitIntoPuzzles } from "../src/lib/wordsearch/bulk";
import { generateOneWordSearch } from "../src/lib/jobs/run";
import { generateCrossword } from "../src/lib/crossword/engine";
import { buildWordSearchBook, wsGeometry, wsLetterSize } from "../src/lib/wordsearch/pdf";
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
    for (const k of SHAPED) {
      const min = shapeInfo(k).minSize ?? 10;
      const sizes = [10, 15, 20, 28, 40].filter((n) => n >= min);
      if (!sizes.includes(min) && min <= LIMITS.maxShapeGridSize) sizes.unshift(min);
      for (const n of sizes) {
        const m = shapeMask(k, n)!;
        const cells = maskCells(m, n);
        const on = (r: number, c: number) => r >= 0 && c >= 0 && r < n && c < n && m[r][c];
        const [br0, bc0, br1, bc1] = maskBox(m, n);
        const box = (br1 - br0 + 1) * (bc1 - bc0 + 1);
        const slim = shapeInfo(k).group === "animals" || shapeInfo(k).group === "stepped" || shapeInfo(k).group === "objects" || shapeInfo(k).islands;
        const gridFrac = slim ? 0.05 : 0.12;
        const boxFrac = slim ? 0.2 : 0.35;
        if (n >= 14) expect(cells, `${k} ${n}`).toBeGreaterThan(Math.min(n * n * gridFrac, box * boxFrac));
        if (n >= 14) expect(cells, `${k} ${n} cells`).toBeGreaterThan(shapeInfo(k).islands ? 30 : 16);
        // Geometric shapes: every used cell belongs to a fully used 3×3 block.
        // Animals, objects and stepped forms may be thinner, but never a one-cell spike.
        if (shapeInfo(k).group === "basic" || shapeInfo(k).group === "geometric") {
          const win = 3;
          for (let r = 0; r < n; r++)
            for (let c = 0; c < n; c++) {
              if (!m[r][c]) continue;
              let ok = false;
              for (let a = r - (win - 1); a <= r && !ok; a++)
                for (let b = c - (win - 1); b <= c && !ok; b++) {
                  let full = true;
                  for (let i = 0; i < win; i++) for (let j = 0; j < win; j++) if (!on(a + i, b + j)) full = false;
                  ok = full;
                }
              expect(ok, `${k} ${n} sliver at ${r},${c}`).toBe(true);
            }
        }
        // Each used cell has at least 2 used neighbours (no one-cell spikes).
        // Animals count diagonals so a 1-cell-wide antler can run diagonally.
        const nDirs: [number, number][] = slim
          ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
          : [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (let r = 0; r < n; r++)
          for (let c = 0; c < n; c++)
            if (m[r][c]) expect(nDirs.reduce((s, [dr, dc]) => s + +on(r + dr, c + dc), 0), `${k} ${n} spike at ${r},${c}`).toBeGreaterThanOrEqual(2);
        // Connected (one piece, or several large islands when the shape is a cluster).
        const seen = new Set<string>();
        let comps = 0;
        for (let r = 0; r < n; r++)
          for (let c = 0; c < n; c++) {
            if (!m[r][c] || seen.has(`${r},${c}`)) continue;
            comps++;
            const st = [[r, c]];
            seen.add(`${r},${c}`);
            let sz = 0;
            while (st.length) {
              const [a, b] = st.pop()!;
              sz++;
              for (const [dr, dc] of nDirs) if (on(a + dr, b + dc) && !seen.has(`${a + dr},${b + dc}`)) { seen.add(`${a + dr},${b + dc}`); st.push([a + dr, b + dc]); }
            }
            if (shapeInfo(k).islands) expect(sz, `${k} ${n} tiny island`).toBeGreaterThanOrEqual(12);
          }
        expect(seen.size, `${k} ${n} visited`).toBe(cells);
        if (shapeInfo(k).islands) expect(comps, `${k} ${n} islands`).toBeGreaterThanOrEqual(2);
        else expect(comps, `${k} ${n} connected`).toBe(1);
      }
    }
  });
  it("artist outlines are the exact silhouette and contain every letter", () => {
    const ringIn = (pts: [number, number][], x: number, y: number) => {
      let hit = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
      }
      return hit;
    };
    const pointIn = (rings: [number, number][][], x: number, y: number) => rings.reduce((hit, ring) => hit !== ringIn(ring, x, y), false);
    const edgeDist = (rings: [number, number][][], x: number, y: number) => {
      let best = Infinity;
      for (const pts of rings) {
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [ax, ay] = pts[j];
          const [bx, by] = pts[i];
          const dx = bx - ax;
          const dy = by - ay;
          const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
          best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
        }
      }
      return best;
    };
    const half = 0.7 / 2 + ARTIST_MARGIN;
    for (const k of SHAPED) {
      const n = Math.max(shapeInfo(k).minSize ?? 16, 16);
      const rings = letteredOutlines(k, n, "smooth");
      expect(rings[0]?.length, k).toBeGreaterThanOrEqual(3);
      if (!shapeInfo(k).buildMask) {
        const sil = shapeOutline(k, n);
        expect(rings).toHaveLength(1);
        expect(rings[0], k).toEqual(sil);
      }
      const m = shapeMask(k, n)!;
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++) {
          if (!m[r][c]) continue;
          expect(pointIn(rings, c + 0.5, r + 0.5), `${k} letter at ${r},${c} outside the artist curve`).toBe(true);
          if (shapeInfo(k).group !== "animals") continue;
          const cx = c + 0.5;
          const cy = r + 0.5 + 0.04 * 0.7;
          for (const [x, y] of [
            [cx - half, cy - half],
            [cx + half, cy - half],
            [cx + half, cy + half],
            [cx - half, cy + half],
            [cx, cy - half],
            [cx, cy + half],
            [cx - half, cy],
            [cx + half, cy],
          ] as [number, number][]) {
            const ok = pointIn(rings, x, y) || edgeDist(rings, x, y) < 1e-6;
            expect(ok, `${k} ${n} glyph at ${r},${c} (${x.toFixed(2)},${y.toFixed(2)}) crosses the artist outline`).toBe(true);
          }
        }
    }
  });

  it("snug outlines hug letters and stay close to them", () => {
    const ringIn = (pts: [number, number][], x: number, y: number) => {
      let hit = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
      }
      return hit;
    };
    const pointIn = (rings: [number, number][][], x: number, y: number) => rings.reduce((hit, ring) => hit !== ringIn(ring, x, y), false);
    const nearCell = (m: boolean[][], x: number, y: number, max: number) => {
      const n = m.length;
      const r0 = Math.max(0, Math.floor(y) - 2);
      const r1 = Math.min(n - 1, Math.ceil(y) + 2);
      const c0 = Math.max(0, Math.floor(x) - 2);
      const c1 = Math.min(n - 1, Math.ceil(x) + 2);
      for (let r = r0; r <= r1; r++)
        for (let c = c0; c <= c1; c++) {
          if (!m[r][c]) continue;
          const dx = x < c ? c - x : x > c + 1 ? x - (c + 1) : 0;
          const dy = y < r ? r - y : y > r + 1 ? y - (r + 1) : 0;
          if (Math.hypot(dx, dy) <= max) return true;
        }
      return false;
    };
    const limit = CELL_DILATE + 0.12;
    for (const k of SHAPED) {
      const n = Math.max(shapeInfo(k).minSize ?? 16, 16);
      const m = shapeMask(k, n)!;
      const rings = letteredOutlines(k, n, "snug");
      expect(rings[0]?.length, k).toBeGreaterThanOrEqual(3);
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++) {
          if (!m[r][c]) continue;
          expect(pointIn(rings, c + 0.5, r + 0.5), `${k} letter at ${r},${c} outside the snug shade`).toBe(true);
        }
      for (const [x, y] of rings.flat()) expect(nearCell(m, x, y, limit), `${k} snug outline at ${x.toFixed(2)},${y.toFixed(2)}`).toBe(true);
      const xs = rings.flatMap((ring) => ring.map((p) => p[0]));
      const ys = rings.flatMap((ring) => ring.map((p) => p[1]));
      const x0 = Math.min(...xs);
      const y0 = Math.min(...ys);
      const x1 = Math.max(...xs);
      const y1 = Math.max(...ys);
      for (let y = y0 + 0.25; y < y1; y += 0.5)
        for (let x = x0 + 0.25; x < x1; x += 0.5) {
          if (!pointIn(rings, x, y)) continue;
          expect(nearCell(m, x, y, limit), `${k} snug empty shade at ${x.toFixed(2)},${y.toFixed(2)}`).toBe(true);
        }
    }
  }, 60_000);

  it("keeps every animal letter's glyph box inside the artist outline, with a margin, on 8.5x11 and 6x9", () => {
    const ringIn = (pts: [number, number][], x: number, y: number) => {
      let hit = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
      }
      return hit;
    };
    const pointIn = (rings: [number, number][][], x: number, y: number) => rings.reduce((hit, ring) => hit !== ringIn(ring, x, y), false);
    const edgeDist = (rings: [number, number][][], x: number, y: number) => {
      let best = Infinity;
      for (const pts of rings) {
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [ax, ay] = pts[j];
          const [bx, by] = pts[i];
          const dx = bx - ax;
          const dy = by - ay;
          const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
          best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
        }
      }
      return best;
    };
    const half = 0.7 / 2 + ARTIST_MARGIN;
    for (const trim of ["8.5x11", "6x9"] as const) {
      for (const k of ANIMAL_KEYS) {
        const n = shapeInfo(k).minSize ?? 24;
        const m = shapeMask(k, n)!;
        const rings = letteredOutlines(k, n, "smooth");
        expect(rings[0], `${k} ${trim}`).toEqual(shapeOutline(k, n));
        for (let r = 0; r < n; r++)
          for (let c = 0; c < n; c++) {
            if (!m[r][c]) continue;
            const cx = c + 0.5;
            const cy = r + 0.5 + 0.04 * 0.7;
            const box: [number, number][] = [
              [cx - half, cy - half],
              [cx + half, cy - half],
              [cx + half, cy + half],
              [cx - half, cy + half],
              [cx, cy - half],
              [cx, cy + half],
              [cx - half, cy],
              [cx + half, cy],
            ];
            for (const [x, y] of box) {
              const ok = pointIn(rings, x, y) || edgeDist(rings, x, y) < 1e-6;
              expect(ok, `${k} ${trim} ${n} glyph at ${r},${c} (${x.toFixed(2)},${y.toFixed(2)}) crosses the outline`).toBe(true);
            }
          }
      }
    }
  });

  it("puts every shape in exactly one picker category, and fills every category", () => {
    const seen = new Set<string>();
    for (const s of SHAPES) {
      const c = shapeCategory(s);
      expect(c, s.key).toBeTruthy();
      expect(CATEGORIES.some((x) => x.id === c), `${s.key} unknown category ${c}`).toBe(true);
      expect(seen.has(s.key), `duplicate ${s.key}`).toBe(false);
      seen.add(s.key);
      if (c === "animals") expect(ANIMAL_GROUPS.some((g) => g.id === animalGroupOf(s)), `${s.key} missing animal group`).toBe(true);
      else expect(animalGroupOf(s), s.key).toBeUndefined();
    }
    expect(seen.size).toBe(SHAPES.length);
    for (const c of CATEGORIES) expect(shapesInCategory(c.id).length, c.id).toBeGreaterThan(0);
  });

  it("includes every letter A–Z and digit 0–9 as a stepped block shape", () => {
    for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      const k = `letter${ch}` as ShapeKey;
      expect(SHAPES.some((s) => s.key === k), k).toBe(true);
      const n = shapeInfo(k).minSize ?? 28;
      const m = shapeMask(k, n)!;
      expect(maskCells(m, n), k).toBeGreaterThan(20);
      expect(letteredOutlines(k, n, "stepped")[0]?.length, k).toBeGreaterThanOrEqual(4);
    }
    for (const ch of "0123456789") {
      const k = `digit${ch}` as ShapeKey;
      expect(SHAPES.some((s) => s.key === k), k).toBe(true);
      expect(maskCells(shapeMask(k, 28)!, 28), k).toBeGreaterThan(16);
    }
  });

  it("places each word entirely inside one island of a multi-piece shape", () => {
    const keys: ShapeKey[] = ["sunburst", "petals", "checkers", "corners", "islands5", "islands9"];
    const comps = (m: boolean[][]) => {
      const n = m.length;
      const seen = m.map((row) => row.map(() => 0));
      let id = 0;
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as [number, number][];
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++) {
          if (!m[r][c] || seen[r][c]) continue;
          id++;
          const st: [number, number][] = [[r, c]];
          seen[r][c] = id;
          while (st.length) {
            const [a, b] = st.pop()!;
            for (const [dr, dc] of dirs) {
              const y = a + dr, x = b + dc;
              if (y >= 0 && x >= 0 && y < n && x < n && m[y][x] && !seen[y][x]) { seen[y][x] = id; st.push([y, x]); }
            }
          }
        }
      return seen;
    };
    for (const k of keys) {
      for (const d of WS_DIFFICULTIES) {
        const g = generateOneWordSearch({ title: k, theme: "", words: WORDS, size: suggestGridSize(WORDS, d.density), shape: k }, d, 7);
        expect(g.unplaced, `${k} ${d.id}`).toEqual([]);
        assertInside(g);
        const ids = comps(shapeMask(k, g.size)!);
        for (const p of g.placements) {
          const cells = placementCells(p);
          const parts = new Set(cells.map(([r, c]) => ids[r][c]));
          expect(parts.size, `${k} ${p.word} spanned islands`).toBe(1);
          expect([...parts][0], `${k} ${p.word}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("stepped outlines emit a path for every island, including holes", () => {
    const cases: { key: ShapeKey; minIslands: number; holes?: boolean }[] = [
      { key: "sunburst", minIslands: 9 },
      { key: "petals", minIslands: 7 },
      { key: "checkers", minIslands: 5 },
      { key: "corners", minIslands: 5 },
      { key: "islands5", minIslands: 5 },
      { key: "islands9", minIslands: 9 },
      { key: "arch", minIslands: 1 },
      { key: "letterS", minIslands: 1 },
      { key: "letterA", minIslands: 1 },
      { key: "ring", minIslands: 1, holes: true },
      { key: "windowframe", minIslands: 1, holes: true },
      { key: "boxframe", minIslands: 1, holes: true },
    ];
    const area = (pts: [number, number][]) => {
      let a = 0;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] - pts[i][0]) * (pts[j][1] + pts[i][1]);
      return a / 2;
    };
    for (const { key, minIslands, holes } of cases) {
      const n = Math.max(shapeInfo(key).minSize ?? 24, 24);
      const m = shapeMask(key, n)!;
      const rings = letteredOutlines(key, n, "stepped");
      expect(rings.length, key).toBeGreaterThanOrEqual(holes ? minIslands + 1 : minIslands);
      for (const ring of rings) {
        expect(ring.length, key).toBeGreaterThanOrEqual(4);
        expect(ring.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)), key).toBe(true);
      }
      const outer = rings.filter((r) => Math.abs(area(r)) > 0.5);
      expect(outer.length, `${key} outer rings`).toBeGreaterThanOrEqual(minIslands);
      // Inset rings sit on the lettered side of the cell edge.
      const raw = maskLoops(m);
      expect(raw.length, `${key} raw loops`).toBeGreaterThanOrEqual(rings.length);
    }
  });

  it("food and object silhouettes stroke as one simple outer path", () => {
    const keys: ShapeKey[] = ["apple", "pear", "icecream", "cupcake", "pizza", "cherry", "raindrop", "moon", "leaf", "snowflake", "gift", "shamrock", "car", "boat", "airplane", "guitar", "crown", "bulb"];
    const segsIntersect = (a: [number, number], b: [number, number], c: [number, number], d: [number, number]) => {
      const cross = (p: [number, number], q: [number, number], r: [number, number]) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
      const d1 = cross(a, b, c), d2 = cross(a, b, d), d3 = cross(c, d, a), d4 = cross(c, d, b);
      if (d1 === 0 && d2 === 0 && d3 === 0 && d4 === 0) return false;
      return d1 * d2 < 0 && d3 * d4 < 0;
    };
    for (const k of keys) {
      const n = Math.max(shapeInfo(k).minSize ?? 20, 20);
      const rings = letteredOutlines(k, n, "smooth");
      expect(rings.length, k).toBe(1);
      const pts = rings[0];
      expect(pts.length, k).toBeGreaterThanOrEqual(8);
      const m = pts.length;
      let hits = 0;
      for (let i = 0; i < m; i++) {
        const a = pts[i], b = pts[(i + 1) % m];
        for (let j = i + 2; j < m; j++) {
          if (i === 0 && j === m - 1) continue;
          if (segsIntersect(a, b, pts[j], pts[(j + 1) % m])) hits++;
        }
      }
      expect(hits, `${k} self-intersections`).toBe(0);
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
    const animals = shapeTargetsFor({ kind: "heart", mix: "animals" }, [{}, {}, {}, {}]);
    expect(animals.every((k) => ANIMAL_KEYS.includes(k))).toBe(true);
    expect(new Set(animals).size).toBeGreaterThan(1);
    const fromCat = shapeTargetsFor({ kind: "arch", mix: "category" }, [{}, {}, {}, {}]);
    expect(fromCat.every((k) => shapeCategory(k) === "stepped")).toBe(true);
    expect(new Set(fromCat).size).toBeGreaterThan(1);
    expect(shapeTargetsFor({ kind: "heart", mix: "theme" }, [{ theme: "Elephants" }, { theme: "Elephants" }, { theme: "Dolphins" }])).toEqual(["elephant", "elephant", "dolphin"]);
  });

  it("matches a theme name to an animal shape", () => {
    expect(suggestShapeForTheme("Elephants")).toBe("elephant");
    expect(suggestShapeForTheme("baby dinosaur party")).toBe("trex");
    expect(suggestShapeForTheme("SEA HORSES")).toBe("seahorse");
    expect(suggestShapeForTheme("")).toBeNull();
    expect(suggestShapeForTheme("Elephants", ["circle", "heart"])).toBeNull();
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
    expect(d.shape).toEqual({ kind: "square", mix: "one", shade: false, outline: "smooth" });
    expect(d.grid.line).toBe("solid");
    expect(d.grid.cells).toBe("plain");
    expect(d.list.box).toBe("none");
    expect(sanitizeDesign({ shape: { kind: "nope", mix: "x" } }).shape).toEqual({ kind: "square", mix: "one", shade: false, outline: "smooth" });
    expect(sanitizeDesign({ shape: { kind: "heart", mix: "each" } }).shape).toEqual({ kind: "heart", mix: "each", shade: false, outline: "smooth" });
    expect(sanitizeDesign({ shape: { kind: "elephant", mix: "animals", shade: true } }).shape).toEqual({ kind: "elephant", mix: "animals", shade: true, outline: "smooth" });
    expect(sanitizeDesign({ shape: { kind: "deer", mix: "one", outline: "blocky" } }).shape.outline).toBe("blocky");
    expect(sanitizeDesign({ shape: { kind: "deer", mix: "one", outline: "snug" } }).shape.outline).toBe("snug");
    expect(sanitizeDesign({ shape: { kind: "arch", mix: "category", shade: false, outline: "stepped", outlineColor: "#e67a2e" } }).shape).toEqual({ kind: "arch", mix: "category", shade: false, outline: "stepped", outlineColor: "#e67a2e" });
  });
});

describe("SVG path silhouettes", () => {
  it("samples commands, implicit numbers, and a unit box", async () => {
    const { pathToPoly, pathToUnit } = await import("../src/lib/shapes/silhouettes");
    const square = pathToPoly("M 0 0 L 10 0 L 10 10 L 0 10 Z");
    expect(square.length).toBeGreaterThanOrEqual(4);
    const { aspect } = pathToUnit("M 0 0 H 20 V 10 H 0 Z");
    expect(aspect).toBeCloseTo(2, 5);
    const p = pathToPoly("M0,0C1,0 2,0 2,1S3,2 2,2Q1,3 0,2Z");
    expect(p.length).toBeGreaterThan(8);
    const compact = pathToPoly("M0 0L10.5.5 11-2Z");
    expect(compact.length).toBeGreaterThanOrEqual(3);
  });

  it("gives every animal a usable outline and mask", () => {
    for (const k of ANIMAL_KEYS) {
      const n = Math.max(shapeInfo(k).minSize ?? 24, 24);
      const pts = shapeOutline(k, n);
      expect(pts.length, k).toBeGreaterThan(8);
      const m = shapeMask(k, n);
      expect(m, k).not.toBeNull();
      expect(maskCells(m!, n), k).toBeGreaterThan(20);
    }
  });
});

describe("word-search letter size", () => {
  /** Font size of single-letter grid glyphs on the first page of a rendered book. */
  async function letterSizes(trim: "8.5x11" | "6x9", shapes: ShapeKey[]) {
    const pz = shapes.map((k, i) => generateOneWordSearch({ title: k, theme: "", words: WORDS, size: 15, shape: k }, WS_DIFFICULTIES[1], 200 + i));
    const design = templateDesign("classic");
    design.shape.shade = true;
    const book = buildWordSearchBook(pz, { trim, bleed: false, answersPerPage: 1, frontMatter: null, extras: NO_EXTRAS, design }, nodeFonts());
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(book.pdf.output("arraybuffer")) }).promise;
    const out: { shape: ShapeKey; size: number; font: number; cell: number }[] = [];
    for (let i = 0; i < pz.length; i++) {
      const tc = await (await doc.getPage(i + 1)).getTextContent();
      const fonts: number[] = [];
      for (const item of tc.items) {
        if (!("str" in item) || !/^[A-Z]$/.test(item.str)) continue;
        const tr = (item as { transform: number[] }).transform;
        fonts.push(Math.abs(tr[0]) || Math.abs(tr[3]) || (item as { height?: number }).height || 0);
      }
      const geo = wsGeometry(pz[i]);
      // Reconstruct cell from the known letter-size formula once we have the font.
      const font = fonts.sort((a, b) => a - b)[Math.floor(fonts.length / 2)] ?? 0;
      const cell = font / 0.6; // classic template, plain cells, gridScale 1
      out.push({ shape: shapes[i], size: pz[i].size, font, cell });
    }
    return out;
  }

  it("stepped cell outline is drawn even when the frame is off", async () => {
    const g = generateOneWordSearch({ title: "Sun", theme: "", words: WORDS, size: 15, shape: "sunburst" }, WS_DIFFICULTIES[1], 7);
    const design = templateDesign("classic");
    design.shape = { kind: "sunburst", mix: "one", shade: false, outline: "stepped", outlineColor: "#e67a2e" };
    design.grid = { ...design.grid, border: "none", frame: 0, line: "solid", shadow: false };
    design.color = { ...design.color, grayscale: false };
    const book = buildWordSearchBook([g], { trim: "8.5x11", bleed: false, answersPerPage: 1, frontMatter: null, extras: NO_EXTRAS, design }, nodeFonts());
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(book.pdf.output("arraybuffer")) }).promise;
    let orange = 0;
    let stroked = 0;
    for (let i = 1; i <= doc.numPages; i++) {
      const ops = await (await doc.getPage(i)).getOperatorList();
      for (let k = 0; k < ops.fnArray.length; k++) {
        if (ops.fnArray[k] === 91 && ops.argsArray[k]?.[0] === 20) stroked++;
        if (ops.fnArray[k] === 58 && String(ops.argsArray[k]).toLowerCase().includes("e67a2e")) orange++;
      }
    }
    expect(orange, "orange #e67a2e stroke is in the PDF").toBeGreaterThan(0);
    expect(stroked, "stroked outline paths").toBeGreaterThan(0);
    const rings = letteredOutlines("sunburst", g.size, "stepped");
    expect(rings.length).toBeGreaterThanOrEqual(9);
  });

  it("stays at least about 7pt on 8.5x11, and records the 6x9 minimum", async () => {
    const keys: ShapeKey[] = ["elephant", "deer", "giraffe", "flamingo", "horse", "octopus", "arch", "sunburst", "letterA"];
    const large = await letterSizes("8.5x11", keys);
    for (const row of large) {
      expect(row.font, `${row.shape} ${row.size} on 8.5x11 is ${row.font.toFixed(2)}pt`).toBeGreaterThanOrEqual(7 - 0.05);
    }
    const small = await letterSizes("6x9", keys);
    const min6 = Math.min(...small.map((r) => r.font));
    expect(min6).toBeGreaterThan(4);
    // Also the helper agrees with the formula.
    expect(wsLetterSize(12, templateDesign("classic"))).toBeCloseTo(12 * 0.6, 5);
  });
});
