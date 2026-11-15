/**
 * Page arrangement: the user's custom page order for a book.
 *
 * A book is a list of "slots" (one per page the user can see and move). Puzzle
 * slots point at a group of items (the puzzles printed on that page); solution
 * slots are derived: the k-th solution slot always prints the k-th solutions
 * page, so answers follow the puzzle order and numbering automatically.
 * Automatic filler pages (to reach an even / KDP page count) are added after
 * the slots and never stored.
 *
 * Everything here is pure so the preview, the build worker and the tests all
 * agree on exactly the same page order.
 */
import type { FrontMatter } from "./frontMatter";
import { KDP_MAX_PAGES, KDP_MIN_PAGES, insideMargin } from "./kdp";

/** Same as book.ts PageKind (duplicated here to avoid an import cycle). */
export type BookPageKind = "title" | "copyright" | "belongs" | "dedication" | "toc" | "intro" | "howto" | "content" | "notes" | "thanks" | "blank";
export type SlotKind = Exclude<BookPageKind, "content"> | "puzzle" | "solution";

export interface Slot {
  id: string;
  kind: SlotKind;
  /** Puzzle slots: index of the original puzzle page (group of items). */
  ref?: number;
}

export type SectionKey = "front" | "puzzles" | "solutions" | "back";

export const TOC_LINES_PER_PAGE = 26;

export interface PlanExtras {
  belongsTo: boolean;
  howTo: boolean;
  toc: boolean;
  intro: string;
  thankYou: boolean;
  notesPages: number;
  padWithNotes: boolean;
}

export interface PlanInput {
  frontMatter: FrontMatter | null;
  extras: PlanExtras;
  contentCount: number;
  sectionCount: number;
  hasHowTo: boolean;
  padForKdp?: boolean;
}

export function tocEntryCount(p: PlanInput): number {
  const e = p.extras;
  return (e.intro.trim() ? 1 : 0) + (e.howTo && p.hasHowTo ? 1 : 0) + p.sectionCount + (e.notesPages > 0 ? 1 : 0);
}

/** The page order before automatic padding ("content" = puzzle and solution pages). */
export function coreKinds(p: PlanInput): BookPageKind[] {
  const e = p.extras;
  const kinds: BookPageKind[] = [];
  if (p.frontMatter) kinds.push("title", "copyright");
  if (e.belongsTo) kinds.push("belongs");
  if (p.frontMatter?.dedication.trim()) kinds.push("dedication");
  if (e.toc) for (let i = 0; i < Math.max(1, Math.ceil(tocEntryCount(p) / TOC_LINES_PER_PAGE)); i++) kinds.push("toc");
  if (e.intro.trim()) kinds.push("intro");
  if (e.howTo && p.hasHowTo) kinds.push("howto");
  for (let i = 0; i < p.contentCount; i++) kinds.push("content");
  for (let i = 0; i < Math.max(0, Math.floor(e.notesPages)); i++) kinds.push("notes");
  if (e.thankYou) kinds.push("thanks");
  return kinds;
}

/** Number of automatic filler pages for a book of `total` arranged pages. */
export function fillerCount(total: number, padForKdp?: boolean): number {
  const target = padForKdp === false ? total + (total % 2) : Math.max(KDP_MIN_PAGES, total + (total % 2));
  return target - total;
}

export interface Padded<T> {
  /** Final pages; `filler` marks automatic padding. */
  pages: { item: T | null; kind: BookPageKind; filler: boolean }[];
}

/**
 * Add the automatic filler pages: lined notes go before a closing thank-you
 * page, empty pages go at the very end (same rule as the original planner).
 */
export function pad<T>(items: { item: T; kind: BookPageKind }[], extras: { padWithNotes: boolean }, padForKdp?: boolean): Padded<T>["pages"] {
  const n = fillerCount(items.length, padForKdp);
  const out: Padded<T>["pages"] = items.map((x) => ({ ...x, filler: false }));
  if (!n) return out;
  const fillKind: BookPageKind = extras.padWithNotes ? "notes" : "blank";
  const filler = Array.from({ length: n }, () => ({ item: null, kind: fillKind, filler: true }));
  let at = out.length;
  if (fillKind === "notes") while (at > 0 && out[at - 1].kind === "thanks") at--;
  out.splice(at, 0, ...filler);
  return out;
}

// ---------------------------------------------------------------- slots

export interface ContentShape {
  /** Number of items (puzzles) in the book. */
  items: number;
  /** Items per puzzle page. */
  perPage: number;
  /** Items per solutions page. */
  answersPerPage: number;
}

export function puzzlePageCount(s: ContentShape, items = s.items): number {
  return Math.ceil(items / Math.max(1, s.perPage));
}
export function solutionPageCount(s: ContentShape, items = s.items): number {
  return Math.ceil(items / Math.max(1, s.answersPerPage));
}

/** The original (unarranged) slots of a book. */
export function defaultSlots(p: Omit<PlanInput, "contentCount">, shape: ContentShape): Slot[] {
  const puzzles = puzzlePageCount(shape);
  const solutions = solutionPageCount(shape);
  const kinds = coreKinds({ ...p, contentCount: puzzles + solutions });
  const counters: Record<string, number> = {};
  let content = 0;
  return kinds.map((k) => {
    let kind: SlotKind;
    if (k === "content") kind = content++ < puzzles ? "puzzle" : "solution";
    else kind = k;
    const n = (counters[kind] = (counters[kind] ?? -1) + 1);
    return kind === "puzzle" ? { id: `puzzle-${n}`, kind, ref: n } : { id: `${kind}-${n}`, kind };
  });
}

/** A short signature of the book's page structure; an arrangement is only valid for the same signature. */
export function arrangementSignature(slots: Slot[], shape: ContentShape): string {
  const counts: Record<string, number> = {};
  for (const s of slots) counts[s.kind] = (counts[s.kind] ?? 0) + 1;
  return JSON.stringify([counts, shape.items, shape.perPage, shape.answersPerPage]);
}

export interface Resolved {
  /** Slots with solution pages reconciled to the remaining puzzles. */
  slots: Slot[];
  /** Original item indices in the arranged order (deleted puzzles are left out). */
  itemOrder: number[];
  /** Items on each puzzle page, in order. */
  puzzlePageSizes: number[];
}

/** Turn slots into the item order the content builder should use. */
export function resolveSlots(input: Slot[], shape: ContentShape): Resolved {
  const per = Math.max(1, shape.perPage);
  const groups = puzzlePageCount(shape);
  const seen = new Set<number>();
  const itemOrder: number[] = [];
  const puzzlePageSizes: number[] = [];
  let slots: Slot[] = [];
  for (const s of input) {
    if (s.kind === "puzzle") {
      const g = s.ref ?? -1;
      if (g < 0 || g >= groups || seen.has(g)) continue; // stale or duplicated puzzle page
      seen.add(g);
      const from = g * per;
      const to = Math.min(shape.items, from + per);
      for (let i = from; i < to; i++) itemOrder.push(i);
      puzzlePageSizes.push(to - from);
    }
    slots.push(s);
  }
  // Solutions follow the remaining puzzles: keep the first N solution pages, add or drop the rest.
  const need = solutionPageCount(shape, itemOrder.length);
  let have = 0;
  slots = slots.filter((s) => s.kind !== "solution" || have++ < need);
  if (have < need) {
    let at = -1;
    slots.forEach((s, i) => {
      if (s.kind === "solution" || s.kind === "puzzle") at = i;
    });
    const used = new Set(slots.map((s) => s.id));
    const add: Slot[] = [];
    for (let k = 0; have + add.length < need; k++) if (!used.has(`solution-${k}`)) add.push({ id: `solution-${k}`, kind: "solution" });
    slots.splice(at + 1, 0, ...add);
  }
  return { slots, itemOrder, puzzlePageSizes };
}

// ---------------------------------------------------------------- page descriptions

export interface PageInfo {
  /** Stable key: the slot id, or `filler-N` for automatic padding. */
  key: string;
  slot: Slot | null;
  kind: SlotKind;
  filler: boolean;
  section: SectionKey;
  label: string;
  /** 1-based page position (= printed page number when `numbered`). */
  page: number;
  numbered: boolean;
  /** Puzzle numbers printed on this page (puzzle and solution pages). */
  numbers?: [number, number];
}

const NUMBERED = new Set<SlotKind>(["toc", "intro", "howto", "puzzle", "solution", "notes"]);

const KIND_LABEL: Record<SlotKind, string> = {
  title: "Title page",
  copyright: "Copyright",
  belongs: "This book belongs to",
  dedication: "Dedication",
  toc: "Contents",
  intro: "Introduction",
  howto: "How to play",
  puzzle: "Puzzle",
  solution: "Solutions",
  notes: "Notes",
  thanks: "Thank you",
  blank: "Blank page",
};

export function sectionOf(kind: SlotKind): SectionKey {
  if (kind === "puzzle") return "puzzles";
  if (kind === "solution") return "solutions";
  if (kind === "notes" || kind === "thanks" || kind === "blank") return "back";
  return "front";
}

const range = (a: number, b: number) => (a === b ? `${a}` : `${a}–${b}`);

/** Every final page of the book, in order, with labels and printed numbers. */
export interface PageNaming {
  /** Replace the default label of a page kind (e.g. "How to solve"). */
  labels?: Partial<Record<SlotKind, string>>;
  /** Name for a one-item puzzle page, by the item's original index (0-based). */
  itemName?: (item: number) => string | undefined;
}

export function describePages(input: Slot[], shape: ContentShape, extras: { padWithNotes: boolean }, padForKdp?: boolean, unit = "Puzzle", naming: PageNaming = {}): { pages: PageInfo[]; resolved: Resolved } {
  const resolved = resolveSlots(input, shape);
  const padded = pad(resolved.slots.map((s) => ({ item: s, kind: (s.kind === "puzzle" || s.kind === "solution" ? "content" : s.kind) as BookPageKind })), extras, padForKdp);
  let puzzleIdx = 0;
  let solIdx = 0;
  let itemNo = 0;
  let fillerNo = 0;
  const total = resolved.itemOrder.length;
  const ans = Math.max(1, shape.answersPerPage);
  const pages = padded.map((p, i): PageInfo => {
    const slot = p.item;
    const kind: SlotKind = slot ? slot.kind : (p.kind as SlotKind);
    const info: PageInfo = { key: slot ? slot.id : `filler-${fillerNo++}`, slot, kind, filler: p.filler, section: sectionOf(kind), label: naming.labels?.[kind] ?? KIND_LABEL[kind], page: i + 1, numbered: NUMBERED.has(kind) };
    if (kind === "puzzle") {
      const size = resolved.puzzlePageSizes[puzzleIdx++] ?? 1;
      info.numbers = [itemNo + 1, itemNo + size];
      itemNo += size;
      const named = size === 1 && slot?.ref !== undefined ? naming.itemName?.(slot.ref) : undefined;
      info.label = named ?? (size > 1 ? `${unit}s ${range(itemNo - size + 1, itemNo)}` : `${unit} ${itemNo}`);
    } else if (kind === "solution") {
      const a = solIdx * ans + 1;
      const b = Math.min(total, (solIdx + 1) * ans);
      solIdx++;
      info.numbers = [a, b];
      info.label = `Answers ${range(a, b)}`;
    } else if (p.filler) info.label = kind === "notes" ? "Notes (auto)" : "Blank (auto)";
    return info;
  });
  return { pages, resolved };
}

// ---------------------------------------------------------------- editing helpers

/** Move the slots with `ids` so they land before the slot at `before` (index in `slots`; slots.length = end). */
export function moveSlots(slots: Slot[], ids: string[], before: number): Slot[] {
  const set = new Set(ids);
  const moving = slots.filter((s) => set.has(s.id));
  if (!moving.length) return slots;
  let at = 0;
  for (let i = 0; i < Math.min(before, slots.length); i++) if (!set.has(slots[i].id)) at++;
  const rest = slots.filter((s) => !set.has(s.id));
  rest.splice(at, 0, ...moving);
  return rest;
}

/** Move selected slots one step up (-1) or down (+1), keeping their relative order. */
export function nudgeSlots(slots: Slot[], ids: string[], dir: -1 | 1): Slot[] {
  const set = new Set(ids);
  const out = slots.slice();
  const order = dir < 0 ? out.map((_, i) => i) : out.map((_, i) => out.length - 1 - i);
  for (const i of order) {
    const j = i + dir;
    if (!set.has(out[i].id) || j < 0 || j >= out.length || set.has(out[j].id)) continue;
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

let uid = 0;
export function newSlotId(kind: SlotKind): string {
  uid++;
  return `${kind}-x${Date.now().toString(36)}${uid}`;
}

export const DUPLICABLE = new Set<SlotKind>(["belongs", "intro", "howto", "notes", "blank", "thanks", "dedication"]);
export const DELETABLE = (k: SlotKind) => k !== "solution";

/** Reorder puzzle slots in place (their positions in the book stay the same). */
export function reorderPuzzles(slots: Slot[], order: (refs: number[]) => number[]): Slot[] {
  const refs = slots.filter((s) => s.kind === "puzzle").map((s) => s.ref ?? 0);
  const next = order(refs);
  const byRef = new Map(slots.filter((s) => s.kind === "puzzle").map((s) => [s.ref ?? 0, s]));
  let k = 0;
  return slots.map((s) => (s.kind === "puzzle" ? byRef.get(next[k++])! : s));
}

export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  let t = seed >>> 0 || 1;
  const rnd = () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function isDefaultOrder(slots: Slot[], defaults: Slot[]): boolean {
  return slots.length === defaults.length && slots.every((s, i) => s.id === defaults[i].id);
}

// ---------------------------------------------------------------- KDP readiness

export type CheckLevel = "ok" | "warn" | "error" | "info";
export type CheckFix = "size" | "title" | "extras" | "title-first" | "solutions-last" | "front-first" | "undo-delete";
export interface ReadinessCheck {
  id: string;
  level: CheckLevel;
  text: string;
  fix?: CheckFix;
  fixLabel?: string;
}

export interface ReadinessInput {
  pages: PageInfo[];
  frontMatter: FrontMatter | null;
  padForKdp?: boolean;
  /** Puzzles in the book before any deletion. */
  originalItems: number;
  items: number;
  unit?: string;
  /** Replaces the "N puzzles, each with its answer" line (e.g. to name special pages). */
  itemsText?: (items: number) => string;
}

export function readinessChecks(r: ReadinessInput): ReadinessCheck[] {
  const out: ReadinessCheck[] = [];
  const n = r.pages.length;
  const unit = (r.unit ?? "puzzle").toLowerCase();
  out.push(n % 2 === 0 ? { id: "even", level: "ok", text: `${n} pages, an even count` } : { id: "even", level: "error", text: `${n} pages; KDP needs an even count` });
  if (n < KDP_MIN_PAGES) out.push({ id: "min", level: "error", text: `KDP paperbacks need at least ${KDP_MIN_PAGES} pages`, fix: "size", fixLabel: "Turn on KDP padding" });
  else if (n > KDP_MAX_PAGES) out.push({ id: "max", level: "error", text: `Over KDP's ${KDP_MAX_PAGES}-page maximum`, fix: "size", fixLabel: "Change size" });
  else out.push({ id: "range", level: "ok", text: `Within KDP's ${KDP_MIN_PAGES}–${KDP_MAX_PAGES} page range` });
  if (n <= KDP_MAX_PAGES) out.push({ id: "gutter", level: "ok", text: `Inside margin ${insideMargin(n)}" (right for ${n} pages)` });
  const fm = r.frontMatter;
  const hasTitle = r.pages.some((p) => p.kind === "title" || p.kind === "copyright" || p.kind === "thanks");
  if (fm && hasTitle) {
    const ph = [fm.author, fm.imprint].some((v) => v.trim() === "Your Name" || v.trim() === "Your Imprint");
    out.push(ph ? { id: "placeholder", level: "warn", text: "Title page still says “Your Name” or “Your Imprint”", fix: "title", fixLabel: "Edit title page" } : { id: "placeholder", level: "ok", text: "No placeholder text on the title page" });
  }
  out.push(r.items > 0 ? { id: "puzzles", level: "ok", text: r.itemsText?.(r.items) ?? `${r.items} ${unit}${r.items === 1 ? "" : "s"}, each with its answer` } : { id: "puzzles", level: "error", text: `The book has no ${unit}s` });
  if (r.items < r.originalItems) out.push({ id: "deleted", level: "info", text: `${r.originalItems - r.items} ${unit}${r.originalItems - r.items === 1 ? "" : "s"} removed (answers removed too)`, fix: "undo-delete", fixLabel: "Bring back" });
  const firstSol = r.pages.findIndex((p) => p.kind === "solution");
  const lastPuz = r.pages.map((p) => p.kind).lastIndexOf("puzzle");
  if (firstSol >= 0 && firstSol < lastPuz) out.push({ id: "order", level: "warn", text: "Some answers come before the puzzles", fix: "solutions-last", fixLabel: "Move answers after puzzles" });
  else out.push({ id: "order", level: "ok", text: "Answers come after the puzzles" });
  const title = r.pages.findIndex((p) => p.kind === "title");
  if (title > 0) out.push({ id: "title-first", level: "warn", text: "The title page isn't the first page", fix: "title-first", fixLabel: "Move it to the start" });
  const firstPuzzle = r.pages.findIndex((p) => p.kind === "puzzle");
  const lateFront = r.pages.some((p, i) => i > firstPuzzle && firstPuzzle >= 0 && (p.kind === "copyright" || p.kind === "toc" || p.kind === "howto"));
  if (lateFront) out.push({ id: "front", level: "warn", text: "Contents, copyright or How to play sits after the first puzzle", fix: "front-first", fixLabel: "Move front pages first" });
  const blanks = r.pages.filter((p) => p.kind === "blank").length;
  const fillers = r.pages.filter((p) => p.filler).length;
  if (blanks) out.push({ id: "blank", level: blanks > 10 ? "warn" : "info", text: `${blanks} blank page${blanks === 1 ? "" : "s"}${blanks > 10 ? " — KDP may flag many blank pages" : ""}`, fix: blanks > 10 ? "extras" : undefined, fixLabel: "Use notes pages" });
  if (fillers) out.push({ id: "filler", level: "info", text: `${fillers} page${fillers === 1 ? "" : "s"} added automatically to reach ${r.padForKdp === false ? "an even count" : "KDP's page count"}` });
  return out;
}

/** Apply an automatic fix that only changes the order. */
export function applyOrderFix(slots: Slot[], fix: CheckFix): Slot[] {
  if (fix === "title-first") {
    const ids = slots.filter((s) => s.kind === "title").map((s) => s.id);
    return moveSlots(slots, ids, 0);
  }
  if (fix === "solutions-last") {
    const sols = slots.filter((s) => s.kind === "solution").map((s) => s.id);
    const lastPuz = slots.map((s) => s.kind).lastIndexOf("puzzle");
    return moveSlots(slots, sols, lastPuz + 1);
  }
  if (fix === "front-first") {
    const rank: Partial<Record<SlotKind, number>> = { title: 0, copyright: 1, belongs: 2, dedication: 3, toc: 4, intro: 5, howto: 6 };
    const front = slots.filter((s) => rank[s.kind] !== undefined).sort((a, b) => rank[a.kind]! - rank[b.kind]!);
    const rest = slots.filter((s) => rank[s.kind] === undefined);
    return [...front, ...rest];
  }
  return slots;
}

/** Put deleted puzzle pages back (after the last puzzle page). */
export function restoreDeleted(slots: Slot[], shape: ContentShape): Slot[] {
  const have = new Set(slots.filter((s) => s.kind === "puzzle").map((s) => s.ref));
  const missing: Slot[] = [];
  for (let g = 0; g < puzzlePageCount(shape); g++) if (!have.has(g)) missing.push({ id: `puzzle-${g}`, kind: "puzzle", ref: g });
  if (!missing.length) return slots;
  const used = new Set(slots.map((s) => s.id));
  const add = missing.map((m) => (used.has(m.id) ? { ...m, id: newSlotId("puzzle") } : m));
  const out = slots.slice();
  out.splice(out.map((s) => s.kind).lastIndexOf("puzzle") + 1, 0, ...add);
  return resolveSlots(out, shape).slots;
}
