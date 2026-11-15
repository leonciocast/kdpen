import { describe, expect, it } from "vitest";
import { CROSSWORD_SHAPES, SUDOKU_SHAPES, ShapeKey, shapeCategory, animalGroupOf } from "../src/lib/shapes/shapes";
import { leafCounts, planPool, shapeTargetsFor, ShapeChoice, PLAN_LEAF_IDS } from "../src/lib/shapes/plan";
import { sanitizeDesign } from "../src/lib/design/presets";
import { filletPolygon } from "../src/lib/design/paint";

const book = (n: number, theme?: (i: number) => string) => Array.from({ length: n }, (_, i) => ({ theme: theme?.(i) }));
const noNeighbours = (t: ShapeKey[]) => t.every((k, i) => i === 0 || k !== t[i - 1]);

describe("shape plan", () => {
  it("one shape: every puzzle the same, pins ignored", () => {
    const t = shapeTargetsFor({ kind: "heart", mix: "one", pins: { "1": "star" } }, book(4));
    expect(t).toEqual(["heart", "heart", "heart", "heart"]);
  });

  it("surprise is deterministic for a seed and changes with the seed", () => {
    const a = shapeTargetsFor({ kind: "square", mix: "each", seed: 42 }, book(30));
    const b = shapeTargetsFor({ kind: "square", mix: "each", seed: 42 }, book(30));
    const c = shapeTargetsFor({ kind: "square", mix: "each", seed: 43 }, book(30));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("surprise draws from every category except letters, without repeats until the pool is used up", () => {
    const pool = planPool({ kind: "square", mix: "each" });
    expect(pool.some((k) => shapeCategory(k) === "letters")).toBe(false);
    expect(new Set(pool.map(shapeCategory)).size).toBe(9);
    const t = shapeTargetsFor({ kind: "square", mix: "each", seed: 7 }, book(pool.length));
    expect(new Set(t).size).toBe(pool.length);
    const twice = shapeTargetsFor({ kind: "square", mix: "each", seed: 7 }, book(pool.length * 2 + 5));
    expect(new Set(twice.slice(pool.length, pool.length * 2)).size).toBe(pool.length);
    expect(noNeighbours(twice)).toBe(true);
  });

  it("random from chosen categories only uses those categories and animal groups", () => {
    const choice: ShapeChoice = { kind: "square", mix: "pick", seed: 3, cats: ["food", "animals:ocean"] };
    const t = shapeTargetsFor(choice, book(60));
    expect(t.every((k) => shapeCategory(k) === "food" || animalGroupOf(k) === "ocean")).toBe(true);
    expect(t.some((k) => shapeCategory(k) === "food")).toBe(true);
    expect(t.some((k) => animalGroupOf(k) === "ocean")).toBe(true);
    expect(noNeighbours(t)).toBe(true);
    const animals = shapeTargetsFor({ kind: "square", mix: "pick", seed: 3, cats: ["animals"] }, book(40));
    expect(animals.every((k) => shapeCategory(k) === "animals")).toBe(true);
    expect(new Set(animals).size).toBe(40);
  });

  it("respects each tool's shapes", () => {
    const cw = shapeTargetsFor({ kind: "square", mix: "each", seed: 9 }, book(300), CROSSWORD_SHAPES);
    expect(cw.every((k) => CROSSWORD_SHAPES.includes(k))).toBe(true);
    const sd = shapeTargetsFor({ kind: "square", mix: "pick", cats: ["animals", "basic"], seed: 9 }, book(300), SUDOKU_SHAPES);
    expect(sd.every((k) => SUDOKU_SHAPES.includes(k))).toBe(true);
    expect(noNeighbours(sd)).toBe(true);
    // A pin the tool cannot use is ignored.
    const pinned = shapeTargetsFor({ kind: "square", mix: "manual", pins: { "0": "letterA" } }, book(2), CROSSWORD_SHAPES);
    expect(pinned[0]).toBe("square");
    expect(leafCounts(CROSSWORD_SHAPES)["letters"]).toBe(0);
  });

  it("pins override a random plan, survive a reshuffle, and never shift the other pages", () => {
    const base: ShapeChoice = { kind: "square", mix: "each", seed: 11 };
    const before = shapeTargetsFor(base, book(50));
    const pins = { "4": "elephant", "20": "heart" } as Record<string, ShapeKey>;
    const after = shapeTargetsFor({ ...base, pins }, book(50));
    expect(after[4]).toBe("elephant");
    expect(after[20]).toBe("heart");
    const changed = after.map((k, i) => (k !== before[i] ? i : -1)).filter((i) => i >= 0);
    expect(changed.every((i) => [3, 4, 5, 19, 20, 21].includes(i))).toBe(true);
    expect(noNeighbours(after)).toBe(true);
    const reshuffled = shapeTargetsFor({ ...base, seed: 99, pins }, book(50));
    expect(reshuffled[4]).toBe("elephant");
    expect(reshuffled[20]).toBe("heart");
    expect(reshuffled).not.toEqual(after);
  });

  it("page by page: picks per puzzle, the default shape elsewhere", () => {
    const t = shapeTargetsFor({ kind: "circle", mix: "manual", pins: { "1": "cat", "3": "pizza" } }, book(5));
    expect(t).toEqual(["circle", "cat", "circle", "pizza", "circle"]);
  });

  it("theme options: one shape per theme, or matching theme names", () => {
    const list = book(9, (i) => ["Elephants", "Dolphins", "Fruit"][Math.floor(i / 3)]);
    const g = shapeTargetsFor({ kind: "square", mix: "each", seed: 5, themes: "group" }, list);
    expect(g.slice(0, 3)).toEqual(["elephant", "elephant", "elephant"]);
    expect(g.slice(3, 6)).toEqual(["dolphin", "dolphin", "dolphin"]);
    expect(new Set(g.slice(6)).size).toBe(1);
    const m = shapeTargetsFor({ kind: "square", mix: "pick", cats: ["animals"], seed: 5, themes: "match" }, list);
    expect(m[0]).toBe("elephant");
    expect(m[3]).toBe("dolphin");
    expect(noNeighbours(m)).toBe(true);
  });

  it("a 500-puzzle book is planned quickly with every rule kept", () => {
    const t0 = performance.now();
    const t = shapeTargetsFor({ kind: "square", mix: "each", seed: 123, pins: { "250": "owl" } }, book(500, (i) => `Theme ${i % 25}`));
    expect(performance.now() - t0).toBeLessThan(500);
    expect(t.length).toBe(500);
    expect(t[250]).toBe("owl");
    expect(noNeighbours(t)).toBe(true);
    expect(new Set(t).size).toBeGreaterThan(120);
  });

  it("design files keep the plan fields and drop bad ones", () => {
    const d = sanitizeDesign({ shape: { kind: "heart", mix: "pick", seed: 5, cats: ["food", "nope", "animals:farm"], pins: { "2": "cat", x: "cat", "3": "nope" }, themes: "match" } });
    expect(d.shape).toMatchObject({ kind: "heart", mix: "pick", seed: 5, cats: ["food", "animals:farm"], pins: { "2": "cat" }, themes: "match" });
    expect(sanitizeDesign({ shape: { mix: "manual" } }).shape.mix).toBe("manual");
    expect(PLAN_LEAF_IDS).toContain("animals:fantasy");
  });

  it("rounded frames survive repeated outline points (boat, airplane)", () => {
    const out = filletPolygon([[0, 0], [10, 0], [10, 0], [10, 10], [0, 10]], 3);
    expect(out.length).toBeGreaterThan(5);
    expect(out.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
  });
});
