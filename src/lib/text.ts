/**
 * Whitespace clean-up shared by the word lists, clue lists and CSV imports.
 */

/** Trim and collapse runs of spaces (incl. non-breaking/tabs) to one space. */
export function tidySpaces(s: string): string {
  return s.replace(/[\s\u00A0\u2000-\u200B\u3000]+/g, " ").trim();
}

/**
 * Tidy a multi-line text box: trim each line, collapse internal spaces,
 * drop blank lines. With `keepTabs`, a tab is kept (as a single tab) because
 * it can separate a crossword word from its clue.
 */
export function tidyLines(text: string, opts: { keepTabs?: boolean } = {}): string {
  return text
    .split(/\r\n|\r|\n/)
    .map((line) =>
      opts.keepTabs
        ? line
            .split(/\t+/)
            .map(tidySpaces)
            .filter((part, i, all) => part || (i > 0 && i < all.length - 1))
            .join("\t")
            .trim()
        : tidySpaces(line)
    )
    .filter(Boolean)
    .join("\n");
}
