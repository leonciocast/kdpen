/**
 * Smart paste for mystery cases. Tolerant of formats such as:
 *
 *   Case 1: The Missing Pearl          (also "CASE #1 - …", "## Case 1. …", "Title: …")
 *   Story: Lady Wren's pearls …        (lines after Story: continue it)
 *   Words: PEARL, VELVET, BALLROOM     (or one word per line below)
 *   Missing: CLASP - What held the pearls together   (or Missing: CLASP / Clue: …)
 *   Suspects: Ada (wears glasses, owns a dog); Bruno (chef) - has a beard
 *   Culprit: Ada                       (also Killer:, Guilty:, Answer:)
 *   Message: THE BUTLER LIED           (optional; otherwise built from traits)
 *   Lead: The next clue is at the docks.
 */
import { cleanPaste, normalizeWord } from "../paste/parse";
import type { CaseSpec, Person } from "./types";

export interface ParsedCases {
  cases: CaseSpec[];
  cast: Person[];
  /** Plain-language notes about things we couldn't use. */
  notes: string[];
}

type Field = "story" | "words" | "missing" | "clue" | "suspects" | "culprit" | "message" | "lead" | "title";

const FIELD_ALIASES: [RegExp, Field][] = [
  [/^(story|brief|case brief|scenario|description|background|summary)$/, "story"],
  [/^(words?|evidence|evidence words|word list|word bank|clues to find|list)$/, "words"],
  [/^(missing|missing evidence|missing word|hidden word|hidden evidence|secret word|extra word)$/, "missing"],
  [/^(clue|hint|missing clue|riddle)$/, "clue"],
  [/^(suspects?|persons? of interest|characters?|cast)$/, "suspects"],
  [/^(culprit|killer|guilty|answer|solution|thief|murderer|whodunit|who did it)$/, "culprit"],
  [/^(message|hidden message|secret message|leftover message|leftover letters)$/, "message"],
  [/^(lead|next|next lead|link|connection|next case)$/, "lead"],
  [/^(title|case title|name)$/, "title"],
];

const CASE_HEAD = /^\s*(?:#{1,6}\s*)?(?:\*\*)?\s*(?:case|file|mystery|puzzle|chapter)\s*(?:file\s*)?(?:#|no\.?|number)?\s*(\d+|[ivxlc]+)\b\s*[:.\-–—)]*\s*(.*?)(?:\*\*)?\s*$/i;
const FIELD_LINE = /^\s*(?:[-*•]\s*)?(?:\*\*)?([A-Za-z][A-Za-z ]{1,24}?)(?:\*\*)?\s*[:=]\s*(.*)$/;
const BULLET = /^\s*(?:[-*•▪◦●○☐]|\d{1,3}[.)]|[a-z][.)])\s+/i;

function fieldOf(label: string): Field | null {
  const l = label.trim().toLowerCase().replace(/\s+/g, " ");
  for (const [re, f] of FIELD_ALIASES) if (re.test(l)) return f;
  return null;
}

const splitList = (s: string) =>
  s
    .split(/[,;|\t]|\s{2,}|\s+[•·]\s+/)
    .map((x) => x.trim())
    .filter(Boolean);

const cleanTitle = (s: string) =>
  s
    .replace(/[*_#]+/g, "")
    .replace(/^["“'”]+|["“'”]+$/g, "")
    .trim();

/** "PEARL - what held them", "PEARL (what held them)", "PEARL" */
function splitWordClue(s: string): { word: string; clue: string } {
  const m = s.match(/^(.+?)\s*(?:\s[-–—:]\s|[–—]|\(|:)\s*(.+?)\)?\s*$/);
  if (m && m[1].trim().split(/\s+/).length <= 3) return { word: normalizeWord(m[1]), clue: m[2].trim() };
  return { word: normalizeWord(s), clue: "" };
}

const VERBISH = /\b(wears|has|is|owns|rides|speaks|plays|carries|smells|whistles|drinks|keeps|likes|loves|hates|knows|sings|always|never|can|was)\b/i;

/** "Ada Fairweather (heiress) - wears glasses, owns a dog" and friends. */
export function parseSuspect(raw: string): Person | null {
  let s = raw.replace(BULLET, "").replace(/[*_]+/g, "").trim();
  if (!s) return null;
  let role = "";
  let traits: string[] = [];
  const paren = s.match(/\(([^)]*)\)/);
  if (paren) {
    const inside = paren[1].trim();
    if (/,/.test(inside) || VERBISH.test(inside)) traits.push(...inside.split(/\s*[,;]\s*|\s+and\s+/));
    else role = inside;
    s = s.replace(paren[0], " ").replace(/\s+/g, " ").trim();
  }
  const dash = s.match(/^(.+?)\s*(?:\s[-–—]\s|[–—]|:)\s*(.+)$/);
  let name = s;
  if (dash) {
    name = dash[1].trim();
    const rest = dash[2].trim();
    const parts = rest.split(/\s*[,;]\s*|\s+and\s+/).filter(Boolean);
    if (!role && parts.length && !VERBISH.test(parts[0]) && parts.length > 1) role = parts.shift()!;
    else if (!role && parts.length === 1 && !VERBISH.test(parts[0]) && !traits.length) {
      role = parts[0];
      parts.length = 0;
    }
    traits.push(...parts);
  }
  name = name.replace(/^the\s+/i, "").replace(/[.,;]+$/, "").trim();
  if (!name || name.length > 40) return null;
  traits = traits.map((t) => t.replace(/[.]+$/, "").trim().toLowerCase()).filter(Boolean);
  return { name: name.replace(/\b[a-z]/g, (c) => c.toUpperCase()), role: role ? role.charAt(0).toUpperCase() + role.slice(1) : "", traits };
}

function splitSuspects(s: string): string[] {
  // Split on ; or on commas that are outside parentheses and followed by a capitalised name.
  if (s.includes(";")) return s.split(";");
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0 && /^\s*[A-Z]/.test(s.slice(i + 1)) && !VERBISH.test(s.slice(i + 1).trim().split(/\s+/)[0])) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

interface Draft {
  title: string;
  story: string[];
  words: string[];
  missing: string;
  clue: string;
  suspects: Person[];
  culprit: string;
  message: string;
  lead: string;
}

const emptyDraft = (title = ""): Draft => ({ title, story: [], words: [], missing: "", clue: "", suspects: [], culprit: "", message: "", lead: "" });

export function parseCases(text: string): ParsedCases {
  const lines = cleanPaste(text).split("\n");
  const drafts: Draft[] = [];
  const notes: string[] = [];
  let cur: Draft | null = null;
  let field: Field | null = null;
  const start = (title: string) => {
    cur = emptyDraft(cleanTitle(title));
    drafts.push(cur);
    field = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (field === "story" || field === "lead") field = null;
      continue;
    }
    const head = line.match(CASE_HEAD);
    if (head && !FIELD_LINE.test(line.replace(CASE_HEAD, ""))) {
      start(head[2] || `Case ${head[1]}`);
      continue;
    }
    if (/^[-=_*~]{3,}$/.test(line)) {
      field = null;
      continue;
    }
    const fm = line.match(FIELD_LINE);
    const f = fm ? fieldOf(fm[1]) : null;
    if (f) {
      if (!cur || (f === "title" && (cur as Draft).title)) start("");
      const d = cur as unknown as Draft;
      const value = fm![2].trim();
      field = f;
      apply(d, f, value);
      continue;
    }
    if (!cur) start("");
    const d = cur as unknown as Draft;
    // Continuation lines.
    if (field === "words") d.words.push(...splitList(line.replace(BULLET, "")));
    else if (field === "suspects") {
      const p = parseSuspect(line);
      if (p) d.suspects.push(p);
    } else if (field === "story") d.story.push(line);
    else if (field === "lead") d.lead += " " + line;
    else if (field === "clue") d.clue += " " + line;
    else if (!d.title && !d.story.length) d.title = cleanTitle(line);
    else d.story.push(line);
  }

  const cast: Person[] = [];
  const addPerson = (p: Person): Person => {
    const k = p.name.toLowerCase();
    const have = cast.find((x) => x.name.toLowerCase() === k || x.name.toLowerCase().split(" ")[0] === k.split(" ")[0]);
    if (have) {
      if (!have.role && p.role) have.role = p.role;
      for (const t of p.traits) if (!have.traits.includes(t)) have.traits.push(t);
      if (p.name.length > have.name.length && p.name.toLowerCase().startsWith(have.name.toLowerCase())) have.name = p.name;
      return have;
    }
    cast.push({ ...p, traits: p.traits.slice() });
    return cast[cast.length - 1];
  };

  const cases: CaseSpec[] = [];
  drafts.forEach((d, i) => {
    const words = d.words.map(normalizeWord).filter((w) => w.replace(/[^A-ZÑ]/g, "").length >= 2);
    if (!words.length) {
      if (d.title || d.story.length) notes.push(`"${d.title || `Case ${i + 1}`}" has no evidence words, so it was skipped.`);
      return;
    }
    const suspects = d.suspects.map(addPerson);
    let missing: CaseSpec["missing"];
    if (d.missing) {
      const wc = splitWordClue(d.missing);
      if (wc.word) missing = { word: wc.word, clue: (d.clue.trim() || wc.clue).trim() };
    }
    const culprit = d.culprit ? (suspects.find((s) => s.name.toLowerCase().startsWith(d.culprit.toLowerCase().split(" ")[0])) ?? addPerson({ name: d.culprit, role: "", traits: [] })).name : undefined;
    if (d.culprit && !suspects.some((s) => s.name === culprit)) suspects.push(cast.find((c) => c.name === culprit)!);
    cases.push({
      title: d.title || `Case ${cases.length + 1}`,
      story: d.story.join(" ").replace(/\s+/g, " ").trim(),
      words,
      missing,
      suspects: suspects.map((s) => s.name),
      culprit,
      message: d.message ? d.message.toUpperCase() : undefined,
      lead: d.lead.trim() || undefined,
    });
  });
  return { cases, cast, notes };

  function apply(d: Draft, f: Field, value: string) {
    switch (f) {
      case "title":
        d.title = cleanTitle(value);
        break;
      case "story":
        if (value) d.story.push(value);
        break;
      case "words":
        d.words.push(...splitList(value));
        break;
      case "missing":
        d.missing = value;
        break;
      case "clue":
        d.clue = value;
        break;
      case "suspects":
        splitSuspects(value)
          .map(parseSuspect)
          .forEach((p) => p && d.suspects.push(p));
        break;
      case "culprit":
        d.culprit = value.replace(/[*_.]+/g, "").replace(/^the\s+/i, "").trim();
        break;
      case "message":
        d.message = value.replace(/["“”]/g, "").trim();
        break;
      case "lead":
        d.lead = value;
        break;
    }
  }
}

export const CASES_EXAMPLE = `Case 1: The Vanishing Violin
Story: The prize violin vanished from the concert hall just before the encore. The stage door was locked from the inside.
Words: violin, stage, encore, curtain, bow, rosin, audience, usher, ticket, balcony, spotlight, program, orchestra
Missing: case - What the violin travels in
Suspects: Ruby Hale (cellist) - wears glasses, hums; Tom Brisk (usher) - has a beard; Mae Lin (pianist) - hums, wears a hat
Culprit: Ruby Hale
Lead: A rosin stain leads to the bakery.

Case 2: Crumbs at the Bakery
Story: The baker's secret recipe was stolen overnight, and a trail of crumbs runs to the back alley.
Words: oven, flour, dough, recipe, apron, crust, butter, sugar, rolling, whisk, loaf, pastry, yeast
Missing: cookbook - Where recipes are kept
Suspects: Ruby Hale; Tom Brisk; Jo Park (baker) - has flour on her sleeves, wears a hat
Culprit: Tom Brisk`;

/** Cases back to the paste format (so templated or starter cases can be edited as text). */
export function casesToText(cases: CaseSpec[], cast: Person[]): string {
  const person = (n: string) => cast.find((p) => p.name === n);
  return cases
    .map((c, i) => {
      const out = [`Case ${i + 1}: ${c.title}`, `Story: ${c.story}`, `Words: ${c.words.join(", ")}`];
      if (c.missing) out.push(`Missing: ${c.missing.word} - ${c.missing.clue}`);
      if (c.suspects.length)
        out.push(
          `Suspects: ${c.suspects
            .map((n) => {
              const p = person(n);
              if (!p) return n;
              return `${p.name}${p.role ? ` (${p.role.toLowerCase()})` : ""}${p.traits.length ? ` - ${p.traits.join(", ")}` : ""}`;
            })
            .join("; ")}`,
        );
      if (c.culprit) out.push(`Culprit: ${c.culprit}`);
      if (c.message) out.push(`Message: ${c.message}`);
      if (c.lead) out.push(`Lead: ${c.lead}`);
      return out.join("\n");
    })
    .join("\n\n");
}
