import { describe, expect, it } from "vitest";
import { csvRowsToTokens, parseWords, tokenize, wordsToCsv } from "../src/lib/wordsearch/words";

describe("word input rules", () => {
  it("accepts letters, digits, Ñ and hyphens, rejects others", () => {
    const r = parseWords(tokenize("apple niño t-rex r2d2 hello! café"), [], 15);
    expect(r.added).toEqual(["APPLE", "NIÑO", "T-REX", "R2D2"]);
    expect(r.errors).toHaveLength(2);
  });
  it("skips duplicates and 4+ repeating characters", () => {
    const r = parseWords(["apple", "APPLE", "baaaad", "kiwi"], ["KIWI"], 15);
    expect(r.added).toEqual(["APPLE"]);
    expect(r.skipped).toHaveLength(3);
  });
  it("max length follows the grid size", () => {
    expect(parseWords(["SUNFLOWER"], [], 8).errors).toHaveLength(1);
    expect(parseWords(["SUNFLOWER"], [], 9).added).toEqual(["SUNFLOWER"]);
  });
  it("stops at 200 words", () => {
    const existing = Array.from({ length: 199 }, (_, i) => `W${i}X`);
    const r = parseWords(["ALPHA", "BETA"], existing, 15);
    expect(r.added).toEqual(["ALPHA"]);
    expect(r.limitReached).toBe(true);
  });
  it("parses single-column CSV with optional header, numbers included", () => {
    expect(csvRowsToTokens([["Word"], ["hello"], [42], [""], ["niño"]]).tokens).toEqual(["hello", "42", "niño"]);
    expect(csvRowsToTokens([["a", "b"]]).error).toBeTruthy();
    expect(wordsToCsv(["A", "B"])).toBe("Word\nA\nB\n");
  });
});
