import { describe, expect, it } from "vitest";
import { tidyLines, tidySpaces } from "../src/lib/text";
import { csvRowsToTokens, parseWords, tokenize } from "../src/lib/wordsearch/words";
import { parseClueLine } from "../src/lib/crossword/engine";

describe("whitespace clean-up", () => {
  it("trims and collapses spaces", () => {
    expect(tidySpaces("  ICE   CREAM  ")).toBe("ICE CREAM");
    expect(tidySpaces("ICE\u00A0\u00A0CREAM")).toBe("ICE CREAM");
    expect(tidySpaces("   ")).toBe("");
  });

  it("tidies a whole text box: blank lines removed, lines trimmed", () => {
    expect(tidyLines("\n\n  ICE   CREAM \r\n\n   \nsunshine\t\n  BEACH  BALL\n\n")).toBe("ICE CREAM\nsunshine\nBEACH BALL");
  });

  it("can keep a single tab as a crossword separator", () => {
    expect(tidyLines("  LION \t\t King   of the jungle  \n\n", { keepTabs: true })).toBe("LION\tKing of the jungle");
  });

  it("is applied when adding typed entries", () => {
    expect(tokenize("ICE   CREAM\n\n\n   SUN  SHINE   \n")).toEqual(["ICE CREAM", "SUN SHINE"]);
    expect(parseWords(tokenize("  ice    cream  "), [], 15).added).toEqual(["ICE CREAM"]);
  });

  it("is applied to CSV imports", () => {
    expect(csvRowsToTokens([["Word"], ["  ICE    CREAM "], [""], ["   "], [" sun\u00A0 shine"]]).tokens).toEqual(["ICE CREAM", "sun shine"]);
  });

  it("is applied to crossword clues", () => {
    expect(parseClueLine("  ICE   CREAM   -   Frozen    summer treat  ")).toEqual({ answer: "ICE CREAM", clue: "Frozen summer treat" });
  });
});
