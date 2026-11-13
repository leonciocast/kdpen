import { gridForm } from "./engine";
import { tidySpaces } from "../text";

/**
 * Same rule for typed words and CSV uploads: letters, digits, Ñ/ñ, hyphens and
 * spaces (multi-word phrases such as "ICE CREAM").
 */
export const VALID_WORD_REGEX = /^[A-Za-z0-9Ññ -]+$/;
export const REPEATING_CHARS_REGEX = /(.)\1{3}/;
export const MAX_WORDS = 200;
export const MIN_WORD_LETTERS = 2;

export interface ParseResult {
  added: string[];
  errors: string[];
  skipped: string[];
  /** Raw entries that had errors (so the UI can keep them for fixing). */
  rejected: string[];
  limitReached: boolean;
}

/** Tidy one entry: trim, collapse repeated spaces, uppercase. */
export function normalizeEntry(raw: string): string {
  return tidySpaces(raw).toUpperCase();
}

/**
 * Split free text (textarea) into entries: one word or phrase per line.
 * Commas and semicolons also separate entries; spaces do not.
 */
export function tokenize(text: string): string[] {
  return text
    .split(/[\r\n,;]+/)
    .map(tidySpaces)
    .filter(Boolean);
}

/**
 * Validate tokens against the spec rules and the words already in the list.
 * `maxLength` is the grid size: a word longer than the grid can never fit.
 */
export function parseWords(
  tokens: string[],
  existing: string[],
  maxLength: number,
  maxWords = MAX_WORDS
): ParseResult {
  const res: ParseResult = { added: [], errors: [], skipped: [], rejected: [], limitReached: false };
  const seen = new Set(existing.map(gridForm));
  for (const raw of tokens) {
    const word = normalizeEntry(raw);
    if (!word) continue;
    if (!VALID_WORD_REGEX.test(word)) {
      res.errors.push(`Word "${raw}" contains invalid characters. Use only letters, numbers, Ñ, spaces and hyphens.`);
      res.rejected.push(raw);
      continue;
    }
    const letters = gridForm(word);
    if (letters.length < MIN_WORD_LETTERS) {
      res.errors.push(`Word "${raw}" is too short (at least ${MIN_WORD_LETTERS} letters).`);
      res.rejected.push(raw);
      continue;
    }
    if (letters.length > maxLength) {
      res.errors.push(
        `"${word}" has ${letters.length} letters (not counting spaces or hyphens); a ${maxLength}×${maxLength} grid fits at most ${maxLength}.`
      );
      res.rejected.push(raw);
      continue;
    }
    if (REPEATING_CHARS_REGEX.test(letters)) {
      res.skipped.push(`Word "${word}" contains 4 or more repeating characters and was skipped.`);
      continue;
    }
    if (seen.has(letters)) {
      res.skipped.push(`Word "${word}" already exists.`);
      continue;
    }
    if (existing.length + res.added.length >= maxWords) {
      res.limitReached = true;
      break;
    }
    seen.add(letters);
    res.added.push(word);
  }
  return res;
}

/**
 * CSV rows -> word tokens. Expects one column; an optional "Word" header row
 * is ignored. Returns an error string if a row has more than one column.
 */
export function csvRowsToTokens(rows: unknown[][]): { tokens: string[]; error?: string } {
  const tokens: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const cells = (rows[i] ?? []).map((v) => (v === null || v === undefined ? "" : tidySpaces(String(v)))).filter(Boolean);
    if (cells.length === 0) continue;
    if (cells.length > 1) {
      return { tokens: [], error: "Invalid CSV file format. The file should have exactly one column for words." };
    }
    if (i === 0 && /^(word|words|word\/phrase|phrase)$/i.test(cells[0])) continue;
    tokens.push(cells[0]);
  }
  return { tokens };
}

export function wordsToCsv(words: string[]): string {
  const esc = (w: string) => (/[",\n]/.test(w) ? `"${w.replace(/"/g, '""')}"` : w);
  return ["Word", ...words.map(esc)].join("\n") + "\n";
}
