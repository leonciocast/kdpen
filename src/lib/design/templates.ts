import type { Design, TemplateId } from "./types";

export interface TemplateInfo {
  id: TemplateId;
  name: string;
  description: string;
  design: Design;
}

const base: Design = {
  version: 1,
  template: "classic",
  name: "Classic minimal",
  header: { style: "rule", text: "", showPuzzleTitle: true, badge: false, badgeShape: "circle", icon: "none" },
  fonts: { heading: "sans", grid: "sans", list: "sans", gridScale: 1, listScale: 1 },
  grid: { lines: false, border: "square", shade: "none", frame: 1.2, line: "solid", shadow: false, cells: "plain" },
  shape: { kind: "square", mix: "one", shade: false },
  color: { accent: "#4f46e5", grayscale: true },
  pattern: { kind: "none", strength: 0.5 },
  pageNumber: "plain",
  list: { columns: 0, checkbox: true, sort: "alpha", box: "none" },
};

function make(id: TemplateId, name: string, description: string, patch: (d: Design) => void): TemplateInfo {
  const d: Design = JSON.parse(JSON.stringify(base));
  d.template = id;
  d.name = name;
  patch(d);
  d.grid = { ...base.grid, ...d.grid };
  return { id, name, description, design: d };
}

export const TEMPLATES: TemplateInfo[] = [
  make("classic", "Classic minimal", "Clean title with a thin rule. Timeless and uses very little ink.", () => {}),
  make("banner", "Bold banner", "A strong title banner with a numbered badge and an icon, on a light dotted page.", (d) => {
    d.header = { style: "banner", text: "", showPuzzleTitle: true, badge: true, badgeShape: "circle", icon: "magnifier" };
    d.fonts = { heading: "display", grid: "serif", list: "serif", gridScale: 1, listScale: 1 };
    d.grid = { ...d.grid, lines: false, border: "rounded", shade: "none", frame: 2 };
    d.pattern = { kind: "dots", strength: 0.5 };
    d.pageNumber = "circle";
    d.color.accent = "#1f2937";
  }),
  make("elegant", "Elegant serif", "Book-like serif type, a double frame and quiet ornaments.", (d) => {
    d.header = { style: "underline", text: "", showPuzzleTitle: true, badge: false, badgeShape: "diamond", icon: "flower" };
    d.fonts = { heading: "serif", grid: "serif", list: "serif", gridScale: 1, listScale: 1 };
    d.grid = { ...d.grid, lines: false, border: "double", shade: "none", frame: 0.9 };
    d.pageNumber = "dashes";
    d.color.accent = "#7c2d12";
  }),
  make("kids", "Kids playful", "Rounded friendly letters, a star badge, soft shaded squares and confetti.", (d) => {
    d.header = { style: "ribbon", text: "", showPuzzleTitle: true, badge: true, badgeShape: "rounded", icon: "star" };
    d.fonts = { heading: "rounded", grid: "rounded", list: "rounded", gridScale: 1.05, listScale: 1.05 };
    d.grid = { ...d.grid, lines: true, border: "rounded", shade: "checker", frame: 2.4 };
    d.pattern = { kind: "confetti", strength: 0.6 };
    d.pageNumber = "pill";
    d.list.sort = "length";
    d.color.accent = "#0ea5e9";
  }),
  make("largeprint", "Large print, high contrast", "Extra-legible letters, bigger type, strong lines. Great for seniors.", (d) => {
    d.header = { style: "boxed", text: "", showPuzzleTitle: true, badge: true, badgeShape: "rounded", icon: "none" };
    d.fonts = { heading: "legible", grid: "legible", list: "legible", gridScale: 1.2, listScale: 1.2 };
    d.grid = { ...d.grid, lines: true, border: "square", shade: "none", frame: 2.5 };
    d.pageNumber = "plain";
    d.list.columns = 3;
    d.color.accent = "#000000";
  }),
  make("seasonal", "Seasonal accent", "Pick a seasonal icon and accent; soft corner decorations frame the page.", (d) => {
    d.header = { style: "tab", text: "", showPuzzleTitle: true, badge: true, badgeShape: "hexagon", icon: "snowflake" };
    d.fonts = { heading: "display", grid: "sans", list: "sans", gridScale: 1, listScale: 1 };
    d.grid = { ...d.grid, lines: false, border: "rounded", shade: "none", frame: 1.6 };
    d.pattern = { kind: "snow", strength: 0.5 };
    d.pageNumber = "pill";
    d.color.accent = "#15803d";
  }),
  make("modern", "Modern typewriter", "Typewriter grid letters, shaded rows and a subtle graph-paper margin.", (d) => {
    d.header = { style: "minimal", text: "", showPuzzleTitle: true, badge: true, badgeShape: "diamond", icon: "pencil" };
    d.fonts = { heading: "display", grid: "mono", list: "mono", gridScale: 1.05, listScale: 1 };
    d.grid = { ...d.grid, lines: false, border: "square", shade: "rows", frame: 1.4 };
    d.pattern = { kind: "grid", strength: 0.45 };
    d.pageNumber = "dashes";
    d.color.accent = "#334155";
  }),
];

export const DEFAULT_DESIGN: Design = TEMPLATES[0].design;

export function templateDesign(id: TemplateId): Design {
  const t = TEMPLATES.find((x) => x.id === id) ?? TEMPLATES[0];
  return JSON.parse(JSON.stringify(t.design));
}
