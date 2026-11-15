/**
 * Vector drawing primitives for the design system (jsPDF, points, top-left origin).
 * Everything here is original artwork built from simple shapes.
 */
import type { jsPDF } from "jspdf";
import { FONT_FAMILIES, FontKey } from "./fonts";
import { RGB, hexToRgb, luminance, textOn, tint, toGray } from "./color";
import type { BadgeShape, Design, IconKey, PageNumberStyle, PatternKey } from "./types";
import { mulberry32 } from "../wordsearch/engine";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Look {
  design: Design;
  accent: RGB;
  /** Very light accent for fills. */
  soft: RGB;
  /** Accent dark enough for text on white. */
  ink: RGB;
  onAccent: RGB;
  muted: RGB;
  pattern: RGB;
  font: (k: FontKey) => string;
}

export function resolveLook(design: Design): Look {
  const raw = hexToRgb(design.color.accent);
  const accent = design.color.grayscale ? toGray(raw) : raw;
  const ink: RGB = luminance(accent) > 140 ? (accent.map((v) => Math.round(v * 0.45)) as RGB) : accent;
  const strength = Math.max(0, Math.min(1, design.pattern.strength));
  // Low-ink pattern colour: between 96% and 86% white.
  const patBase = design.color.grayscale ? ([150, 150, 150] as RGB) : accent;
  return {
    design,
    accent,
    soft: tint(accent, 0.86),
    ink,
    onAccent: textOn(accent),
    muted: [95, 95, 95],
    pattern: tint(patBase, 0.9 - strength * 0.12),
    font: (k) => FONT_FAMILIES[k].pdfName,
  };
}

const fill = (pdf: jsPDF, c: RGB) => pdf.setFillColor(c[0], c[1], c[2]);
const stroke = (pdf: jsPDF, c: RGB) => pdf.setDrawColor(c[0], c[1], c[2]);
const textColor = (pdf: jsPDF, c: RGB) => pdf.setTextColor(c[0], c[1], c[2]);
export const paint = { fill, stroke, textColor };

/** Closed polygon from absolute points. */
export function poly(pdf: jsPDF, pts: [number, number][], style: "S" | "F" | "FD") {
  const deltas: number[][] = [];
  for (let i = 1; i < pts.length; i++) deltas.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
  pdf.lines(deltas, pts[0][0], pts[0][1], [1, 1], style, true);
}

function isRings(pts: P2[] | P2[][]): pts is P2[][] {
  return Array.isArray(pts[0]?.[0]);
}

function asRings(pts: P2[] | P2[][]): P2[][] {
  return isRings(pts) ? pts : [pts];
}

function writeRings(pdf: jsPDF, rings: P2[][]) {
  for (const pts of rings) {
    if (pts.length < 2) continue;
    pdf.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) pdf.lineTo(pts[i][0], pts[i][1]);
    pdf.close();
  }
}

/** Fill or stroke one ring or a compound path (even-odd so holes stay empty). */
export function polys(pdf: jsPDF, pts: P2[] | P2[][], style: "S" | "F" | "FD") {
  const rings = asRings(pts).filter((r) => r.length >= 2);
  if (!rings.length) return;
  if (rings.length === 1) {
    poly(pdf, rings[0], style);
    return;
  }
  writeRings(pdf, rings);
  if (style === "F") pdf.fillEvenOdd();
  else if (style === "S") pdf.stroke();
  else pdf.fillStrokeEvenOdd();
}

function regular(cx: number, cy: number, r: number, n: number, rot = -Math.PI / 2): [number, number][] {
  return Array.from({ length: n }, (_, i) => [cx + r * Math.cos(rot + (i * 2 * Math.PI) / n), cy + r * Math.sin(rot + (i * 2 * Math.PI) / n)] as [number, number]);
}

function starPts(cx: number, cy: number, r: number, inner = 0.45): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * inner;
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return pts;
}

// ---------------------------------------------------------------- icons

/** Small line icons, drawn in `c` within a square of side `size` centred on (cx, cy). */
export function drawIcon(pdf: jsPDF, key: IconKey, cx: number, cy: number, size: number, c: RGB) {
  if (key === "none") return;
  const r = size / 2;
  stroke(pdf, c);
  fill(pdf, c);
  pdf.setLineWidth(Math.max(0.8, size * 0.08));
  pdf.setLineCap("round");
  switch (key) {
    case "magnifier":
      pdf.circle(cx - r * 0.18, cy - r * 0.18, r * 0.52, "S");
      pdf.setLineWidth(Math.max(1.2, size * 0.13));
      pdf.line(cx + r * 0.2, cy + r * 0.2, cx + r * 0.75, cy + r * 0.75);
      break;
    case "star":
      poly(pdf, starPts(cx, cy, r * 0.95), "F");
      break;
    case "heart": {
      const s = r * 0.9;
      pdf.circle(cx - s * 0.42, cy - s * 0.2, s * 0.45, "F");
      pdf.circle(cx + s * 0.42, cy - s * 0.2, s * 0.45, "F");
      poly(pdf, [[cx - s * 0.85, cy - s * 0.05], [cx + s * 0.85, cy - s * 0.05], [cx, cy + s * 0.85]], "F");
      break;
    }
    case "leaf":
      pdf.lines([[r * 0.9, -r * 0.2, r * 1.4, -r * 1.2, r * 1.5, -r * 1.5], [-r * 0.2, r * 0.1, -r * 1.2, r * 0.6, -r * 1.5, r * 1.5]], cx - r * 0.75, cy + r * 0.75, [1, 1], "F", true);
      stroke(pdf, [255, 255, 255]);
      pdf.setLineWidth(Math.max(0.5, size * 0.05));
      pdf.line(cx - r * 0.5, cy + r * 0.5, cx + r * 0.45, cy - r * 0.45);
      break;
    case "sun":
      pdf.circle(cx, cy, r * 0.42, "F");
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        pdf.line(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62, cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95);
      }
      break;
    case "snowflake":
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3 + Math.PI / 2;
        const dx = Math.cos(a) * r * 0.95;
        const dy = Math.sin(a) * r * 0.95;
        pdf.line(cx - dx, cy - dy, cx + dx, cy + dy);
        for (const sgn of [1, -1]) {
          const bx = cx + sgn * dx * 0.55;
          const by = cy + sgn * dy * 0.55;
          for (const t of [0.5, -0.5]) {
            const b = a + t * 1.6;
            pdf.line(bx, by, bx + sgn * Math.cos(b) * r * 0.3, by + sgn * Math.sin(b) * r * 0.3);
          }
        }
      }
      break;
    case "flower":
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        pdf.circle(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5, r * 0.36, "F");
      }
      fill(pdf, [255, 255, 255]);
      pdf.circle(cx, cy, r * 0.22, "F");
      break;
    case "pencil": {
      const a = -Math.PI / 4;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const px = -uy;
      const py = ux;
      const L = r * 1.6;
      const W = r * 0.32;
      const sx = cx - ux * L * 0.5;
      const sy = cy - uy * L * 0.5;
      const ex = sx + ux * L * 0.75;
      const ey = sy + uy * L * 0.75;
      poly(pdf, [[sx + px * W, sy + py * W], [ex + px * W, ey + py * W], [ex - px * W, ey - py * W], [sx - px * W, sy - py * W]], "F");
      poly(pdf, [[ex + px * W, ey + py * W], [sx + ux * L, sy + uy * L], [ex - px * W, ey - py * W]], "S");
      break;
    }
  }
  pdf.setLineCap("butt");
}

// ---------------------------------------------------------------- badge

export function drawBadge(pdf: jsPDF, shape: BadgeShape, cx: number, cy: number, r: number, bg: RGB, border: RGB, label: string, font: string, fg: RGB) {
  fill(pdf, bg);
  stroke(pdf, border);
  pdf.setLineWidth(Math.max(1, r * 0.12));
  if (shape === "circle") pdf.circle(cx, cy, r, "FD");
  else if (shape === "rounded") pdf.roundedRect(cx - r, cy - r, r * 2, r * 2, r * 0.45, r * 0.45, "FD");
  else if (shape === "diamond") poly(pdf, regular(cx, cy, r * 1.22, 4), "FD");
  else poly(pdf, regular(cx, cy, r * 1.1, 6, 0), "FD");
  pdf.setFont(font, "bold");
  const size = r * (label.length >= 4 ? 0.62 : label.length === 3 ? 0.78 : 0.95);
  pdf.setFontSize(size);
  textColor(pdf, fg);
  pdf.text(label, cx, cy + size * 0.02, { align: "center", baseline: "middle" });
}

// ---------------------------------------------------------------- patterns

/** Where a background pattern may print: the full page with bleed, else a safe inset. */
/**
 * Where the background pattern may go. With bleed it runs to the page edge. Without bleed KDP
 * wants everything inside the margins: at least 0.25" from the outside edges and the full gutter
 * (`gutter`, in points) on the spine side, so the area depends on the page side.
 */
export function patternArea(pageW: number, pageH: number, bleed: boolean, gutter = 18, side: "recto" | "verso" = "recto"): Box {
  if (bleed) return { x: 0, y: 0, w: pageW, h: pageH };
  // 0.25" plus a dot's reach, so no mark touches the minimum.
  const edge = 18 + 2;
  const spine = Math.max(gutter, 18) + 2;
  const left = side === "recto" ? spine : edge;
  const right = side === "recto" ? edge : spine;
  return { x: left, y: edge, w: pageW - left - right, h: pageH - edge * 2 };
}

/** Low-ink decorative background. Content panels are drawn on top in white. */
export function drawPattern(pdf: jsPDF, kind: PatternKey, area: Box, look: Look, seed = 7) {
  if (kind === "none") return;
  const c = look.pattern;
  const rng = mulberry32(seed);
  const { x, y, w, h } = area;
  stroke(pdf, c);
  fill(pdf, c);
  pdf.setLineWidth(0.6);
  switch (kind) {
    case "dots": {
      const step = 21;
      for (let yy = y + step / 2, row = 0; yy < y + h; yy += step, row++)
        for (let xx = x + (row % 2 ? step : step / 2); xx < x + w; xx += step) pdf.circle(xx, yy, 1.15, "F");
      break;
    }
    case "grid": {
      const step = 14;
      pdf.setLineWidth(0.35);
      for (let xx = x + step; xx < x + w; xx += step) pdf.line(xx, y, xx, y + h);
      for (let yy = y + step; yy < y + h; yy += step) pdf.line(x, yy, x + w, yy);
      break;
    }
    case "diagonal": {
      const step = 15;
      pdf.setLineWidth(0.45);
      for (let k = -h; k < w; k += step) {
        // line from (x+k, y+h) going up-right at 45°, clipped to the box
        let x1 = x + k;
        let y1 = y + h;
        let x2 = x + k + h;
        let y2 = y;
        if (x1 < x) {
          y1 -= x - x1;
          x1 = x;
        }
        if (x2 > x + w) {
          y2 += x2 - (x + w);
          x2 = x + w;
        }
        if (x2 > x1) pdf.line(x1, y1, x2, y2);
      }
      break;
    }
    case "waves": {
      const step = 30;
      const amp = 4;
      const seg = 24;
      pdf.setLineWidth(0.6);
      for (let yy = y + 12; yy < y + h; yy += step) {
        const segs: number[][] = [];
        for (let xx = 0; xx + seg <= w; xx += seg) segs.push([seg / 4, -amp, (seg * 3) / 4, amp, seg, 0]);
        pdf.lines(segs, x, yy, [1, 1], "S", false);
      }
      break;
    }
    case "confetti": {
      const n = Math.round((w * h) / 5200);
      // Marks reach up to 8pt from their centre; keep every one inside the area.
      const m = 8.5;
      for (let i = 0; i < n; i++) {
        const px = x + m + rng() * (w - 2 * m);
        const py = y + m + rng() * (h - 2 * m);
        const s = 2 + rng() * 3;
        const t = rng();
        if (t < 0.35) pdf.circle(px, py, s * 0.6, "F");
        else if (t < 0.65) poly(pdf, regular(px, py, s, 3, rng() * 6), "F");
        else {
          const a = rng() * Math.PI;
          pdf.setLineWidth(1.1);
          pdf.line(px, py, px + Math.cos(a) * s * 1.6, py + Math.sin(a) * s * 1.6);
        }
      }
      break;
    }
    case "snow": {
      const n = Math.round((w * h) / 9000);
      const m = 12;
      for (let i = 0; i < n; i++) {
        const px = x + m + rng() * (w - 2 * m);
        const py = y + m + rng() * (h - 2 * m);
        if (rng() < 0.4) drawIcon(pdf, "snowflake", px, py, 6 + rng() * 6, c);
        else pdf.circle(px, py, 0.8 + rng() * 1.2, "F");
      }
      break;
    }
    case "corners": {
      const r = Math.min(w, h) * 0.12;
      pdf.setLineWidth(1.2);
      const corners: [number, number, number, number][] = [
        [x, y, 1, 1],
        [x + w, y, -1, 1],
        [x, y + h, 1, -1],
        [x + w, y + h, -1, -1],
      ];
      for (const [cx, cy, sx, sy] of corners) {
        for (let k = 1; k <= 3; k++) {
          const rr = (r * k) / 3;
          // quarter arc as a bezier
          const kk = 0.5523 * rr;
          pdf.lines([[0, sy * kk, sx * (rr - kk), sy * rr, sx * rr, sy * rr]], cx, cy + 0 * sy, [1, 1], "S", false);
          pdf.lines([[sx * kk, 0, sx * rr, sy * (rr - kk), sx * rr, sy * rr]], cx, cy, [1, 1], "S", false);
        }
        pdf.circle(cx + sx * r * 1.25, cy + sy * r * 0.25, 2, "F");
        pdf.circle(cx + sx * r * 0.25, cy + sy * r * 1.25, 2, "F");
      }
      break;
    }
  }
}

/** White panel (optionally rounded) so text never sits on a pattern. */
export function panel(pdf: jsPDF, b: Box, look: Look, radius = 8) {
  if (look.design.pattern.kind === "none") return;
  fill(pdf, [255, 255, 255]);
  pdf.roundedRect(b.x, b.y, b.w, b.h, radius, radius, "F");
}

// ---------------------------------------------------------------- header

export interface HeaderInfo {
  text: string;
  /** Puzzle number shown in the badge. */
  number?: number;
  /** Puzzle title / theme. */
  subtitle?: string;
}

const titleCase = (t: string) => (t === t.toUpperCase() ? t.toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(To|Of|The|A|And)\b(?!$)/g, (w, _a, i) => (i === 0 ? w : w.toLowerCase())) : t);

/** Draw the page header and return the y where content may start. */
export function drawHeader(pdf: jsPDF, box: Box, look: Look, info: HeaderInfo, s: number): number {
  const d = look.design.header;
  const hf = look.font(look.design.fonts.heading);
  const text = info.text;
  const hasBadge = d.badge && info.number !== undefined;
  const label = info.number !== undefined ? String(info.number) : "";
  const sub = d.showPuzzleTitle && info.subtitle && info.subtitle.toUpperCase() !== text.toUpperCase() ? info.subtitle : "";
  const H = 34 * s;
  const x = box.x;
  const w = box.w;
  let y = box.y;
  const white: RGB = [255, 255, 255];
  const fit = (t: string, max: number, size: number) => {
    pdf.setFontSize(size);
    let sz = size;
    while (sz > 8 && pdf.getTextWidth(t) > max) pdf.setFontSize((sz -= 0.5));
    return sz;
  };
  pdf.setFont(hf, "bold");
  switch (d.style) {
    case "banner": {
      const r = H * 0.62;
      fill(pdf, look.accent);
      pdf.roundedRect(x + (hasBadge ? r * 0.7 : 0), y + (r - H / 2), w - (hasBadge ? r * 0.7 : 0) - (d.icon !== "none" ? r * 0.7 : 0), H, H / 2, H / 2, "F");
      textColor(pdf, look.onAccent);
      fit(text, w - r * 4.4, 19 * s);
      pdf.text(text, x + w / 2, y + r, { align: "center", baseline: "middle" });
      if (hasBadge) drawBadge(pdf, d.badgeShape, x + r, y + r, r, white, look.accent, label, hf, look.ink);
      if (d.icon !== "none") {
        fill(pdf, white);
        stroke(pdf, look.accent);
        pdf.setLineWidth(1.6);
        pdf.circle(x + w - r, y + r, r, "FD");
        drawIcon(pdf, d.icon, x + w - r, y + r, r * 1.05, look.ink);
      }
      y += r * 2 + 4 * s;
      break;
    }
    case "ribbon": {
      const top = y + 4 * s;
      // The tails' sharp corners would throw miter spikes past the margin: round the joins and inset by half the stroke.
      const x = box.x + 0.7;
      const w = box.w - 1.4;
      pdf.setLineJoin("round");
      const tail = 14 * s;
      fill(pdf, look.soft);
      stroke(pdf, look.accent);
      pdf.setLineWidth(1.4);
      poly(pdf, [[x, top + 4 * s], [x + tail * 1.6, top + 4 * s], [x + tail * 1.6, top + H + 4 * s], [x, top + H + 4 * s], [x + tail * 0.7, top + H / 2 + 4 * s]], "FD");
      poly(pdf, [[x + w, top + 4 * s], [x + w - tail * 1.6, top + 4 * s], [x + w - tail * 1.6, top + H + 4 * s], [x + w, top + H + 4 * s], [x + w - tail * 0.7, top + H / 2 + 4 * s]], "FD");
      pdf.setLineJoin("miter");
      fill(pdf, look.soft);
      pdf.roundedRect(x + tail, top, w - tail * 2, H, H * 0.35, H * 0.35, "FD");
      textColor(pdf, look.ink);
      fit(text, w - tail * 2 - 90 * s, 19 * s);
      pdf.text(text, x + w / 2, top + H / 2, { align: "center", baseline: "middle" });
      if (hasBadge) drawBadge(pdf, d.badgeShape, x + tail + H * 0.75, top + H / 2, H * 0.4, look.accent, look.accent, label, hf, look.onAccent);
      if (d.icon !== "none") drawIcon(pdf, d.icon, x + w - tail - H * 0.75, top + H / 2, H * 0.6, look.accent);
      y = top + H + 8 * s;
      break;
    }
    case "boxed": {
      fill(pdf, look.accent);
      pdf.rect(x, y, w, H, "F");
      textColor(pdf, look.onAccent);
      fit(text, w - 120 * s, 18 * s);
      pdf.text(text, x + 12 * s, y + H / 2, { baseline: "middle" });
      if (hasBadge) {
        fill(pdf, white);
        const bw = 70 * s;
        pdf.roundedRect(x + w - bw - 6 * s, y + 5 * s, bw, H - 10 * s, 4, 4, "F");
        textColor(pdf, look.ink);
        pdf.setFontSize(14 * s);
        pdf.text(`No. ${label}`, x + w - bw / 2 - 6 * s, y + H / 2, { align: "center", baseline: "middle" });
      } else if (d.icon !== "none") drawIcon(pdf, d.icon, x + w - H / 2, y + H / 2, H * 0.55, look.onAccent);
      y += H + 6 * s;
      break;
    }
    case "tab": {
      const tw = hasBadge ? 54 * s : 0;
      if (hasBadge) {
        fill(pdf, look.accent);
        pdf.roundedRect(x, y, tw, H, 7, 7, "F");
        textColor(pdf, look.onAccent);
        pdf.setFontSize(18 * s);
        pdf.text(label, x + tw / 2, y + H / 2, { align: "center", baseline: "middle" });
      }
      textColor(pdf, look.ink);
      fit(text, w - tw - 60 * s, 18 * s);
      pdf.text(text, x + tw + 12 * s, y + H / 2, { baseline: "middle" });
      stroke(pdf, look.accent);
      pdf.setLineWidth(2);
      pdf.line(x + tw + 12 * s, y + H - 1, x + w, y + H - 1);
      if (d.icon !== "none") drawIcon(pdf, d.icon, x + w - 12 * s, y + H / 2 - 2, 18 * s, look.accent);
      y += H + 6 * s;
      break;
    }
    case "underline": {
      const cy = y + H / 2;
      textColor(pdf, look.ink);
      const sz = fit(text, w - 160 * s, 20 * s);
      pdf.setFont(hf, "bold");
      pdf.setFontSize(sz);
      pdf.setCharSpace(1.2 * s);
      const tw = pdf.getTextWidth(text) + text.length * 1.2 * s;
      pdf.text(text, x + w / 2 - tw / 2, cy, { baseline: "middle" });
      pdf.setCharSpace(0);
      stroke(pdf, look.accent);
      fill(pdf, look.accent);
      pdf.setLineWidth(0.7);
      const gap = 14 * s;
      pdf.line(x, cy, x + w / 2 - tw / 2 - gap, cy);
      pdf.line(x + w / 2 + tw / 2 + gap, cy, x + w, cy);
      poly(pdf, regular(x + w / 2 - tw / 2 - gap / 2, cy, 2.6 * s, 4), "F");
      poly(pdf, regular(x + w / 2 + tw / 2 + gap / 2, cy, 2.6 * s, 4), "F");
      if (hasBadge) drawBadge(pdf, d.badgeShape, x + 14 * s, cy, 12 * s, white, look.accent, label, hf, look.ink);
      if (d.icon !== "none") drawIcon(pdf, d.icon, x + w - 12 * s, cy, 16 * s, look.accent);
      y += H + 2 * s;
      break;
    }
    case "casebook": {
      // A refined casebook header: small letter-spaced kicker, a hairline, then the title in the heading serif.
      const kick = sub ? text : "";
      const title = sub || titleCase(text);
      const ky = y + 5 * s;
      pdf.setFont(look.font("sans"), "bold");
      pdf.setFontSize(7.4 * s);
      pdf.setCharSpace(1.5 * s);
      textColor(pdf, look.ink);
      const kicker = [kick.toUpperCase(), info.number !== undefined ? `NO. ${String(info.number).padStart(2, "0")}` : ""].filter(Boolean).join(" · ");
      if (kicker) pdf.text(kicker, x, ky, { baseline: "middle" });
      pdf.setCharSpace(0);
      if (d.icon !== "none") drawIcon(pdf, d.icon, x + w - 5 * s, ky, 10 * s, look.accent);
      stroke(pdf, look.design.color.grayscale ? [200, 200, 200] : [224, 220, 213]);
      pdf.setLineWidth(0.6);
      pdf.line(x, y + 14 * s, x + w, y + 14 * s);
      pdf.setFont(hf, "bold");
      let size = 21 * s;
      pdf.setFontSize(size);
      let tl = pdf.splitTextToSize(title, w) as string[];
      while (tl.length > 1 && size > 15 * s) {
        pdf.setFontSize((size -= 1 * s));
        tl = pdf.splitTextToSize(title, w) as string[];
      }
      tl = tl.slice(0, 2);
      pdf.setTextColor(28, 28, 32);
      let ty = y + 14 * s + 10 * s + size * 0.78;
      tl.forEach((l, i) => pdf.text(l, x, ty + i * size * 1.15));
      ty += (tl.length - 1) * size * 1.15;
      stroke(pdf, look.accent);
      pdf.setLineWidth(1.3);
      pdf.line(x, ty + 9 * s, x + 26 * s, ty + 9 * s);
      pdf.setTextColor(0, 0, 0);
      y = ty + 9 * s + 12 * s;
      break;
    }
    case "minimal": {
      textColor(pdf, look.ink);
      pdf.setCharSpace(2 * s);
      fit(text, w - 140 * s, 13 * s);
      pdf.text(text, x, y + H * 0.62, { baseline: "middle" });
      pdf.setCharSpace(0);
      if (hasBadge) {
        pdf.setFontSize(26 * s);
        textColor(pdf, look.accent);
        pdf.text(`#${label}`, x + w, y + H * 0.55, { align: "right", baseline: "middle" });
      }
      if (d.icon !== "none") drawIcon(pdf, d.icon, x + w - (hasBadge ? 70 * s : 10 * s), y + H * 0.55, 15 * s, look.accent);
      stroke(pdf, [0, 0, 0]);
      pdf.setLineWidth(0.5);
      pdf.line(x, y + H + 2, x + w, y + H + 2);
      y += H + 8 * s;
      break;
    }
    default: {
      // rule
      let tx = x;
      if (hasBadge) {
        drawBadge(pdf, d.badgeShape, x + 13 * s, y + H / 2, 13 * s, look.accent, look.accent, label, hf, look.onAccent);
        tx += 34 * s;
      }
      textColor(pdf, [0, 0, 0]);
      fit(text, w - (tx - x) - 40 * s, 18 * s);
      pdf.setFont(hf, "bold");
      pdf.text(text, tx, y + H / 2, { baseline: "middle" });
      if (d.icon !== "none") drawIcon(pdf, d.icon, x + w - 10 * s, y + H / 2, 16 * s, look.accent);
      stroke(pdf, [0, 0, 0]);
      pdf.setLineWidth(0.9);
      pdf.line(x, y + H, x + w, y + H);
      y += H + 6 * s;
    }
  }
  if (sub && d.style !== "casebook") {
    pdf.setFont(look.font(look.design.fonts.list), "normal");
    pdf.setFontSize(11.5 * s);
    textColor(pdf, look.muted);
    pdf.text(sub, x + w / 2, y + 7 * s, { align: "center", baseline: "middle" });
    y += 18 * s;
  }
  textColor(pdf, [0, 0, 0]);
  return y + 4 * s;
}

// ---------------------------------------------------------------- page numbers

export function drawPageNumber(pdf: jsPDF, style: PageNumberStyle, n: number, cx: number, cy: number, look: Look, s: number) {
  if (style === "none") return;
  const f = look.font(look.design.fonts.list);
  pdf.setFont(f, "normal");
  pdf.setFontSize(10 * s);
  const label = String(n);
  if (style === "circle" || style === "pill") {
    const r = 9 * s;
    const w = style === "pill" ? Math.max(r * 2.6, pdf.getTextWidth(label) + r * 1.6) : r * 2;
    fill(pdf, style === "pill" ? look.soft : [255, 255, 255]);
    stroke(pdf, look.accent);
    pdf.setLineWidth(0.9);
    pdf.roundedRect(cx - w / 2, cy - r, w, r * 2, r, r, "FD");
    textColor(pdf, look.ink);
    pdf.text(label, cx, cy, { align: "center", baseline: "middle" });
  } else {
    textColor(pdf, [70, 70, 70]);
    pdf.text(style === "dashes" ? `— ${label} —` : label, cx, cy, { align: "center", baseline: "middle" });
  }
  textColor(pdf, [0, 0, 0]);
}

// ---------------------------------------------------------------- lists

export function drawCheckbox(pdf: jsPDF, x: number, y: number, size: number, checked = false) {
  stroke(pdf, [40, 40, 40]);
  pdf.setLineWidth(Math.max(0.5, size * 0.09));
  pdf.roundedRect(x, y, size, size, size * 0.18, size * 0.18, "S");
  if (checked) {
    pdf.setLineWidth(Math.max(0.8, size * 0.14));
    pdf.lines([[size * 0.25, size * 0.25], [size * 0.45, -size * 0.6]], x + size * 0.2, y + size * 0.5, [1, 1], "S", false);
  }
}

export interface ListLayout {
  columns: number;
  rows: number;
  fontSize: number;
  leading: number;
  height: number;
}

/** Choose columns and font size so `items` fit in `w`. */
export function layoutList(pdf: jsPDF, items: string[], w: number, font: string, baseSize: number, opts: { columns: number; checkbox: boolean; minSize?: number; maxRows?: number }): ListLayout {
  const minSize = opts.minSize ?? 7;
  let size = baseSize;
  for (;;) {
    pdf.setFont(font, "normal");
    pdf.setFontSize(size);
    const box = opts.checkbox ? size * 1.15 : 0;
    const longest = Math.max(10, ...items.map((t) => pdf.getTextWidth(t))) + box + size * 1.1;
    let columns = opts.columns > 0 ? opts.columns : Math.max(1, Math.min(6, Math.floor(w / longest)));
    if (opts.columns === 0 && items.length <= 8) columns = Math.min(columns, Math.max(1, Math.ceil(items.length / 3)));
    columns = Math.max(1, Math.min(columns, items.length || 1));
    const rows = Math.ceil(items.length / columns);
    const leading = size * 1.5;
    const fits = longest <= w / columns + 0.5;
    if ((fits && (!opts.maxRows || rows <= opts.maxRows)) || size <= minSize) return { columns, rows, fontSize: size, leading, height: rows * leading };
    size -= 0.5;
  }
}

/** Draw a column-major list, optionally with a checkbox before each item. Returns the height used. */
export function drawList(pdf: jsPDF, items: string[], x: number, y: number, w: number, font: string, layout: ListLayout, checkbox: boolean): number {
  const { columns, rows, fontSize, leading } = layout;
  const colW = w / columns;
  pdf.setFont(font, "normal");
  pdf.setFontSize(fontSize);
  textColor(pdf, [0, 0, 0]);
  const box = fontSize * 0.78;
  items.forEach((t, k) => {
    const col = Math.floor(k / rows);
    const row = k % rows;
    const tx = x + col * colW;
    const ty = y + row * leading + leading * 0.5;
    if (checkbox) {
      drawCheckbox(pdf, tx, ty - box * 0.55, box);
      pdf.text(t, tx + box + fontSize * 0.45, ty, { baseline: "middle" });
    } else pdf.text(t, tx, ty, { baseline: "middle" });
  });
  return rows * leading;
}

// ---------------------------------------------------------------- grids

export function sortList(items: string[], sort: "entered" | "alpha" | "length"): string[] {
  if (sort === "entered") return items.slice();
  const key = (s: string) => s.replace(/[\s-]/g, "");
  if (sort === "alpha") return items.slice().sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  return items.slice().sort((a, b) => key(a).length - key(b).length || a.localeCompare(b, "en", { sensitivity: "base" }));
}

/** Shading and inner lines for a rows×cols grid at (x, y). Lines are only drawn between two used cells. */
export function drawGridBody(pdf: jsPDF, x: number, y: number, cell: number, rows: number, cols: number, look: Look, isCell: (r: number, c: number) => boolean = () => true) {
  const g = look.design.grid;
  if (g.shade !== "none") {
    fill(pdf, look.design.color.grayscale ? [238, 238, 238] : tint(look.accent, 0.9));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const on = g.shade === "rows" ? r % 2 === 1 : (r + c) % 2 === 1;
        if (on && isCell(r, c)) pdf.rect(x + c * cell, y + r * cell, cell, cell, "F");
      }
  }
  if (g.lines) {
    stroke(pdf, [150, 150, 150]);
    pdf.setLineWidth(0.4);
    // Merge runs so a plain square grid is still one line per row/column.
    for (let c = 1; c < cols; c++) {
      let start = -1;
      for (let r = 0; r <= rows; r++) {
        const on = r < rows && isCell(r, c - 1) && isCell(r, c);
        if (on && start < 0) start = r;
        if (!on && start >= 0) {
          pdf.line(x + c * cell, y + start * cell, x + c * cell, y + r * cell);
          start = -1;
        }
      }
    }
    for (let r = 1; r < rows; r++) {
      let start = -1;
      for (let c = 0; c <= cols; c++) {
        const on = c < cols && isCell(r - 1, c) && isCell(r, c);
        if (on && start < 0) start = c;
        if (!on && start >= 0) {
          pdf.line(x + start * cell, y + r * cell, x + c * cell, y + r * cell);
          start = -1;
        }
      }
    }
  }
  drawCellMarks(pdf, x, y, cell, rows, cols, look, isCell);
}

/** Per-cell box / rounded box / circle behind each letter. */
export function drawCellMarks(pdf: jsPDF, x: number, y: number, cell: number, rows: number, cols: number, look: Look, isCell: (r: number, c: number) => boolean = () => true) {
  const style = look.design.grid.cells;
  if (style === "plain") return;
  if (style === "tiles") {
    fill(pdf, look.design.color.grayscale ? [240, 240, 240] : [244, 241, 236]);
    const ins = cell * 0.055;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) if (isCell(r, c)) pdf.roundedRect(x + c * cell + ins, y + r * cell + ins, cell - ins * 2, cell - ins * 2, cell * 0.16, cell * 0.16, "F");
    return;
  }
  stroke(pdf, [120, 120, 120]);
  pdf.setLineWidth(Math.max(0.35, Math.min(0.6, cell * 0.025)));
  const inset = cell * (style === "circles" ? 0.07 : 0.08);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (!isCell(r, c)) continue;
      const cx = x + c * cell;
      const cy = y + r * cell;
      if (style === "circles") pdf.circle(cx + cell / 2, cy + cell / 2, cell / 2 - inset, "S");
      else if (style === "rounded") pdf.roundedRect(cx + inset, cy + inset, cell - inset * 2, cell - inset * 2, cell * 0.2, cell * 0.2, "S");
      else pdf.rect(cx + inset, cy + inset, cell - inset * 2, cell - inset * 2, "S");
    }
}

type P2 = [number, number];

/** Polygon with every corner rounded by radius `r` (curves already finely sampled are left alone). */
export function filletPolygon(pts: P2[], r: number): P2[] {
  if (pts.length > 40 || r <= 0) return pts;
  const out: P2[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]);
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    // Repeated points (some silhouettes, e.g. boat / airplane) have no corner to round.
    if (la < 1e-6 || lb < 1e-6) {
      out.push(p);
      continue;
    }
    const rr = Math.min(r, la * 0.45, lb * 0.45);
    const p1: P2 = [p[0] + ((a[0] - p[0]) / la) * rr, p[1] + ((a[1] - p[1]) / la) * rr];
    const p2: P2 = [p[0] + ((b[0] - p[0]) / lb) * rr, p[1] + ((b[1] - p[1]) / lb) * rr];
    // Quadratic Bézier p1 → p (control) → p2, sampled.
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      const u = 1 - t;
      out.push([u * u * p1[0] + 2 * u * t * p[0] + t * t * p2[0], u * u * p1[1] + 2 * u * t * p[1] + t * t * p2[1]]);
    }
  }
  return out.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
}

function signedArea(pts: P2[]): number {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] - pts[i][0]) * (pts[j][1] + pts[i][1]);
  return a / 2;
}

/** Push every edge outward by `d` (miter joins, clamped so sharp inner corners don't spike). */
export function offsetPolygon(pts: P2[], d: number): P2[] {
  const n = pts.length;
  const sgn = signedArea(pts) > 0 ? 1 : -1;
  const normal = (a: P2, b: P2): P2 => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [(dy / l) * sgn, (-dx / l) * sgn];
  };
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    const n1 = normal(a, p);
    const n2 = normal(p, b);
    let mx = n1[0] + n2[0];
    let my = n1[1] + n2[1];
    const ml = Math.hypot(mx, my);
    if (ml < 1e-6) return [p[0] + n1[0] * d, p[1] + n1[1] * d] as P2;
    mx /= ml;
    my /= ml;
    const cos = mx * n1[0] + my * n1[1];
    const len = Math.min(d / Math.max(cos, 0.2), d * 2);
    return [p[0] + mx * len, p[1] + my * len] as P2;
  });
}

function withLineStyle(pdf: jsPDF, look: Look, width: number, draw: () => void) {
  const line = look.design.grid.line;
  if (line === "dashed") pdf.setLineDashPattern([Math.max(3, width * 3), Math.max(2, width * 2)], 0);
  if (line === "dotted") {
    pdf.setLineCap("round");
    pdf.setLineDashPattern([0.01, Math.max(2.4, width * 2.4)], 0);
  }
  draw();
  if (line !== "solid") {
    pdf.setLineDashPattern([], 0);
    pdf.setLineCap("butt");
  }
}

/** The outline a frame style gives a polygon (rounded corners applied). */
export function framePolygon(pts: P2[], look: Look, unit: number): P2[] {
  return look.design.grid.border === "rounded" ? filletPolygon(pts, Math.min(unit * 0.9, 16)) : pts;
}

/** Soft shadow and optional shaded (or white) backing under a shaped grid (drawn before the letters). */
function isSteppedLook(look: Look) {
  return look.design.shape.outline === "stepped";
}

function steppedStroke(look: Look): RGB {
  const raw = hexToRgb(look.design.shape.outlineColor || "#e67a2e");
  return look.design.color.grayscale ? toGray(raw) : raw;
}

export function drawOutlineBacking(pdf: jsPDF, pts: P2[] | P2[][], look: Look, unit: number) {
  const g = look.design.grid;
  const stepped = isSteppedLook(look);
  // Stepped outlines stay sharp; never fillet the stairs into a curve.
  const rings = asRings(pts).map((r) => (stepped ? r : framePolygon(r, look, unit)));
  if (g.shadow && g.border !== "none") {
    const o = Math.max(2.5, unit * 0.22);
    fill(pdf, [205, 205, 205]);
    polys(pdf, rings.map((r) => r.map(([x, y]) => [x + o, y + o] as P2)), "F");
  }
  // The stepped style is outline-only (no grey fill). A white knockout is
  // still used when a shadow or pattern would otherwise show through.
  if (look.design.shape.shade && !stepped) {
    fill(pdf, look.design.color.grayscale ? [226, 226, 226] : tint(look.accent, 0.9));
    polys(pdf, rings, "F");
  } else if (g.shadow || look.design.pattern.kind !== "none") {
    fill(pdf, [255, 255, 255]);
    polys(pdf, rings, "F");
  }
}

/** Outline of any shape in the design's frame style (thickness, double, dashed, dotted, rounded). */
export function drawOutline(pdf: jsPDF, pts: P2[] | P2[][], look: Look, unit: number) {
  const g = look.design.grid;
  const stepped = isSteppedLook(look);
  // The stepped cell-edge stroke is the shape outline itself; it still draws
  // when the frame picker is set to "No outline".
  if (!stepped && (g.border === "none" || g.frame <= 0)) return;
  const rings = asRings(pts).map((r) => (stepped ? r : framePolygon(r, look, unit)));
  if (stepped) {
    const width = Math.max(0.9, Math.min(1.45, unit * 0.12));
    stroke(pdf, steppedStroke(look));
    pdf.setLineWidth(width);
    pdf.setLineJoin("miter");
    pdf.setLineMiterLimit(2.5);
    pdf.setLineCap("butt");
    pdf.setLineDashPattern([], 0);
    polys(pdf, rings, "S");
    pdf.setLineJoin("round");
    pdf.setLineCap("butt");
    return;
  }
  stroke(pdf, [0, 0, 0]);
  pdf.setLineWidth(g.frame);
  pdf.setLineJoin("round");
  withLineStyle(pdf, look, g.frame, () => {
    polys(pdf, rings, "S");
    if (g.border === "double") {
      pdf.setLineWidth(Math.max(0.4, g.frame * 0.6));
      polys(pdf, rings.map((r) => offsetPolygon(r, Math.max(2.5, g.frame * 2.5))), "S");
    }
  });
}

/** Outer frame in the design's border style around box `b`. */
export function drawFrame(pdf: jsPDF, b: Box, look: Look, unit: number) {
  const g = look.design.grid;
  if (g.border === "none" || g.frame <= 0) return;
  const r = Math.min(unit * 0.45, 12);
  stroke(pdf, [0, 0, 0]);
  pdf.setLineWidth(g.frame);
  withLineStyle(pdf, look, g.frame, () => {
    if (g.border === "rounded") {
      pdf.roundedRect(b.x, b.y, b.w, b.h, r, r, "S");
    } else if (g.border === "double") {
      pdf.rect(b.x, b.y, b.w, b.h, "S");
      pdf.setLineWidth(Math.max(0.4, g.frame * 0.6));
      const o = Math.max(2.5, g.frame * 2.5);
      pdf.rect(b.x - o, b.y - o, b.w + o * 2, b.h + o * 2, "S");
    } else pdf.rect(b.x, b.y, b.w, b.h, "S");
  });
}

/** Shadow under a rectangular frame must sit below the grid: call before drawing cells. */
export function drawFrameShadow(pdf: jsPDF, b: Box, look: Look, unit: number) {
  const g = look.design.grid;
  if (!g.shadow || g.border === "none" || g.frame <= 0) return;
  const r = Math.min(unit * 0.45, 12);
  const o = Math.max(2.5, unit * 0.18);
  fill(pdf, [205, 205, 205]);
  if (g.border === "rounded") pdf.roundedRect(b.x + o, b.y + o, b.w, b.h, r, r, "F");
  else pdf.rect(b.x + o, b.y + o, b.w, b.h, "F");
  fill(pdf, [255, 255, 255]);
  if (g.border === "rounded") pdf.roundedRect(b.x, b.y, b.w, b.h, r, r, "F");
  else pdf.rect(b.x, b.y, b.w, b.h, "F");
}

/** Box around the word list / clues in the design's list-box style. */
export function drawListBox(pdf: jsPDF, b: Box, look: Look) {
  const style = look.design.list.box;
  if (style === "none") return;
  stroke(pdf, look.design.color.grayscale ? [60, 60, 60] : look.ink);
  pdf.setLineWidth(1);
  if (style === "solid") pdf.rect(b.x, b.y, b.w, b.h, "S");
  else if (style === "rounded") pdf.roundedRect(b.x, b.y, b.w, b.h, 9, 9, "S");
  else if (style === "dashed") {
    pdf.setLineWidth(1.1);
    pdf.setLineDashPattern([4, 3], 0);
    pdf.roundedRect(b.x, b.y, b.w, b.h, 11, 11, "S");
    pdf.setLineDashPattern([], 0);
  } else {
    pdf.rect(b.x, b.y, b.w, b.h, "S");
    pdf.setLineWidth(0.6);
    pdf.rect(b.x + 2.6, b.y + 2.6, b.w - 5.2, b.h - 5.2, "S");
  }
}

/** Room a list box needs around its content, per side. */
export const listBoxPad = (look: Look) => (look.design.list.box === "none" ? 0 : look.design.list.box === "double" ? 9 : 7);

export function drawArrow(pdf: jsPDF, x1: number, y1: number, x2: number, y2: number, c: RGB, width = 1.4) {
  stroke(pdf, c);
  fill(pdf, c);
  pdf.setLineWidth(width);
  const a = Math.atan2(y2 - y1, x2 - x1);
  const head = width * 4;
  const bx = x2 - Math.cos(a) * head;
  const by = y2 - Math.sin(a) * head;
  pdf.line(x1, y1, bx, by);
  poly(pdf, [[x2, y2], [bx + Math.cos(a + Math.PI / 2) * head * 0.55, by + Math.sin(a + Math.PI / 2) * head * 0.55], [bx - Math.cos(a + Math.PI / 2) * head * 0.55, by - Math.sin(a + Math.PI / 2) * head * 0.55]], "F");
}
