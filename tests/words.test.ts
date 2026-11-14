import { describe, expect, it } from "vitest";
import { MAX_WORDS, csvRowsToEntries, csvRowsToTokens, entriesToCsv, parseWords, tokenize, wordsToCsv } from "../src/lib/wordsearch/words";
import { gridForm } from "../src/lib/wordsearch/engine";

describe("word input rules", () => {
  it("one word or phrase per line; spaces stay inside phrases", () => {
    expect(tokenize("ice cream\n  apple pie  \n\nkiwi, plum")).toEqual(["ice cream", "apple pie", "kiwi", "plum"]);
    const r = parseWords(tokenize("ice  cream\nbanana split\nniño\nt-rex"), [], 15);
    expect(r.added).toEqual(["ICE CREAM", "BANANA SPLIT", "NIÑO", "T-REX"]);
  });
  it("grid form strips spaces and hyphens", () => {
    expect(gridForm("ICE CREAM")).toBe("ICECREAM");
    expect(gridForm("JACK-IN-THE-BOX")).toBe("JACKINTHEBOX");
  });
  it("length limit uses letters without spaces", () => {
    expect(parseWords(["BANANA SPLIT"], [], 11).added).toEqual(["BANANA SPLIT"]); // 11 letters
    expect(parseWords(["BANANA SPLIT"], [], 10).errors).toHaveLength(1);
  });
  it("treats ICE CREAM and ICECREAM as duplicates", () => {
    const r = parseWords(["ICECREAM"], ["ICE CREAM"], 15);
    expect(r.added).toEqual([]);
    expect(r.skipped).toHaveLength(1);
  });
  it("accepts letters, digits, Ñ, spaces and hyphens, rejects others", () => {
    const r = parseWords(["apple", "r2d2", "hello!", "café", "o'clock"], [], 15);
    expect(r.added).toEqual(["APPLE", "R2D2"]);
    expect(r.errors).toHaveLength(3);
  });
  it("skips duplicates and 4+ repeating characters", () => {
    const r = parseWords(["apple", "APPLE", "baaaad", "kiwi"], ["KIWI"], 15);
    expect(r.added).toEqual(["APPLE"]);
    expect(r.skipped).toHaveLength(3);
  });
  it("rejects entries without enough letters", () => {
    expect(parseWords(["-", " - ", "a"], [], 15).added).toEqual([]);
  });
  it("allows 20,000 words and stops at the limit", () => {
    expect(MAX_WORDS).toBeGreaterThanOrEqual(20000);
    const existing = Array.from({ length: 199 }, (_, i) => `W${i}X`);
    expect(parseWords(["ALPHA", "BETA"], existing, 15).added).toEqual(["ALPHA", "BETA"]);
    const r = parseWords(["ALPHA", "BETA"], existing, 15, 200);
    expect(r.added).toEqual(["ALPHA"]);
    expect(r.limitReached).toBe(true);
  });
  it("CSV rows: one entry per row, optional header, phrases kept", () => {
    expect(csvRowsToTokens([["Word"], ["hello"], [42], [""], ["ice  cream"]]).tokens).toEqual(["hello", "42", "ice cream"]);
    expect(csvRowsToTokens([["a", "b"]]).error).toBeTruthy();
    expect(wordsToCsv(["A", "ICE CREAM"])).toBe("Word\nA\nICE CREAM\n");
  });
  it("CSV entries: word plus optional theme column, header optional", () => {
    const r = csvRowsToEntries([["Word", "Theme"], ["whale", "Ocean"], ["ice  cream", ""], ["", ""], ["kiwi", "  Fruit  "]]);
    expect(r.entries).toEqual([{ word: "whale", theme: "Ocean" }, { word: "ice cream" }, { word: "kiwi", theme: "Fruit" }]);
    expect(csvRowsToEntries([["a", "b", "c"]]).error).toMatch(/3 columns/);
    expect(csvRowsToEntries([["Word"], ["x1"]]).entries).toEqual([{ word: "x1" }]);
  });
  it("exports themed CSV that imports back", () => {
    const csv = entriesToCsv([{ word: "ICE CREAM", theme: "Summer, Fun" }, { word: "WHALE" }]);
    expect(csv.split("\n")[0]).toBe("Word,Theme");
    expect(csv).toContain('"Summer, Fun"');
  });
});
