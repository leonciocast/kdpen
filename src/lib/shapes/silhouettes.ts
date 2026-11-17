/**
 * Original silhouette helpers. Animal shapes are SVG path outlines (cubic /
 * quadratic Béziers) sampled into a polygon; the same polygon is the PDF
 * outline, so the edge stays smooth. Ellipse-union helpers remain for tests
 * of older geometry. Nothing here is copied from a commercial puzzle.
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


// ---------------------------------------------------------------- SVG paths

function tokenizePath(d: string): (string | number)[] {
  const out: (string | number)[] = [];
  let i = 0;
  const isCmd = (c: string) => /[MmLlHhVvCcSsQqTtAaZz]/.test(c);
  while (i < d.length) {
    const c = d[i];
    if (c === "," || c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    if (isCmd(c)) {
      out.push(c);
      i++;
      continue;
    }
    let s = "";
    if (c === "+" || c === "-") {
      s += c;
      i++;
    }
    let dotted = false;
    let exp = false;
    while (i < d.length) {
      const ch = d[i];
      if (ch >= "0" && ch <= "9") {
        s += ch;
        i++;
      } else if (ch === "." && !dotted && !exp) {
        dotted = true;
        s += ch;
        i++;
      } else if ((ch === "e" || ch === "E") && !exp) {
        exp = true;
        dotted = true;
        s += ch;
        i++;
        if (d[i] === "+" || d[i] === "-") {
          s += d[i];
          i++;
        }
      } else break;
    }
    if (s !== "" && s !== "+" && s !== "-" && s !== "." && s !== "-." && s !== "+.") out.push(parseFloat(s));
  }
  return out;
}

function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
  const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
  return [x, y];
}

function quad(p0: Pt, p1: Pt, p2: Pt, t: number): Pt {
  const u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
}

function sampleCubic(out: Pt[], a: Pt, b: Pt, c: Pt, d: Pt, steps: number) {
  for (let i = 1; i <= steps; i++) out.push(cubic(a, b, c, d, i / steps));
}

function sampleQuad(out: Pt[], a: Pt, b: Pt, c: Pt, steps: number) {
  for (let i = 1; i <= steps; i++) out.push(quad(a, b, c, i / steps));
}

/**
 * Sample an SVG path (M/L/H/V/C/S/Q/T/Z, absolute and relative) into a
 * dense polygon in the author's coordinates. Arcs are not used by our animals.
 */
export function pathToPoly(d: string, steps = 16): Pt[] {
  const tok = tokenizePath(d);
  let i = 0;
  let cmd = "M";
  let x = 0, y = 0, sx = 0, sy = 0;
  let cx = 0, cy = 0; // last cubic control
  let qx = 0, qy = 0; // last quad control
  let prev = "";
  const out: Pt[] = [];
  const push = (px: number, py: number) => {
    const last = out[out.length - 1];
    if (!last || Math.hypot(last[0] - px, last[1] - py) > 1e-6) out.push([px, py]);
  };
  const num = (): number => {
    const v = tok[i++];
    if (typeof v !== "number") throw new Error(`SVG path: expected number, got ${v}`);
    return v;
  };
  const hasNum = () => typeof tok[i] === "number";
  while (i < tok.length) {
    if (typeof tok[i] === "string") {
      cmd = tok[i++] as string;
    } else if (cmd === "M") cmd = "L";
    else if (cmd === "m") cmd = "l";
    const rel = cmd === cmd.toLowerCase();
    const k = cmd.toUpperCase();
    const nx = (v: number) => (rel ? x + v : v);
    const ny = (v: number) => (rel ? y + v : v);
    if (k === "M") {
      x = nx(num());
      y = ny(num());
      sx = x;
      sy = y;
      push(x, y);
      cx = x;
      cy = y;
      prev = k;
    } else if (k === "L") {
      x = nx(num());
      y = ny(num());
      push(x, y);
      prev = k;
    } else if (k === "H") {
      x = nx(num());
      push(x, y);
      prev = k;
    } else if (k === "V") {
      y = ny(num());
      push(x, y);
      prev = k;
    } else if (k === "C") {
      const x1 = nx(num()), y1 = ny(num());
      const x2 = nx(num()), y2 = ny(num());
      const x3 = nx(num()), y3 = ny(num());
      sampleCubic(out, [x, y], [x1, y1], [x2, y2], [x3, y3], steps);
      cx = x2;
      cy = y2;
      x = x3;
      y = y3;
      prev = k;
    } else if (k === "S") {
      const rx = prev === "C" || prev === "S" ? 2 * x - cx : x;
      const ry = prev === "C" || prev === "S" ? 2 * y - cy : y;
      const x2 = nx(num()), y2 = ny(num());
      const x3 = nx(num()), y3 = ny(num());
      sampleCubic(out, [x, y], [rx, ry], [x2, y2], [x3, y3], steps);
      cx = x2;
      cy = y2;
      x = x3;
      y = y3;
      prev = k;
    } else if (k === "Q") {
      const x1 = nx(num()), y1 = ny(num());
      const x2 = nx(num()), y2 = ny(num());
      sampleQuad(out, [x, y], [x1, y1], [x2, y2], steps);
      qx = x1;
      qy = y1;
      x = x2;
      y = y2;
      prev = k;
    } else if (k === "T") {
      const x1 = prev === "Q" || prev === "T" ? 2 * x - qx : x;
      const y1 = prev === "Q" || prev === "T" ? 2 * y - qy : y;
      const x2 = nx(num()), y2 = ny(num());
      sampleQuad(out, [x, y], [x1, y1], [x2, y2], steps);
      qx = x1;
      qy = y1;
      x = x2;
      y = y2;
      prev = k;
    } else if (k === "Z") {
      x = sx;
      y = sy;
      push(x, y);
      prev = k;
    } else {
      throw new Error(`SVG path: unsupported command ${cmd}`);
    }
  }
  return out;
}

export function polyBox(pts: Pt[]): [number, number, number, number] {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** Sample a path and normalise it to the unit box [0,1]²; `aspect` is the natural width/height. */
export function pathToUnit(d: string): { poly: Pt[]; aspect: number; bbox: [number, number, number, number] } {
  const raw = pathToPoly(d);
  if (raw.length < 3) throw new Error("SVG path produced too few points");
  const bbox = polyBox(raw);
  const [x0, y0, x1, y1] = bbox;
  const w = x1 - x0 || 1;
  const h = y1 - y0 || 1;
  return { poly: raw.map(([x, y]) => [(x - x0) / w, (y - y0) / h]), aspect: w / h, bbox };
}

/** Map a rectangle in authoring coordinates into the unit box of `bbox`. */
export function mapRect(bbox: [number, number, number, number], rect: [number, number, number, number]): [number, number, number, number] {
  const [x0, y0, x1, y1] = bbox;
  const w = x1 - x0 || 1;
  const h = y1 - y0 || 1;
  return [(rect[0] - x0) / w, (rect[1] - y0) / h, (rect[2] - x0) / w, (rect[3] - y0) / h];
}
