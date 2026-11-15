import { describe, expect, test } from "vitest";
import { checkCaseGrid, directionsFor, generateCaseGrid, messageLetters, BLANK } from "../src/lib/mystery/engine";
import { findPerson, generateMystery, keyInstruction, phraseLetters, planBook, uniqueTraits, validateBook } from "../src/lib/mystery/model";
import { CASES_EXAMPLE, casesToText, parseCases } from "../src/lib/mystery/parse";
import { SALTMERE, phraseFor, starterCases } from "../src/lib/mystery/starter";
import { SETTINGS, scaffoldBook } from "../src/lib/mystery/templates";
import { DEFAULT_MYSTERY_SETTINGS, type MysteryItem } from "../src/lib/mystery/types";
import { buildMysteryBook, mysteryDesign } from "../src/lib/mystery/pdf";
import { nodeFonts } from "../src/lib/print/nodeFonts";
import { DEFAULT_EXTRAS } from "../src/lib/print/book";
import { DEFAULT_FRONT_MATTER } from "../src/lib/print/frontMatter";

const cases = (items: MysteryItem[]) => items.flatMap((i) => (i.kind === "case" ? [i.case] : []));

describe("mystery engine", () => {
  const words = ["HARBOR", "QUAY", "STORM", "DAWN", "COAT", "ANCHOR", "LANTERN", "ROPE", "TIDE", "GULLS"];
  test("leftover letters spell the message exactly and every word reads once", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const g = generateCaseGrid({ words, extra: "LOGBOOK", message: ["THE CULPRIT WEARS A HAT", "CULPRIT WEARS A HAT", "GUILTY ONE WEARS A HAT", "WEARS A HAT"], dirs: directionsFor("medium"), seed });
      const check = checkCaseGrid(g.grid, words, "LOGBOOK", g.message);
      expect(check.problems).toEqual([]);
      expect(check.leftover).toBe(messageLetters(g.message));
      expect(g.messageCells.length).toBe(messageLetters(g.message).length);
    }
  });
  test("difficulty limits directions", () => {
    expect(directionsFor("easy").sort()).toEqual(["E", "S"]);
    expect(directionsFor("medium")).toHaveLength(4);
    expect(directionsFor("hard")).toHaveLength(8);
  });
  test("works in a shaped grid", () => {
    const g = generateCaseGrid({ words, message: ["THE CULPRIT WEARS A HAT", "CULPRIT WEARS A HAT", "WEARS A HAT", "A HAT"], dirs: directionsFor("medium"), seed: 7, shape: "heart" });
    expect(g.mask).not.toBeNull();
    expect(checkCaseGrid(g.grid, words, undefined, g.message).problems).toEqual([]);
  });
});

describe("starter pack: The Saltmere Lantern", () => {
  test("every case has a culprit with a trait no other suspect shares", () => {
    for (const c of SALTMERE.cases) {
      const suspects = c.suspects.map((n) => findPerson(SALTMERE.cast, n)!);
      expect(suspects.every(Boolean), c.title).toBe(true);
      expect(uniqueTraits(findPerson(suspects, c.culprit)!, suspects).length, c.title).toBeGreaterThan(0);
    }
  });
  test("phrase fits the case count", () => {
    expect(phraseFor(24)).toBe("THE KEEPER ODETTE MARSH LIED");
    for (const n of [6, 12, 24]) expect(phraseLetters(phraseFor(n)).length).toBeLessThanOrEqual(n);
    expect(starterCases(6).at(-1)!.title).toBe(SALTMERE.cases.at(-1)!.title);
  });
  for (const n of [6, 12, 24])
    for (const difficulty of ["easy", "medium", "hard"] as const)
      test(`${n} cases, ${difficulty}: validates`, () => {
        const settings = { ...DEFAULT_MYSTERY_SETTINGS, difficulty };
        const out = generateMystery({ book: SALTMERE, cases: starterCases(n), phrase: phraseFor(n), settings, seed: 11 });
        expect(out.problems).toEqual([]);
        const cs = cases(out.items);
        expect(cs).toHaveLength(n);
        expect(out.items[0].kind).toBe("board");
        expect(out.items.at(-1)!.kind).toBe("finale");
        // keys spell the phrase in box order
        const keyed = cs.filter((c) => c.key).sort((a, b) => a.key!.box - b.key!.box);
        expect(keyed.map((c) => c.key!.letter).join("")).toBe(phraseLetters(phraseFor(n)));
        for (const c of keyed) expect(keyInstruction(c.key!)).toMatch(/^Letter \d+ of /);
      });
  test("the validator catches a tampered grid", () => {
    const out = generateMystery({ book: SALTMERE, cases: starterCases(6), phrase: phraseFor(6), settings: DEFAULT_MYSTERY_SETTINGS, seed: 3 });
    const c = cases(out.items)[0];
    const [r, col] = c.messageCells[0];
    c.grid[r][col] = c.grid[r][col] === "Z" ? "Q" : "Z";
    expect(validateBook(out.items).ok).toBe(false);
  });
  test("layers can be switched off", () => {
    const settings = { ...DEFAULT_MYSTERY_SETTINGS, hiddenMessage: false, missingEvidence: false, storyline: false };
    const out = generateMystery({ book: SALTMERE, cases: starterCases(6), phrase: phraseFor(6), settings, seed: 5 });
    expect(out.problems).toEqual([]);
    expect(out.items.some((i) => i.kind === "board" || i.kind === "finale")).toBe(false);
    expect(cases(out.items).every((c) => !c.extra && !c.key)).toBe(true);
  });
  test("plan picks a box for every phrase letter", () => {
    const plan = planBook(SALTMERE, SALTMERE.cases, SALTMERE.finale.phrase, DEFAULT_MYSTERY_SETTINGS);
    const boxes = plan.targets.filter(Boolean).map((t) => t!.box).sort((a, b) => a - b);
    expect(boxes).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
  });
});

describe("pasted cases", () => {
  test("reads the example format", () => {
    const p = parseCases(CASES_EXAMPLE);
    expect(p.cases).toHaveLength(2);
    expect(p.cases[0].title).toBe("The Vanishing Violin");
    expect(p.cases[0].missing?.word).toMatch(/case/i);
    expect(p.cases[1].culprit).toBe("Tom Brisk");
    expect(p.cast.find((x) => x.name === "Ruby Hale")?.traits.length).toBeGreaterThan(0);
  });
  test("reads looser formats and aliases", () => {
    const p = parseCases(`CASE #1 - Smoke in the Kitchen
Brief: The chef's knife set vanished during service.
Evidence: knife; stove; apron; ladle; pantry; saucepan; garnish; menu; waiter; order
Hidden word: TIMER - What rings when the bread is done
Persons of interest: Ana Cruz (chef) - wears glasses, sings; Ben Odom (waiter) - sings
Thief: Ana Cruz`);
    expect(p.cases).toHaveLength(1);
    expect(p.cases[0].words.length).toBe(10);
    expect(p.cases[0].missing?.word).toMatch(/timer/i);
    expect(p.cases[0].culprit).toBe("Ana Cruz");
  });
  test("round-trips through text", () => {
    const text = casesToText(SALTMERE.cases.slice(0, 3), SALTMERE.cast);
    const p = parseCases(text);
    expect(p.cases.map((c) => c.title)).toEqual(SALTMERE.cases.slice(0, 3).map((c) => c.title));
    expect(p.cases[0].words.map((w) => w.toUpperCase())).toEqual(SALTMERE.cases[0].words.map((w) => w.toUpperCase()));
  });
  test("pasted cases build and validate", () => {
    const p = parseCases(CASES_EXAMPLE);
    const book = { ...SALTMERE, cast: p.cast, cases: p.cases };
    const out = generateMystery({ book, cases: p.cases, phrase: "", settings: DEFAULT_MYSTERY_SETTINGS, seed: 9 });
    expect(out.problems).toEqual([]);
    expect(cases(out.items)).toHaveLength(2);
  });
});

describe("templated cases", () => {
  test("120 cases across settings build and validate", () => {
    const book = scaffoldBook({ settings: SETTINGS.slice(0, 4).map((s) => s.id), count: 120, seed: 21 }, "CASE CLOSED");
    expect(book.cases).toHaveLength(120);
    const out = generateMystery({ book, cases: book.cases, phrase: book.finale.phrase, settings: DEFAULT_MYSTERY_SETTINGS, seed: 4 });
    expect(out.problems).toEqual([]);
    expect(cases(out.items)).toHaveLength(120);
    expect(cases(out.items).every((c) => c.templated)).toBe(true);
  }, 60000);
});

describe("case-file PDF", () => {
  const out = generateMystery({ book: SALTMERE, cases: starterCases(12), phrase: phraseFor(12), settings: DEFAULT_MYSTERY_SETTINGS, seed: 2 });
  for (const trim of ["8.5x11", "6x9"] as const)
    test(`builds a ${trim} book with readable letters`, () => {
      const book = buildMysteryBook(out.items, { trim, bleed: false, answersPerPage: 4, frontMatter: DEFAULT_FRONT_MATTER, extras: DEFAULT_EXTRAS, design: mysteryDesign() }, nodeFonts());
      const pdf = book.pdf;
      expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(12 + 2);
      const pages = (pdf.internal as unknown as { pages: string[][] }).pages.slice(1);
      const sizes = pages.flatMap((p) => p.join("\n").match(/ ([\d.]+) Tf/g) ?? []).map((m) => parseFloat(m.trim()));
      expect(sizes.length).toBeGreaterThan(0);
      if (trim === "8.5x11") expect(Math.min(...sizes)).toBeGreaterThanOrEqual(7);
      expect(BLANK).toBe("·");
    }, 60000);
});

describe("shapes for mystery cases", () => {
  test("only shapes that hold a case are offered", async () => {
    const { MYSTERY_SHAPES } = await import("../src/lib/shapes/shapes");
    for (const k of ["letterL", "letterT", "digit1", "checkers", "islands9", "zigzag", "longneck"]) expect(MYSTERY_SHAPES).not.toContain(k);
    for (const k of ["heart", "pear", "letterB", "letterE", "dragon", "bee"]) expect(MYSTERY_SHAPES).toContain(k);
  });
  test("a shape that can't hold the evidence falls back to a square grid instead of failing", () => {
    // The original bug: Surprise me gave case 7 a thin shape, the whole build threw and an error toast appeared.
    const out = generateMystery({ book: SALTMERE, cases: starterCases(2), phrase: "", settings: DEFAULT_MYSTERY_SETTINGS, shapes: starterCases(2).map(() => "letterL" as const), seed: 7 });
    expect(out.problems).toEqual([]);
    expect(out.warnings.some((w) => w.includes("square grid"))).toBe(true);
  }, 120000);
  test("words inside other words are left off with a note, never found twice", () => {
    const book = scaffoldBook({ settings: ["vineyard", "circus"], count: 30, seed: 5 }, "CASE CLOSED");
    book.cases[0] = { ...book.cases[0], words: [...book.cases[0].words.slice(0, 10), "VINE", "VINEYARD"] };
    const out = generateMystery({ book, cases: book.cases, phrase: "CASE CLOSED", settings: DEFAULT_MYSTERY_SETTINGS, seed: 3 });
    expect(out.problems).toEqual([]);
    expect(cases(out.items)[0].words).not.toContain("VINE");
  }, 120000);
  test("no hidden message: ordinary filler letters, no dotted squares", () => {
    const out = generateMystery({ book: SALTMERE, cases: starterCases(6), phrase: "", settings: { ...DEFAULT_MYSTERY_SETTINGS, hiddenMessage: false, storyline: false }, seed: 1 });
    expect(out.problems).toEqual([]);
    expect(cases(out.items).every((c) => c.blanks.length === 0 && c.grid.flat().every((v) => v === "" || /^[A-Z]$/.test(v)))).toBe(true);
  });
  test("small starter books never get an answer longer than the case count", () => {
    for (let n = 1; n <= 24; n++) expect(phraseLetters(phraseFor(n)).length).toBeLessThanOrEqual(n);
  });
});
