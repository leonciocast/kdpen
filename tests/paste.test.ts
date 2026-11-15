import { describe, expect, it } from "vitest";
import { PASTE_EXAMPLE, PASTE_EXAMPLE_CLUES, chunkSizes, cleanThemeName, normalizeWord, parsePasted, reviewThemes, suggestName } from "../src/lib/paste/parse";

const names = (t: string, o = {}) => parsePasted(t, o).themes.map((x) => x.name);
const words = (t: string, i = 0, o = {}) => parsePasted(t, o).themes[i]?.items.map((x) => x.word);

describe("Leoncio's ice cream sample", () => {
  const r = parsePasted(PASTE_EXAMPLE);
  it("finds the two themes with clean names", () => {
    expect(r.themes.map((t) => t.name)).toEqual(["Ice Cream Word Search Vocabulary", "Ice Cream Shop Words"]);
    expect(r.needsName).toBe(false);
  });
  it("keeps 39 unique words in theme 1 and reports the SUNDAE duplicate", () => {
    expect(r.themes[0].items).toHaveLength(39);
    expect(r.themes[0].duplicates).toEqual(["SUNDAE"]);
    expect(r.themes[0].items[0].word).toBe("ICECREAM");
    expect(r.themes[0].items.at(-1)!.word).toBe("BUTTERSCOTCH");
  });
  it("keeps the 10 shop words, CONE included", () => {
    expect(r.themes[1].items.map((i) => i.word)).toEqual(["FREEZER", "FLAVOR", "CONE", "NAPKIN", "SCOOPER", "PARLOR", "DELICIOUS", "COLD", "SWEET", "TREAT"]);
  });
  it("review: CONE shared, long words flagged, 40 words split 20/19 → 3 puzzles", () => {
    const rv = reviewThemes(r.themes, { wordsPerPuzzle: 20, longAt: 10 });
    expect(rv[1].shared).toEqual([["CONE", "Ice Cream Word Search Vocabulary"]]);
    expect(rv[0].shared).toEqual([]);
    expect(rv[0].long).toEqual(expect.arrayContaining(["CHOCOLATECHIP", "MARSHMALLOW", "BUTTERSCOTCH"]));
    expect(rv[0].chunks).toEqual([20, 19]);
    expect(rv.reduce((n, x) => n + x.puzzles, 0)).toBe(3);
    expect(rv[1].small).toBe(false);
  });
});

describe("headings", () => {
  it("lines ending in ':'", () => expect(names("Ocean:\nwhale\nshark\nFarm:\ncow\npig")).toEqual(["Ocean", "Farm"]));
  it("markdown # and **bold**", () => {
    expect(names("# Ocean Animals\n- whale\n- shark\n\n**Farm Animals**\n- cow\n- pig")).toEqual(["Ocean Animals", "Farm Animals"]);
  });
  it("ALL CAPS multi-word heading followed by list items, title-cased", () => {
    const r = parsePasted("OCEAN ANIMALS\n1. WHALE\n2. SHARK\n3. SEAL");
    expect(r.themes.map((t) => t.name)).toEqual(["Ocean Animals"]);
    expect(r.themes[0].items.map((i) => i.word)).toEqual(["WHALE", "SHARK", "SEAL"]);
  });
  it("a phrase among plain words is a word, not a heading", () => {
    const r = parsePasted("SUNSHINE\nICE CREAM\nBEACH BALL\nPICNIC");
    expect(r.themes).toHaveLength(1);
    expect(r.themes[0].items.map((i) => i.word)).toEqual(["SUNSHINE", "ICE CREAM", "BEACH BALL", "PICNIC"]);
  });
  it("emoji + Bonus: prefix stripped", () => {
    expect(cleanThemeName("🍧 Bonus: Ice Cream Shop Words")).toBe("Ice Cream Shop Words");
    expect(names("🌊 Under the Sea\n• whale\n• shark")).toEqual(["Under the Sea"]);
  });
  it("Theme: X and Puzzle 3 - X", () => {
    expect(names("Theme: Ocean\nwhale\nshark\nTheme: Space\nmoon\nstar")).toEqual(["Ocean", "Space"]);
    expect(names("Puzzle 1 - Fruits\napple\npear\nPuzzle 2 – Colors\nred\nblue")).toEqual(["Fruits", "Colors"]);
  });
  it("Title Case heading over plain UPPERCASE words, blocks split by blank lines", () => {
    const r = parsePasted("Ocean Animals\nWHALE\nSHARK\n\nFarm Animals\nCOW\nPIG\n");
    expect(r.themes.map((t) => t.name)).toEqual(["Ocean Animals", "Farm Animals"]);
    expect(r.themes[1].items.map((i) => i.word)).toEqual(["COW", "PIG"]);
  });
  it("word counts in headings are removed", () => expect(cleanThemeName("Fruits (12 words)")).toBe("Fruits"));
  it("a book title above the first heading is dropped (empty theme)", () => {
    expect(names("My Big Puzzle Book\n\nOcean:\n- whale\n- shark")).toEqual(["Ocean"]);
  });
  it("the same heading twice adds to one theme", () => {
    const r = parsePasted("Ocean:\nwhale\nFarm:\ncow\nOcean:\nshark");
    expect(r.themes.map((t) => [t.name, t.items.length])).toEqual([["Ocean", 2], ["Farm", 1]]);
  });
});

describe("inline themes", () => {
  it("Ocean: whale, shark", () => {
    const r = parsePasted("Ocean: whale, shark, seal\nFarm: cow; pig; goat");
    expect(r.themes.map((t) => t.name)).toEqual(["Ocean", "Farm"]);
    expect(r.themes[1].items.map((i) => i.word)).toEqual(["COW", "PIG", "GOAT"]);
  });
  it("Theme | words", () => {
    expect(words("Ocean | whale, shark, seal")).toEqual(["WHALE", "SHARK", "SEAL"]);
    expect(names("Ocean Animals | WHALE | SHARK | SEAL")).toEqual(["Ocean Animals"]);
  });
  it("a pipe list without a title column is all words", () => expect(words("WHALE | SHARK | SEAL")).toEqual(["WHALE", "SHARK", "SEAL"]));
});

describe("list markers", () => {
  it("1. 1) - • * a) ☐ [ ] and plain lines all give the word", () => {
    expect(words("1. ONE\n2) TWO\n- THREE\n• FOUR\n* FIVE\na) SIX\n☐ SEVEN\n[ ] EIGHT\n[x] NINE\nTEN")).toEqual(["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN"]);
  });
  it("comma, semicolon, tab and pipe separated words", () => {
    expect(words("apple, pear; plum\tkiwi | fig")).toEqual(["APPLE", "PEAR", "PLUM", "KIWI", "FIG"]);
  });
  it("extra blank lines and separator rules are ignored", () => expect(words("\n\n apple \n\n\n-----\npear\n\n")).toEqual(["APPLE", "PEAR"]));
});

describe("cleaning words", () => {
  it("uppercase, accents off, Ñ kept, phrases kept", () => {
    expect(normalizeWord("crème brûlée")).toBe("CREME BRULEE");
    expect(normalizeWord("piñata")).toBe("PIÑATA");
    expect(normalizeWord("  ice   cream ")).toBe("ICE CREAM");
    expect(normalizeWord("t-rex")).toBe("T-REX");
  });
  it("digits and punctuation removed", () => {
    expect(normalizeWord("7up!")).toBe("UP");
    expect(normalizeWord("don’t")).toBe("DONT");
    expect(normalizeWord("“Sundae”.")).toBe("SUNDAE");
  });
  it("notes after a dash or in parentheses are dropped", () => {
    expect(words("CONE – a crunchy holder\nSCOOP - one serving, round\nFUDGE (thick sauce)\nMINT: a fresh herb")).toEqual(["CONE", "SCOOP", "FUDGE", "MINT"]);
  });
  it("Word / Google Docs paste: nbsp, smart quotes, zero-width", () => {
    expect(words("1.\u00A0VANILLA\n2.\u00A0\u201CMANGO\u201D\n3.\u200BLEMON")).toEqual(["VANILLA", "MANGO", "LEMON"]);
  });
  it("duplicates inside a theme merge, ICE CREAM = ICECREAM", () => {
    const t = parsePasted("ICE CREAM\nICECREAM\ncone\nCone").themes[0];
    expect(t.items.map((i) => i.word)).toEqual(["ICE CREAM", "CONE"]);
    expect(t.duplicates).toEqual(["ICECREAM", "CONE"]);
  });
  it("too long and too short words are rejected with a reason", () => {
    const t = parsePasted("SUPERCALIFRAGILISTIC\nA\nOK", { maxLetters: 15 }).themes[0];
    expect(t.items.map((i) => i.word)).toEqual(["OK"]);
    expect(t.rejected.map((r) => r.reason)).toEqual([expect.stringContaining("too long"), expect.stringContaining("too short")]);
  });
});

describe("tables", () => {
  it("CSV with a theme,word header (quotes honoured)", () => {
    const r = parsePasted('theme,word\nOcean,whale\nOcean,"sea horse"\nFarm,cow\n');
    expect(r.format).toBe("csv");
    expect(r.themes.map((t) => [t.name, t.items.map((i) => i.word)])).toEqual([["Ocean", ["WHALE", "SEA HORSE"]], ["Farm", ["COW"]]]);
  });
  it("CSV with word,theme order and semicolons", () => {
    expect(names("Word;Category\nwhale;Ocean\ncow;Farm\npig;Farm")).toEqual(["Ocean", "Farm"]);
  });
  it("header-less Excel paste (two tab columns): finds the theme column", () => {
    const r = parsePasted("Ocean\twhale\nOcean\tshark\nOcean\tseal\nFarm\tcow\nFarm\tpig\nFarm\tgoat");
    expect(r.format).toBe("table");
    expect(r.themes.map((t) => t.name)).toEqual(["Ocean", "Farm"]);
    expect(r.themes[0].items.map((i) => i.word)).toEqual(["WHALE", "SHARK", "SEAL"]);
  });
});

describe("no headings", () => {
  it("one theme with a suggested name", () => {
    const r = parsePasted("whale\nshark\ndolphin\noctopus");
    expect(r.needsName).toBe(true);
    expect(r.suggestedName).toBe("Ocean Life");
    expect(r.themes[0].name).toBe("Ocean Life");
  });
  it("a title-looking first line names the list", () => {
    const r = parsePasted("Things at the Beach\nSAND\nWAVES\nTOWEL");
    expect(r.needsName).toBe(false);
    expect(r.themes[0].name).toBe("Things at the Beach");
  });
  it("falls back to My Word List", () => expect(suggestName(["QWERTY", "ZXCV"])).toBe("My Word List"));
  it("words before the first heading get the suggested name", () => {
    const r = parsePasted("apple\nbanana\nmango\nOcean:\nwhale");
    expect(r.themes.map((t) => t.name)).toEqual(["Fruits", "Ocean"]);
  });
});

describe("crossword clues", () => {
  it("WORD - clue and WORD: clue lines, headings between them", () => {
    const r = parsePasted("Animals\nLION - King of the jungle\nEAGLE: Bird with sharp eyes\nOWL\tNight bird\n\nFood\nAPPLE – Keeps the doctor away", { clues: true });
    expect(r.themes.map((t) => t.name)).toEqual(["Animals", "Food"]);
    expect(r.themes[0].items).toEqual([
      { word: "LION", clue: "King of the jungle" },
      { word: "EAGLE", clue: "Bird with sharp eyes" },
      { word: "OWL", clue: "Night bird" },
    ]);
  });
  it("numbered clue lines and a word without a clue", () => {
    const r = parsePasted("1. ICE CREAM - Frozen treat, often in a cone\n2. SUNDAE", { clues: true });
    expect(r.themes[0].items).toEqual([{ word: "ICE CREAM", clue: "Frozen treat, often in a cone" }]);
    expect(r.themes[0].rejected[0].reason).toContain("needs a clue");
  });
  it("the clue example parses into two themes", () => {
    const r = parsePasted(PASTE_EXAMPLE_CLUES, { clues: true, maxLetters: 15 });
    expect(r.themes.map((t) => [t.name, t.items.length])).toEqual([["Ice Cream Shop", 10], ["Frozen Treats", 6]]);
  });
  it("CSV word,clue,theme", () => {
    const r = parsePasted("Word,Clue,Theme\nLION,King of the jungle,Animals\nAPPLE,\"Red, round fruit\",Food", { clues: true });
    expect(r.themes[1].items).toEqual([{ word: "APPLE", clue: "Red, round fruit" }]);
  });
});

describe("review helpers", () => {
  it("balanced chunks like the splitter", () => {
    expect(chunkSizes(40, 20)).toEqual([20, 20]);
    expect(chunkSizes(41, 20)).toEqual([14, 14, 13]);
    expect(chunkSizes(5, 20)).toEqual([5]);
  });
  it("small themes are flagged for merging", () => {
    const r = parsePasted("Ocean:\nwhale\nshark\nseal\ncrab\neel\nsquid\nray\nFarm:\ncow\npig");
    const rv = reviewThemes(r.themes, { wordsPerPuzzle: 20, longAt: 15 });
    expect(rv.map((x) => x.small)).toEqual([false, true]);
  });
  it("a 20,000-word paste is read quickly", () => {
    const big = Array.from({ length: 200 }, (_, t) => `Theme ${t}:\n` + Array.from({ length: 100 }, (_, i) => `${i + 1}. W${String.fromCharCode(65 + (t % 26))}${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`).join("\n")).join("\n");
    const t0 = performance.now();
    const r = parsePasted(big);
    expect(performance.now() - t0).toBeLessThan(1500);
    expect(r.themes).toHaveLength(200);
  });
});

describe("files and the puzzle splitter", () => {
  it("docx XML keeps paragraphs and tabs", async () => {
    const { docxXmlToText } = await import("../src/lib/paste/files");
    const xml = '<w:p><w:r><w:t>Ocean</w:t></w:r></w:p><w:p><w:r><w:t>WHALE</w:t><w:tab/><w:t>big &amp; blue</w:t></w:r></w:p>';
    expect(docxXmlToText(xml)).toBe("Ocean\nWHALE\tbig & blue\n");
  });
  it("the same word in two themes goes into each theme's puzzles once", async () => {
    const { splitIntoPuzzles } = await import("../src/lib/wordsearch/bulk");
    const entries = [
      { word: "CONE", theme: "A" },
      { word: "SCOOP", theme: "A" },
      { word: "CONE", theme: "B" },
      { word: "NAPKIN", theme: "B" },
    ];
    const byTheme = splitIntoPuzzles(entries, { wordsPerPuzzle: 20, size: 12, density: 0.5, groupByTheme: true });
    expect(byTheme.map((s) => s.words)).toEqual([["CONE", "SCOOP"], ["CONE", "NAPKIN"]]);
    const mixed = splitIntoPuzzles(entries, { wordsPerPuzzle: 20, size: 12, density: 0.5, groupByTheme: false });
    expect(mixed[0].words).toEqual(["CONE", "SCOOP", "NAPKIN"]);
  });
});
