/**
 * Compactness rule for murder-mystery shapes.
 *
 * A mystery case is read as a solid block of letters (evidence, a missing word and a
 * hidden message), so its shape has to be one compact, solid region. A mask passes when,
 * at every size it is measured at:
 *  - it is one 4-connected region (no islands);
 *  - its cells fill at least half of their bounding box;
 *  - at most 12% of its cells are "thin" (not inside any solid 3×3 block, i.e. arms,
 *    legs, tails and protrusions only 1–2 cells wide);
 *  - its bounding box is no longer than 1.7 : 1;
 *  - enclosed holes are at most 8% of its cell count.
 * It is measured at the sizes a case actually uses (the first size with 120, 160 and 200
 * cells). `MYSTERY_SHAPES` in shapes.ts is the precomputed result; tests re-derive it.
 */
import { shapeMask, type ShapeKey } from "./shapes";

export const COMPACT_RULE = { minFill: 0.5, maxThin: 0.12, maxAspect: 1.7, maxHoles: 0.08, targets: [120, 160, 200] } as const;

export type Compactness = { cells: number; components: number; fill: number; thin: number; aspect: number; holes: number };

export function maskCompactness(m: boolean[][]): Compactness {
  const n = m.length;
  const on = (r: number, c: number) => !!m[r]?.[c];
  const cells: [number, number][] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < (m[r]?.length ?? 0); c++) if (m[r][c]) cells.push([r, c]);
  if (!cells.length) return { cells: 0, components: 0, fill: 0, thin: 1, aspect: Infinity, holes: 0 };
  const flood = (start: [number, number], pass: (r: number, c: number) => boolean) => {
    const seen = new Set([`${start[0]},${start[1]}`]);
    const st = [start];
    while (st.length) {
      const [a, b] = st.pop()!;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = a + dr, y = b + dc, k = `${x},${y}`;
        if (!seen.has(k) && pass(x, y)) { seen.add(k); st.push([x, y]); }
      }
    }
    return seen;
  };
  let r0 = Infinity, r1 = -Infinity, c0 = Infinity, c1 = -Infinity;
  for (const [r, c] of cells) { r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); }
  const h = r1 - r0 + 1, w = c1 - c0 + 1;
  // Islands: count 4-connected regions.
  const left = new Set(cells.map(([r, c]) => `${r},${c}`));
  let components = 0;
  for (const [r, c] of cells) {
    if (!left.has(`${r},${c}`)) continue;
    components++;
    for (const k of flood([r, c], on)) left.delete(k);
  }
  // Holes: empty cells in the box that can't reach the outside.
  const inBox = (r: number, c: number) => r >= r0 - 1 && r <= r1 + 1 && c >= c0 - 1 && c <= c1 + 1;
  const outside = flood([r0 - 1, c0 - 1], (r, c) => inBox(r, c) && !on(r, c));
  let holes = 0;
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (!on(r, c) && !outside.has(`${r},${c}`)) holes++;
  // Thin parts: cells not covered by any solid 3×3 block (a morphological opening).
  const core = new Set<string>();
  for (let r = r0; r <= r1 - 2; r++)
    for (let c = c0; c <= c1 - 2; c++) {
      let all = true;
      for (let i = 0; i < 3 && all; i++) for (let j = 0; j < 3; j++) if (!on(r + i, c + j)) { all = false; break; }
      if (all) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) core.add(`${r + i},${c + j}`);
    }
  const thin = cells.filter(([r, c]) => !core.has(`${r},${c}`)).length / cells.length;
  return { cells: cells.length, components, fill: cells.length / (w * h), thin, aspect: Math.max(w / h, h / w), holes: holes / cells.length };
}

export const meetsCompactRule = (x: Compactness) =>
  x.components === 1 && x.fill >= COMPACT_RULE.minFill && x.thin <= COMPACT_RULE.maxThin && x.aspect <= COMPACT_RULE.maxAspect && x.holes <= COMPACT_RULE.maxHoles;

/** Measurements of a shape at the sizes a case uses (square always passes). */
export function shapeCompactness(key: ShapeKey): Compactness[] {
  if (key === "square") return [{ cells: 196, components: 1, fill: 1, thin: 0, aspect: 1, holes: 0 }];
  const out: Compactness[] = [];
  let n = 9;
  let m = shapeMask(key, n);
  const count = (x: boolean[][]) => x.reduce((s, row) => s + row.filter(Boolean).length, 0);
  for (const target of COMPACT_RULE.targets) {
    while (m && n < 44 && count(m) < target) m = shapeMask(key, ++n);
    if (m) out.push(maskCompactness(m));
  }
  return out;
}

export const isCompactShape = (key: ShapeKey) => {
  const all = shapeCompactness(key);
  return all.length > 0 && all.every(meetsCompactRule);
};
