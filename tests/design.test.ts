import { describe, expect, it } from "vitest";
import { sanitizeDesign, designToJson, designFromJson, parsePresetStore, upsertPreset, removePreset } from "../src/lib/design/presets";
import { TEMPLATES, DEFAULT_DESIGN, templateDesign } from "../src/lib/design/templates";
import { sortList } from "../src/lib/design/paint";
import { toGray, hexToRgb } from "../src/lib/design/color";

describe("design templates and presets", () => {
  it("has the original templates, grayscale-safe with checkboxes by default", () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(["classic", "banner", "elegant", "kids", "largeprint", "seasonal", "modern"]);
    for (const t of TEMPLATES) {
      expect(t.design.color.grayscale).toBe(true);
      expect(t.design.list.checkbox).toBe(true);
      expect(sanitizeDesign(t.design)).toEqual(t.design);
    }
  });
  it("sanitizes junk and clamps numbers", () => {
    const d = sanitizeDesign({ template: "kids", header: { style: "evil" }, fonts: { gridScale: 99 }, color: { accent: "red" }, list: { columns: -4 } });
    expect(d.template).toBe("kids");
    expect(d.header.style).toBe(templateDesign("kids").header.style);
    expect(d.fonts.gridScale).toBeLessThanOrEqual(1.5);
    expect(d.color.accent).toMatch(/^#[0-9a-f]{6}$/i);
    expect(d.list.columns).toBeGreaterThanOrEqual(0);
    expect(sanitizeDesign(null)).toEqual(DEFAULT_DESIGN);
  });
  it("round-trips through JSON and rejects other files", () => {
    const d = { ...templateDesign("seasonal"), name: "My Winter Look" };
    expect(designFromJson(designToJson(d))).toEqual(d);
    expect(() => designFromJson("not json")).toThrow();
    expect(() => designFromJson('{"hello":1}')).toThrow();
  });
  it("saves, replaces and removes presets by name", () => {
    let store = parsePresetStore(null);
    store = upsertPreset(store, { ...DEFAULT_DESIGN, name: "A" });
    store = upsertPreset(store, { ...DEFAULT_DESIGN, name: "B" });
    store = upsertPreset(store, { ...templateDesign("kids"), name: "A" });
    expect(store.presets.map((p) => p.name).sort()).toEqual(["A", "B"]);
    expect(store.presets.find((p) => p.name === "A")!.template).toBe("kids");
    store = removePreset(store, "A");
    expect(store.presets.map((p) => p.name)).toEqual(["B"]);
    expect(parsePresetStore("garbage").presets).toEqual([]);
  });
  it("sorts word lists", () => {
    const w = ["PEAR", "FIG", "BANANA", "APPLE"];
    expect(sortList(w, "entered")).toEqual(w);
    expect(sortList(w, "alpha")).toEqual(["APPLE", "BANANA", "FIG", "PEAR"]);
    expect(sortList(w, "length")[0]).toBe("FIG");
  });
  it("grayscale conversion is neutral", () => {
    const [r, g, b] = toGray(hexToRgb("#e4572e"));
    expect(r).toBe(g);
    expect(g).toBe(b);
  });
});
