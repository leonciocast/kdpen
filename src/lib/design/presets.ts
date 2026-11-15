/** Validate, save and load designs (localStorage + JSON files). */
import { FONT_KEYS, FontKey } from "./fonts";
import { isHexColor } from "./color";
import { DEFAULT_DESIGN, TEMPLATES, templateDesign } from "./templates";
import type { BadgeShape, CellStyle, Design, GridBorder, GridShade, HeaderStyle, IconKey, LineStyle, ListBox, ListSort, PageNumberStyle, PatternKey, TemplateId } from "./types";
import { SHAPE_KEYS, OutlineStyle, ShapeKey, ShapeMix } from "../shapes/shapes";
import { MAX_PINS, PLAN_LEAF_IDS, ThemeMode } from "../shapes/plan";

const HEADERS: HeaderStyle[] = ["rule", "banner", "ribbon", "underline", "boxed", "tab", "minimal"];
const BADGES: BadgeShape[] = ["circle", "rounded", "diamond", "hexagon"];
const ICONS: IconKey[] = ["none", "magnifier", "star", "heart", "leaf", "sun", "snowflake", "flower", "pencil"];
const PATTERNS: PatternKey[] = ["none", "dots", "diagonal", "waves", "confetti", "grid", "corners", "snow"];
const BORDERS: GridBorder[] = ["square", "rounded", "double", "none"];
const SHADES: GridShade[] = ["none", "rows", "checker"];
const NUMBERS: PageNumberStyle[] = ["plain", "dashes", "circle", "pill", "none"];
const SORTS: ListSort[] = ["entered", "alpha", "length"];
const LINES: LineStyle[] = ["solid", "dashed", "dotted"];
const CELLS: CellStyle[] = ["plain", "boxed", "rounded", "circles"];
const LIST_BOXES: ListBox[] = ["none", "solid", "rounded", "dashed", "double"];
const MIXES: ShapeMix[] = ["one", "each", "pick", "manual", "theme", "animals", "category"];
const THEME_MODES: ThemeMode[] = ["off", "match", "group"];
const OUTLINES: OutlineStyle[] = ["smooth", "stepped", "snug", "blocky"];

export const DESIGN_OPTIONS = { HEADERS, BADGES, ICONS, PATTERNS, BORDERS, SHADES, NUMBERS, SORTS, LINES, CELLS, LIST_BOXES, MIXES, OUTLINES };

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
const num = (v: unknown, lo: number, hi: number, fallback: number) => (typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const str = (v: unknown, max: number, fallback: string) => (typeof v === "string" ? v.slice(0, max) : fallback);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

/** Optional shape-plan fields: only kept when present and valid. */
function planFields(s: Record<string, unknown>): { seed?: number; cats?: string[]; pins?: Record<string, ShapeKey>; themes?: ThemeMode } {
  const out: { seed?: number; cats?: string[]; pins?: Record<string, ShapeKey>; themes?: ThemeMode } = {};
  if (typeof s.seed === "number" && Number.isFinite(s.seed)) out.seed = Math.abs(Math.floor(s.seed)) % 2147483647;
  if (Array.isArray(s.cats)) out.cats = [...new Set(s.cats.filter((c): c is string => typeof c === "string" && (c === "animals" || PLAN_LEAF_IDS.includes(c))))];
  const pins = obj(s.pins);
  const keep = Object.entries(pins).filter(([i, k]) => /^\d{1,5}$/.test(i) && SHAPE_KEYS.includes(k as ShapeKey)).slice(0, MAX_PINS);
  if (keep.length) out.pins = Object.fromEntries(keep) as Record<string, ShapeKey>;
  if (THEME_MODES.includes(s.themes as ThemeMode)) out.themes = s.themes as ThemeMode;
  return out;
}

/** Turn anything (old presets, hand-edited JSON) into a complete, safe Design. */
export function sanitizeDesign(input: unknown): Design {
  const i = obj(input);
  const template = pick<TemplateId>(i.template, TEMPLATES.map((t) => t.id), DEFAULT_DESIGN.template);
  const d = templateDesign(template);
  const h = obj(i.header);
  const f = obj(i.fonts);
  const g = obj(i.grid);
  const c = obj(i.color);
  const p = obj(i.pattern);
  const l = obj(i.list);
  const s = obj(i.shape);
  return {
    version: 1,
    template,
    name: str(i.name, 60, d.name),
    header: {
      style: pick(h.style, HEADERS, d.header.style),
      text: str(h.text, 40, d.header.text),
      showPuzzleTitle: bool(h.showPuzzleTitle, d.header.showPuzzleTitle),
      badge: bool(h.badge, d.header.badge),
      badgeShape: pick(h.badgeShape, BADGES, d.header.badgeShape),
      icon: pick(h.icon, ICONS, d.header.icon),
    },
    fonts: {
      heading: pick<FontKey>(f.heading, FONT_KEYS, d.fonts.heading),
      grid: pick<FontKey>(f.grid, FONT_KEYS, d.fonts.grid),
      list: pick<FontKey>(f.list, FONT_KEYS, d.fonts.list),
      gridScale: num(f.gridScale, 0.8, 1.3, d.fonts.gridScale),
      listScale: num(f.listScale, 0.8, 1.3, d.fonts.listScale),
    },
    grid: {
      lines: bool(g.lines, d.grid.lines),
      border: pick(g.border, BORDERS, d.grid.border),
      shade: pick(g.shade, SHADES, d.grid.shade),
      frame: num(g.frame, 0, 4, d.grid.frame),
      line: pick(g.line, LINES, d.grid.line),
      shadow: bool(g.shadow, d.grid.shadow),
      cells: pick(g.cells, CELLS, d.grid.cells),
    },
    shape: {
      kind: pick(s.kind, SHAPE_KEYS, d.shape.kind),
      mix: pick(s.mix, MIXES, d.shape.mix),
      shade: bool(s.shade, d.shape.shade),
      outline: pick(s.outline, OUTLINES, d.shape.outline),
      ...(isHexColor(s.outlineColor) ? { outlineColor: s.outlineColor } : d.shape.outlineColor ? { outlineColor: d.shape.outlineColor } : {}),
      ...planFields(s),
    },
    color: { accent: isHexColor(c.accent) ? c.accent : d.color.accent, grayscale: bool(c.grayscale, d.color.grayscale) },
    pattern: { kind: pick(p.kind, PATTERNS, d.pattern.kind), strength: num(p.strength, 0, 1, d.pattern.strength) },
    pageNumber: pick(i.pageNumber, NUMBERS, d.pageNumber),
    list: { columns: Math.round(num(l.columns, 0, 6, d.list.columns)), checkbox: bool(l.checkbox, d.list.checkbox), sort: pick(l.sort, SORTS, d.list.sort), box: pick(l.box, LIST_BOXES, d.list.box) },
  };
}

export const PRESETS_STORAGE_KEY = "puzzle-generator.design-presets.v1";
export const CURRENT_DESIGN_KEY = "puzzle-generator.design.v1";

export interface PresetStore {
  presets: Design[];
}

export function parsePresetStore(raw: string | null): PresetStore {
  try {
    const v = raw ? JSON.parse(raw) : null;
    const list = Array.isArray(v?.presets) ? v.presets : [];
    return { presets: list.slice(0, 50).map(sanitizeDesign) };
  } catch {
    return { presets: [] };
  }
}

/** Add or replace (by name) a preset. */
export function upsertPreset(store: PresetStore, design: Design): PresetStore {
  const name = design.name.trim() || "My design";
  const clean = sanitizeDesign({ ...design, name });
  return { presets: [clean, ...store.presets.filter((p) => p.name !== name)].slice(0, 50) };
}

export function removePreset(store: PresetStore, name: string): PresetStore {
  return { presets: store.presets.filter((p) => p.name !== name) };
}

/** JSON file contents for "Export design". */
export function designToJson(design: Design): string {
  return JSON.stringify({ kind: "puzzle-generator-design", ...sanitizeDesign(design) }, null, 2);
}

/** Read an exported design file. Throws a friendly error when it isn't one. */
export function designFromJson(text: string): Design {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  const o = obj(v);
  if (o.kind !== "puzzle-generator-design" && !o.header) throw new Error("That file doesn't look like a saved design.");
  return sanitizeDesign(o);
}
