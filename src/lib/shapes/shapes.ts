/**
 * Puzzle grid shapes. Every shape is a polygon in a unit box; a puzzle of
 * size N gets a boolean mask of the N×N cells that lie well inside it (with
 * room for the letter and the outline), cleaned so thin tips and stray cells
 * disappear. The same polygon is drawn as the outline, so it hugs the cells.
 * Pure (no DOM): shared by the engine, the PDF renderer, the UI and tests.
 */

import { ANIMALS } from "./animals";
import { mapRect, pathToUnit } from "./silhouettes";


export type ShapeKey =
  | "square"
  | "rounded"
  | "landscape"
  | "portrait"
  | "circle"
  | "oval"
  | "egg"
  | "triangle"
  | "diamond"
  | "pentagon"
  | "hexagon"
  | "octagon"
  | "heart"
  | "star"
  | "cross"
  | "house"
  | "tree"
  | "apple"
  | "pumpkin"
  | "cloud"
  | "elephant"
  | "deer"
  | "moose"
  | "horse"
  | "unicorn"
  | "zebra"
  | "donkey"
  | "cow"
  | "bull"
  | "pig"
  | "sheep"
  | "goat"
  | "llama"
  | "camel"
  | "giraffe"
  | "hippo"
  | "rhino"
  | "bear"
  | "panda"
  | "koala"
  | "cat"
  | "lion"
  | "dog"
  | "wolf"
  | "fox"
  | "rabbit"
  | "squirrel"
  | "mouse"
  | "hedgehog"
  | "raccoon"
  | "otter"
  | "monkey"
  | "kangaroo"
  | "owl"
  | "eagle"
  | "duck"
  | "swan"
  | "goose"
  | "chicken"
  | "rooster"
  | "turkey"
  | "penguin"
  | "flamingo"
  | "parrot"
  | "peacock"
  | "bat"
  | "fish"
  | "whale"
  | "dolphin"
  | "shark"
  | "seahorse"
  | "octopus"
  | "crab"
  | "lobster"
  | "turtle"
  | "frog"
  | "crocodile"
  | "snail"
  | "butterfly"
  | "bee"
  | "ladybug"
  | "trex"
  | "longneck"
  | "dragon"
  | "seal"
  | "ostrich"
  | "pelican"
  | "snake"
  | "scorpion";

export type Pt = [number, number];

export interface ShapeInfo {
  key: ShapeKey;
  label: string;
  /** Width / height of the shape. */
  aspect: number;
  /** Seasonal / theme hint shown on the card. */
  tag?: string;
  group: "basic" | "geometric" | "fun" | "animals";
  /** Smallest recommended N×N canvas (animals need more cells to stay recognisable). */
  minSize?: number;
  /** Extra names used to match a puzzle theme to this shape. */
  aliases?: string[];
  /** Torso box in the unit square; a sudoku 9×9 is placed inside it. */
  focus?: [number, number, number, number];
  /** Polygon in a unit box [0,1]×[0,1] (x right, y down), before aspect. */
  poly: () => Pt[];
}

const TAU = Math.PI * 2;

function regular(n: number, rot: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i * TAU) / n;
    pts.push([Math.cos(a), Math.sin(a)]);
  }
  return pts;
}

/** Scale points so their bounding box is exactly [0,1]². */
function normalize(pts: Pt[]): Pt[] {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const w = Math.max(...xs) - x0 || 1;
  const h = Math.max(...ys) - y0 || 1;
  return pts.map(([x, y]) => [(x - x0) / w, (y - y0) / h]);
}

function curve(n: number, f: (t: number) => Pt): Pt[] {
  return Array.from({ length: n }, (_, i) => f((i / n) * TAU));
}

function roundedRect(r: number, n = 10): Pt[] {
  const pts: Pt[] = [];
  const corners: [number, number, number][] = [
    [1 - r, r, -Math.PI / 2],
    [1 - r, 1 - r, 0],
    [r, 1 - r, Math.PI / 2],
    [r, r, Math.PI],
  ];
  for (const [cx, cy, a0] of corners) for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * (Math.PI / 2);
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/** Outline of a union of circles seen from `c` (the union must be star-shaped from c). */
function radialUnion(circles: [number, number, number][], c: Pt, n = 120): Pt[] {
  return curve(n, (t) => {
    const dx = Math.cos(t);
    const dy = Math.sin(t);
    let best = 0;
    for (const [x, y, r] of circles) {
      // Farthest intersection of the ray with this circle.
      const ox = c[0] - x;
      const oy = c[1] - y;
      const b = ox * dx + oy * dy;
      const disc = b * b - (ox * ox + oy * oy - r * r);
      if (disc >= 0) best = Math.max(best, -b + Math.sqrt(disc));
    }
    return [c[0] + dx * best, c[1] + dy * best];
  });
}

function animalShape(a: (typeof ANIMALS)[number]): ShapeInfo {
  const packed = pathToUnit(a.path);
  return {
    key: a.key as ShapeKey,
    label: a.label,
    aspect: a.aspect ?? packed.aspect,
    group: "animals",
    minSize: a.minSize,
    aliases: a.aliases,
    focus: a.focus ? mapRect(packed.bbox, a.focus) : undefined,
    poly: () => packed.poly,
  };
}

const ANIMAL_SHAPES: ShapeInfo[] = ANIMALS.map(animalShape);

export const SHAPES: ShapeInfo[] = [
  { key: "square", label: "Square", aspect: 1, group: "basic", poly: () => [[0, 0], [1, 0], [1, 1], [0, 1]] },
  { key: "rounded", label: "Rounded square", aspect: 1, group: "basic", poly: () => roundedRect(0.16) },
  { key: "landscape", label: "Wide rectangle", aspect: 1.38, group: "basic", poly: () => [[0, 0], [1, 0], [1, 1], [0, 1]] },
  { key: "portrait", label: "Tall rectangle", aspect: 0.76, group: "basic", poly: () => [[0, 0], [1, 0], [1, 1], [0, 1]] },
  { key: "circle", label: "Circle", aspect: 1, group: "basic", poly: () => normalize(curve(120, (t) => [Math.cos(t), Math.sin(t)])) },
  { key: "oval", label: "Oval", aspect: 1.32, group: "basic", poly: () => normalize(curve(120, (t) => [Math.cos(t), Math.sin(t)])) },
  { key: "triangle", label: "Triangle", aspect: 1.12, group: "geometric", poly: () => [[0.5, 0], [1, 1], [0, 1]] },
  { key: "diamond", label: "Diamond", aspect: 0.9, group: "geometric", poly: () => [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]] },
  { key: "pentagon", label: "Pentagon", aspect: 1, group: "geometric", poly: () => normalize(regular(5, -Math.PI / 2)) },
  { key: "hexagon", label: "Hexagon", aspect: 1.12, group: "geometric", poly: () => normalize(regular(6, 0)) },
  { key: "octagon", label: "Octagon", aspect: 1, group: "geometric", poly: () => normalize(regular(8, Math.PI / 8)) },
  {
    key: "star",
    label: "Star",
    aspect: 1.05,
    group: "geometric",
    // A chubby star (inner radius 0.55) so the points keep room for words.
    poly: () => normalize(Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5; const r = i % 2 ? 0.55 : 1; return [Math.cos(a) * r, Math.sin(a) * r] as Pt; })),
  },
  { key: "cross", label: "Plus", aspect: 1, group: "geometric", poly: () => [[0.3, 0], [0.7, 0], [0.7, 0.3], [1, 0.3], [1, 0.7], [0.7, 0.7], [0.7, 1], [0.3, 1], [0.3, 0.7], [0, 0.7], [0, 0.3], [0.3, 0.3]] },
  {
    key: "heart",
    label: "Heart",
    aspect: 1.08,
    tag: "Valentine's",
    group: "fun",
    poly: () => normalize(curve(140, (t) => [16 * Math.sin(t) ** 3, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))])),
  },
  {
    key: "egg",
    label: "Egg",
    aspect: 0.8,
    tag: "Easter",
    group: "fun",
    poly: () => normalize(curve(120, (t) => [Math.sin(t) * (0.78 - 0.22 * Math.cos(t)), -Math.cos(t)])),
  },
  {
    key: "pumpkin",
    label: "Pumpkin",
    aspect: 1.25,
    tag: "Halloween",
    group: "fun",
    poly: () => normalize(radialUnion([[0.5, 0.55, 0.36], [0.3, 0.57, 0.3], [0.7, 0.57, 0.3], [0.5, 0.2, 0.1]], [0.5, 0.55])),
  },
  {
    key: "tree",
    label: "Christmas tree",
    aspect: 0.9,
    tag: "Christmas",
    group: "fun",
    poly: () => [[0.5, 0], [0.8, 0.28], [0.66, 0.28], [0.92, 0.56], [0.76, 0.56], [1, 0.84], [0.65, 0.84], [0.65, 1], [0.35, 1], [0.35, 0.84], [0, 0.84], [0.24, 0.56], [0.08, 0.56], [0.34, 0.28], [0.2, 0.28]],
  },
  { key: "house", label: "House", aspect: 1, group: "fun", poly: () => [[0.5, 0], [1, 0.42], [0.9, 0.42], [0.9, 1], [0.1, 1], [0.1, 0.42], [0, 0.42]] },
  {
    key: "apple",
    label: "Apple",
    aspect: 1,
    tag: "Back to school",
    group: "fun",
    poly: () => normalize(curve(140, (t) => { const r = 1 - 0.16 * Math.exp(-((Math.atan2(Math.sin(t + Math.PI / 2), Math.cos(t + Math.PI / 2))) ** 2) / 0.12) - 0.06 * Math.exp(-((Math.atan2(Math.sin(t - Math.PI / 2), Math.cos(t - Math.PI / 2))) ** 2) / 0.1); return [Math.cos(t) * r * 1.04, Math.sin(t) * r]; })),
  },
  { key: "cloud", label: "Cloud", aspect: 1.45, group: "fun", poly: () => normalize(radialUnion([[0.5, 0.58, 0.3], [0.27, 0.62, 0.22], [0.73, 0.62, 0.22], [0.38, 0.38, 0.22], [0.63, 0.36, 0.25], [0.5, 0.72, 0.24]], [0.5, 0.56])) },
  ...ANIMAL_SHAPES,
];

export const SHAPE_KEYS = SHAPES.map((s) => s.key);
const BY_KEY = new Map(SHAPES.map((s) => [s.key, s]));
export const shapeInfo = (k: ShapeKey | undefined) => BY_KEY.get(k ?? "square") ?? SHAPES[0];
export const isSquare = (k: ShapeKey | undefined) => !k || k === "square";

/** Outline padding around the outer cells, in cells (the old square frame used 0.22). */
export const OUTLINE_PAD = 0.22;
/** A cell is used when its centre is at least this far (in cells) inside the outline. */
const INSET = 0.5 + OUTLINE_PAD;

// ---------------------------------------------------------------- geometry

function inside(pts: Pt[], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function edgeDistance(pts: Pt[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, ay] = pts[j];
    const [bx, by] = pts[i];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
  }
  return best;
}

/** The shape's outline in cell units for an N×N puzzle (the box around all N×N cells + padding). */
export function shapeOutline(key: ShapeKey | undefined, size: number): Pt[] {
  const info = shapeInfo(key);
  const box = size + 2 * OUTLINE_PAD;
  const w = info.aspect >= 1 ? box : box * info.aspect;
  const h = info.aspect >= 1 ? box / info.aspect : box;
  const x0 = -OUTLINE_PAD + (box - w) / 2;
  const y0 = -OUTLINE_PAD + (box - h) / 2;
  return info.poly().map(([x, y]) => [x0 + x * w, y0 + y * h]);
}

export type Mask = boolean[][];

/**
 * Remove cells that can't hold words and keep the biggest connected piece.
 * `open` is the opening block (3 for geometric shapes, 2 for animals so trunks,
 * antlers and legs survive).
 */
function clean(m: Mask, open = 3): Mask {
  const n = m.length;
  const on = (r: number, c: number) => r >= 0 && c >= 0 && r < n && c < n && m[r][c];
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        if (!m[r][c]) continue;
        const k = +on(r - 1, c) + +on(r + 1, c) + +on(r, c - 1) + +on(r, c + 1);
        if (k < 2) {
          m[r][c] = false;
          changed = true;
        }
      }
  }
  // Opening: keep only cells that belong to a fully used open×open square.
  const k = n >= 6 ? 3 : 0;
  const win = k ? Math.min(open, k) : 0;
  if (win >= 2 && n >= win + 2) {
    const keep = m.map((row) => row.map(() => false));
    for (let r = 0; r + win - 1 < n; r++)
      for (let c = 0; c + win - 1 < n; c++) {
        let full = true;
        for (let a = 0; a < win && full; a++) for (let b = 0; b < win && full; b++) if (!m[r + a][c + b]) full = false;
        if (full) for (let a = 0; a < win; a++) for (let b = 0; b < win; b++) keep[r + a][c + b] = true;
      }
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) m[r][c] = keep[r][c];
  }
  const seen = m.map((row) => row.map(() => false));
  let best: [number, number][] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (!m[r][c] || seen[r][c]) continue;
      const comp: [number, number][] = [];
      const stack: [number, number][] = [[r, c]];
      seen[r][c] = true;
      while (stack.length) {
        const [a, b] = stack.pop()!;
        comp.push([a, b]);
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const y = a + dr;
          const x = b + dc;
          if (on(y, x) && !seen[y][x]) {
            seen[y][x] = true;
            stack.push([y, x]);
          }
        }
      }
      if (comp.length > best.length) best = comp;
    }
  const out: Mask = m.map((row) => row.map(() => false));
  for (const [r, c] of best) out[r][c] = true;
  return out;
}

const cache = new Map<string, Mask>();

/** Which cells of an N×N grid a shape uses (null = all, i.e. a plain square). */
export function shapeMask(key: ShapeKey | undefined, size: number): Mask | null {
  if (isSquare(key)) return null;
  const id = `${key}:${size}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const pts = shapeOutline(key, size);
  const m: Mask = Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => inside(pts, c + 0.5, r + 0.5) && edgeDistance(pts, c + 0.5, r + 0.5) >= INSET - 1e-6));
  const open = shapeInfo(key).group === "animals" ? 2 : 3;
  const out = clean(m, open);
  cache.set(id, out);
  return out;
}

export function maskCells(mask: Mask | null, size: number): number {
  if (!mask) return size * size;
  return mask.reduce((a, row) => a + row.filter(Boolean).length, 0);
}

/** Share of the N×N cells a shape uses. */
export function fillRatio(key: ShapeKey | undefined, size: number): number {
  return maskCells(shapeMask(key, size), size) / (size * size);
}

/** Rows/cols actually used: [r0, c0, r1, c1] inclusive. */
export function maskBox(mask: Mask | null, size: number): [number, number, number, number] {
  if (!mask) return [0, 0, size - 1, size - 1];
  let r0 = size, c0 = size, r1 = -1, c1 = -1;
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (mask[r][c]) {
        r0 = Math.min(r0, r);
        r1 = Math.max(r1, r);
        c0 = Math.min(c0, c);
        c1 = Math.max(c1, c);
      }
  return r1 < 0 ? [0, 0, size - 1, size - 1] : [r0, c0, r1, c1];
}

/** Longest straight run of used cells in any of the 8 directions (a word longer than this can't fit). */
export function longestRun(mask: Mask | null, size: number): number {
  if (!mask) return size;
  let best = 0;
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++) {
        if (!mask[r][c]) continue;
        const pr = r - dr;
        const pc = c - dc;
        if (pr >= 0 && pc >= 0 && pc < size && mask[pr][pc]) continue;
        let k = 0;
        while (r + dr * k < size && c + dc * k >= 0 && c + dc * k < size && mask[r + dr * k][c + dc * k]) k++;
        best = Math.max(best, k);
      }
  }
  return best;
}

/** Chaikin corner rounding for polygon outlines ("rounded corners" frame). */
export function roundCorners(pts: Pt[], iterations = 2): Pt[] {
  if (pts.length > 40) return pts; // already a smooth curve
  let p = pts;
  for (let k = 0; k < iterations; k++) {
    const out: Pt[] = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i];
      const b = p[(i + 1) % p.length];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    p = out;
  }
  return p;
}

// ---------------------------------------------------------------- per-tool availability & mixing

export const ANIMAL_KEYS: ShapeKey[] = ANIMAL_SHAPES.map((s) => s.key);
export const isAnimal = (k: ShapeKey | undefined) => !!k && (shapeInfo(k).group === "animals");

export type ShapeCategory = "basic" | "animals" | "objects";
export function shapeCategory(s: ShapeInfo): ShapeCategory {
  if (s.group === "animals") return "animals";
  if (s.group === "fun") return "objects";
  return "basic";
}

function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Pick the animal (or other shape) whose name matches a puzzle theme, e.g. "Elephants" → elephant. */
export function suggestShapeForTheme(theme: string | undefined, allowed?: ShapeKey[]): ShapeKey | null {
  const t = normName(theme ?? "");
  if (!t) return null;
  const list = SHAPES.filter((s) => !allowed || allowed.includes(s.key));
  const names = (s: ShapeInfo) => [s.key, s.label, ...(s.aliases ?? [])].map(normName).filter(Boolean);
  const eq = (a: string, b: string) => a === b || a === b + "s" || a + "s" === b || a === b + "es" || a + "es" === b;
  for (const s of list) {
    for (const n of names(s)) if (eq(t, n)) return s.key;
  }
  for (const s of list) {
    for (const n of names(s)) {
      if (!n || n.length < 3) continue;
      if (t === n || t.includes(" " + n) || t.includes(n + " ") || n.includes(t)) return s.key;
    }
  }
  return null;
}

/**
 * Shapes that make good crosswords. Measured over the standard 12-word fruit
 * set (4 seeds): triangle, diamond, star, tree, pentagon, tall rectangle,
 * rabbit, mouse, dolphin and seal lost too many words, so they are not offered.
 */
export const CROSSWORD_SHAPES: ShapeKey[] = [
  "square", "rounded", "landscape", "circle", "oval", "octagon", "hexagon", "heart", "egg", "apple", "pumpkin", "house", "cloud",
  ...ANIMAL_KEYS.filter((k) => !(["horse", "fox", "raccoon", "bat", "seahorse", "snake", "scorpion"] as ShapeKey[]).includes(k)),
];

/** Shapes used when "mix shapes" is on (basics plus a rotation of favourite animals). */
export const MIX_SET: ShapeKey[] = ["circle", "heart", "star", "hexagon", "diamond", "cloud", "octagon", "egg", "apple", "rounded", "elephant", "dolphin", "cat", "owl", "fish", "butterfly", "dog", "penguin", "rabbit", "whale"];

export type ShapeMix = "one" | "each" | "theme" | "animals";

/** The shape of puzzle `index` (theme order index `themeIndex`) for a design's shape choice. */
export function shapeFor(choice: { kind: ShapeKey; mix: ShapeMix }, index: number, themeIndex = 0, allowed?: ShapeKey[]): ShapeKey {
  if (choice.mix === "animals") {
    const set = ANIMAL_KEYS.filter((s) => !allowed || allowed.includes(s));
    return set.length ? set[index % set.length] : (allowed?.[0] ?? "square");
  }
  const set = allowed ? MIX_SET.filter((s) => allowed.includes(s)) : MIX_SET;
  if (!set.length) return allowed?.[0] ?? "square";
  if (choice.mix === "each") return set[index % set.length];
  if (choice.mix === "theme") return set[themeIndex % set.length];
  return allowed && !allowed.includes(choice.kind) ? "square" : choice.kind;
}

// ---------------------------------------------------------------- sizing

/** The grid argument for the engine: a plain size for squares, size + mask for shapes. */
export function shapedGrid(size: number, shape: ShapeKey | undefined): number | { size: number; mask: Mask | null } {
  return isSquare(shape) ? size : { size, mask: shapeMask(shape, size) };
}

/**
 * Starting canvas for a shape that should hold about as many cells as a
 * `base`×`base` square, and a straight line long enough for `longest`.
 */
export function shapeStartSize(shape: ShapeKey | undefined, base: number, longest: number, max: number): number {
  if (isSquare(shape)) return base;
  let n = Math.max(base, longest, shapeInfo(shape).minSize ?? 0);
  while (n < max) {
    const m = shapeMask(shape, n);
    if (maskCells(m, n) >= base * base * 0.97 && longestRun(m, n) >= longest + 1) break;
    n++;
  }
  return n;
}

// ---------------------------------------------------------------- sudoku frames

/**
 * A sudoku is always a 9×9 square; these shapes are drawn as a frame around it.
 * Animals whose silhouette would dwarf the grid (giraffe, flamingo, antlers, etc.)
 * are left out so the page stays print-friendly; the rest place the 9×9 in the body.
 */
const SUDOKU_SKIP: ShapeKey[] = ["deer", "moose", "llama", "giraffe", "flamingo", "peacock", "bat", "longneck", "ostrich"];
export const SUDOKU_SHAPES: ShapeKey[] = ["square", "rounded", "circle", "octagon", "hexagon", ...ANIMAL_KEYS.filter((k) => !SUDOKU_SKIP.includes(k))];

/**
 * Frame outline (cell units, grid at 0..n) for a sudoku: the shape scaled
 * just enough that all four grid corners sit inside it with a small margin.
 * Animals with a `focus` (torso) box place the 9×9 inside that body, with
 * heads, legs and tails drawn around the grid.
 */
export function sudokuFrame(key: ShapeKey | undefined, n = 9): Pt[] {
  const margin = 0.35;
  const info = shapeInfo(key);
  if (isSquare(key) || key === "rounded") return [[-margin, -margin], [n + margin, -margin], [n + margin, n + margin], [-margin, n + margin]];
  const unit = info.poly();
  const corners: Pt[] = [[-margin, -margin], [n + margin, -margin], [n + margin, n + margin], [-margin, n + margin]];
  const at = (s: number): Pt[] => {
    const w = s * Math.max(1, info.aspect);
    const h = s / Math.min(1, info.aspect);
    return unit.map(([x, y]) => [n / 2 + (x - 0.5) * w, n / 2 + (y - 0.5) * h]);
  };
  const contain = (): Pt[] => {
    let lo = n, hi = n * 6;
    for (let k = 0; k < 30; k++) {
      const mid = (lo + hi) / 2;
      const pts = at(mid);
      if (corners.every(([x, y]) => inside(pts, x, y))) hi = mid;
      else lo = mid;
    }
    return at(hi);
  };
  const spanOf = (pts: Pt[]) => {
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  };
  const fitted = contain();
  if (info.focus) {
    const [fx0, fy0, fx1, fy1] = info.focus;
    const fw = Math.max(0.15, fx1 - fx0);
    const fh = Math.max(0.15, fy1 - fy0);
    const side = n + margin * 2;
    const scale = Math.max(side / fw, side / fh);
    const cx = (fx0 + fx1) / 2;
    const cy = (fy0 + fy1) / 2;
    const focused = unit.map(([x, y]) => [n / 2 + (x - cx) * scale, n / 2 + (y - cy) * scale] as Pt);
    // Prefer the tighter frame so skinny animals (giraffe, butterfly) don't dwarf the 9×9.
    if (spanOf(focused) <= spanOf(fitted)) return focused;
  }
  return fitted;
}

/** Shape of every puzzle in a book for a design's shape choice (one shape, or mixed per puzzle / per theme / random animals). */
export function shapeTargetsFor(choice: { kind: ShapeKey; mix: ShapeMix }, list: { theme?: string }[], allowed?: ShapeKey[]): ShapeKey[] {
  const themes = Array.from(new Set(list.map((p) => p.theme ?? "")));
  const suggestIn = choice.mix === "animals" ? ANIMAL_KEYS.filter((s) => !allowed || allowed.includes(s)) : allowed;
  return list.map((p, i) => {
    if (choice.mix === "theme" || choice.mix === "animals") {
      const hit = suggestShapeForTheme(p.theme, suggestIn);
      if (hit) return hit;
    }
    return shapeFor(choice, i, themes.indexOf(p.theme ?? ""), allowed);
  });
}
