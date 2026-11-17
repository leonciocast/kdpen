/**
 * Stepped / cell-built puzzle shapes.
 *
 * Each shape is an original block construction painted onto a grid of
 * whole cells. Nothing here is traced from commercial puzzle books or
 * stock art. Letters and digits are original 7-row block forms designed
 * so a scaled stroke is wide enough to hold words.
 */
export type Mask = boolean[][];

export function blank(n: number): Mask {
  return Array.from({ length: n }, () => Array<boolean>(n).fill(false));
}

function set(m: Mask, r: number, c: number, on = true) {
  if (r >= 0 && c >= 0 && r < m.length && c < m.length) m[r][c] = on;
}

function rect(m: Mask, r0: number, c0: number, r1: number, c1: number) {
  const n = m.length;
  const a = Math.max(0, Math.min(r0, r1));
  const b = Math.min(n - 1, Math.max(r0, r1));
  const d = Math.max(0, Math.min(c0, c1));
  const e = Math.min(n - 1, Math.max(c0, c1));
  for (let r = a; r <= b; r++) for (let c = d; c <= e; c++) m[r][c] = true;
}

function thick(n: number, frac = 0.22, min = 4) {
  return Math.max(min, Math.round(n * frac));
}

/** Stamp a row-string bitmap ( "#" = used ) into the centre of an N×N grid. */
export function stamp(bits: string[], n: number): Mask {
  const m = blank(n);
  const rows = bits.length;
  const cols = Math.max(...bits.map((s) => s.length));
  const scale = Math.max(1, Math.floor(Math.min(n / rows, n / cols)));
  const h = rows * scale;
  const w = cols * scale;
  const r0 = Math.floor((n - h) / 2);
  const c0 = Math.floor((n - w) / 2);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < bits[r].length; c++) {
      if (bits[r][c] !== "#") continue;
      for (let i = 0; i < scale; i++)
        for (let j = 0; j < scale; j++) set(m, r0 + r * scale + i, c0 + c * scale + j);
    }
  return m;
}

function uBand(m: Mask, outer: number, t: number, openBottom = true) {
  const n = m.length;
  const inner = outer + t - 1;
  const rBot = openBottom ? n - 1 : n - 1 - outer;
  rect(m, outer, outer, inner, n - 1 - outer); // top
  rect(m, outer, outer, rBot, inner); // left
  rect(m, outer, n - 1 - inner, rBot, n - 1 - outer); // right
}

function arch(n: number): Mask {
  const m = blank(n);
  uBand(m, 0, thick(n, 0.24, 5), true);
  return m;
}

function rainbow(n: number): Mask {
  const m = blank(n);
  const t = Math.max(3, Math.round(n * 0.12));
  const gap = Math.max(2, Math.round(n * 0.055));
  for (let k = 0; k < 3; k++) uBand(m, k * (t + gap), t, true);
  return m;
}

function ubend(n: number): Mask {
  const m = blank(n);
  uBand(m, Math.round(n * 0.06), thick(n, 0.26, 5), true);
  return m;
}

function bowl(n: number): Mask {
  const m = blank(n);
  const t = thick(n, 0.24, 5);
  // U opening upward (a bowl / smile).
  const top = Math.round(n * 0.28);
  rect(m, n - t, 0, n - 1, n - 1); // floor
  rect(m, top, 0, n - 1, t - 1); // left
  rect(m, top, n - t, n - 1, n - 1); // right
  return m;
}

function wave(n: number): Mask {
  const m = blank(n);
  const t = thick(n, 0.2, 4);
  for (let c = 0; c < n; c++) {
    const mid = n * (0.5 + 0.22 * Math.sin((c / Math.max(1, n - 1)) * Math.PI * 2.5));
    const r0 = Math.round(mid - t / 2);
    rect(m, r0, c, r0 + t - 1, c);
  }
  return m;
}

function zigzag(n: number): Mask {
  const m = blank(n);
  const t = thick(n, 0.2, 4);
  const amp = n * 0.28;
  const cycles = 2;
  for (let c = 0; c < n; c++) {
    const ph = (c / Math.max(1, n - 1)) * cycles;
    const tri = 1 - 4 * Math.abs(ph - Math.floor(ph + 0.5));
    const mid = n * 0.5 + amp * tri;
    const r0 = Math.round(mid - t / 2);
    rect(m, r0, c, r0 + t - 1, c);
  }
  return m;
}

function stairs(n: number): Mask {
  const m = blank(n);
  const t = thick(n, 0.22, 5);
  const steps = Math.max(4, Math.round(n / t));
  const step = n / steps;
  for (let k = 0; k < steps; k++) {
    const c0 = Math.round(k * step);
    const c1 = Math.round((k + 1) * step) - 1;
    const r1 = n - 1 - Math.round(k * step);
    rect(m, r1 - t + 1, c0, r1, n - 1);
    rect(m, 0, c0, r1, c0 + t - 1);
  }
  return m;
}

function pyramid(n: number): Mask {
  const m = blank(n);
  const rows = Math.max(4, Math.floor(n / 2));
  const rowH = Math.max(3, Math.floor(n / rows));
  for (let k = 0; k < rows; k++) {
    const r1 = n - 1 - k * rowH;
    const r0 = Math.max(0, r1 - rowH + 1);
    const inset = Math.round((k * n) / (2 * rows));
    rect(m, r0, inset, r1, n - 1 - inset);
  }
  return m;
}

function stepdiamond(n: number): Mask {
  const m = blank(n);
  const mid = (n - 1) / 2;
  const t = thick(n, 0.2, 4);
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const d = Math.abs(r - mid) + Math.abs(c - mid);
      if (d <= mid && d >= mid - t) m[r][c] = true;
    }
  // fill the interior so it is a solid stepped diamond (not a ring)
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (Math.abs(r - mid) + Math.abs(c - mid) <= mid - 0.2) m[r][c] = true;
    }
  return m;
}

function stepcircle(n: number): Mask {
  const m = blank(n);
  const cx = (n - 1) / 2;
  const cy = (n - 1) / 2;
  const r = n / 2 - 0.35;
  for (let row = 0; row < n; row++)
    for (let col = 0; col < n; col++) {
      const d = Math.hypot(row + 0.5 - cy, col + 0.5 - cx);
      if (d <= r) m[row][col] = true;
    }
  return m;
}

function ring(n: number): Mask {
  const m = blank(n);
  const cx = (n - 1) / 2;
  const cy = (n - 1) / 2;
  const outer = n / 2 - 0.3;
  const inner = outer - thick(n, 0.24, 5);
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const d = Math.hypot(r + 0.5 - cy, c + 0.5 - cx);
      if (d <= outer && d >= inner) m[r][c] = true;
    }
  return m;
}

function boxframe(n: number): Mask {
  const m = blank(n);
  const t = thick(n, 0.24, 5);
  rect(m, 0, 0, t - 1, n - 1);
  rect(m, n - t, 0, n - 1, n - 1);
  rect(m, 0, 0, n - 1, t - 1);
  rect(m, 0, n - t, n - 1, n - 1);
  return m;
}

function windowframe(n: number): Mask {
  const m = boxframe(n);
  const t = thick(n, 0.2, 4);
  const mid = Math.floor((n - t) / 2);
  rect(m, 0, mid, n - 1, mid + t - 1); // mullion
  rect(m, mid, 0, mid + t - 1, n - 1); // transom
  return m;
}

function blockcross(n: number): Mask {
  const m = blank(n);
  const t = thick(n, 0.32, 6);
  const o = Math.floor((n - t) / 2);
  rect(m, 0, o, n - 1, o + t - 1);
  rect(m, o, 0, o + t - 1, n - 1);
  return m;
}

function blockx(n: number): Mask {
  const m = blank(n);
  const t = thick(n, 0.22, 5);
  for (let i = 0; i < n; i++) {
    for (let k = -Math.floor(t / 2); k <= Math.ceil(t / 2) - 1; k++) {
      set(m, i, i + k);
      set(m, i, n - 1 - i + k);
    }
  }
  return m;
}

function blockt(n: number): Mask {
  const m = blank(n);
  const t = thick(n, 0.28, 5);
  rect(m, 0, 0, t - 1, n - 1);
  const o = Math.floor((n - t) / 2);
  rect(m, 0, o, n - 1, o + t - 1);
  return m;
}

function blockl(n: number): Mask {
  const m = blank(n);
  const t = thick(n, 0.28, 5);
  rect(m, 0, 0, n - 1, t - 1);
  rect(m, n - t, 0, n - 1, n - 1);
  return m;
}

function arrow(n: number): Mask {
  const m = blank(n);
  const t = thick(n, 0.28, 5);
  const o = Math.floor((n - t) / 2);
  const shaft = Math.round(n * 0.55);
  rect(m, o, 0, o + t - 1, shaft);
  const tip = n - 1;
  const mid = (n - 1) / 2;
  for (let r = 0; r < n; r++)
    for (let c = shaft - Math.round(n * 0.06); c < n; c++) {
      const y = Math.abs(r - mid);
      const x = tip - c;
      if (y <= x * 0.85 + t * 0.15) m[r][c] = true;
    }
  return m;
}

function bolt(n: number): Mask {
  const m = blank(n);
  // Original stepped lightning: two thick zigs, not a traced silhouette.
  const pts: [number, number][] = [
    [0.12, 0.02], [0.62, 0.02], [0.42, 0.38], [0.78, 0.38],
    [0.28, 0.98], [0.38, 0.58], [0.10, 0.58],
  ];
  fillPoly(m, pts);
  return m;
}

function fillPoly(m: Mask, unit: [number, number][]) {
  const n = m.length;
  const pts = unit.map(([x, y]) => [x * n, y * n] as [number, number]);
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const x = c + 0.5;
      const y = r + 0.5;
      let hit = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
      }
      if (hit) m[r][c] = true;
    }
}

function blockheart(n: number): Mask {
  const m = blank(n);
  const cx = (n - 1) / 2;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const x = (c + 0.5) / n * 2 - 1;
      const y = (r + 0.5) / n * 2 - 1.05;
      // Classic heart inequality, then quantized to cells.
      const a = x * x + y * y - 1;
      if (a * a * a - x * x * y * y * y < 0) m[r][c] = true;
    }
  return m;
}

function blockstar(n: number): Mask {
  const m = blank(n);
  const cx = (n - 1) / 2, cy = (n - 1) / 2;
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 0.42 : 1;
    pts.push([0.5 + 0.48 * r * Math.cos(a), 0.5 + 0.48 * r * Math.sin(a)]);
  }
  fillPoly(m, pts);
  return m;
}

function blockhouse(n: number): Mask {
  const m = blank(n);
  const roof = Math.round(n * 0.42);
  const wall = Math.round(n * 0.08);
  fillPoly(m, [[0.5, 0.02], [0.98, 0.42], [0.02, 0.42]]);
  rect(m, roof, wall, n - 1, n - 1 - wall);
  // door cut-out
  const dw = Math.max(3, Math.round(n * 0.16));
  const dh = Math.max(4, Math.round(n * 0.28));
  const dc = Math.floor((n - dw) / 2);
  for (let r = n - dh; r < n; r++) for (let c = dc; c < dc + dw; c++) if (m[r]) m[r][c] = false;
  return m;
}

function blocktree(n: number): Mask {
  const m = blank(n);
  const layers = 3;
  const trunkW = thick(n, 0.2, 4);
  const trunkH = Math.round(n * 0.2);
  const mid = Math.floor((n - trunkW) / 2);
  rect(m, n - trunkH, mid, n - 1, mid + trunkW - 1);
  for (let k = 0; k < layers; k++) {
    const top = Math.round(n * (0.04 + k * 0.22));
    const bot = Math.round(n * (0.38 + k * 0.22));
    const inset = Math.round(n * (0.28 - k * 0.1));
    fillPoly(m, [[0.5, top / n], [1 - inset / n, bot / n], [inset / n, bot / n]]);
  }
  return m;
}

function cup(n: number): Mask {
  const m = blank(n);
  const top = Math.round(n * 0.18);
  const bot = Math.round(n * 0.82);
  const t = thick(n, 0.2, 4);
  fillPoly(m, [[0.12, top / n], [0.88, top / n], [0.74, bot / n], [0.26, bot / n]]);
  // hollow the bowl interior
  const inset = t;
  for (let r = top + inset; r < bot - Math.ceil(t * 0.7); r++) {
    const y = (r - top) / Math.max(1, bot - top);
    const c0 = Math.round(n * (0.12 + 0.14 * y)) + inset;
    const c1 = Math.round(n * (0.88 - 0.14 * y)) - inset;
    for (let c = c0; c <= c1; c++) if (m[r]) m[r][c] = false;
  }
  // handle
  const hy0 = Math.round(n * 0.32);
  const hy1 = Math.round(n * 0.62);
  const hx0 = Math.round(n * 0.82);
  const hx1 = Math.round(n * 0.98);
  rect(m, hy0, hx0, hy0 + t - 2, hx1);
  rect(m, hy1 - t + 2, hx0, hy1, hx1);
  rect(m, hy0, hx1 - t + 2, hy1, hx1);
  return m;
}

function key(n: number): Mask {
  const m = blank(n);
  const t = thick(n, 0.2, 4);
  const cy = Math.floor((n - t) / 2);
  rect(m, cy, Math.round(n * 0.34), cy + t - 1, n - 1); // shaft
  // bits
  rect(m, cy + t - 1, n - t * 2, n - Math.round(n * 0.22), n - 1 - Math.round(n * 0.04));
  rect(m, cy + t - 1, n - t * 3 - 2, cy + t + Math.round(n * 0.12), n - t * 2 - 1);
  // bow (ring)
  const cx = n * 0.22, midy = n * 0.5, ro = n * 0.22, ri = ro - t;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const d = Math.hypot(r + 0.5 - midy, c + 0.5 - cx);
      if (d <= ro && d >= ri) m[r][c] = true;
    }
  return m;
}

function rocket(n: number): Mask {
  const m = blank(n);
  const t = thick(n, 0.28, 5);
  const o = Math.floor((n - t) / 2);
  const nose = Math.round(n * 0.28);
  fillPoly(m, [[0.5, 0.02], [0.5 + t / n / 2 + 0.04, nose / n], [0.5 - t / n / 2 - 0.04, nose / n]]);
  rect(m, nose, o, Math.round(n * 0.78), o + t - 1);
  // fins
  fillPoly(m, [[0.5 - t / n / 2, 0.55], [0.08, 0.86], [0.5 - t / n / 2, 0.78]]);
  fillPoly(m, [[0.5 + t / n / 2, 0.55], [0.92, 0.86], [0.5 + t / n / 2, 0.78]]);
  // flame
  fillPoly(m, [[0.38, 0.78], [0.5, 0.98], [0.62, 0.78]]);
  return m;
}

function sunburst(n: number): Mask {
  const m = blank(n);
  const cx = (n - 1) / 2, cy = (n - 1) / 2;
  const body = n * 0.22;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const dx = Math.abs(c + 0.5 - cx) / (body * 1.1);
      const dy = Math.abs(r + 0.5 - cy) / body;
      // octagon
      if (Math.max(dx, dy, (dx + dy) * 0.75) <= 1) m[r][c] = true;
    }
  const ray = Math.max(5, Math.round(n * 0.16));
  const reach = n * 0.46;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 - Math.PI / 2;
    const rr = cy + Math.sin(a) * reach;
    const cc = cx + Math.cos(a) * reach;
    const r0 = Math.round(rr - ray / 2);
    const c0 = Math.round(cc - ray / 2);
    rect(m, r0, c0, r0 + ray - 1, c0 + ray - 1);
  }
  return m;
}

function petals(n: number): Mask {
  const m = blank(n);
  const cx = (n - 1) / 2, cy = (n - 1) / 2;
  const core = n * 0.16;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) if (Math.hypot(r + 0.5 - cy, c + 0.5 - cx) <= core) m[r][c] = true;
  const petal = Math.max(5, Math.round(n * 0.16));
  const reach = n * 0.36;
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3 - Math.PI / 2;
    const rr = cy + Math.sin(a) * reach;
    const cc = cx + Math.cos(a) * reach;
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        if (Math.hypot(r + 0.5 - rr, c + 0.5 - cc) <= petal / 2 + 0.15) m[r][c] = true;
      }
  }
  return m;
}

function checkers(n: number): Mask {
  const m = blank(n);
  const cells = 3;
  const gap = Math.max(2, Math.round(n * 0.06));
  const block = Math.floor((n - gap * (cells - 1)) / cells);
  for (let i = 0; i < cells; i++)
    for (let j = 0; j < cells; j++) {
      if ((i + j) % 2 === 1) continue;
      const r0 = i * (block + gap);
      const c0 = j * (block + gap);
      rect(m, r0, c0, r0 + block - 1, c0 + block - 1);
    }
  return m;
}

function corners(n: number): Mask {
  const m = blank(n);
  const b = Math.max(6, Math.round(n * 0.28));
  const mid = Math.max(6, Math.round(n * 0.3));
  const o = Math.floor((n - mid) / 2);
  rect(m, 0, 0, b - 1, b - 1);
  rect(m, 0, n - b, b - 1, n - 1);
  rect(m, n - b, 0, n - 1, b - 1);
  rect(m, n - b, n - b, n - 1, n - 1);
  rect(m, o, o, o + mid - 1, o + mid - 1);
  return m;
}

function islandsK(n: number, k: number): Mask {
  const m = blank(n);
  const gap = 2;
  const b = Math.max(6, Math.floor((n - 2 * gap) / 3));
  if (k === 5) {
    const mid = Math.floor((n - b) / 2);
    const spots: [number, number][] = [[mid, mid], [0, 0], [0, n - b], [n - b, 0], [n - b, n - b]];
    for (const [r0, c0] of spots) rect(m, r0, c0, r0 + b - 1, c0 + b - 1);
    return m;
  }
  const used = 3 * b + 2 * gap;
  const pad = Math.max(0, Math.floor((n - used) / 2));
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      const r0 = pad + i * (b + gap);
      const c0 = pad + j * (b + gap);
      rect(m, r0, c0, r0 + b - 1, c0 + b - 1);
    }
  return m;
}

/** Original 7-row block letters and digits (stroke usually two cells wide). */
export const GLYPHS: Record<string, string[]> = {
  A: [".#####.", "##...##", "##...##", "#######", "##...##", "##...##", "##...##"],
  B: ["######.", "##...##", "##...##", "######.", "##...##", "##...##", "######."],
  C: [".#####.", "##...##", "##.....", "##.....", "##.....", "##...##", ".#####."],
  D: ["######.", "##...##", "##...##", "##...##", "##...##", "##...##", "######."],
  E: ["#######", "##.....", "##.....", "######.", "##.....", "##.....", "#######"],
  F: ["#######", "##.....", "##.....", "######.", "##.....", "##.....", "##....."],
  G: [".#####.", "##...##", "##.....", "##.####", "##...##", "##...##", ".#####."],
  H: ["##...##", "##...##", "##...##", "#######", "##...##", "##...##", "##...##"],
  I: ["#######", "...##..", "...##..", "...##..", "...##..", "...##..", "#######"],
  J: ["..#####", "....##.", "....##.", "....##.", "##..##.", "##..##.", ".####.."],
  K: ["##...##", "##..##.", "##.##..", "####...", "##.##..", "##..##.", "##...##"],
  L: ["##.....", "##.....", "##.....", "##.....", "##.....", "##.....", "#######"],
  M: ["##...##", "###.###", "#######", "##.#.##", "##...##", "##...##", "##...##"],
  N: ["##...##", "###..##", "####.##", "##.#.##", "##..###", "##...##", "##...##"],
  O: [".#####.", "##...##", "##...##", "##...##", "##...##", "##...##", ".#####."],
  P: ["######.", "##...##", "##...##", "######.", "##.....", "##.....", "##....."],
  Q: [".#####.", "##...##", "##...##", "##...##", "##.#.##", "##..##.", ".####.#"],
  R: ["######.", "##...##", "##...##", "######.", "##.##..", "##..##.", "##...##"],
  S: [".#####.", "##...##", "##.....", ".#####.", ".....##", "##...##", ".#####."],
  T: ["#######", "...##..", "...##..", "...##..", "...##..", "...##..", "...##.."],
  U: ["##...##", "##...##", "##...##", "##...##", "##...##", "##...##", ".#####."],
  V: ["##...##", "##...##", "##...##", "##...##", ".##.##.", ".##.##.", "..###.."],
  W: ["##...##", "##...##", "##...##", "##.#.##", "#######", "###.###", "##...##"],
  X: ["##...##", "##...##", ".##.##.", "..###..", ".##.##.", "##...##", "##...##"],
  Y: ["##...##", "##...##", ".##.##.", "..###..", "...##..", "...##..", "...##.."],
  Z: ["#######", ".....##", "....##.", "...##..", "..##...", ".##....", "#######"],
  "0": [".#####.", "##...##", "##..###", "##.#.##", "###..##", "##...##", ".#####."],
  "1": ["..##...", ".###...", "..##...", "..##...", "..##...", "..##...", "#######"],
  "2": [".#####.", "##...##", ".....##", "...###.", "..##...", ".##....", "#######"],
  "3": [".#####.", "##...##", ".....##", "..####.", ".....##", "##...##", ".#####."],
  "4": ["...##..", "..###..", ".##.#..", "##..#..", "#######", "....#..", "....#.."],
  "5": ["#######", "##.....", "##.....", "######.", ".....##", "##...##", ".#####."],
  "6": [".#####.", "##.....", "##.....", "######.", "##...##", "##...##", ".#####."],
  "7": ["#######", ".....##", "....##.", "...##..", "..##...", "..##...", "..##..."],
  "8": [".#####.", "##...##", "##...##", ".#####.", "##...##", "##...##", ".#####."],
  "9": [".#####.", "##...##", "##...##", ".######", ".....##", ".....##", ".#####."],
};

export type SteppedDef = {
  key: string;
  label: string;
  aspect: number;
  category: "stepped" | "hollow" | "clusters" | "letters";
  minSize: number;
  aliases?: string[];
  tag?: string;
  islands?: boolean;
  buildMask: (n: number) => Mask;
};

const glyphs: SteppedDef[] = [
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((ch) => ({
    key: `letter${ch}`,
    label: ch,
    aspect: 1,
    category: "letters" as const,
    minSize: 28,
    aliases: [ch, `letter ${ch}`, `the letter ${ch}`],
    buildMask: (n: number) => stamp(GLYPHS[ch], n),
  })),
  ..."0123456789".split("").map((ch) => ({
    key: `digit${ch}`,
    label: ch,
    aspect: 1,
    category: "letters" as const,
    minSize: 28,
    aliases: [ch, `number ${ch}`, `digit ${ch}`, `age ${ch}`],
    buildMask: (n: number) => stamp(GLYPHS[ch], n),
  })),
];

export const STEPPED_DEFS: SteppedDef[] = [
  { key: "arch", label: "Arch", aspect: 1.2, category: "stepped", minSize: 24, aliases: ["rainbow arch", "arcade"], buildMask: arch },
  { key: "rainbow", label: "Rainbow", aspect: 1.25, category: "stepped", minSize: 28, aliases: ["rainbows"], tag: "Weather", buildMask: rainbow },
  { key: "ubend", label: "U shape", aspect: 1.05, category: "stepped", minSize: 24, aliases: ["u", "horseshoe"], buildMask: ubend },
  { key: "bowl", label: "Bowl", aspect: 1.2, category: "stepped", minSize: 24, aliases: ["smile", "cup bowl", "basin"], buildMask: bowl },
  { key: "wave", label: "Wave", aspect: 1.4, category: "stepped", minSize: 24, aliases: ["waves", "sea wave"], tag: "Ocean", buildMask: wave },
  { key: "zigzag", label: "Zigzag", aspect: 1.35, category: "stepped", minSize: 24, aliases: ["zig zag", "chevron"], buildMask: zigzag },
  { key: "stairs", label: "Staircase", aspect: 1, category: "stepped", minSize: 24, aliases: ["steps", "stair"], buildMask: stairs },
  { key: "pyramid", label: "Pyramid", aspect: 1.1, category: "stepped", minSize: 24, aliases: ["triangle stack"], buildMask: pyramid },
  { key: "stepdiamond", label: "Stepped diamond", aspect: 1, category: "stepped", minSize: 24, aliases: ["block diamond"], buildMask: stepdiamond },
  { key: "stepcircle", label: "Stepped circle", aspect: 1, category: "stepped", minSize: 24, aliases: ["block circle"], buildMask: stepcircle },
  { key: "blockcross", label: "Cross", aspect: 1, category: "stepped", minSize: 24, aliases: ["plus sign", "block plus"], buildMask: blockcross },
  { key: "blockx", label: "X shape", aspect: 1, category: "stepped", minSize: 24, aliases: ["x", "times"], buildMask: blockx },
  { key: "blockt", label: "T shape", aspect: 1, category: "stepped", minSize: 24, aliases: ["t"], buildMask: blockt },
  { key: "blockl", label: "L shape", aspect: 1, category: "stepped", minSize: 24, aliases: ["l", "ell"], buildMask: blockl },
  { key: "arrow", label: "Arrow", aspect: 1.15, category: "stepped", minSize: 24, aliases: ["pointer"], buildMask: arrow },
  { key: "bolt", label: "Lightning", aspect: 0.72, category: "stepped", minSize: 26, aliases: ["lightning bolt", "thunder"], tag: "Weather", buildMask: bolt },
  { key: "blockheart", label: "Block heart", aspect: 1, category: "stepped", minSize: 24, aliases: ["pixel heart"], tag: "Valentine's", buildMask: blockheart },
  { key: "blockstar", label: "Block star", aspect: 1, category: "stepped", minSize: 24, aliases: ["pixel star"], buildMask: blockstar },
  { key: "blockhouse", label: "Block house", aspect: 1, category: "stepped", minSize: 24, aliases: ["pixel house"], buildMask: blockhouse },
  { key: "blocktree", label: "Block tree", aspect: 0.9, category: "stepped", minSize: 26, aliases: ["pixel tree"], tag: "Christmas", buildMask: blocktree },
  { key: "cup", label: "Cup", aspect: 0.95, category: "stepped", minSize: 24, aliases: ["mug", "tea cup"], buildMask: cup },
  { key: "key", label: "Key", aspect: 1.35, category: "stepped", minSize: 26, aliases: ["keys"], buildMask: key },
  { key: "rocket", label: "Rocket", aspect: 0.7, category: "stepped", minSize: 26, aliases: ["spaceship"], buildMask: rocket },
  { key: "boxframe", label: "Square frame", aspect: 1, category: "hollow", minSize: 24, aliases: ["hollow square", "border"], buildMask: boxframe },
  { key: "ring", label: "Ring", aspect: 1, category: "hollow", minSize: 26, aliases: ["donut", "hoop", "circle frame"], buildMask: ring },
  { key: "windowframe", label: "Window", aspect: 1, category: "hollow", minSize: 26, aliases: ["window frame", "pane"], buildMask: windowframe },
  { key: "sunburst", label: "Sun with rays", aspect: 1, category: "clusters", minSize: 32, aliases: ["sun", "sunshine", "weather sun"], tag: "Weather", islands: true, buildMask: sunburst },
  { key: "petals", label: "Flower petals", aspect: 1, category: "clusters", minSize: 32, aliases: ["flower", "blossom"], tag: "Garden", islands: true, buildMask: petals },
  { key: "checkers", label: "Checkerboard", aspect: 1, category: "clusters", minSize: 30, aliases: ["chequerboard", "islands checker"], islands: true, buildMask: checkers },
  { key: "corners", label: "Corners and centre", aspect: 1, category: "clusters", minSize: 30, aliases: ["four corners"], islands: true, buildMask: corners },
  { key: "islands5", label: "Five islands", aspect: 1, category: "clusters", minSize: 30, aliases: ["five blocks", "scattered five"], islands: true, buildMask: (n) => islandsK(n, 5) },
  { key: "islands9", label: "Nine islands", aspect: 1, category: "clusters", minSize: 32, aliases: ["nine blocks", "scattered nine"], islands: true, buildMask: (n) => islandsK(n, 9) },
  ...glyphs,
];

export type SteppedKey = (typeof STEPPED_DEFS)[number]["key"];
