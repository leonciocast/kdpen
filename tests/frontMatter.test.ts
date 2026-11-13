import { describe, expect, it } from "vitest";
import { DEFAULT_FRONT_MATTER, copyrightDetails, isbnLooksValid, parseStoredFrontMatter, resolveNotice } from "../src/lib/print/frontMatter";

describe("front matter", () => {
  it("defaults are placeholders, not real names", () => {
    expect(DEFAULT_FRONT_MATTER.author).toBe("Your Name");
    expect(DEFAULT_FRONT_MATTER.year).toBe("2026");
    expect(DEFAULT_FRONT_MATTER.notice).toContain("All rights reserved");
    expect(DEFAULT_FRONT_MATTER.notice).toContain("personal");
  });
  it("fills {year}, {author} and {imprint} tokens", () => {
    const text = resolveNotice({ ...DEFAULT_FRONT_MATTER, author: "Ana Pérez", year: "2027", notice: "© {year} {author}. Published by {imprint}." });
    expect(text).toBe("© 2027 Ana Pérez. Published by Your Imprint.");
    expect(resolveNotice({ ...DEFAULT_FRONT_MATTER, author: "" , imprint: ""})).toContain("© 2026 the author.");
  });
  it("lists only the filled-in details", () => {
    expect(copyrightDetails({ ...DEFAULT_FRONT_MATTER, isbn: "", website: "" })).toEqual(["First Edition", "Published by Your Imprint"]);
    expect(copyrightDetails({ ...DEFAULT_FRONT_MATTER, edition: "", imprint: "", isbn: "9781234567897", website: "example.com" })).toEqual(["ISBN 9781234567897", "example.com"]);
  });
  it("checks ISBN shape loosely", () => {
    expect(isbnLooksValid("")).toBe(true);
    expect(isbnLooksValid("978-1-23456-789-7")).toBe(true);
    expect(isbnLooksValid("0-306-40615-X")).toBe(true);
    expect(isbnLooksValid("12345")).toBe(false);
  });
  it("restores stored settings safely", () => {
    expect(parseStoredFrontMatter(null).title).toBe(DEFAULT_FRONT_MATTER.title);
    expect(parseStoredFrontMatter("not json").author).toBe("Your Name");
    const fm = parseStoredFrontMatter(JSON.stringify({ author: "Me", year: 2030, bogus: "x" }));
    expect(fm.author).toBe("Me");
    expect(fm.year).toBe("2026"); // non-string ignored
    expect((fm as unknown as Record<string, unknown>).bogus).toBeUndefined();
  });
});
