/**
 * Original object, food, nature and holiday silhouettes.
 *
 * Every path is a simple geometric construction drawn for this project.
 * Nothing is traced from commercial puzzle books or stock art. See
 * `src/lib/shapes/objects/SOURCES.md`.
 */
export type Pt = [number, number];

const TAU = Math.PI * 2;

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

/** Union of circles, star-shaped from `c`. */
function radialUnion(circles: [number, number, number][], c: Pt, n = 140): Pt[] {
  return curve(n, (t) => {
    const dx = Math.cos(t);
    const dy = Math.sin(t);
    let best = 0;
    for (const [x, y, r] of circles) {
      const ox = c[0] - x;
      const oy = c[1] - y;
      const b = ox * dx + oy * dy;
      const disc = b * b - (ox * ox + oy * oy - r * r);
      if (disc >= 0) best = Math.max(best, -b + Math.sqrt(disc));
    }
    return [c[0] + dx * best, c[1] + dy * best];
  });
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
  return normalize(curve(140, (t) => {
    const a = t - Math.PI / 2;
    const r = 0.72 + 0.28 * Math.sin(a) + 0.12 * Math.sin(2 * a);
    return [Math.cos(t) * r * 0.82, Math.sin(t) * r];
  }).concat([
    // stem
    [0.0, -1.05], [0.08, -1.2], [0.0, -1.28], [-0.08, -1.18],
  ]));
}

function icecream(): Pt[] {
  const scoop = radialUnion([[0.5, 0.28, 0.28], [0.32, 0.34, 0.2], [0.68, 0.34, 0.2]], [0.5, 0.32], 100);
  const cone: Pt[] = [[0.22, 0.48], [0.78, 0.48], [0.5, 1.0]];
  return normalize([...scoop, ...cone.reverse(), scoop[0]]);
}

function cupcake(): Pt[] {
  const liner: Pt[] = [];
  const y0 = 0.48, y1 = 0.92, x0 = 0.18, x1 = 0.82;
  liner.push([x0, y0]);
  const folds = 8;
  for (let i = 0; i <= folds; i++) {
    const x = x0 + ((x1 - x0) * i) / folds;
    liner.push([x, i % 2 === 0 ? y1 : y1 - 0.06]);
  }
  liner.push([x1, y0]);
  const dome = curve(80, (t) => {
    const a = -Math.PI + t / 2;
    return [0.5 + 0.32 * Math.cos(a), 0.48 + 0.32 * Math.sin(a)];
  }).filter(([_, y]) => y <= 0.48);
  const cherry = curve(24, (t) => [0.5 + 0.07 * Math.cos(t), 0.14 + 0.07 * Math.sin(t)]);
  return normalize([...dome, ...liner, ...cherry]);
}

function pizza(): Pt[] {
  // A thick slice: two radii and a crust arc.
  const pts: Pt[] = [[0.5, 0.95]];
  const a0 = -Math.PI / 2 - 0.42;
  const a1 = -Math.PI / 2 + 0.42;
  for (let i = 0; i <= 24; i++) {
    const a = a0 + ((a1 - a0) * i) / 24;
    pts.push([0.5 + 0.85 * Math.cos(a), 0.95 + 0.85 * Math.sin(a)]);
  }
  return normalize(pts);
}

function cherry(): Pt[] {
  return normalize(radialUnion(
    [[0.34, 0.62, 0.28], [0.66, 0.66, 0.26]],
    [0.5, 0.64],
    160,
  ).concat([
    [0.34, 0.36], [0.48, 0.02], [0.54, 0.04], [0.66, 0.4], [0.58, 0.42], [0.5, 0.16], [0.4, 0.4],
  ]));
}

function raindrop(): Pt[] {
  return normalize(curve(120, (t) => {
    const a = t - Math.PI / 2;
    const r = 0.72 * (1 + 0.55 * Math.cos(a)) / (1.2 - 0.2 * Math.cos(a));
    return [Math.sin(t) * r * 0.72, -Math.cos(t) * r];
  }));
}

function moon(): Pt[] {
  // Crescent: outer circle minus an offset inner circle, traced as a single outline.
  const pts: Pt[] = [];
  for (let i = 0; i <= 80; i++) {
    const a = -0.7 + (TAU * 0.62 * i) / 80;
    pts.push([Math.cos(a), Math.sin(a)]);
  }
  for (let i = 0; i <= 60; i++) {
    const a = 0.7 + Math.PI - (TAU * 0.48 * i) / 60;
    pts.push([0.42 + 0.78 * Math.cos(a), 0.05 + 0.78 * Math.sin(a)]);
  }
  return normalize(pts);
}

function leaf(): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= 80; i++) {
    const t = i / 80;
    const a = t * Math.PI;
    const r = Math.sin(a);
    pts.push([t, 0.5 - 0.46 * r]);
  }
  for (let i = 0; i <= 80; i++) {
    const t = 1 - i / 80;
    const a = t * Math.PI;
    const r = Math.sin(a);
    pts.push([t, 0.5 + 0.46 * r]);
  }
  return normalize(pts);
}

function snowflake(): Pt[] {
  const arms: Pt[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (k * TAU) / 6 - Math.PI / 2;
    const dx = Math.cos(a), dy = Math.sin(a);
    const px = -dy, py = dx;
    const tip = 1;
    const w = 0.08;
    const mid = 0.55;
    const hw = 0.28;
    // shaft
    arms.push([dx * 0.1 + px * w, dy * 0.1 + py * w]);
    // side branch
    arms.push([dx * mid + px * w, dy * mid + py * w]);
    arms.push([dx * mid + px * w + dx * 0.05 + px * hw, dy * mid + py * w + dy * 0.05 + py * hw]);
    arms.push([dx * (mid + 0.08) + px * 0.02, dy * (mid + 0.08) + py * 0.02]);
    arms.push([dx * mid - px * w + dx * 0.05 - px * hw, dy * mid - py * w + dy * 0.05 - py * hw]);
    arms.push([dx * mid - px * w, dy * mid - py * w]);
    arms.push([dx * tip - px * w, dy * tip - py * w]);
    arms.push([dx * tip + px * w, dy * tip + py * w]);
  }
  // The arm walk above is not a single outline. Build a 6-fold union of a
  // thick shaft + two branches as a star-shaped radial envelope.
  const spines: [number, number, number][] = [];
  for (let k = 0; k < 6; k++) {
    const a = (k * TAU) / 6 - Math.PI / 2;
    for (let s = 0.08; s <= 0.98; s += 0.08) spines.push([0.5 + 0.46 * s * Math.cos(a), 0.5 + 0.46 * s * Math.sin(a), s > 0.85 ? 0.09 : 0.115]);
    const b1 = a + 0.7, b2 = a - 0.7;
    for (const b of [b1, b2]) {
      const bx = 0.5 + 0.28 * Math.cos(a) + 0.22 * Math.cos(b);
      const by = 0.5 + 0.28 * Math.sin(a) + 0.22 * Math.sin(b);
      spines.push([bx, by, 0.085]);
    }
  }
  spines.push([0.5, 0.5, 0.14]);
  return normalize(radialUnion(spines, [0.5, 0.5], 240));
}

function gift(): Pt[] {
  const box: Pt[] = [[0.08, 0.32], [0.92, 0.32], [0.92, 0.96], [0.08, 0.96]];
  const bow = radialUnion([[0.38, 0.2, 0.16], [0.62, 0.2, 0.16], [0.5, 0.3, 0.1]], [0.5, 0.24], 80);
  return normalize([...bow, ...box, bow[0]]);
}

function shamrock(): Pt[] {
  return normalize(radialUnion(
    [[0.5, 0.32, 0.22], [0.32, 0.52, 0.22], [0.68, 0.52, 0.22], [0.5, 0.5, 0.12]],
    [0.5, 0.48],
    180,
  ).concat([[0.48, 0.7], [0.42, 1.0], [0.56, 1.0], [0.52, 0.7]]));
}

function car(): Pt[] {
  const body: Pt[] = [
    [0.04, 0.58], [0.18, 0.58], [0.28, 0.32], [0.62, 0.32], [0.76, 0.58], [0.96, 0.58],
    [0.96, 0.78], [0.04, 0.78],
  ];
  // wheels as bumps (single outline, no holes)
  const wheel = (cx: number) => curve(20, (t) => [cx + 0.12 * Math.cos(t), 0.78 + 0.12 * Math.sin(t)]);
  return normalize([...body, ...wheel(0.26), ...wheel(0.74)]);
}

function boat(): Pt[] {
  // A single outer silhouette: triangular sail sitting on a simple hull.
  return normalize([
    [0.48, 0.04],
    [0.86, 0.60],
    [0.92, 0.60],
    [0.80, 0.90],
    [0.20, 0.90],
    [0.08, 0.60],
    [0.46, 0.60],
  ]);
}

function airplane(): Pt[] {
  return normalize([
    [0.5, 0.02], [0.58, 0.18], [0.58, 0.42], [0.98, 0.58], [0.98, 0.68], [0.58, 0.62],
    [0.58, 0.82], [0.72, 0.96], [0.58, 0.92], [0.5, 0.86], [0.42, 0.92], [0.28, 0.96],
    [0.42, 0.82], [0.42, 0.62], [0.02, 0.68], [0.02, 0.58], [0.42, 0.42], [0.42, 0.18],
  ]);
}

function guitar(): Pt[] {
  const body = radialUnion([[0.5, 0.68, 0.28], [0.5, 0.48, 0.2]], [0.5, 0.6], 100);
  const neck: Pt[] = [[0.44, 0.02], [0.56, 0.02], [0.56, 0.48], [0.44, 0.48]];
  return normalize([...neck, ...body, neck[0]]);
}

function crown(): Pt[] {
  return normalize([
    [0.06, 0.42], [0.06, 0.88], [0.94, 0.88], [0.94, 0.42],
    [0.76, 0.62], [0.5, 0.08], [0.24, 0.62],
  ]);
}

function bulb(): Pt[] {
  const glass = curve(80, (t) => {
    const a = t - Math.PI / 2;
    const r = a < 0.9 || a > TAU - 0.9 ? 0.55 : 0.48;
    return [0.5 + r * Math.cos(t), 0.38 + r * Math.sin(t) * 0.95];
  });
  const base: Pt[] = [[0.38, 0.78], [0.62, 0.78], [0.58, 0.98], [0.42, 0.98]];
  return normalize([...glass.filter(([_, y]) => y < 0.8), ...base]);
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
