import { describe, expect, test } from "vitest";
import { COMPACT_RULE, isCompactShape, maskCompactness, meetsCompactRule, shapeCompactness } from "../src/lib/shapes/compact";
import { MYSTERY_SHAPES, SHAPE_KEYS, shapeCategory, type ShapeKey } from "../src/lib/shapes/shapes";
import { shapeTargetsFor, substituteShape } from "../src/lib/shapes/plan";
import { CROSSWORD_SHAPES } from "../src/lib/shapes/shapes";

const grid = (rows: string[]) => rows.map((r) => [...r].map((ch) => ch === "#"));
const book = (n: number) => Array.from({ length: n }, () => ({}));

describe("compactness rule", () => {
  test("measures islands, holes, thin arms, fill and aspect", () => {
    expect(meetsCompactRule(maskCompactness(grid(["#####", "#####", "#####", "#####"])))).toBe(true);
    const islands = maskCompactness(grid(["###..", "###..", "###.#"]));
    expect(islands.components).toBe(2);
    const ring = maskCompactness(grid(["#####", "#...#", "#...#", "#####"]));
    expect(ring.holes).toBeGreaterThan(COMPACT_RULE.maxHoles);
    const arm = maskCompactness(grid(["####......", "####......", "##########", "####......"]));
    expect(maskCompactness(grid(["....#", "#####", "#####", "#####", "#...."])).spurs).toBe(2);
    expect(arm.thin).toBeGreaterThan(COMPACT_RULE.maxThin);
    expect(arm.fill).toBeLessThan(0.6);
    expect(maskCompactness(grid(["##########", "##########", "##########"])).aspect).toBeGreaterThan(COMPACT_RULE.maxAspect);
  });

  test("every mystery shape is compact at the sizes a case uses", () => {
    for (const k of MYSTERY_SHAPES) expect(isCompactShape(k), k).toBe(true);
  }, 180000);

  test("spread-out shapes from a real book are excluded", () => {
    for (const k of ["goat", "flamingo", "rooster", "horse", "airplane", "crown", "guitar", "giraffe", "dragon", "cat", "bear", "squirrel", "car", "lemon", "pig", "mouse", "bee"] as ShapeKey[]) {
      if (!SHAPE_KEYS.includes(k)) continue;
      expect(MYSTERY_SHAPES).not.toContain(k);
      expect(shapeCompactness(k).every(meetsCompactRule), k).toBe(false);
    }
  }, 120000);

  test("keeps a good variety", () => {
    expect(MYSTERY_SHAPES.length).toBeGreaterThanOrEqual(35);
    const cats = new Set(MYSTERY_SHAPES.map(shapeCategory));
    expect(cats.has("hollow") || cats.has("clusters")).toBe(false);
    expect(cats.size).toBeGreaterThanOrEqual(5);
    expect(MYSTERY_SHAPES.filter((k) => shapeCategory(k) === "animals").length).toBeGreaterThanOrEqual(1);
  });
});

describe("mystery plans only use compact shapes", () => {
  const ok = (ks: ShapeKey[]) => ks.every((k) => MYSTERY_SHAPES.includes(k));
  test("surprise me, categories and page by page", () => {
    expect(ok(shapeTargetsFor({ kind: "square", mix: "each", seed: 11 }, book(60), MYSTERY_SHAPES))).toBe(true);
    expect(ok(shapeTargetsFor({ kind: "square", mix: "pick", cats: ["animals"], seed: 4 }, book(30), MYSTERY_SHAPES))).toBe(true);
    const manual = shapeTargetsFor({ kind: "heart", mix: "manual", pins: { "0": "ladybug", "1": "goat", "2": "flamingo" } }, book(4), MYSTERY_SHAPES);
    expect(manual[0]).toBe("ladybug");
    expect(manual[3]).toBe("heart");
    expect(ok(manual)).toBe(true);
  });
  test("old saved plans swap in a compact shape of the same kind", () => {
    const goat = substituteShape("goat", MYSTERY_SHAPES);
    expect(MYSTERY_SHAPES).toContain(goat);
    expect(shapeCategory(goat)).toBe(shapeCategory("goat"));
    expect(substituteShape("goat", MYSTERY_SHAPES)).toBe(goat);
    const one = shapeTargetsFor({ kind: "flamingo", mix: "one" }, book(3), MYSTERY_SHAPES);
    expect(ok(one)).toBe(true);
    expect(new Set(one).size).toBe(1);
    const pinned = shapeTargetsFor({ kind: "square", mix: "each", seed: 2, pins: { "5": "crown" } }, book(10), MYSTERY_SHAPES);
    expect(ok(pinned)).toBe(true);
  });
  test("other tools are unchanged", () => {
    expect(shapeTargetsFor({ kind: "square", mix: "manual", pins: { "0": "letterA" } }, book(2), CROSSWORD_SHAPES)).toEqual(["square", "square"]);
    expect(substituteShape("goat", CROSSWORD_SHAPES)).toBe(CROSSWORD_SHAPES.includes("goat") ? "goat" : "square");
    expect(shapeTargetsFor({ kind: "goat", mix: "one" }, book(2))).toEqual(["goat", "goat"]);
    expect(SHAPE_KEYS.length).toBeGreaterThan(MYSTERY_SHAPES.length);
  });
});
