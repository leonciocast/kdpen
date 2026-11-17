/** KDP paperback trim sizes, bleed and margin rules (mirrors /workspace/wordsearch/kdp.py). */

export type TrimKey = "6x9" | "8.5x11" | "8.27x11.69";

export const TRIM_SIZES: Record<TrimKey, { width: number; height: number; label: string }> = {
  "6x9": { width: 6, height: 9, label: '6" × 9"' },
  "8.5x11": { width: 8.5, height: 11, label: '8.5" × 11" (large print)' },
  "8.27x11.69": { width: 8.27, height: 11.69, label: '8.27" × 11.69" (A4)' },
};

/** Bleed adds 0.125" to the width (outside edge) and 0.25" to the height. */
export const BLEED_WIDTH_IN = 0.125;
export const BLEED_HEIGHT_IN = 0.25;
export const BLEED_PER_EDGE_IN = 0.125;

export const GUTTER_BY_PAGES: [number, number, number][] = [
  [24, 150, 0.375],
  [151, 300, 0.5],
  [301, 500, 0.625],
  [501, 700, 0.75],
  [701, 828, 0.875],
];

export const OUTSIDE_MIN_IN = 0.25;
export const OUTSIDE_MIN_BLEED_IN = 0.375;
export const DEFAULT_OUTSIDE_IN = 0.5;
export const DEFAULT_TOP_IN = 0.625;
export const DEFAULT_BOTTOM_IN = 0.7;
export const KDP_MIN_PAGES = 24;
export const KDP_MAX_PAGES = 828;
export const PT = 72;

export interface PageSpec {
  trim: TrimKey;
  bleed: boolean;
  pageWidth: number; // inches, including bleed
  pageHeight: number;
  inside: number;
  outside: number;
  top: number;
  bottom: number;
  pageCount: number;
}

export function insideMargin(pageCount: number): number {
  if (pageCount < KDP_MIN_PAGES) return GUTTER_BY_PAGES[0][2];
  for (const [lo, hi, m] of GUTTER_BY_PAGES) if (pageCount >= lo && pageCount <= hi) return m;
  throw new Error(`Page count ${pageCount} exceeds KDP's maximum of ${KDP_MAX_PAGES}`);
}

export function outsideMargin(bleed: boolean, requested?: number): number {
  const min = bleed ? OUTSIDE_MIN_BLEED_IN : OUTSIDE_MIN_IN;
  const value = requested ?? DEFAULT_OUTSIDE_IN;
  if (value + 1e-9 < min) throw new Error(`Outside margin ${value}" is below the KDP minimum of ${min}"`);
  return value;
}

/** Even, and at least 24 pages. */
export function paddedPageCount(count: number): number {
  let n = Math.max(count, KDP_MIN_PAGES);
  if (n % 2 === 1) n++;
  if (n > KDP_MAX_PAGES) throw new Error(`Book would have ${n} pages; KDP allows at most ${KDP_MAX_PAGES}`);
  return n;
}

export function makePageSpec(trim: TrimKey, pageCount: number, bleed: boolean, outside?: number): PageSpec {
  const t = TRIM_SIZES[trim];
  if (!t) throw new Error(`Unknown trim size ${trim}`);
  const extra = bleed ? BLEED_PER_EDGE_IN : 0;
  return {
    trim,
    bleed,
    pageWidth: t.width + (bleed ? BLEED_WIDTH_IN : 0),
    pageHeight: t.height + (bleed ? BLEED_HEIGHT_IN : 0),
    inside: insideMargin(pageCount),
    outside: outsideMargin(bleed, outside),
    top: DEFAULT_TOP_IN + extra,
    bottom: DEFAULT_BOTTOM_IN + extra,
    pageCount,
  };
}

/** Margins for a 1-based page. Odd pages are rectos: gutter on the left. */
export function marginsForPage(spec: PageSpec, page: number): { left: number; right: number; top: number; bottom: number } {
  const odd = page % 2 === 1;
  return {
    left: odd ? spec.inside : spec.outside,
    right: odd ? spec.outside : spec.inside,
    top: spec.top,
    bottom: spec.bottom,
  };
}

/**
 * Points kept clear inside the left and right margins. Frames, cards and badges are stroked on the
 * edge of the content box and half of each stroke lands outside it, so without this the ink would
 * sit a hair past KDP's minimum gutter (0.375" for short books).
 */
export const STROKE_SAFETY_PT = 1.5;

/** Content box in points, origin top-left (jsPDF convention). */
export function contentBox(spec: PageSpec, page: number): { x: number; y: number; w: number; h: number } {
  const m = marginsForPage(spec, page);
  return {
    x: m.left * PT + STROKE_SAFETY_PT,
    y: m.top * PT,
    w: (spec.pageWidth - m.left - m.right) * PT - 2 * STROKE_SAFETY_PT,
    h: (spec.pageHeight - m.top - m.bottom) * PT,
  };
}
