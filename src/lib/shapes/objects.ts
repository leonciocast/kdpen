/**
 * Original object, food, nature and holiday silhouettes.
 *
 * Every outline is a single outer path: parts are boolean-unioned with
 * polygon-clipping before stroking, so there are never internal lines.
 * Where a clean professional CC0/PD silhouette was available it is used
 * and credited in `src/lib/shapes/objects/SOURCES.md`. Otherwise the
 * drawing is an original geometric construction (also documented there).
 * Nothing is traced from commercial puzzle books or stock art.
 */
import polygonClipping from "polygon-clipping";

export type Pt = [number, number];

const TAU = Math.PI * 2;

function signedArea(pts: Pt[]): number {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] - pts[i][0]) * (pts[j][1] + pts[i][1]);
  return a / 2;
}

function close(pts: Pt[]): Pt[] {
  if (pts.length < 3) return pts;
  const a = pts[0], b = pts[pts.length - 1];
  return a[0] === b[0] && a[1] === b[1] ? pts : [...pts, a];
}

function normalize(pts: Pt[]): Pt[] {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const w = Math.max(...xs) - x0 || 1;
  const h = Math.max(...ys) - y0 || 1;
  return pts.filter((_, i) => i === 0 || pts[i][0] !== pts[i - 1][0] || pts[i][1] !== pts[i - 1][1])
    .map(([x, y]) => [(x - x0) / w, (y - y0) / h]);
}

function curve(n: number, f: (t: number) => Pt, t0 = 0, t1 = TAU): Pt[] {
  return Array.from({ length: n }, (_, i) => f(t0 + ((t1 - t0) * i) / n));
}

function circle(cx: number, cy: number, r: number, n = 48): Pt[] {
  return curve(n, (t) => [cx + r * Math.cos(t), cy + r * Math.sin(t)]);
}

function ellipse(cx: number, cy: number, rx: number, ry: number, n = 48): Pt[] {
  return curve(n, (t) => [cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
}

function rect(x0: number, y0: number, x1: number, y1: number): Pt[] {
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}

/** Union of simple filled parts into one outer ring (holes are dropped). */
export function unionParts(parts: Pt[][]): Pt[] {
  const polys = parts
    .map((p) => p.filter((q, i) => i === 0 || q[0] !== p[i - 1][0] || q[1] !== p[i - 1][1]))
    .filter((p) => p.length >= 3)
    .map((p) => [close(p)]);
  if (!polys.length) return [];
  let acc: typeof polys = [polys[0]];
  for (let i = 1; i < polys.length; i++) {
    try {
      acc = polygonClipping.union(acc, [polys[i]]) as typeof polys;
    } catch {
      /* skip a part that won't clip rather than leave internal edges */
    }
  }
  let best: Pt[] = polys[0][0];
  let bestA = 0;
  for (const poly of acc) {
    const outer = poly[0];
    if (!outer || outer.length < 4) continue;
    const a = Math.abs(signedArea(outer));
    if (a > bestA) {
      bestA = a;
      best = outer;
    }
  }
  return normalize(best);
}

/** Two-lobe apple with a short stem and a leaf — one unioned outline. */
export function applePoly(): Pt[] {
  const bodyL = circle(0.38, 0.56, 0.36, 56);
  const bodyR = circle(0.62, 0.56, 0.36, 56);
  const bodyB = circle(0.5, 0.66, 0.34, 48);
  const stem = rect(0.47, 0.02, 0.53, 0.28);
  const leaf = ellipse(0.68, 0.16, 0.22, 0.09, 32);
  return unionParts([bodyL, bodyR, bodyB, stem, leaf]);
}

export type ObjectDef = {
  key: string;
  label: string;
  aspect: number;
  category: "nature" | "holiday" | "food" | "objects";
  minSize?: number;
  aliases?: string[];
  tag?: string;
  focus?: [number, number, number, number];
  poly: () => Pt[];
};

function pear(): Pt[] {
  const body = curve(96, (t) => {
    const a = t - Math.PI / 2;
    const r = 0.70 + 0.28 * Math.sin(a) + 0.10 * Math.sin(2 * a);
    return [0.5 + Math.cos(t) * r * 0.72, 0.58 + Math.sin(t) * r * 0.72];
  });
  const stem = rect(0.47, 0.00, 0.53, 0.22);
  return unionParts([body, stem]);
}

function icecream(): Pt[] {
  const scoop = circle(0.5, 0.30, 0.30, 56);
  const scoopL = circle(0.34, 0.36, 0.20, 40);
  const scoopR = circle(0.66, 0.36, 0.20, 40);
  const cone: Pt[] = [[0.24, 0.46], [0.76, 0.46], [0.5, 1.0]];
  return unionParts([scoop, scoopL, scoopR, cone]);
}

function cupcake(): Pt[] {
  // Full ellipse and a wide lip overlap the liner so the union has no hook or spike.
  const cherry = circle(0.5, 0.13, 0.09, 24);
  const dome = ellipse(0.5, 0.40, 0.36, 0.30, 56);
  const lip = rect(0.14, 0.44, 0.86, 0.56);
  const liner: Pt[] = [[0.20, 0.50], [0.80, 0.50], [0.73, 0.96], [0.27, 0.96]];
  return unionParts([cherry, dome, lip, liner]);
}

function pizza(): Pt[] {
  // A single thick slice: tip, left radius, crust arc, right radius.
  const tip: Pt = [0.5, 0.96];
  const a0 = -Math.PI / 2 - 0.46;
  const a1 = -Math.PI / 2 + 0.46;
  const outer: Pt[] = [tip];
  for (let i = 0; i <= 28; i++) {
    const a = a0 + ((a1 - a0) * i) / 28;
    outer.push([0.5 + 0.90 * Math.cos(a), 0.96 + 0.90 * Math.sin(a)]);
  }
  return normalize(outer);
}

function cherry(): Pt[] {
  const left = circle(0.32, 0.68, 0.26, 48);
  const right = circle(0.70, 0.70, 0.24, 48);
  const stemL: Pt[] = [
    [0.30, 0.44], [0.36, 0.44], [0.48, 0.16], [0.54, 0.04], [0.48, 0.02], [0.42, 0.14],
  ];
  const stemR: Pt[] = [
    [0.50, 0.16], [0.70, 0.46], [0.64, 0.48], [0.52, 0.22], [0.46, 0.08], [0.50, 0.08],
  ];
  return unionParts([left, right, stemL, stemR]);
}

function raindrop(): Pt[] {
  return normalize(curve(96, (t) => {
    const a = t - Math.PI / 2;
    const r = (0.72 * (1 + 0.55 * Math.cos(a))) / (1.2 - 0.2 * Math.cos(a));
    return [Math.sin(t) * r * 0.70, -Math.cos(t) * r];
  }));
}

function moon(): Pt[] {
  // A right-facing crescent: one outer arc and one inner arc that meet only at the cusps.
  const pts: Pt[] = [];
  const a0 = 0.42 * Math.PI;
  const a1 = 2 * Math.PI - a0;
  for (let i = 0; i <= 72; i++) {
    const a = a0 + ((a1 - a0) * i) / 72;
    pts.push([Math.cos(a), Math.sin(a)]);
  }
  const shift = 0.38;
  const ri = 0.78;
  const inner: Pt[] = [];
  for (let i = 0; i <= 56; i++) {
    const a = a1 - 0.18 - ((a1 - a0 - 0.36) * i) / 56;
    inner.push([shift + ri * Math.cos(a), ri * Math.sin(a)]);
  }
  return normalize([...pts, ...inner]);
}

function leaf(): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= 64; i++) {
    const t = i / 64;
    pts.push([0.06 + 0.86 * t, 0.5 - 0.42 * Math.sin(t * Math.PI)]);
  }
  for (let i = 0; i <= 64; i++) {
    const t = 1 - i / 64;
    pts.push([0.06 + 0.86 * t, 0.5 + 0.42 * Math.sin(t * Math.PI)]);
  }
  const stem = rect(-0.08, 0.46, 0.10, 0.54);
  return unionParts([pts, stem]);
}

function snowflake(): Pt[] {
  const spines: Pt[][] = [];
  const hub = circle(0.5, 0.5, 0.10, 24);
  for (let k = 0; k < 6; k++) {
    const a = (k * TAU) / 6 - Math.PI / 2;
    const dx = Math.cos(a), dy = Math.sin(a);
    const px = -dy, py = dx;
    const tip = 0.48;
    const shaft: Pt[] = [
      [0.5 + px * 0.07, 0.5 + py * 0.07],
      [0.5 + dx * tip + px * 0.06, 0.5 + dy * tip + py * 0.06],
      [0.5 + dx * tip - px * 0.06, 0.5 + dy * tip - py * 0.06],
      [0.5 - px * 0.07, 0.5 - py * 0.07],
    ];
    const mid = 0.26;
    const branch = (sign: number): Pt[] => [
      [0.5 + dx * mid + px * 0.04, 0.5 + dy * mid + py * 0.04],
      [0.5 + dx * mid + dx * 0.04 + px * 0.04 + sign * (dx * 0.04 + px * 0.18), 0.5 + dy * mid + dy * 0.04 + py * 0.04 + sign * (dy * 0.04 + py * 0.18)],
      [0.5 + dx * (mid + 0.10) + sign * px * 0.02, 0.5 + dy * (mid + 0.10) + sign * py * 0.02],
      [0.5 + dx * mid - px * 0.04, 0.5 + dy * mid - py * 0.04],
    ];
    spines.push(shaft, branch(1), branch(-1));
  }
  return unionParts([hub, ...spines]);
}

function gift(): Pt[] {
  const box = rect(0.10, 0.36, 0.90, 0.96);
  const lid = rect(0.06, 0.30, 0.94, 0.46);
  const ribbonV = rect(0.44, 0.30, 0.56, 0.96);
  const ribbonH = rect(0.10, 0.58, 0.90, 0.70);
  const bowL = ellipse(0.36, 0.22, 0.18, 0.14, 36);
  const bowR = ellipse(0.64, 0.22, 0.18, 0.14, 36);
  const knot = circle(0.5, 0.28, 0.08, 24);
  return unionParts([box, lid, ribbonV, ribbonH, bowL, bowR, knot]);
}

function shamrock(): Pt[] {
  const a = circle(0.5, 0.34, 0.20, 40);
  const b = circle(0.32, 0.54, 0.20, 40);
  const c = circle(0.68, 0.54, 0.20, 40);
  const core = circle(0.5, 0.50, 0.10, 24);
  const stem: Pt[] = [[0.47, 0.62], [0.53, 0.62], [0.56, 1.0], [0.44, 1.0]];
  return unionParts([a, b, c, core, stem]);
}

function car(): Pt[] {
  // Cabin bottom overlaps the body; otherwise the union keeps only the larger ring and the roof vanishes.
  const cabin: Pt[] = [[0.20, 0.42], [0.34, 0.14], [0.66, 0.14], [0.80, 0.42]];
  const body: Pt[] = [[0.04, 0.36], [0.96, 0.36], [0.96, 0.70], [0.04, 0.70]];
  const wheelL = circle(0.26, 0.70, 0.14, 32);
  const wheelR = circle(0.74, 0.70, 0.14, 32);
  return unionParts([cabin, body, wheelL, wheelR]);
}

function boat(): Pt[] {
  const sail: Pt[] = [[0.48, 0.04], [0.86, 0.58], [0.48, 0.58]];
  const mast = rect(0.45, 0.04, 0.52, 0.62);
  const hull: Pt[] = [[0.08, 0.60], [0.92, 0.60], [0.80, 0.90], [0.20, 0.90]];
  return unionParts([sail, mast, hull]);
}

function airplane(): Pt[] {
  const fuselage: Pt[] = [
    [0.50, 0.02], [0.60, 0.18], [0.60, 0.76], [0.50, 0.90], [0.40, 0.76], [0.40, 0.18],
  ];
  const wing: Pt[] = [[0.02, 0.38], [0.98, 0.38], [0.98, 0.60], [0.02, 0.60]];
  const tail: Pt[] = [[0.40, 0.74], [0.60, 0.74], [0.76, 0.98], [0.24, 0.98]];
  const fin: Pt[] = [[0.50, 0.66], [0.50, 0.86], [0.66, 0.86], [0.60, 0.66]];
  return unionParts([fuselage, wing, tail, fin]);
}

function guitar(): Pt[] {
  const lower = circle(0.5, 0.70, 0.30, 56);
  const upper = circle(0.5, 0.48, 0.22, 48);
  const neck = rect(0.44, 0.02, 0.56, 0.46);
  const head: Pt[] = [[0.40, 0.00], [0.60, 0.00], [0.60, 0.10], [0.40, 0.10]];
  return unionParts([lower, upper, neck, head]);
}

function crown(): Pt[] {
  // Five points, tallest in the centre, so it reads as a crown at picker size.
  return normalize([
    [0.02, 0.44],
    [0.10, 0.20],
    [0.20, 0.44],
    [0.30, 0.10],
    [0.40, 0.44],
    [0.50, 0.04],
    [0.60, 0.44],
    [0.70, 0.10],
    [0.80, 0.44],
    [0.90, 0.20],
    [0.98, 0.44],
    [0.98, 0.92],
    [0.02, 0.92],
  ]);
}

function bulb(): Pt[] {
  const glass = ellipse(0.5, 0.40, 0.36, 0.40, 56);
  const neck = rect(0.36, 0.70, 0.64, 0.82);
  const base: Pt[] = [[0.38, 0.80], [0.62, 0.80], [0.58, 0.98], [0.42, 0.98]];
  return unionParts([glass, neck, base]);
}

export const OBJECT_DEFS: ObjectDef[] = [
  { key: "pear", label: "Pear", aspect: 0.82, category: "food", minSize: 20, aliases: ["pears"], poly: pear },
  { key: "icecream", label: "Ice cream", aspect: 0.72, category: "food", minSize: 22, aliases: ["ice cream cone", "gelato"], tag: "Summer", poly: icecream },
  { key: "cupcake", label: "Cupcake", aspect: 0.9, category: "food", minSize: 20, aliases: ["cupcakes", "muffin", "cake"], tag: "Party", poly: cupcake },
  { key: "pizza", label: "Pizza slice", aspect: 1, category: "food", minSize: 20, aliases: ["pizza", "slice"], poly: pizza },
  { key: "cherry", label: "Cherries", aspect: 1.05, category: "food", minSize: 20, aliases: ["cherry", "cherries"], poly: cherry },
  { key: "raindrop", label: "Raindrop", aspect: 0.72, category: "nature", minSize: 18, aliases: ["rain", "drop"], tag: "Weather", poly: raindrop },
  { key: "moon", label: "Moon", aspect: 0.95, category: "nature", minSize: 18, aliases: ["crescent", "night"], tag: "Night", poly: moon },
  { key: "leaf", label: "Leaf", aspect: 1.35, category: "nature", minSize: 18, aliases: ["leaves", "foliage"], tag: "Autumn", poly: leaf },
  { key: "snowflake", label: "Snowflake", aspect: 1, category: "nature", minSize: 28, aliases: ["snow", "flake"], tag: "Winter", poly: snowflake },
  { key: "gift", label: "Gift", aspect: 1, category: "holiday", minSize: 20, aliases: ["present", "package"], tag: "Birthday", poly: gift },
  { key: "shamrock", label: "Shamrock", aspect: 0.95, category: "holiday", minSize: 20, aliases: ["clover", "irish"], tag: "St. Patrick's", poly: shamrock },
  { key: "car", label: "Car", aspect: 1.55, category: "objects", minSize: 22, aliases: ["auto", "vehicle"], poly: car, focus: [0.08, 0.34, 0.92, 0.86] },
  { key: "boat", label: "Boat", aspect: 1.4, category: "objects", minSize: 20, aliases: ["sailboat", "ship"], poly: boat, focus: [0.16, 0.5, 0.86, 0.9] },
  { key: "airplane", label: "Airplane", aspect: 0.9, category: "objects", minSize: 22, aliases: ["plane", "aeroplane", "jet"], poly: airplane, focus: [0.3, 0.2, 0.7, 0.85] },
  { key: "guitar", label: "Guitar", aspect: 0.55, category: "objects", minSize: 24, aliases: ["guitar", "music"], poly: guitar, focus: [0.28, 0.42, 0.72, 0.96] },
  { key: "crown", label: "Crown", aspect: 1.35, category: "objects", minSize: 20, aliases: ["king", "queen", "royal"], poly: crown },
  { key: "bulb", label: "Light bulb", aspect: 0.7, category: "objects", minSize: 20, aliases: ["lightbulb", "idea", "lamp"], poly: bulb, focus: [0.22, 0.08, 0.78, 0.78] },
];

export type ObjectKey = (typeof OBJECT_DEFS)[number]["key"];
