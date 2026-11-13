import { gridForm } from "./engine";

/** Same rule for typed words and CSV uploads: letters, digits, Ñ/ñ and hyphens. */
export const VALID_WORD_REGEX = /^[A-Za-z0-9Ññ-]+$/;
export const REPEATING_CHARS_REGEX = /(.)\1{3}/;
export const MAX_WORDS = 200;
export const MIN_WORD_LETTERS = 2;

export interface ParseResult {
  added: string[];
  errors: string[];
  skipped: string[];
  limitReached: boolean;
}

/** Split free text (textarea) into candidate words: whitespace or commas. */
export function tokenize(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((t) => t.trim())
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
  const res: ParseResult = { added: [], errors: [], skipped: [], limitReached: false };
  const seen = new Set(existing.map(gridForm));
  for (const raw of tokens) {
    const word = raw.trim().toUpperCase();
    if (!word) continue;
    if (!VALID_WORD_REGEX.test(word)) {
      res.errors.push(`Word "${raw}" contains invalid characters. Only letters, numbers, Ñ and - are allowed.`);
      continue;
    }
    const letters = gridForm(word);
    if (letters.length < MIN_WORD_LETTERS) {
      res.errors.push(`Word "${raw}" is too short (at least ${MIN_WORD_LETTERS} letters).`);
      continue;
    }
    if (letters.length > maxLength) {
      res.errors.push(`Word "${word}" has ${letters.length} letters; the ${maxLength}×${maxLength} grid allows at most ${maxLength}.`);
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
    const cells = (rows[i] ?? []).map((v) => (v === null || v === undefined ? "" : String(v).trim())).filter(Boolean);
    if (cells.length === 0) continue;
    if (cells.length > 1) {
      return { tokens: [], error: "Invalid CSV file format. The file should have exactly one column for words." };
    }
    if (i === 0 && cells[0].toLowerCase() === "word") continue;
    tokens.push(...tokenize(cells[0]));
  }
  return { tokens };
}

export function wordsToCsv(words: string[]): string {
  return ["Word", ...words].join("\n") + "\n";
}
