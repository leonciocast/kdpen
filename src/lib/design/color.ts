export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return [79, 70, 229];
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex([r, g, b]: RGB): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}

/** Perceived lightness 0-255 (Rec. 601), used for the grayscale-safe mode. */
export function luminance([r, g, b]: RGB): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function toGray(c: RGB): RGB {
  const l = Math.round(luminance(c));
  return [l, l, l];
}

/** Mix a colour with white: t=0 colour, t=1 white. */
export function tint(c: RGB, t: number): RGB {
  return c.map((v) => Math.round(v + (255 - v) * t)) as RGB;
}

/** Black or white text, whichever reads better on `bg`. */
export function textOn(bg: RGB): RGB {
  return luminance(bg) > 150 ? [0, 0, 0] : [255, 255, 255];
}

export function isHexColor(s: unknown): s is string {
  return typeof s === "string" && /^#[0-9a-f]{6}$/i.test(s);
}
