/**
 * Puzzle grid shapes. Silhouettes are polygons in a unit box; stepped
 * shapes are painted onto whole cells. Word-search pages default to the
 * exact artist curve ("smooth") for silhouettes, or a thin cell-edge
 * stroke ("stepped") for block shapes. "snug" hugs letters; "blocky" is
 * a padded pixel outline. Pure (no DOM).
 */

import polygonClipping from "polygon-clipping";
import { ANIMALS } from "./animals";
import { mapRect, pathToUnit } from "./silhouettes";
import { STEPPED_DEFS } from "./stepped";
import { OBJECT_DEFS, applePoly } from "./objects";
import { ANIMAL_GROUP, LEGACY_CATEGORY, THEME_SHAPES, type AnimalGroup, type ShapeCategory } from "./catalog";


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
  | "scorpion"
  | "arch"
  | "rainbow"
  | "ubend"
  | "bowl"
  | "wave"
  | "zigzag"
  | "stairs"
  | "pyramid"
  | "stepdiamond"
  | "stepcircle"
  | "blockcross"
  | "blockx"
  | "blockt"
  | "blockl"
  | "arrow"
  | "bolt"
  | "blockheart"
  | "blockstar"
  | "blockhouse"
  | "blocktree"
  | "cup"
  | "key"
  | "rocket"
  | "boxframe"
  | "ring"
  | "windowframe"
  | "sunburst"
  | "petals"
  | "checkers"
  | "corners"
  | "islands5"
  | "islands9"
  | "pear"
  | "icecream"
  | "cupcake"
  | "pizza"
  | "cherry"
  | "raindrop"
  | "moon"
  | "leaf"
  | "snowflake"
  | "gift"
  | "shamrock"
  | "car"
  | "boat"
  | "airplane"
  | "guitar"
  | "crown"
  | "bulb"
  | "letterA"
  | "letterB"
  | "letterC"
  | "letterD"
  | "letterE"
  | "letterF"
  | "letterG"
  | "letterH"
  | "letterI"
  | "letterJ"
  | "letterK"
  | "letterL"
  | "letterM"
  | "letterN"
  | "letterO"
  | "letterP"
  | "letterQ"
  | "letterR"
  | "letterS"
  | "letterT"
  | "letterU"
  | "letterV"
  | "letterW"
  | "letterX"
  | "letterY"
  | "letterZ"
  | "digit0"
  | "digit1"
  | "digit2"
  | "digit3"
  | "digit4"
  | "digit5"
  | "digit6"
  | "digit7"
  | "digit8"
  | "digit9";


export type Pt = [number, number];

export interface ShapeInfo {
  key: ShapeKey;
  label: string;
  /** Width / height of the shape. */
  aspect: number;
  /** Seasonal / theme hint shown on the card. */
  tag?: string;
  group: "basic" | "geometric" | "fun" | "animals" | "stepped" | "objects";
  /** Public picker category; every shape has exactly one. */
  category?: ShapeCategory;
  /** Animal sub-group, only when category is "animals". */
  animalGroup?: AnimalGroup;
  /** Smallest recommended N×N canvas (animals need more cells to stay recognisable). */
  minSize?: number;
  /** Extra names used to match a puzzle theme to this shape. */
  aliases?: string[];
  /** Torso box in the unit square; a sudoku 9×9 is placed inside it. */
  focus?: [number, number, number, number];
  /** Polygon in a unit box [0,1]×[0,1] (x right, y down), before aspect. */
  poly: () => Pt[];
  /** Optional cell-built mask (stepped / island shapes). */
  buildMask?: (size: number) => boolean[][];
  /** Keep every large connected piece instead of just the biggest one. */
  islands?: boolean;
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
    category: "animals",
    animalGroup: ANIMAL_GROUP[a.key],
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
    poly: applePoly,
  },
  { key: "cloud", label: "Cloud", aspect: 1.45, group: "fun", poly: () => normalize(radialUnion([[0.5, 0.58, 0.3], [0.27, 0.62, 0.22], [0.73, 0.62, 0.22], [0.38, 0.38, 0.22], [0.63, 0.36, 0.25], [0.5, 0.72, 0.24]], [0.5, 0.56])) },
  ...ANIMAL_SHAPES,
  ...STEPPED_DEFS.map((d): ShapeInfo => ({
    key: d.key as ShapeKey,
    label: d.label,
    aspect: d.aspect,
    group: "stepped",
    category: d.category,
    minSize: d.minSize,
    aliases: d.aliases,
    tag: d.tag,
    islands: d.islands,
    buildMask: d.buildMask,
    poly: () => [[0, 0], [1, 0], [1, 1], [0, 1]],
  })),
  ...OBJECT_DEFS.map((d): ShapeInfo => ({
    key: d.key as ShapeKey,
    label: d.label,
    aspect: d.aspect,
    group: "objects",
    category: d.category,
    minSize: d.minSize,
    aliases: d.aliases,
    tag: d.tag,
    focus: d.focus,
    poly: d.poly,
  })),
];

export const SHAPE_KEYS = SHAPES.map((s) => s.key);
const BY_KEY = new Map(SHAPES.map((s) => [s.key, s]));
export const shapeInfo = (k: ShapeKey | undefined) => BY_KEY.get(k ?? "square") ?? SHAPES[0];
export const isSquare = (k: ShapeKey | undefined) => !k || k === "square";

/** Outline padding around the outer cells, in cells (the old square frame used 0.22). */
export const OUTLINE_PAD = 0.22;
/** Geometric shapes: a cell is used when its centre is at least this far (in cells) inside the outline. */
const INSET = 0.5 + OUTLINE_PAD;
/** Animals: include a cell when this fraction of it sits inside the silhouette. */
const COVERAGE = 0.2;
const COVERAGE_SAMPLES = 5;
/** Outer cap: no shade farther than this from a lettered cell (round joins). */
export const CELL_DILATE = 0.6;
/** Extra clearance, in cells, between a letter's glyph box and the stroke's inner edge (snug style). */
export const GLYPH_MARGIN = 0.15;
/** Artist style: clearance, in cells, between a letter's glyph box and the silhouette curve. */
export const ARTIST_MARGIN = 0.1;
/**
 * Half-side of the glyph box used to decide whether an animal cell can hold a
 * letter inside the artist curve. On tight 8.5x11 pages the 7pt floor can
 * make a letter about 0.7 of a cell; this half includes that size plus
 * {@link ARTIST_MARGIN}.
 */
export const ARTIST_GLYPH_HALF = 0.7 / 2 + ARTIST_MARGIN;
/** Maximum letter size as a fraction of a cell (`wsLetterSize` cap / 7pt floor). */
export const GLYPH_FRAC = 0.82;
/**
 * Half-side of the rounded box wrapped around each letter so the glyph, a
 * {@link GLYPH_MARGIN} gap, and half of a default 1.2pt stroke (over a
 * conservative 7pt cell) sit inside the outline path. A little extra keeps
 * box corners strictly inside the polygon.
 */
export const GLYPH_WRAP_HALF = GLYPH_FRAC / 2 + GLYPH_MARGIN + 1.2 / 2 / 7 + 0.02;

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

function coverageGrid(pts: Pt[], size: number): number[][] {
  const s = COVERAGE_SAMPLES;
  const g: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++) {
      let hit = 0;
      for (let i = 0; i < s; i++)
        for (let j = 0; j < s; j++) if (inside(pts, c + (j + 0.5) / s, r + (i + 0.5) / s)) hit++;
      g[r][c] = hit / (s * s);
    }
  return g;
}

function dilate(m: Mask): Mask {
  const n = m.length;
  const out: Mask = m.map((row) => row.slice());
  const on = (r: number, c: number) => r >= 0 && c >= 0 && r < n && c < n && m[r][c];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (!out[r][c] && (on(r - 1, c) || on(r + 1, c) || on(r, c - 1) || on(r, c + 1))) out[r][c] = true;
    }
  return out;
}

function erode(m: Mask): Mask {
  const n = m.length;
  const out: Mask = m.map((row) => row.slice());
  const on = (r: number, c: number) => r >= 0 && c >= 0 && r < n && c < n && m[r][c];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (out[r][c] && !(on(r - 1, c) && on(r + 1, c) && on(r, c - 1) && on(r, c + 1))) out[r][c] = false;
    }
  return out;
}

/**
 * Grow 1-cell-wide tips (antlers, legs, trunks) just enough to form a 2×2,
 * preferring to expand into cells the silhouette already covers.
 */
function thickenThin(m: Mask, score: (r: number, c: number) => number, allow: (r: number, c: number) => boolean = () => true) {
  const n = m.length;
  const used = (r: number, c: number) => r >= 0 && c >= 0 && r < n && c < n && m[r][c];
  const inBlock = (r: number, c: number) => {
    for (let a = r - 1; a <= r; a++)
      for (let b = c - 1; b <= c; b++) {
        if (a < 0 || b < 0 || a + 1 >= n || b + 1 >= n) continue;
        if (used(a, b) && used(a, b + 1) && used(a + 1, b) && used(a + 1, b + 1)) return true;
      }
    return false;
  };
  const add: [number, number][] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (!m[r][c] || inBlock(r, c)) continue;
      let best = -1;
      let at: [number, number] | null = null;
      for (const [a, b] of [[r - 1, c - 1], [r - 1, c], [r, c - 1], [r, c]] as [number, number][]) {
        if (a < 0 || b < 0 || a + 1 >= n || b + 1 >= n) continue;
        let ok = true;
        let s = 0;
        for (let i = 0; i < 2 && ok; i++)
          for (let j = 0; j < 2 && ok; j++) {
            if (!allow(a + i, b + j)) ok = false;
            else s += used(a + i, b + j) ? 10 : score(a + i, b + j);
          }
        if (!ok) continue;
        if (s > best) {
          best = s;
          at = [a, b];
        }
      }
      if (at) for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) add.push([at[0] + i, at[1] + j]);
    }
  for (const [r, c] of add) m[r][c] = true;
}

function signedArea(pts: Pt[]): number {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] - pts[i][0]) * (pts[j][1] + pts[i][1]);
  return a / 2;
}

function dropClose(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6) out.push(p);
  }
  if (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= 1e-6) out.pop();
  return out;
}

function dropColinear(pts: Pt[]): Pt[] {
  const n = pts.length;
  if (n < 3) return pts;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n];
    const p = pts[i];
    const b = pts[(i + 1) % n];
    if (Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) > 1e-9) out.push(p);
  }
  return out.length >= 3 ? out : pts;
}

/**
 * Push every edge away from the used cells by `d`. Loops are walked with used
 * cells on the right, so this is a visual-left offset — it grows the outer
 * ring and shrinks holes. Miter joins are clamped so sharp corners don't spike.
 */
function offsetPoly(pts: Pt[], d: number): Pt[] {
  const p = dropColinear(dropClose(pts));
  const n = p.length;
  if (n < 3 || d === 0) return p;
  const normal = (a: Pt, b: Pt): Pt => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [dy / l, -dx / l];
  };
  return p.map((q, i) => {
    const a = p[(i - 1 + n) % n];
    const b = p[(i + 1) % n];
    const n1 = normal(a, q);
    const n2 = normal(q, b);
    let mx = n1[0] + n2[0];
    let my = n1[1] + n2[1];
    const ml = Math.hypot(mx, my);
    if (ml < 1e-6) return [q[0] + n1[0] * d, q[1] + n1[1] * d] as Pt;
    mx /= ml;
    my /= ml;
    const cos = mx * n1[0] + my * n1[1];
    const len = Math.min(d / Math.max(cos, 0.2), d * 2);
    return [q[0] + mx * len, q[1] + my * len] as Pt;
  });
}

/** Insert vertices along long edges so Chaikin only rounds corners. */
function subdivide(pts: Pt[], maxLen = 0.5): Pt[] {
  const p = dropClose(pts);
  const out: Pt[] = [];
  const n = p.length;
  for (let i = 0; i < n; i++) {
    const a = p[i];
    const b = p[(i + 1) % n];
    const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / maxLen));
    for (let s = 0; s < steps; s++) out.push([a[0] + ((b[0] - a[0]) * s) / steps, a[1] + ((b[1] - a[1]) * s) / steps]);
  }
  return out;
}

function chaikin(pts: Pt[], rounds = 2): Pt[] {
  let p = dropClose(pts);
  for (let k = 0; k < rounds; k++) {
    const n = p.length;
    const next: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const a = p[i];
      const b = p[(i + 1) % n];
      next.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
      next.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    p = next;
  }
  return p;
}

/** Clockwise outer (and any hole) loops of a mask, in cell units: cell (r,c) is the square [c,c+1]×[r,r+1]. */
export function maskLoops(mask: Mask): Pt[][] {
  const n = mask.length;
  const used = (r: number, c: number) => !!mask[r]?.[c];
  const outs = new Map<string, Pt[]>();
  const add = (x0: number, y0: number, x1: number, y1: number) => {
    const k = `${x0},${y0}`;
    const list = outs.get(k);
    if (list) list.push([x1, y1]);
    else outs.set(k, [[x1, y1]]);
  };
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (!used(r, c)) continue;
      if (!used(r - 1, c)) add(c, r, c + 1, r);
      if (!used(r, c + 1)) add(c + 1, r, c + 1, r + 1);
      if (!used(r + 1, c)) add(c + 1, r + 1, c, r + 1);
      if (!used(r, c - 1)) add(c, r + 1, c, r);
    }
  const seen = new Set<string>();
  const loops: Pt[][] = [];
  for (const [sk, dests] of outs) {
    for (const d0 of dests) {
      const [sx, sy] = sk.split(",").map(Number);
      if (seen.has(`${sx},${sy},${d0[0]},${d0[1]}`)) continue;
      const loop: Pt[] = [[sx, sy]];
      let x = sx;
      let y = sy;
      let nx = d0[0];
      let ny = d0[1];
      for (let step = 0; step < n * n * 4 + 2; step++) {
        seen.add(`${x},${y},${nx},${ny}`);
        loop.push([nx, ny]);
        if (nx === sx && ny === sy) break;
        const cands = outs.get(`${nx},${ny}`) ?? [];
        const unused = cands.filter((q) => !seen.has(`${nx},${ny},${q[0]},${q[1]}`));
        if (!unused.length) break;
        // Prefer the tightest right turn (interior stays to the right in y-down coords).
        const idxx = x;
        const idxy = y;
        const turn = (q: Pt) => {
          const ax = nx - idxx;
          const ay = ny - idxy;
          const bx = q[0] - nx;
          const by = q[1] - ny;
          return Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
        };
        unused.sort((a, b) => turn(b) - turn(a)); // most positive = right turn with y-down
        x = nx;
        y = ny;
        nx = unused[0][0];
        ny = unused[0][1];
      }
      if (loop.length >= 4) loops.push(dropClose(loop));
    }
  }
  return loops;
}

/**
 * Smooth outline rings around the occupied (lettered) cells, padded by `pad`
 * cells. The first ring is the outer silhouette; later rings are holes (for
 * example the gap between a horse's legs). Word-search pages fill these with
 * even-odd so grey never covers empty space.
 */
export function maskOutlines(mask: Mask, pad = OUTLINE_PAD): Pt[][] {
  return maskLoops(mask).map((L) => chaikin(subdivide(offsetPoly(L, pad), 0.5), 2)).filter((L) => L.length >= 3);
}

/** Outer ring of {@link maskOutlines} (for bounding boxes and simple outlines). */
export function maskOutline(mask: Mask, pad = OUTLINE_PAD): Pt[] {
  const loops = maskOutlines(mask, pad);
  if (!loops.length) return [];
  let best = loops[0];
  let bestA = 0;
  for (const L of loops) {
    const a = Math.abs(signedArea(L));
    if (a > bestA) {
      bestA = a;
      best = L;
    }
  }
  return best;
}

function closeRing(pts: Pt[]): Pt[] {
  const p = dropClose(pts);
  if (p.length < 3) return p;
  return [...p, [p[0][0], p[0][1]] as Pt];
}


/**
 * Offset a loop away from the used cells (visual left) by `r`, with round
 * joins on convex corners so tips stay circular rather than blocky.
 */
function offsetRound(pts: Pt[], r: number, arcPts = 12): Pt[] {
  const p = dropColinear(dropClose(pts));
  const n = p.length;
  if (n < 3 || r === 0) return p;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = p[(i - 1 + n) % n];
    const b = p[i];
    const c = p[(i + 1) % n];
    const d1x = b[0] - a[0];
    const d1y = b[1] - a[1];
    const d2x = c[0] - b[0];
    const d2y = c[1] - b[1];
    const l1 = Math.hypot(d1x, d1y) || 1;
    const l2 = Math.hypot(d2x, d2y) || 1;
    const n1: Pt = [d1y / l1, -d1x / l1];
    const n2: Pt = [d2y / l2, -d2x / l2];
    const cross = d1x * d2y - d1y * d2x;
    const dot = d1x * d2x + d1y * d2y;
    if (Math.abs(cross) < 1e-9 * l1 * l2 && dot > 0) {
      out.push([b[0] + n1[0] * r, b[1] + n1[1] * r]);
      continue;
    }
    if (cross > 0) {
      // Right turn in y-down = convex outer corner: quarter-circle (or whatever the turn) around b.
      const cr = n1[0] * n2[1] - n1[1] * n2[0];
      const dt = Math.atan2(cr, n1[0] * n2[0] + n1[1] * n2[1]);
      const steps = Math.max(1, Math.round((Math.abs(dt) / (Math.PI / 2)) * arcPts));
      for (let s = 0; s <= steps; s++) {
        const t = (dt * s) / steps;
        const cos = Math.cos(t);
        const sin = Math.sin(t);
        const nx = n1[0] * cos - n1[1] * sin;
        const ny = n1[0] * sin + n1[1] * cos;
        out.push([b[0] + r * nx, b[1] + r * ny]);
      }
    } else {
      const aOff: Pt = [a[0] + n1[0] * r, a[1] + n1[1] * r];
      const bOff1: Pt = [b[0] + n1[0] * r, b[1] + n1[1] * r];
      const bOff2: Pt = [b[0] + n2[0] * r, b[1] + n2[1] * r];
      const cOff: Pt = [c[0] + n2[0] * r, c[1] + n2[1] * r];
      // Bevel concave corners so an offset never spikes past r (a long miter
      // would let empty grey leak more than half a cell from a letter).
      out.push(bOff1);
      out.push(bOff2);
    }
  }
  return dropClose(out);
}

function ringsToMulti(rings: Pt[][]): [number, number][][][] {
  const closed = rings.map(closeRing).filter((r) => r.length >= 4);
  let outers = closed.filter((r) => signedArea(r) > 0);
  const holes = closed.filter((r) => signedArea(r) <= 0);
  if (!outers.length && closed.length) outers = closed.map((r) => closeRing([...dropClose(r)].reverse()));
  return outers.map((o) => [o, ...holes.filter((h) => inside(o, h[0][0], h[0][1]))]);
}

function multiToRings(multi: [number, number][][][]): Pt[][] {
  const rings = multi.flat().map((r) => dropClose(r)).filter((r) => r.length >= 3 && Math.abs(signedArea(r)) > 0.2);
  rings.sort((a, b) => Math.abs(signedArea(b)) - Math.abs(signedArea(a)));
  return rings;
}




/** Push the artist curve out just enough that every letter glyph box sits inside
 * it, with a smooth bump around each overflowing corner so the silhouette
 * keeps its shape instead of ballooning or turning into cell stairs. */
function inflateToGlyphs(sil: Pt[], mask: Mask): Pt[] {
  const p = dropClose(sil);
  const n = p.length;
  if (n < 3) return p;
  const half = GLYPH_WRAP_HALF;
  const dy = 0.04 * GLYPH_FRAC;
  const outside: Pt[] = [];
  for (let r = 0; r < mask.length; r++)
    for (let c = 0; c < mask.length; c++) {
      if (!mask[r][c]) continue;
      const cx = c + 0.5;
      const cy = r + 0.5 + dy;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const q: Pt = [cx + sx * half, cy + sy * half];
        if (!inside(p, q[0], q[1])) outside.push(q);
      }
    }
  if (!outside.length) return p;

  const edgeLen: number[] = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const L = Math.hypot(p[(i + 1) % n][0] - p[i][0], p[(i + 1) % n][1] - p[i][1]);
    edgeLen.push(L);
    total += L;
  }
  const arc: number[] = [0];
  for (let i = 0; i < n - 1; i++) arc.push(arc[i] + edgeLen[i]);
  const pathDist = (s1: number, s2: number) => {
    const d = Math.abs(s1 - s2);
    return Math.min(d, total - d);
  };
  const closest = (c: Pt) => {
    let bestD = Infinity;
    let bestS = 0;
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const a = p[i];
      const b = p[(i + 1) % n];
      const vx = b[0] - a[0];
      const vy = b[1] - a[1];
      const len2 = vx * vx + vy * vy || 1e-12;
      const t = Math.max(0, Math.min(1, ((c[0] - a[0]) * vx + (c[1] - a[1]) * vy) / len2));
      const d = Math.hypot(c[0] - (a[0] + t * vx), c[1] - (a[1] + t * vy));
      if (d < bestD) {
        bestD = d;
        bestS = acc + t * edgeLen[i];
      }
      acc += edgeLen[i];
    }
    return { d: bestD, s: bestS };
  };

  const left = (a: Pt, b: Pt): Pt => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [dy / l, -dx / l];
  };
  const normals: Pt[] = p.map((_, i) => {
    const n1 = left(p[(i - 1 + n) % n], p[i]);
    const n2 = left(p[i], p[(i + 1) % n]);
    let mx = n1[0] + n2[0];
    let my = n1[1] + n2[1];
    const l = Math.hypot(mx, my) || 1;
    return [mx / l, my / l];
  });

  const d = Array(n).fill(0);
  const sigma = 1.4;
  for (const c of outside) {
    const hit = closest(c);
    const height = hit.d + 0.08;
    for (let i = 0; i < n; i++) {
      const s = pathDist(arc[i], hit.s);
      const w = Math.exp(-0.5 * (s / sigma) ** 2);
      if (w < 0.02) continue;
      d[i] = Math.max(d[i], height * w);
    }
  }
  return p.map((q, i) => [q[0] + d[i] * normals[i][0], q[1] + d[i] * normals[i][1]] as Pt);
}

/** Axis-aligned box centred at (cx, cy), clockwise in y-down coordinates. */
function glyphBox(cx: number, cy: number, half: number): Pt[] {
  return closeRing([
    [cx + half, cy - half],
    [cx + half, cy + half],
    [cx - half, cy + half],
    [cx - half, cy - half],
  ]);
}

function unionAll(geoms: [number, number][][][][]): [number, number][][][] {
  const parts = geoms.filter((g) => g.length);
  if (!parts.length) return [];
  if (parts.length === 1) return parts[0];
  const mid = Math.ceil(parts.length / 2);
  return polygonClipping.union(unionAll(parts.slice(0, mid)), unionAll(parts.slice(mid)));
}



/** Drop sliver holes and pull any vertex farther than {@link CELL_DILATE} back
 * toward the nearest lettered cell so the half-cell test always holds. */
function sanitizeRings(rings: Pt[][], mask: Mask): Pt[][] {
  const n = mask.length;
  const kept: Pt[][] = [];
  for (const L of rings) {
    const a = signedArea(L);
    if (Math.abs(a) < 0.2) continue;
    if (a <= 0) {
      let swallows = false;
      for (let r = 0; r < n && !swallows; r++)
        for (let c = 0; c < n && !swallows; c++)
          if (mask[r][c] && inside(L, c + 0.5, r + 0.5)) swallows = true;
      if (swallows) continue;
    }
    kept.push(L);
  }
  const src = kept.length ? kept : rings;
  const rmax = CELL_DILATE;
  return src.map((L) => {
    if (signedArea(L) <= 0) return L;
    return L.map((p) => {
      let best = Infinity;
      let qx = p[0];
      let qy = p[1];
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++) {
          if (!mask[r][c]) continue;
          const x = p[0] < c ? c : p[0] > c + 1 ? c + 1 : p[0];
          const y = p[1] < r ? r : p[1] > r + 1 ? r + 1 : p[1];
          const d = Math.hypot(p[0] - x, p[1] - y);
          if (d < best) {
            best = d;
            qx = x;
            qy = y;
          }
        }
      if (!isFinite(best) || best <= rmax + 1e-9) return p;
      const t = rmax / best;
      return [qx + (p[0] - qx) * t, qy + (p[1] - qy) * t] as Pt;
    });
  });
}

const letteredCache = new Map<string, Pt[][]>();

/**
 * Word-search shade/outline styles.
 * - "smooth" (default, shown as "Artist (smooth)"): the professional SVG
 *   silhouette exactly as drawn, with no inflation and no clipping.
 * - "snug": inflate the curve just enough that every letter sits inside the
 *   stroke, then clip to a round dilation of the lettered cells so empty
 *   tips are trimmed and the outline hugs the letters.
 * - "blocky": the cell-hugging pixel staircase.
 */
export type OutlineStyle = "smooth" | "snug" | "stepped" | "blocky";

/** Inset of a stepped cell-edge stroke, in cells, so letters never touch the line. */
export const STEPPED_INSET = 0.12;

/** Exact cell-edge loops, inset slightly so a thin stroke stays off the letters. */
export function steppedOutlines(mask: Mask, inset = STEPPED_INSET): Pt[][] {
  return maskLoops(mask)
    .map((L) => offsetPoly(L, -inset))
    .map((L) => dropClose(L))
    .filter((L) => L.length >= 4);
}

export function letteredOutlines(key: ShapeKey | undefined, size: number, style: OutlineStyle = "smooth"): Pt[][] {
  const mask = shapeMask(key, size);
  if (!mask) return [];
  if (style === "blocky") return maskOutlines(mask, CELL_DILATE);
  if (style === "stepped") return steppedOutlines(mask);
  if (shapeInfo(key).buildMask) {
    // Mask-built shapes have no artist curve; smooth/snug follow the inset cell edges.
    return steppedOutlines(mask);
  }
  if (style === "smooth") return [shapeOutline(key, size)];
  const id = `${key}:${size}:snug`;
  const hit = letteredCache.get(id);
  if (hit) return hit;
  const sil = ringsToMulti([shapeOutline(key, size)]);
  const loops = maskLoops(mask);
  const cap = ringsToMulti(loops.map((L) => offsetRound(L, CELL_DILATE)));
  let rings: Pt[][] = [];
  try {
    if (shapeInfo(key).group === "animals") {
      if (sil.length && cap.length) {
        const base = shapeOutline(key, size);
        const inflated = inflateToGlyphs(subdivide(base, 0.4), mask);
        let grown = sil;
        try { grown = polygonClipping.union(sil, ringsToMulti([inflated])); } catch { grown = sil; }
        // Any glyph box still outside the inflated curve gets a local cap so
        // letters never cross the stroke; along a well-inflated edge this is empty
        // and the artist curve shows.
        const leftover: [number, number][][][][] = [];
        const half = GLYPH_WRAP_HALF;
        const dy = 0.04 * GLYPH_FRAC;
        const grownRings = multiToRings(grown);
        const inGrown = (x: number, y: number) => {
          let hit = false;
          for (const ring of grownRings) if (inside(ring, x, y)) hit = !hit;
          return hit;
        };
        const boxIn = (cx: number, cy: number) =>
          [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]].every(([sx, sy]) =>
            inGrown(cx + sx * half, cy + sy * half),
          );
        for (let r = 0; r < mask.length; r++)
          for (let c = 0; c < mask.length; c++) {
            if (!mask[r][c]) continue;
            const cx = c + 0.5;
            const cy = r + 0.5 + dy;
            if (!boxIn(cx, cy)) leftover.push([[glyphBox(cx, cy, half)]]);
          }
        if (leftover.length) {
          try { grown = polygonClipping.union(grown, unionAll(leftover)); } catch { /* keep grown */ }
        }
        const padded = ringsToMulti(multiToRings(grown).map((L) => (signedArea(L) > 0 ? offsetRound(L, 0.06) : L)));
        rings = multiToRings(polygonClipping.intersection(padded.length ? padded : grown, cap));
      }
    } else if (sil.length && cap.length) {
      rings = multiToRings(polygonClipping.intersection(sil, cap));
    }
  } catch {
    rings = [];
  }
  if (!rings.length) rings = maskLoops(mask).map((L) => offsetRound(L, CELL_DILATE)).filter((L) => L.length >= 3);
  if (rings.length) rings = sanitizeRings(rings, mask);
  letteredCache.set(id, rings);
  return rings;
}

export function letteredOutline(key: ShapeKey | undefined, size: number, style: OutlineStyle = "smooth"): Pt[] {
  return letteredOutlines(key, size, style)[0] ?? [];
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
 * `open` is the opening block (3 for geometric shapes). Animals skip this so
 * 1-cell-wide antlers and legs can keep letters; isolated spikes are still
 * removed and thin parts are thickened when a 2×2 fits inside the silhouette.
 */
function clean(m: Mask, open = 3, opts?: { keepIslands?: boolean; minIsland?: number }): Mask {
  const n = m.length;
  const on = (r: number, c: number) => r >= 0 && c >= 0 && r < n && c < n && m[r][c];
  // Animals (open < 2): 8-connected so diagonal antlers are not eaten from the tips.
  const dirs: [number, number][] = open >= 2
    ? [[1, 0], [-1, 0], [0, 1], [0, -1]]
    : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        if (!m[r][c]) continue;
        let k = 0;
        for (const [dr, dc] of dirs) if (on(r + dr, c + dc)) k++;
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
        for (const [dr, dc] of dirs) {
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
  const minIsland = opts?.minIsland ?? 12;
  const out: Mask = m.map((row) => row.map(() => false));
  if (opts?.keepIslands) {
    const seen2 = m.map((row) => row.map(() => false));
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        if (!m[r][c] || seen2[r][c]) continue;
        const comp: [number, number][] = [];
        const stack: [number, number][] = [[r, c]];
        seen2[r][c] = true;
        while (stack.length) {
          const [a, b] = stack.pop()!;
          comp.push([a, b]);
          for (const [dr, dc] of dirs) {
            const y = a + dr;
            const x = b + dc;
            if (on(y, x) && !seen2[y][x]) {
              seen2[y][x] = true;
              stack.push([y, x]);
            }
          }
        }
        if (comp.length >= minIsland) for (const [rr, cc] of comp) out[rr][cc] = true;
      }
    return out;
  }
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
  const info = shapeInfo(key);
  if (info.buildMask) {
    const painted = info.buildMask(size);
    const out = clean(painted, 1, { keepIslands: !!info.islands, minIsland: 12 });
    cache.set(id, out);
    return out;
  }
  const pts = shapeOutline(key, size);
  const animal = info.group === "animals";
  const object = info.group === "objects";
  const loose = animal || object;
  const cover = animal ? coverageGrid(pts, size) : null;
  const inCenter = (r: number, c: number) => inside(pts, c + 0.5, r + 0.5);
  const glyphFits = (r: number, c: number) => {
    const half = ARTIST_GLYPH_HALF;
    const cx = c + 0.5;
    const cy = r + 0.5 + 0.04 * 0.7;
    return ([[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]] as [number, number][])
      .every(([sx, sy]) => inside(pts, cx + sx * half, cy + sy * half));
  };
  const m: Mask = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => {
      if (loose) return glyphFits(r, c);
      return inCenter(r, c) && edgeDistance(pts, c + 0.5, r + 0.5) >= INSET - 1e-6;
    }),
  );
  const open = loose ? 1 : 3;
  if (animal) {
    // Keep the 20% coverage + thickening path as a fallback only for cells
    // that also pass the glyph test (it never adds overflowing letters).
    const seed: Mask = Array.from({ length: size }, (_, r) =>
      Array.from({ length: size }, (_, c) => cover![r][c] >= COVERAGE && inCenter(r, c)),
    );
    const closed = erode(dilate(seed));
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
      if (closed[r][c] && glyphFits(r, c)) m[r][c] = true;
    }
    thickenThin(m, (r, c) => cover![r]?.[c] ?? 0, (r, c) => glyphFits(r, c));
  }
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

export type { ShapeCategory, AnimalGroup } from "./catalog";
export { CATEGORIES, ANIMAL_GROUPS, THEME_SHAPES, OUTLINE_COLORS, DEFAULT_STEPPED_COLOR } from "./catalog";

export function shapeCategory(s: ShapeInfo | ShapeKey): ShapeCategory {
  const info = typeof s === "string" ? shapeInfo(s) : s;
  if (info.category) return info.category;
  if (info.group === "animals") return "animals";
  return LEGACY_CATEGORY[info.key] ?? "basic";
}

export function animalGroupOf(k: ShapeKey | ShapeInfo): AnimalGroup | undefined {
  const info = typeof k === "string" ? shapeInfo(k) : k;
  return info.animalGroup ?? ANIMAL_GROUP[info.key];
}

export function isSteppedShape(k: ShapeKey | undefined): boolean {
  return !!k && !!shapeInfo(k).buildMask;
}

export function defaultOutlineFor(k: ShapeKey | undefined): OutlineStyle {
  return isSteppedShape(k) ? "stepped" : "smooth";
}

export function shapesInCategory(cat: ShapeCategory, allowed?: ShapeKey[]): ShapeKey[] {
  return SHAPES.filter((s) => shapeCategory(s) === cat && (!allowed || allowed.includes(s.key))).map((s) => s.key);
}

/** Several shapes that fit a theme, for the picker "Suggested" row. */
export function suggestShapesForTheme(theme: string | undefined, allowed?: ShapeKey[], limit = 8): ShapeKey[] {
  const t = (theme ?? "").toLowerCase();
  const out: ShapeKey[] = [];
  const add = (k: string) => {
    if (!k || out.includes(k as ShapeKey)) return;
    if (allowed && !allowed.includes(k as ShapeKey)) return;
    if (!BY_KEY.has(k as ShapeKey)) return;
    out.push(k as ShapeKey);
  };
  const direct = suggestShapeForTheme(theme, allowed);
  if (direct) add(direct);
  for (const row of THEME_SHAPES) if (row.match.test(t)) row.keys.forEach(add);
  return out.slice(0, limit);
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
 * and any animal or new form that drops more than one word across four seeds, so they are not offered.
 */
const CROSSWORD_SKIP = new Set<ShapeKey>([
  "triangle", "diamond", "star", "tree", "pentagon", "portrait", "monkey",
  "sunburst", "petals", "checkers", "corners", "islands5", "islands9",
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((c) => `letter${c}` as ShapeKey),
  ..."0123456789".split("").map((c) => `digit${c}` as ShapeKey),
  "rainbow", "wave", "zigzag", "airplane", "bowl", "icecream", "moon", "boat",
]);
export const CROSSWORD_SHAPES: ShapeKey[] = SHAPE_KEYS.filter((k) => !CROSSWORD_SKIP.has(k) && !shapeInfo(k).islands);

/** Shapes used when "mix shapes" is on (basics plus a rotation of favourite animals). */
export const MIX_SET: ShapeKey[] = ["circle", "heart", "star", "hexagon", "diamond", "cloud", "octagon", "egg", "apple", "rounded", "elephant", "dolphin", "cat", "owl", "fish", "butterfly", "dog", "penguin", "rabbit", "whale"];

export type ShapeMix = "one" | "each" | "theme" | "animals" | "category";

/** The shape of puzzle `index` (theme order index `themeIndex`) for a design's shape choice. */
export function shapeFor(choice: { kind: ShapeKey; mix: ShapeMix }, index: number, themeIndex = 0, allowed?: ShapeKey[]): ShapeKey {
  if (choice.mix === "animals") {
    const set = ANIMAL_KEYS.filter((s) => !allowed || allowed.includes(s));
    return set.length ? set[index % set.length] : (allowed?.[0] ?? "square");
  }
  if (choice.mix === "category") {
    const set = shapesInCategory(shapeCategory(choice.kind), allowed);
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
/** Sudoku uses the shape as a decorative frame around a 9×9; skip forms that would dwarf or fragment it. */
const SUDOKU_SKIP = new Set<ShapeKey>([
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((c) => `letter${c}` as ShapeKey),
  ..."0123456789".split("").map((c) => `digit${c}` as ShapeKey),
  "sunburst", "petals", "checkers", "corners", "islands5", "islands9",
  "rainbow", "wave", "zigzag", "bolt", "rocket", "key", "stairs", "arch", "ubend", "bowl", "pyramid",
  "blockx", "blockt", "blockl", "arrow", "windowframe", "boxframe", "ring",
  "snowflake", "leaf", "guitar", "airplane", "pizza",
]);
export const SUDOKU_SHAPES: ShapeKey[] = SHAPE_KEYS.filter((k) => {
  if (SUDOKU_SKIP.has(k) || shapeInfo(k).islands || shapeInfo(k).buildMask) return false;
  if (k === "square" || k === "rounded" || k === "circle" || k === "octagon" || k === "hexagon") return true;
  if (isAnimal(k)) return true;
  return ["pear", "icecream", "cupcake", "cherry", "raindrop", "moon", "gift", "shamrock", "car", "boat", "bulb", "crown", "apple", "heart", "egg", "pumpkin", "house", "cloud"].includes(k);
});

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
