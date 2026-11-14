/** Page estimates, KDP limits and automatic volume splitting. */
import { LIMITS } from "../limits";
import { BookExtras, PlanInput, planKinds } from "./book";
import type { FrontMatter } from "./frontMatter";

export interface ToolLayout {
  /** Items (puzzles) on each puzzle page. */
  perPage: number;
  /** Items on each solutions page. */
  answersPerPage: number;
  /** Extra TOC sections (e.g. themes); "Puzzles" and "Solutions" are always listed. */
  sectionCount?: number;
  hasHowTo?: boolean;
}

export function contentPagesFor(items: number, layout: ToolLayout): number {
  if (items <= 0) return 0;
  return Math.ceil(items / Math.max(1, layout.perPage)) + Math.ceil(items / Math.max(1, layout.answersPerPage));
}

export interface EstimateInput {
  items: number;
  layout: ToolLayout;
  frontMatter: FrontMatter | null;
  extras: BookExtras;
  padForKdp?: boolean;
}

export function estimatePages(input: EstimateInput): number {
  if (input.items <= 0) return 0;
  const plan: PlanInput = {
    frontMatter: input.frontMatter,
    extras: input.extras,
    contentCount: contentPagesFor(input.items, input.layout),
    sectionCount: (input.layout.sectionCount ?? 0) + 2,
    hasHowTo: input.layout.hasHowTo ?? true,
    padForKdp: input.padForKdp,
  };
  return planKinds(plan).length;
}

export interface VolumePlan {
  /** [start, end) item ranges, one per volume. */
  ranges: [number, number][];
  /** Estimated pages per volume. */
  pages: number[];
  maxItemsPerVolume: number;
}

/**
 * Split `total` items into the fewest volumes that each stay within `maxPages`,
 * with volumes of near-equal size. `pagesFor(n)` = pages of a book with n items.
 */
export function planVolumes(total: number, pagesFor: (n: number) => number, maxPages: number = LIMITS.kdpMaxPages): VolumePlan {
  if (total <= 0) return { ranges: [], pages: [], maxItemsPerVolume: 0 };
  let lo = 1;
  let hi = total;
  if (pagesFor(1) > maxPages) throw new Error("Even one puzzle doesn't fit within the page limit.");
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (pagesFor(mid) <= maxPages) lo = mid;
    else hi = mid - 1;
  }
  const maxItems = lo;
  const volumes = Math.ceil(total / maxItems);
  const per = Math.ceil(total / volumes);
  const ranges: [number, number][] = [];
  for (let i = 0; i < total; i += per) ranges.push([i, Math.min(total, i + per)]);
  return { ranges, pages: ranges.map(([a, b]) => pagesFor(b - a)), maxItemsPerVolume: maxItems };
}
