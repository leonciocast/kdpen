import { describe, expect, test } from "vitest";
import { jsPDF } from "jspdf";
import { PRINT_FILL_INK, PRINT_LINE_INK, PRINT_MIN_LINE_PT, printTone } from "../src/lib/design/paint";
import { generateMystery } from "../src/lib/mystery/model";
import { SALTMERE, phraseFor, starterCases } from "../src/lib/mystery/starter";
import { DEFAULT_MYSTERY_SETTINGS } from "../src/lib/mystery/types";
import { buildMysteryBook, fitLead, mysteryDesign } from "../src/lib/mystery/pdf";
import { nodeFonts } from "../src/lib/print/nodeFonts";
import { DEFAULT_EXTRAS, subtitleLines } from "../src/lib/print/book";
import { DEFAULT_FRONT_MATTER } from "../src/lib/print/frontMatter";

describe("print floors", () => {
  test("light tints darken to the floor, white stays white", () => {
    expect(printTone([255, 255, 255], PRINT_FILL_INK)).toEqual([255, 255, 255]);
    const f = printTone([245, 245, 245], PRINT_FILL_INK);
    expect(f[0]).toBeLessThanOrEqual(Math.round(255 * (1 - PRINT_FILL_INK)));
    const l = printTone([200, 200, 200], PRINT_LINE_INK);
    expect(l[0]).toBeLessThanOrEqual(Math.round(255 * (1 - PRINT_LINE_INK)));
    expect(printTone([60, 60, 60], PRINT_LINE_INK)).toEqual([60, 60, 60]);
  });

  const cases = starterCases(6);
  const long = "Next, a watch in the harbor office starts ticking the wrong way. Find out whose time has been tampered with before the race begins.";
  cases[0] = { ...cases[0], lead: long };
  const out = generateMystery({ book: SALTMERE, cases, phrase: phraseFor(6), settings: DEFAULT_MYSTERY_SETTINGS, seed: 3 });
  const book = buildMysteryBook(out.items, { trim: "8.5x11", bleed: false, answersPerPage: 4, frontMatter: DEFAULT_FRONT_MATTER, extras: DEFAULT_EXTRAS, design: mysteryDesign() }, nodeFonts());
  const pages = (book.pdf.internal as unknown as { pages: string[][] }).pages.slice(1).map((p) => p.join("\n"));
  // jsPDF opens page 1 with its default "0.2 w"; the renderer replaces it before anything is drawn.
  const all = pages.map((p) => p.replace(/^0\.2 w\n0 G\n(?=[\d.]+ w)/, "")).join("\n");

  test("every stroke is at least 0.75 pt and every tint at least 12%", () => {
    const widths = [...all.matchAll(/(?:^|\s)([\d.]+) w(?=\s)/g)].map((m) => parseFloat(m[1]));
    expect(widths.length).toBeGreaterThan(0);
    expect(Math.min(...widths)).toBeGreaterThanOrEqual(PRINT_MIN_LINE_PT - 1e-6);
    const fills = [...[...all.matchAll(/(?:^|\s)([\d.]+) ([\d.]+) ([\d.]+) rg(?=\s)/g)].map((m) => (+m[1] + +m[2] + +m[3]) / 3), ...[...all.matchAll(/(?:^|\s)([\d.]+) g(?=\s)/g)].map((m) => +m[1])];
    const tooLight = fills.filter((v) => v < 0.995 && v > 1 - PRINT_FILL_INK + 0.005);
    expect(tooLight).toEqual([]);
  }, 60000);

  test("a long NEXT LEAD is printed in full, never cut", () => {
    const pdf = new jsPDF({ unit: "pt", format: [612, 792] });
    for (const w of [520, 380, 260]) {
      const fit = fitLead(pdf, long, w, 1);
      expect(fit.lines.join(" ").replace(/\s+/g, " ")).toBe(long);
      expect(fit.size).toBeGreaterThanOrEqual(8);
    }
  });
});

describe("title page", () => {
  test("a two-line subtitle breaks after its colon", () => {
    const pdf = new jsPDF({ unit: "pt", format: [612, 792] });
    pdf.setFontSize(15);
    const lines = subtitleLines(pdf, "50 Detective Cases to Solve: A Whodunit Puzzle Book for Adults", 380);
    expect(lines).toEqual(["50 Detective Cases to Solve:", "A Whodunit Puzzle Book for Adults"]);
    expect(subtitleLines(pdf, "Short subtitle", 380)).toEqual(["Short subtitle"]);
  });
});
