/**
 * Shape plan: which shape each puzzle of a book gets.
 *
 * Modes (stored in `design.shape.mix`):
 *  - "one"      every puzzle uses `kind`.
 *  - "each"     Surprise me: a random shape per puzzle from every category (letters & numbers left out).
 *  - "pick"     Random from the categories / animal groups in `cats`.
 *  - "manual"   Page by page: `pins[i]` for puzzle i, `kind` for the rest.
 * Legacy values still load: "theme" (= surprise, one shape per theme),
 * "animals" (= pick all animals, theme names matched) and "category" (= pick the category of `kind`).
 *
 * Random plans are seeded (`seed`), so the preview and the PDF always agree;
 * a shape is not reused until the whole pool has been used once, and two
 * neighbouring puzzles never share a shape when the pool has more than one.
 * Pins override any mode except "one" and never move when the plan is reshuffled.
 */
import { ANIMAL_GROUPS, CATEGORIES, SHAPE_KEYS, ShapeKey, ShapeMix, animalGroupOf, shapeCategory, suggestShapeForTheme, suggestShapesForTheme } from "./shapes";
import type { AnimalGroup, ShapeCategory } from "./catalog";

export type PlanMode = "one" | "surprise" | "pick" | "manual";
/** off = pure random; match = use shapes named after the puzzle's theme when there are some; group = one shape per theme. */
export type ThemeMode = "off" | "match" | "group";

export interface ShapeChoice {
  kind: ShapeKey;
  mix: ShapeMix;
  seed?: number;
  /** Category ids ("food") or animal groups ("animals:farm"); "animals" means every animal. */
  cats?: string[];
  /** Puzzle index (0-based, as a string) → shape. */
  pins?: Record<string, ShapeKey>;
  themes?: ThemeMode;
}

export const DEFAULT_SEED = 1;
export const MAX_PINS = 2000;

/** Every leaf id a user can tick: categories, with Animals split into its groups. */
export interface PlanLeaf { id: string; label: string; category: ShapeCategory; group?: AnimalGroup }
export const PLAN_LEAVES: PlanLeaf[] = CATEGORIES.flatMap((c): PlanLeaf[] =>
  c.id === "animals" ? ANIMAL_GROUPS.map((g) => ({ id: `animals:${g.id}`, label: g.label, category: c.id, group: g.id })) : [{ id: c.id, label: c.label, category: c.id }]
);
export const PLAN_LEAF_IDS = PLAN_LEAVES.map((l) => l.id);

export function planMode(mix: ShapeMix): PlanMode {
  if (mix === "one") return "one";
  if (mix === "manual") return "manual";
  if (mix === "pick" || mix === "animals" || mix === "category") return "pick";
  return "surprise";
}

/** The leaf ids a choice draws from (legacy mixes translated). */
export function planCats(choice: ShapeChoice): string[] {
  if (choice.mix === "animals") return ANIMAL_GROUPS.map((g) => `animals:${g.id}`);
  if (choice.mix === "category") {
    const cat = shapeCategory(choice.kind);
    return cat === "animals" ? ANIMAL_GROUPS.map((g) => `animals:${g.id}`) : [cat];
  }
  const out = new Set<string>();
  for (const id of choice.cats ?? []) {
    if (id === "animals") ANIMAL_GROUPS.forEach((g) => out.add(`animals:${g.id}`));
    else if (PLAN_LEAF_IDS.includes(id)) out.add(id);
  }
  return PLAN_LEAF_IDS.filter((id) => out.has(id));
}

export function planThemes(choice: ShapeChoice): ThemeMode {
  if (choice.themes) return choice.themes;
  if (choice.mix === "theme") return "group";
  if (choice.mix === "animals") return "match";
  return "off";
}

export function leafOf(k: ShapeKey): string {
  const cat = shapeCategory(k);
  return cat === "animals" ? `animals:${animalGroupOf(k) ?? "farm"}` : cat;
}

/** Shapes a random mode draws from, in catalog order. */
export function planPool(choice: ShapeChoice, allowed?: ShapeKey[]): ShapeKey[] {
  const base = allowed ?? SHAPE_KEYS;
  const mode = planMode(choice.mix);
  if (mode === "pick") {
    const cats = new Set(planCats(choice));
    return base.filter((k) => cats.has(leafOf(k)));
  }
  // Surprise / manual fill: everything except letters & numbers (they spell things and read oddly at random).
  const pool = base.filter((k) => shapeCategory(k) !== "letters");
  return pool.length ? pool : base.slice();
}

function rng(seed: number) {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomPlanSeed(): number {
  return 1 + Math.floor(Math.random() * 2147483646);
}

/** Draws from a shuffled bag; refills (reshuffled) only when every shape has been used. */
function bagDrawer(pool: ShapeKey[], rand: () => number) {
  let bag: ShapeKey[] = [];
  return (avoid: Set<ShapeKey>): ShapeKey => {
    if (!bag.length) {
      // Shuffle within each category, then deal categories weighted by √size so a big
      // category (animals) doesn't crowd out the small ones early in the book.
      const groups = new Map<string, ShapeKey[]>();
      for (const k of pool) {
        const c = shapeCategory(k);
        groups.set(c, [...(groups.get(c) ?? []), k]);
      }
      for (const g of groups.values()) {
        for (let i = g.length - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1));
          [g[i], g[j]] = [g[j], g[i]];
        }
      }
      const order: ShapeKey[] = [];
      const live = [...groups.values()];
      while (live.length) {
        const w = live.map((g) => Math.sqrt(g.length));
        let r = rand() * w.reduce((a, b) => a + b, 0);
        let gi = 0;
        while (gi < live.length - 1 && r >= w[gi]) r -= w[gi++];
        order.push(live[gi].pop()!);
        if (!live[gi].length) live.splice(gi, 1);
      }
      bag = order.reverse();
    }
    let j = bag.length - 1;
    while (j >= 0 && avoid.has(bag[j])) j--;
    if (j < 0) j = bag.length - 1;
    const [k] = bag.splice(j, 1);
    return k;
  };
}

const pinOf = (choice: ShapeChoice, i: number, allowed?: ShapeKey[]): ShapeKey | undefined => {
  const k = choice.pins?.[String(i)];
  return k && (!allowed || allowed.includes(k)) && SHAPE_KEYS.includes(k) ? k : undefined;
};

/**
 * Shape of every puzzle in a book, in order.
 * `list` is the book's puzzles (only `theme` is read); `allowed` the shapes the tool can use.
 */
export function shapeTargetsFor(choice: ShapeChoice, list: { theme?: string }[], allowed?: ShapeKey[]): ShapeKey[] {
  const fallback: ShapeKey = allowed && !allowed.includes(choice.kind) ? (allowed.includes("square") ? "square" : allowed[0] ?? "square") : choice.kind;
  const mode = planMode(choice.mix);
  if (mode === "one") return list.map(() => fallback);
  if (mode === "manual") return list.map((_, i) => pinOf(choice, i, allowed) ?? fallback);

  const pool = planPool(choice, allowed);
  if (!pool.length) return list.map((_, i) => pinOf(choice, i, allowed) ?? fallback);
  const themeMode = planThemes(choice);
  const rand = rng((choice.seed ?? DEFAULT_SEED) * 2654435761);
  const draw = bagDrawer(pool, rand);
  const themeKey = (p: { theme?: string }) => (p.theme ?? "").trim().toLowerCase();

  // Base plan for every index (pins never shift what the other pages get).
  const base: ShapeKey[] = [];
  const perTheme = new Map<string, ShapeKey>();
  const seen = new Map<string, number>();
  const matchCache = new Map<string, ShapeKey[]>();
  const matches = (t: string, raw?: string) => {
    let hit = matchCache.get(t);
    if (!hit) {
      hit = suggestShapesForTheme(raw, pool, 8);
      matchCache.set(t, hit);
    }
    return hit;
  };
  list.forEach((p, i) => {
    const prev = base[i - 1];
    const avoid = new Set<ShapeKey>(prev ? [prev] : []);
    const t = themeKey(p);
    if (t && themeMode === "group") {
      let k = perTheme.get(t);
      if (!k) {
        const used = new Set(perTheme.values());
        const named = suggestShapeForTheme(p.theme, pool);
        k = named && !used.has(named) ? named : draw(new Set([...avoid, ...used]));
        perTheme.set(t, k);
      }
      base.push(k);
      return;
    }
    if (t && themeMode === "match") {
      const m = matches(t, p.theme);
      if (m.length) {
        const n = seen.get(t) ?? 0;
        seen.set(t, n + 1);
        let k = m[n % m.length];
        if (k === prev && m.length > 1) k = m[(n + 1) % m.length];
        if (k !== prev) {
          base.push(k);
          return;
        }
      }
    }
    base.push(draw(avoid));
  });

  // Apply pins, then repair any neighbours that now match (only unpinned pages change).
  const out = base.map((k, i) => pinOf(choice, i, allowed) ?? k);
  if (pool.length > 1) {
    for (let i = 0; i < out.length; i++) {
      if (pinOf(choice, i, allowed)) continue;
      const sameTheme = (j: number) => themeMode === "group" && !!themeKey(list[i]) && themeKey(list[i]) === themeKey(list[j] ?? {});
      const left = i > 0 && !sameTheme(i - 1) ? out[i - 1] : undefined;
      const rightPinned = i + 1 < out.length && pinOf(choice, i + 1, allowed) && !sameTheme(i + 1) ? out[i + 1] : undefined;
      if (out[i] !== left && out[i] !== rightPinned) continue;
      const r = rng((choice.seed ?? DEFAULT_SEED) + i * 7919);
      const start = Math.floor(r() * pool.length);
      for (let s = 0; s < pool.length; s++) {
        const k = pool[(start + s) % pool.length];
        if (k !== left && k !== rightPinned && k !== out[i + 1]) {
          out[i] = k;
          break;
        }
      }
    }
  }
  return out;
}

/** Count of shapes per leaf id for a tool (for the category cards). */
export function leafCounts(allowed?: ShapeKey[]): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(PLAN_LEAF_IDS.map((id) => [id, 0]));
  for (const k of allowed ?? SHAPE_KEYS) out[leafOf(k)] = (out[leafOf(k)] ?? 0) + 1;
  return out;
}

/** Changes whenever the plan could give any puzzle a different shape. */
export function planSignature(choice: ShapeChoice): string {
  return JSON.stringify([choice.kind, choice.mix, choice.seed ?? null, choice.cats ?? null, choice.pins ?? null, choice.themes ?? null]);
}
