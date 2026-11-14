/**
 * Original silhouette helpers: a shape is a union of ellipses (and optional
 * polygons). The outline is traced with marching squares so the PDF can draw
 * it as a crisp vector. Nothing here is copied from a commercial puzzle.
 */
export type Pt = [number, number];

export interface Blob {
  /** Centre and radii in the author's canvas (any scale); rotation in radians. */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rot?: number;
}

/** Ellipse. `deg` is clockwise in the y-down canvas, in degrees, for easier authoring. */
export function e(cx: number, cy: number, rx: number, ry: number, deg = 0): Blob {
  return { cx, cy, rx, ry, rot: deg ? (deg * Math.PI) / 180 : 0 };
}

export function inBlob(b: Blob, x: number, y: number): boolean {
  const dx = x - b.cx;
  const dy = y - b.cy;
  const c = Math.cos(b.rot ?? 0);
  const s = Math.sin(b.rot ?? 0);
  const u = c * dx + s * dy;
  const v = -s * dx + c * dy;
  return (u * u) / (b.rx * b.rx) + (v * v) / (b.ry * b.ry) <= 1;
}

export function inBlobs(blobs: Blob[], x: number, y: number): boolean {
  for (const b of blobs) if (inBlob(b, x, y)) return true;
  return false;
}

/** Axis-aligned bounding box of an ellipse (samples the rim when rotated). */
function blobBox(b: Blob): [number, number, number, number] {
  if (!b.rot) return [b.cx - b.rx, b.cy - b.ry, b.cx + b.rx, b.cy + b.ry];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const c = Math.cos(b.rot);
  const s = Math.sin(b.rot);
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    const x = b.cx + c * b.rx * Math.cos(a) - s * b.ry * Math.sin(a);
    const y = b.cy + s * b.rx * Math.cos(a) + c * b.ry * Math.sin(a);
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}

export function unionBox(blobs: Blob[]): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of blobs) {
    const [a, c, d, f] = blobBox(b);
    if (a < x0) x0 = a;
    if (c < y0) y0 = c;
    if (d > x1) x1 = d;
    if (f > y1) y1 = f;
  }
  return [x0, y0, x1, y1];
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * Trace the outer contour of a blob union. The result is normalised to the
 * unit box [0,1]² (possibly stretched); the caller stores the natural aspect
 * so the outline can be unsquashed later.
 */
export function blobsToPoly(blobs: Blob[], res = 96): Pt[] {
  const [bx0, by0, bx1, by1] = unionBox(blobs);
  const pad = Math.max(bx1 - bx0, by1 - by0) * 0.04 || 0.04;
  const x0 = bx0 - pad;
  const y0 = by0 - pad;
  const w = bx1 - bx0 + pad * 2;
  const h = by1 - by0 + pad * 2;
  const inside = (i: number, j: number) => inBlobs(blobs, x0 + (j / res) * w, y0 + (i / res) * h);
  const field: boolean[][] = Array.from({ length: res + 1 }, (_, i) => Array.from({ length: res + 1 }, (_, j) => inside(i, j)));
  const at = (i: number, j: number, i2: number, j2: number): Pt => {
    const a = field[i][j];
    const b = field[i2][j2];
    const t = a === b ? 0.5 : 0.5; // mid-edge is plenty at this resolution
    return [lerp(j, j2, t) / res, lerp(i, i2, t) / res];
  };
  const segs: [Pt, Pt][] = [];
  for (let i = 0; i < res; i++) {
    for (let j = 0; j < res; j++) {
      const tl = field[i][j];
      const tr = field[i][j + 1];
      const br = field[i + 1][j + 1];
      const bl = field[i + 1][j];
      const idx = (tl ? 1 : 0) | (tr ? 2 : 0) | (br ? 4 : 0) | (bl ? 8 : 0);
      const top = () => at(i, j, i, j + 1);
      const right = () => at(i, j + 1, i + 1, j + 1);
      const bottom = () => at(i + 1, j, i + 1, j + 1);
      const left = () => at(i, j, i + 1, j);
      // Standard marching-squares edge cases (saddle split along the first diagonal).
      switch (idx) {
        case 1: case 14: segs.push([left(), top()]); break;
        case 2: case 13: segs.push([top(), right()]); break;
        case 3: case 12: segs.push([left(), right()]); break;
        case 4: case 11: segs.push([right(), bottom()]); break;
        case 6: case 9: segs.push([top(), bottom()]); break;
        case 7: case 8: segs.push([left(), bottom()]); break;
        case 5:
          segs.push([left(), top()], [right(), bottom()]);
          break;
        case 10:
          segs.push([top(), right()], [left(), bottom()]);
          break;
      }
    }
  }
  const loops = stitch(segs);
  let best: Pt[] = [];
  for (const loop of loops) if (loop.length > best.length) best = loop;
  if (best.length < 8) {
    // Fallback: bounding rectangle, should never happen for a real animal.
    return [[0, 0], [1, 0], [1, 1], [0, 1]];
  }
  return smooth(best, 2);
}

function keyOf(p: Pt): string {
  return `${p[0].toFixed(5)},${p[1].toFixed(5)}`;
}

function stitch(segs: [Pt, Pt][]): Pt[][] {
  const pts = new Map<string, Pt>();
  const edges = new Map<string, string[]>();
  const put = (p: Pt) => {
    const k = keyOf(p);
    if (!pts.has(k)) pts.set(k, p);
    return k;
  };
  for (const [a, b] of segs) {
    const ka = put(a);
    const kb = put(b);
    (edges.get(ka) ?? (edges.set(ka, []), edges.get(ka)!)).push(kb);
    (edges.get(kb) ?? (edges.set(kb, []), edges.get(kb)!)).push(ka);
  }
  const used = new Set<string>();
  const loops: Pt[][] = [];
  const edgeId = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  for (const start of edges.keys()) {
    const neigh0 = edges.get(start)!;
    for (const n0 of neigh0) {
      if (used.has(edgeId(start, n0))) continue;
      const loop: Pt[] = [pts.get(start)!];
      let prev = start;
      let cur = n0;
      used.add(edgeId(prev, cur));
      for (let guard = 0; guard < 20000; guard++) {
        loop.push(pts.get(cur)!);
        if (cur === start && loop.length > 2) break;
        const next = (edges.get(cur) ?? []).find((k) => !used.has(edgeId(cur, k)));
        if (!next) break;
        used.add(edgeId(cur, next));
        prev = cur;
        cur = next;
      }
      if (loop.length > 6) loops.push(loop);
    }
  }
  return loops;
}

/** Neighbour averaging, a couple of passes, then drop every other point. */
function smooth(pts: Pt[], passes: number): Pt[] {
  let p = pts;
  for (let k = 0; k < passes; k++) {
    const out: Pt[] = [];
    const n = p.length;
    for (let i = 0; i < n; i++) {
      const a = p[(i - 1 + n) % n];
      const b = p[i];
      const c = p[(i + 1) % n];
      out.push([(a[0] + b[0] * 2 + c[0]) / 4, (a[1] + b[1] * 2 + c[1]) / 4]);
    }
    p = out;
  }
  if (p.length > 80) p = p.filter((_, i) => i % 2 === 0);
  return p;
}

/** Map a rectangle in the author's canvas into the unit box of `blobsToPoly`. */
export function unitRect(blobs: Blob[], rect: [number, number, number, number]): [number, number, number, number] {
  const [bx0, by0, bx1, by1] = unionBox(blobs);
  const pad = Math.max(bx1 - bx0, by1 - by0) * 0.04 || 0.04;
  const x0 = bx0 - pad;
  const y0 = by0 - pad;
  const w = bx1 - bx0 + pad * 2;
  const h = by1 - by0 + pad * 2;
  return [(rect[0] - x0) / w, (rect[1] - y0) / h, (rect[2] - x0) / w, (rect[3] - y0) / h];
}

export function naturalAspect(blobs: Blob[]): number {
  const [x0, y0, x1, y1] = unionBox(blobs);
  return (x1 - x0) / (y1 - y0 || 1);
}
