/**
 * Smart paste: turn a word list pasted in (almost) any format into themes and words.
 *
 * Handles headings (titles, "Theme: X", "Puzzle 3 - X", "Ocean:", markdown, emoji),
 * list markers (1. 1) a) - • * ☐ [ ]), comma/semicolon/tab/pipe lists, inline
 * "Ocean: whale, shark", CSV with a header, Excel/Docs pastes (tabs, smart quotes,
 * non-breaking spaces) and "CONE – a crunchy holder" definitions. With `clues`
 * (crosswords) "WORD - clue" / "WORD: clue" lines become a word and its clue.
 *
 * Pure and synchronous: no DOM, no React.
 */

export interface PastedItem {
  word: string;
  clue?: string;
}

export interface PastedTheme {
  name: string;
  items: PastedItem[];
  /** Words dropped because they were already in this theme (as written the second time). */
  duplicates: string[];
  /** Entries we could not use, with the reason in plain words. */
  rejected: { text: string; reason: string }[];
  /** The name came from the text (a heading), not from a guess. */
  fromHeading: boolean;
}

export interface PasteResult {
  themes: PastedTheme[];
  /** No heading was found: the single theme needs a name (see `suggestedName`). */
  needsName: boolean;
  suggestedName: string;
  /** What we recognised, for the "we read this as…" line. */
  format: "list" | "csv" | "table";
}

export interface PasteOptions {
  /** Crossword mode: each line is WORD + clue. */
  clues?: boolean;
  /** Longest word (letters, no spaces) that can go in a grid; longer ones are rejected. */
  maxLetters?: number;
  /** Name for a list with no headings (else a guess from the words). */
  fallbackName?: string;
}

const DEFAULT_MAX = 30;

// ------------------------------------------------------------------ cleaning

/** Fix what Word / Google Docs / Excel put in pasted text. */
export function cleanPaste(text: string): string {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .replace(/[\u200B-\u200D\u2060]/g, (m) => (m === "\u200D" ? m : ""))
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[\u2028\u2029]/g, "\n");
}

const EMOJI = /^(?:[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\uFE0F\u200D\u20E3]|\s)+/u;
const EMOJI_ANY = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\uFE0F\u200D\u20E3]/gu;

/** Uppercase, accents off (Ñ kept), digits and punctuation out, phrases kept. "" when nothing is left. */
export function normalizeWord(raw: string): string {
  const s = raw
    .replace(EMOJI_ANY, " ")
    .replace(/[ñ]/g, "\u0001")
    .replace(/[Ñ]/g, "\u0002")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0001|\u0002/g, "Ñ")
    .replace(/ß/g, "SS")
    .replace(/[Ææ]/g, "AE")
    .replace(/[Œœ]/g, "OE")
    .replace(/[Øø]/g, "O")
    .replace(/['`´\u2018\u2019\u02BC]/g, "")
    .toUpperCase()
    .replace(/[–—_]/g, "-")
    .replace(/[^A-ZÑ\- ]+/g, " ")
    .replace(/\s*-\s*/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[\s-]+|[\s-]+$/g, "");
  return s;
}

/** Letters that go into the grid (no spaces or hyphens). */
export const lettersOf = (w: string) => w.replace(/[\s-]/g, "");

/** Tidy a heading into a theme name: no emoji, markers, "Bonus:", counts or trailing colon. */
export function cleanThemeName(raw: string): string {
  let s = raw.replace(EMOJI, "").replace(EMOJI_ANY, " ");
  s = s.replace(/^#{1,6}\s*/, "").replace(/\*\*|__/g, "").replace(/^[*_]+|[*_]+$/g, "");
  s = s.replace(/^\s*(?:theme|topic|category|section|title|list)\s*(?:\d+\s*)?[:|\-–—#.]\s*/i, "");
  s = s.replace(/^\s*(?:puzzle|word\s*search|crossword|page|part|set|round|level|day|week|chapter|unit|lesson|list)\s*#?\s*\d+\s*[:|\-–—.)]?\s*/i, "");
  s = s.replace(/^\s*(?:bonus(?:\s+(?:round|list|words?))?|extra|extras|more|also)\s*[:\-–—]\s*/i, "");
  s = s.replace(/\s*[([]\s*\d+\s*(?:words?|items?|entries)?\s*[)\]]\s*$/i, "");
  s = s.replace(/\s*[-–—:]\s*\d+\s*(?:words?|items?)\s*$/i, "");
  s = s.replace(/[\s:;,.\-–—|=]+$/g, "").replace(/^[\s:;,.\-–—|=]+/g, "");
  s = s.replace(/["]/g, "").replace(/\s+/g, " ").trim();
  if (s && s === s.toUpperCase() && /[A-Z]/.test(s)) s = titleCase(s);
  return s.slice(0, 80);
}

export function titleCase(s: string): string {
  const small = new Set(["a", "an", "and", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with", "&"]);
  return s
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

// ------------------------------------------------------------------ line reading

const MARKER = /^(?:\d{1,4}\s*[.)\]:]|\(\d{1,4}\)|#\d{1,4}\b|[a-zA-Z][.)](?=\s)|[-–—*•·▪▫◦●○►▶▸✓✔✗☐☑☒□■◻◼◆◇♦→>+]|\[\s?[xX✓]?\s?\])\s*/u;
const NUMBER_ONLY = /^\d{1,4}$/;

type Kind = "blank" | "heading" | "item" | "plain";

interface Line {
  raw: string;
  /** Text without the list marker, emoji and markdown. */
  text: string;
  kind: Kind;
  marker: boolean;
  /** Strong heading signal (markdown, emoji, "Theme:", trailing colon). */
  strong: boolean;
  /** Inline "Theme: a, b, c" split into a heading and items. */
  inline?: { name: string; rest: string };
}

const EXPLICIT = /^\s*(?:theme|topic|category|section)\s*(?:\d+\s*)?[:|\-–—#]\s*\S/i;
const PUZZLE_N = /^\s*(?:puzzle|word\s*search|crossword|page|part|set|round|level|day|week|chapter|unit|lesson|list)\s*#?\s*\d+\s*(?:[:|\-–—.)]\s*\S|$)/i;
const DEF_SEP = /\s+[-–—=]\s+|\s*[–—]\s*|\s*=\s*/;

function styleOf(s: string): "upper" | "lower" | "mixed" | "none" {
  const up = /[A-ZÀ-ÞÑ]/.test(s);
  const lo = /[a-zß-ÿñ]/.test(s);
  if (up && lo) return "mixed";
  if (up) return "upper";
  if (lo) return "lower";
  return "none";
}

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;
const LISTY = /[,;|\t]/;
const splitList = (s: string) => s.split(/\s*[,;|\t]\s*/).map((x) => x.trim()).filter(Boolean);
const TITLE_WORDS = /\b(words?|vocabulary|vocab|list|puzzle|theme|search|crossword|bonus|animals|things|names|terms|fun|time|day)\b/i;

function readLine(raw: string, clues: boolean): Line {
  const trimmed = raw.trim();
  if (!trimmed || /^[-=_*~#.\s]{3,}$/.test(trimmed)) return { raw, text: "", kind: "blank", marker: false, strong: false };
  let s = trimmed;
  let strong = false;
  if (/^#{1,6}\s+/.test(s)) {
    strong = true;
    s = s.replace(/^#{1,6}\s+/, "");
  }
  const bold = s.match(/^(?:\*\*|__)(.+?)(?:\*\*|__)\s*:?\s*$/);
  if (bold) {
    strong = true;
    s = bold[1];
  }
  const emoji = s.match(EMOJI);
  if (emoji && emoji[0].trim()) {
    s = s.slice(emoji[0].length);
    if (!MARKER.test(s)) strong = true;
  }
  let marker = false;
  const m = s.match(MARKER);
  if (m && !strong && !NUMBER_ONLY.test(s)) {
    // "A. Lincoln"-style false positives are rare; a lone letter marker needs text after it.
    marker = true;
    s = s.slice(m[0].length);
  }
  s = s.replace(/^\s*(?:\*\*|__)(.+?)(?:\*\*|__)/, "$1").trim();
  if (!s) return { raw, text: "", kind: "blank", marker: false, strong: false };

  if (!marker) {
    if (EXPLICIT.test(s) || PUZZLE_N.test(s)) {
      // "Theme: Ocean" / "Puzzle 3 - Space" (unless it carries a list: "Theme: Ocean | whale, shark")
      const name = s;
      const pipe = name.match(/^(.*?\S)\s*(?:\||\t)\s*(.+)$/);
      if (pipe && splitList(pipe[2]).length >= 1 && !clues) return { raw, text: pipe[1], kind: "heading", marker, strong: true, inline: { name: pipe[1], rest: pipe[2] } };
      return { raw, text: name, kind: "heading", marker, strong: true };
    }
    if (/[:]\s*$/.test(s) && wordCount(s) <= 10) return { raw, text: s, kind: "heading", marker, strong: true };
    if (strong) return { raw, text: s, kind: "heading", marker, strong: true };
    // Inline theme: "Ocean: whale, shark" or "Ocean | whale | shark".
    if (!clues) {
      const colon = s.match(/^([^:,;|\t]{2,60}?)\s*:\s*(.+)$/);
      if (colon && splitList(colon[2]).length >= 2) return { raw, text: colon[1], kind: "heading", marker, strong: true, inline: { name: colon[1], rest: colon[2] } };
      const cells = s.split(/\s*(?:\||\t)\s*/).filter(Boolean);
      if (cells.length === 2 && /\|/.test(s) && splitList(cells[1].replace(/\|/g, ",")).length >= 2 && /[,;]/.test(cells[1]))
        return { raw, text: cells[0], kind: "heading", marker, strong: true, inline: { name: cells[0], rest: cells[1] } };
      if (cells.length >= 3 && !/[,;]/.test(cells[0])) {
        const [head, ...rest] = cells;
        const restStyle = rest.map(styleOf);
        const sameRest = restStyle.every((x) => x === restStyle[0]);
        if ((sameRest && styleOf(head) !== restStyle[0] && styleOf(head) === "mixed") || (wordCount(head) >= 2 && rest.every((r) => wordCount(r) === 1)))
          return { raw, text: head, kind: "heading", marker, strong: true, inline: { name: head, rest: rest.join(", ") } };
      }
    }
  }
  return { raw, text: s, kind: marker ? "item" : "plain", marker, strong: false };
}

/** Decide which plain lines are headings, using the lines around them. */
const CLUE_SEP = /\t|\s[-–—=]\s|[–—]|:\s|\|/;

function markHeadings(lines: Line[], clues: boolean): void {
  const blocks = lines.reduce((n, l, i) => n + (l.kind !== "blank" && (i === 0 || lines[i - 1].kind === "blank") ? 1 : 0), 0);
  const nextNonBlank = (i: number) => {
    for (let j = i + 1; j < lines.length; j++) if (lines[j].kind !== "blank") return { line: lines[j], gap: j > i + 1 };
    return null;
  };
  const following = (i: number) => {
    const out: Line[] = [];
    for (let j = i + 1; j < lines.length && out.length < 6; j++) {
      if (lines[j].kind === "blank") {
        if (out.length) break;
        continue;
      }
      if (lines[j].kind === "heading") break;
      out.push(lines[j]);
    }
    return out;
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.kind !== "plain") continue;
    const text = l.text;
    if (clues) {
      // Crosswords: a line without a clue, followed by WORD - clue lines, is a heading.
      if (CLUE_SEP.test(text)) continue;
      const nx = nextNonBlank(i);
      if (nx && CLUE_SEP.test(nx.line.text)) l.kind = "heading";
      continue;
    }
    if (LISTY.test(text) && splitList(text).length >= 2) continue; // a comma list is items
    if (DEF_SEP.test(text)) continue; // "CONE - a crunchy holder" is an item with a note
    const nxt = nextNonBlank(i);
    if (!nxt) continue;
    // A title line above the first heading ("My Big Puzzle Book") is not a word.
    if (nxt.line.kind === "heading" && wordCount(text) >= 2 && lines.slice(0, i).every((x) => x.kind === "blank")) {
      l.kind = "heading";
      continue;
    }
    const after = following(i);
    if (!after.length) continue;
    const startOrBlank = i === 0 || lines[i - 1].kind === "blank" || lines[i - 1].kind === "heading";
    const words = wordCount(text);
    let score = 0;
    if (startOrBlank) score += 1;
    if (after[0].marker) score += 2;
    if (words >= 2) score += 1;
    const st = styleOf(text);
    const afterStyles = after.filter((a) => !a.marker || true).map((a) => styleOf(a.text));
    const dom = afterStyles.sort((a, b) => afterStyles.filter((x) => x === b).length - afterStyles.filter((x) => x === a).length)[0];
    if (st === "mixed" && dom !== "mixed") score += 1;
    if (TITLE_WORDS.test(text) && words >= 2) score += 1;
    if (blocks >= 2 && startOrBlank && words >= 2 && after.length >= 2 && !after[0].marker) score += 1;
    if (words > 8) score -= 1;
    // A plain line in the middle of plain lines of the same style is a word.
    if (!startOrBlank && i > 0 && lines[i - 1].kind === "plain" && styleOf(lines[i - 1].text) === st) score -= 2;
    if (score >= 3) l.kind = "heading";
  }
}

// ------------------------------------------------------------------ items

/** One item's text → word (and clue). Notes after " - ", in (parentheses) or after ":" are dropped in word mode. */
function itemFrom(text: string, clues: boolean): { word: string; clue?: string } | { error: string; text: string } {
  let s = text.trim();
  if (clues) {
    const m = s.match(/^(.+?)(?:\t+|\s+[-–—=]\s+|\s*[–—]\s*|\s*:\s+|\s*\|\s*|\s*=\s*|(?<=\S)-(?=[A-Za-z]))(.+)$/);
    if (!m) return { error: "needs a clue (write WORD - clue)", text: s };
    const word = normalizeWord(m[1].replace(/\([^)]*\)|\[[^\]]*\]/g, " "));
    const clue = m[2].replace(/\s+/g, " ").trim().replace(/^["']|["']$/g, "");
    if (!clue) return { error: "needs a clue (write WORD - clue)", text: s };
    return { word, clue };
  }
  s = s.replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, " ");
  const def = s.split(/\s+[-–—=:]\s+|\s*[–—=]\s*|:\s+/);
  s = def[0];
  return { word: normalizeWord(s) };
}

function splitItems(text: string, clues: boolean): string[] {
  if (clues) return [text];
  // a note may contain commas: "CONE – crunchy, sweet" is one item
  if (DEF_SEP.test(text) || /:\s+/.test(text) || /\([^)]*,[^)]*\)/.test(text)) return [text];
  return LISTY.test(text) ? splitList(text) : [text];
}

// ------------------------------------------------------------------ tables / CSV

const THEME_COL = /^(theme|themes|title|category|categories|topic|group|section|puzzle|list)$/i;
const WORD_COL = /^(word|words|word\/phrase|phrase|phrases|entry|entries|answer|answers|item|items|term|terms|vocabulary)$/i;
const CLUE_COL = /^(clue|clues|hint|hints|definition|definitions|question|meaning)$/i;

/** Split a CSV/TSV line, honouring quotes. */
export function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"' && !cur.trim()) q = true;
    else if (c === sep) {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

function tryTable(lines: string[], opts: PasteOptions): { rows: { word: string; clue?: string; theme?: string }[]; format: "csv" | "table" } | null {
  const body = lines.filter((l) => l.trim());
  if (body.length < 2) return null;
  for (const sep of ["\t", ",", ";", "|"]) {
    const head = splitCsvLine(body[0], sep);
    if (head.length < 2) continue;
    const wi = head.findIndex((h) => WORD_COL.test(h));
    const ti = head.findIndex((h) => THEME_COL.test(h));
    const ci = head.findIndex((h) => CLUE_COL.test(h));
    if (wi >= 0 && (ti >= 0 || ci >= 0)) {
      const rows = body.slice(1).map((l) => {
        const c = splitCsvLine(l, sep);
        return { word: c[wi] ?? "", clue: ci >= 0 ? c[ci] : undefined, theme: ti >= 0 ? c[ti] : undefined };
      });
      return { rows: rows.filter((r) => r.word), format: "csv" };
    }
  }
  // Header-less spreadsheet paste: every line has the same number (2–3) of tab cells.
  const cells = body.map((l) => l.split("\t").map((c) => c.trim()));
  const n = cells[0].length;
  if (body.length >= 3 && n >= 2 && n <= 3 && cells.every((c) => c.length === n && c.every(Boolean))) {
    const distinct = (k: number) => new Set(cells.map((c) => c[k].toLowerCase())).size;
    const counts = Array.from({ length: n }, (_, k) => distinct(k));
    const min = Math.min(...counts);
    const themeCol = min < body.length / 2 && counts.filter((x) => x === min).length === 1 ? counts.indexOf(min) : -1;
    if (opts.clues) {
      if (n === 2) return null; // WORD<tab>clue lines: the normal reader handles them
      const t = themeCol >= 0 ? themeCol : 2;
      const [w, c] = [0, 1, 2].filter((k) => k !== t);
      return { rows: cells.map((r) => ({ word: r[w], clue: r[c], theme: r[t] })), format: "table" };
    }
    if (themeCol < 0) return null;
    const wordCol = [0, 1, 2].slice(0, n).find((k) => k !== themeCol)!;
    return { rows: cells.map((r) => ({ word: r[wordCol], theme: r[themeCol] })), format: "table" };
  }
  return null;
}

// ------------------------------------------------------------------ naming

const TOPICS: [string, string[]][] = [
  ["Ice Cream", ["ICECREAM", "ICE CREAM", "SUNDAE", "CONE", "SCOOP", "SPRINKLES", "VANILLA", "GELATO", "SHERBET", "MILKSHAKE", "FUDGE"]],
  ["Ocean Life", ["WHALE", "SHARK", "DOLPHIN", "OCTOPUS", "CORAL", "SEAHORSE", "CRAB", "LOBSTER", "JELLYFISH", "STARFISH", "SEAL", "SQUID"]],
  ["Fruits", ["APPLE", "BANANA", "ORANGE", "MANGO", "GRAPE", "PEAR", "KIWI", "LEMON", "CHERRY", "PEACH", "PLUM", "STRAWBERRY", "PINEAPPLE"]],
  ["Farm Animals", ["COW", "PIG", "SHEEP", "GOAT", "HORSE", "CHICKEN", "DUCK", "ROOSTER", "DONKEY", "TRACTOR", "BARN"]],
  ["Colors", ["RED", "BLUE", "GREEN", "YELLOW", "PURPLE", "ORANGE", "PINK", "BLACK", "WHITE", "BROWN", "GRAY", "VIOLET"]],
  ["Weather", ["RAIN", "SNOW", "SUNNY", "CLOUD", "STORM", "THUNDER", "LIGHTNING", "WIND", "FOG", "HAIL", "RAINBOW"]],
  ["Sports", ["SOCCER", "TENNIS", "BASEBALL", "FOOTBALL", "HOCKEY", "GOLF", "BASKETBALL", "RUGBY", "SKIING", "BOXING"]],
  ["Space", ["PLANET", "STAR", "MOON", "ROCKET", "COMET", "GALAXY", "ORBIT", "MARS", "JUPITER", "ASTRONAUT", "SATURN"]],
  ["Summer Fun", ["BEACH", "SUNSHINE", "SANDCASTLE", "SEASHELL", "PICNIC", "LEMONADE", "SWIMMING", "VACATION", "SUNSCREEN"]],
  ["Christmas", ["SANTA", "REINDEER", "SLEIGH", "ELF", "STOCKING", "WREATH", "MISTLETOE", "SNOWMAN", "ORNAMENT", "GIFT"]],
  ["Halloween", ["PUMPKIN", "GHOST", "WITCH", "BAT", "SPIDER", "SKELETON", "CANDY", "COSTUME", "MONSTER", "ZOMBIE"]],
  ["Vegetables", ["CARROT", "POTATO", "TOMATO", "ONION", "LETTUCE", "BROCCOLI", "SPINACH", "CABBAGE", "PEAS", "CORN"]],
  ["Body Parts", ["HEAD", "ARM", "LEG", "HAND", "FOOT", "KNEE", "ELBOW", "SHOULDER", "NOSE", "EAR", "EYE", "MOUTH"]],
  ["Jungle Animals", ["LION", "TIGER", "MONKEY", "GORILLA", "ELEPHANT", "GIRAFFE", "ZEBRA", "PARROT", "SNAKE", "JAGUAR"]],
];

/** A name for a list without a heading: a topic match, else "My Word List". */
export function suggestName(words: string[]): string {
  const set = new Set(words.map((w) => w.toUpperCase()));
  let best: [string, number] = ["", 0];
  for (const [name, keys] of TOPICS) {
    const hits = keys.filter((k) => set.has(k) || set.has(lettersOf(k))).length;
    if (hits > best[1]) best = [name, hits];
  }
  return best[1] >= 2 ? best[0] : "My Word List";
}

// ------------------------------------------------------------------ main

/** Read pasted text into themes and words (see file header for the formats). */
export function parsePasted(input: string, opts: PasteOptions = {}): PasteResult {
  const clues = !!opts.clues;
  const max = opts.maxLetters ?? DEFAULT_MAX;
  const text = cleanPaste(input);
  const rawLines = text.split("\n");
  const themes: PastedTheme[] = [];
  let current: PastedTheme | null = null;
  const seenIn = new Map<PastedTheme, Set<string>>();

  const open = (name: string, fromHeading: boolean) => {
    const cleaned = cleanThemeName(name);
    // Same heading twice: keep adding to the first theme.
    const again = cleaned && themes.find((t) => t.fromHeading && t.name.toLowerCase() === cleaned.toLowerCase());
    if (again) return (current = again);
    current = { name: cleaned, items: [], duplicates: [], rejected: [], fromHeading };
    themes.push(current);
    seenIn.set(current, new Set());
    return current;
  };
  const add = (rawText: string, theme: PastedTheme, item: { word: string; clue?: string } | { error: string; text: string }) => {
    if ("error" in item) return theme.rejected.push({ text: item.text, reason: item.error });
    const w = item.word;
    const letters = lettersOf(w);
    if (!letters) return; // just punctuation or numbers
    if (letters.length < 2) return theme.rejected.push({ text: rawText.trim(), reason: "too short (needs 2 letters or more)" });
    if (letters.length > max) return theme.rejected.push({ text: w, reason: `too long (${letters.length} letters; the biggest grid fits ${max})` });
    if (/(.)\1{3}/.test(letters)) return theme.rejected.push({ text: w, reason: "repeats one letter 4 or more times" });
    const seen = seenIn.get(theme)!;
    if (seen.has(letters)) return theme.duplicates.push(w);
    seen.add(letters);
    theme.items.push(clues ? { word: w, clue: item.clue } : { word: w });
  };
  const ensure = () => current ?? open("", false);

  const table = tryTable(rawLines, opts);
  if (table) {
    for (const r of table.rows) {
      const name = (r.theme ?? "").trim();
      const t = name ? themes.find((x) => x.name.toLowerCase() === cleanThemeName(name).toLowerCase()) ?? open(name, true) : themes.find((x) => !x.name) ?? open("", false);
      current = t;
      if (clues) {
        if (!r.clue?.trim()) add(r.word, t, { error: "needs a clue", text: r.word });
        else add(r.word, t, { word: normalizeWord(r.word), clue: r.clue.trim() });
      } else add(r.word, t, { word: normalizeWord(r.word) });
    }
    return finish(themes, opts, table.format);
  }

  const lines = rawLines.map((l) => readLine(l, clues));
  markHeadings(lines, clues);
  for (const l of lines) {
    if (l.kind === "blank") continue;
    if (l.kind === "heading") {
      const t = open(l.inline ? l.inline.name : l.text, true);
      if (l.inline) for (const part of splitItems(l.inline.rest, clues)) add(part, t, itemFrom(part, clues));
      continue;
    }
    const t = ensure();
    for (const part of splitItems(l.text, clues)) add(part, t, itemFrom(part, clues));
  }
  return finish(themes, opts, "list");
}

function finish(all: PastedTheme[], opts: PasteOptions, format: PasteResult["format"]): PasteResult {
  // Drop empty themes (a book title above the first real heading), unless they hold rejects.
  const themes = all.filter((t) => t.items.length || t.rejected.length || t.duplicates.length);
  const named = themes.some((t) => t.fromHeading && t.name);
  const unnamed = themes.filter((t) => !t.name);
  let suggested = "";
  if (unnamed.length) {
    suggested = opts.fallbackName?.trim() || suggestName(unnamed.flatMap((t) => t.items.map((i) => i.word)));
    unnamed.forEach((t) => (t.name = suggested));
  }
  return { themes, needsName: !named && themes.length > 0, suggestedName: suggested, format };
}

// ------------------------------------------------------------------ review helpers

export interface ThemeReview {
  /** Puzzles this theme becomes at the words-per-puzzle setting. */
  puzzles: number;
  /** Puzzle sizes, e.g. [20, 19]. */
  chunks: number[];
  /** Fewer words than `minWords`: suggest merging with the theme before it. */
  small: boolean;
  /** Words longer than the grid can take comfortably. */
  long: string[];
  /** Words that are also in an earlier theme: [word, that theme's name]. */
  shared: [string, string][];
}

export interface ReviewOptions {
  wordsPerPuzzle: number;
  /** Words with more letters than this are flagged as long. */
  longAt: number;
  minWords?: number;
}

/** Balanced chunk sizes, same rule as the puzzle splitter (no tiny last puzzle). */
export function chunkSizes(n: number, per: number): number[] {
  const p = Math.max(1, Math.floor(per));
  if (n <= 0) return [];
  const count = Math.ceil(n / p);
  const size = Math.ceil(n / count);
  const out: number[] = [];
  for (let i = 0; i < n; i += size) out.push(Math.min(size, n - i));
  return out;
}

export function reviewThemes(themes: { name: string; items: PastedItem[] }[], opts: ReviewOptions): ThemeReview[] {
  const min = opts.minWords ?? 6;
  const owners = new Map<string, number[]>();
  themes.forEach((t, i) =>
    t.items.forEach((it) => {
      const k = lettersOf(it.word);
      const list = owners.get(k) ?? [];
      if (!list.includes(i)) list.push(i);
      owners.set(k, list);
    })
  );
  return themes.map((t, i) => {
    const chunks = chunkSizes(t.items.length, opts.wordsPerPuzzle);
    const shared: [string, string][] = [];
    for (const it of t.items) {
      const other = (owners.get(lettersOf(it.word)) ?? []).find((j) => j < i);
      if (other !== undefined) shared.push([it.word, themes[other].name || "another theme"]);
    }
    return {
      puzzles: chunks.length,
      chunks,
      small: themes.length > 1 && t.items.length > 0 && t.items.length < min,
      long: t.items.filter((it) => lettersOf(it.word).length > opts.longAt).map((it) => it.word),
      shared,
    };
  });
}

/** Example list (Leoncio's ice cream book) for the "Paste example" link and the tests. */
export const PASTE_EXAMPLE = `Ice Cream Word Search Vocabulary
1. ICECREAM
2. VANILLA
3. CHOCOLATE
4. STRAWBERRY
5. COOKIE
6. CARAMEL
7. SPRINKLES
8. SUNDAE
9. CONE
10. WAFFLE
11. SCOOP
12. MILKSHAKE
13. FUDGE
14. CHERRY
15. MINT
16. PEANUT
17. BUTTER
18. BANANA
19. COCONUT
20. PISTACHIO
21. BLUEBERRY
22. RASPBERRY
23. LEMON
24. MANGO
25. SHERBET
26. GELATO
27. FROZEN
28. DESSERT
29. TOPPING
30. WHIPPED
31. CREAM
32. SUNDAE
33. BROWNIE
34. OREO
35. MARSHMALLOW
36. CUP
37. SPOON
38. CHOCOLATECHIP
39. NEAPOLITAN
40. BUTTERSCOTCH
🍧 Bonus: Ice Cream Shop Words
- FREEZER
- FLAVOR
- CONE
- NAPKIN
- SCOOPER
- PARLOR
- DELICIOUS
- COLD
- SWEET
- TREAT`;

export const PASTE_EXAMPLE_CLUES = `Ice Cream Shop
CONE - Crunchy holder for a scoop
SUNDAE - Ice cream with toppings and a cherry
SPRINKLES - Tiny colorful toppings
VANILLA - Classic white flavor
SCOOP - One round serving
WAFFLE - Crisp, grid-patterned cone
FUDGE - Thick chocolate sauce
CHERRY - Red fruit on top
GELATO - Italian-style ice cream
MILKSHAKE - Blended ice cream drink

🍧 Bonus: Frozen Treats
POPSICLE - Frozen treat on a stick
SHERBET - Fruity frozen dessert
SORBET - Dairy-free frozen dessert
SLUSHIE - Icy drink with a straw
FROZEN YOGURT - Tangy soft-serve treat
SNOW CONE - Shaved ice with syrup`;
