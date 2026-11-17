import { describe, expect, it } from "vitest";
import { allowedDirections, generatePuzzle, mulberry32 } from "../src/lib/wordsearch/engine";
import { BookPuzzle } from "../src/lib/wordsearch/pdf";
import { DEFAULT_FRONT_MATTER } from "../src/lib/print/frontMatter";
import { DEFAULT_EXTRAS, NO_EXTRAS, planKinds } from "../src/lib/print/book";
import { applyOrderFix, defaultSlots, describePages, moveSlots, nudgeSlots, readinessChecks, reorderPuzzles, resolveSlots, Slot } from "../src/lib/print/arrange";
import { runJob } from "../src/lib/jobs/run";
import { nodeFonts } from "../src/lib/print/nodeFonts";
import { generateSudoku } from "../src/lib/sudoku";

const fm = { ...DEFAULT_FRONT_MATTER, title: "Arranged", author: "Ana", imprint: "Ana Books" };
const dirs = allowedDirections({ horizontal: true, vertical: true, diagonalDown: false, diagonalUp: false, reversed: false });
const puzzles: BookPuzzle[] = ["ALPHA", "BRAVO", "CHARLIE", "DELTA", "ECHO"].map((t, i) => {
  const words = ["APPLE", "BERRY", "CHERRY", "MANGO"];
  const g = generatePuzzle(words, 10, dirs, mulberry32(i + 7));
  return { title: t, theme: i < 3 ? "Fruit" : "More", size: 10, grid: g.grid, words, placements: g.placements };
});

async function pageTexts(bytes: ArrayBuffer): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    out.push(tc.items.map((x) => ("str" in x ? x.str : "")).join(" ").replace(/\s+/g, " "));
  }
  return out;
}

async function build(slots?: Slot[], items = puzzles) {
  const files = await runJob(
    { type: "build", tool: "word-search", items, volumes: [[0, items.length]], fileBase: "t", slots, settings: { trim: "8.5x11", bleed: false, padForKdp: true, frontMatter: fm, extras: { ...DEFAULT_EXTRAS, notesPages: 1 }, design: (await import("../src/lib/design/templates")).DEFAULT_DESIGN, answersPerPage: 2 } },
    { progress: () => {}, loadFonts: async () => nodeFonts() },
  );
  return files[0];
}

const plan = { frontMatter: fm, extras: { ...DEFAULT_EXTRAS, notesPages: 1 }, sectionCount: 4, hasHowTo: true, padForKdp: true };
const shape = { items: 5, perPage: 1, answersPerPage: 2 };

describe("page arrangement model", () => {
  it("default slots reproduce the planner exactly", () => {
    for (const extras of [DEFAULT_EXTRAS, NO_EXTRAS, { ...DEFAULT_EXTRAS, padWithNotes: false, intro: "Hi" }]) {
      for (const pf of [true, false]) {
        const p = { ...plan, extras, padForKdp: pf };
        const slots = defaultSlots(p, shape);
        const { pages } = describePages(slots, shape, extras, pf);
        expect(pages.map((x) => (x.kind === "puzzle" || x.kind === "solution" ? "content" : x.kind))).toEqual(planKinds({ ...p, contentCount: 5 + 3 }));
      }
    }
  });

  it("moves, nudges and keeps solutions in sync with puzzles", () => {
    const slots = defaultSlots(plan, shape);
    const p = slots.filter((s) => s.kind === "puzzle");
    // Move puzzle 5 to before puzzle 1.
    const moved = moveSlots(slots, [p[4].id], slots.indexOf(p[0]));
    const r = resolveSlots(moved, shape);
    expect(r.itemOrder).toEqual([4, 0, 1, 2, 3]);
    const { pages } = describePages(moved, shape, plan.extras, true);
    expect(pages.filter((x) => x.kind === "puzzle").map((x) => x.label)).toEqual(["Puzzle 1", "Puzzle 2", "Puzzle 3", "Puzzle 4", "Puzzle 5"]);
    expect(pages.filter((x) => x.kind === "solution").map((x) => x.label)).toEqual(["Answers 1–2", "Answers 3–4", "Answers 5"]);
    // Nudging down then up returns to the same order.
    expect(nudgeSlots(nudgeSlots(slots, [p[1].id], 1), [p[1].id], -1)).toEqual(slots);
    // Deleting a puzzle drops its answers: 4 puzzles -> 2 solution pages.
    const del = resolveSlots(slots.filter((s) => s.id !== p[2].id), shape);
    expect(del.itemOrder).toEqual([0, 1, 3, 4]);
    expect(del.slots.filter((s) => s.kind === "solution").length).toBe(2);
  });

  it("page numbers follow positions and reorder fixes work", () => {
    const slots = defaultSlots(plan, shape);
    const sols = slots.filter((s) => s.kind === "solution").map((s) => s.id);
    const odd = moveSlots(slots, sols, 0);
    const { pages } = describePages(odd, shape, plan.extras, true);
    expect(pages[0].kind).toBe("solution");
    expect(pages.every((x, i) => x.page === i + 1)).toBe(true);
    const checks = readinessChecks({ pages, frontMatter: fm, originalItems: 5, items: 5 });
    expect(checks.find((c) => c.id === "order")?.level).toBe("warn");
    expect(checks.find((c) => c.id === "title-first")?.level).toBe("warn");
    const fixed = applyOrderFix(applyOrderFix(odd, "solutions-last"), "title-first");
    const ok = readinessChecks({ pages: describePages(fixed, shape, plan.extras, true).pages, frontMatter: fm, originalItems: 5, items: 5 });
    expect(ok.filter((c) => c.level === "warn" || c.level === "error")).toEqual([]);
  });

  it("flags placeholders and tiny books", () => {
    const { pages } = describePages(defaultSlots(plan, shape), shape, plan.extras, false);
    const c = readinessChecks({ pages, frontMatter: DEFAULT_FRONT_MATTER, originalItems: 5, items: 5, padForKdp: false });
    expect(c.find((x) => x.id === "placeholder")?.level).toBe("warn");
    expect(c.find((x) => x.id === "min")?.level).toBe("error");
  });

  it("shuffles puzzles in place", () => {
    const slots = defaultSlots(plan, shape);
    const rev = reorderPuzzles(slots, (refs) => refs.slice().reverse());
    expect(rev.map((s) => s.kind)).toEqual(slots.map((s) => s.kind));
    expect(resolveSlots(rev, shape).itemOrder).toEqual([4, 3, 2, 1, 0]);
  });
});

describe("arranged PDF export", () => {
  it("default build is unchanged and the arranged PDF prints the arranged order", async () => {
    const plain = await build();
    const same = await build(defaultSlots(plan, shape));
    expect(same.pages).toBe(plain.pages);
    const a = await pageTexts(plain.bytes);
    const b = await pageTexts(same.bytes);
    expect(b).toEqual(a);

    // Reverse the puzzles and put the How to play page right before the notes.
    let slots = reorderPuzzles(defaultSlots(plan, shape), (r) => r.slice().reverse());
    const howto = slots.find((s) => s.kind === "howto")!;
    slots = moveSlots(slots, [howto.id], slots.findIndex((s) => s.kind === "notes"));
    const { pages } = describePages(slots, shape, plan.extras, true);
    const built = await build(slots);
    const t = await pageTexts(built.bytes);
    expect(t.length).toBe(pages.length);
    const puzzlePages = pages.filter((p) => p.kind === "puzzle");
    // Puzzle 1 in the arranged book is the original ECHO, numbered No. 1, on the page the preview says.
    expect(t[puzzlePages[0].page - 1]).toMatch(/ECHO/);
    expect(t[puzzlePages[4].page - 1]).toMatch(/ALPHA/);
    // Printed page numbers follow the new positions.
    for (const p of pages.filter((x) => x.numbered)) expect(t[p.page - 1]).toMatch(new RegExp(`(^| )${p.page}( |$)`));
    // The answers follow: first answers page lists ECHO then DELTA.
    const sol = t[pages.find((p) => p.kind === "solution")!.page - 1];
    expect(sol.indexOf("ECHO")).toBeGreaterThanOrEqual(0);
    expect(sol.indexOf("ECHO")).toBeLessThan(sol.indexOf("DELTA"));
    // The contents page points at the moved How to Play page and the new Solutions page.
    const toc = t[pages.find((p) => p.kind === "toc")!.page - 1];
    const howPage = pages.find((p) => p.kind === "howto")!.page;
    expect(toc).toMatch(new RegExp(`How to Play.*${howPage}`));
    expect(toc).toMatch(new RegExp(`Solutions.*${pages.find((p) => p.kind === "solution")!.page}`));
  }, 30000);

  it("sudoku with several puzzles per page keeps arranged page groups", async () => {
    const sd = Array.from({ length: 6 }, (_, i) => generateSudoku(i < 3 ? "easy" : "hard"));
    const sh = { items: 6, perPage: 4, answersPerPage: 4 };
    const slots = defaultSlots({ ...plan, extras: NO_EXTRAS, frontMatter: null, sectionCount: 3 }, sh);
    const ps = slots.filter((s) => s.kind === "puzzle");
    const swapped = moveSlots(slots, [ps[1].id], slots.indexOf(ps[0]));
    const r = resolveSlots(swapped, sh);
    expect(r.puzzlePageSizes).toEqual([2, 4]);
    const files = await runJob(
      { type: "build", tool: "sudoku", items: sd, volumes: [[0, 6]], fileBase: "s", slots: swapped, settings: { trim: "8.5x11", bleed: false, padForKdp: false, frontMatter: null, extras: NO_EXTRAS, design: (await import("../src/lib/design/templates")).DEFAULT_DESIGN, answersPerPage: 4, perPage: 4 } },
      { progress: () => {}, loadFonts: async () => nodeFonts() },
    );
    expect(files[0].pages).toBe(describePages(swapped, sh, NO_EXTRAS, false).pages.length);
  }, 30000);
});
