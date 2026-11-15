/**
 * Turning case specs into printable cases: the culprit's unique trait becomes
 * the hidden message, key letters spell the book's final phrase, and every
 * grid is built and checked.
 */
import { gridForm, mulberry32 } from "../wordsearch/engine";
import type { ShapeKey } from "../shapes/shapes";
import { BLANK, checkCaseGrid, directionsFor, generateCaseGrid, messageLetters } from "./engine";
import type { CaseBook, CaseKey, CaseSpec, KeySource, MysteryCase, MysteryItem, MysterySettings, Person } from "./types";

const VERB = /^(wears|has|is|owns|rides|speaks|plays|carries|smells|whistles|drinks|keeps|loves|hates|knows|sings|walks|limps|stutters|hums|collects|reads|writes|works|lives|bakes|paints|sails|always|never|can|was|had)\b/i;

/**
 * Different wordings of the same clue, so the grid can use the one whose
 * length fits exactly. Ordered from most to least natural.
 */
export function messageWordings(trait: string): string[] {
  const t = trait.trim().toUpperCase().replace(/[^A-ZÑ' -]/g, "").replace(/-/g, " ");
  if (!t) return [];
  if (!VERB.test(t)) {
    return ["LOOK FOR ", "THE CLUE IS ", "THE KEY CLUE IS ", "THE TELLTALE SIGN IS ", "THE CULPRIT IS LINKED TO ", "THE ONE CLUE THAT MATTERS IS ", "FOLLOW THE CLUE ", "WATCH FOR "].map((p) => p + t);
  }
  const prefixes = [
    "THE CULPRIT ",
    "THE GUILTY ONE ",
    "THE ONE YOU SEEK ",
    "THE GUILTY PARTY ",
    "LOOK FOR THE ONE WHO ",
    "OUR CULPRIT SURELY ",
    "THE CULPRIT IS ONE WHO ",
    "THE ONE YOU ARE SEEKING ",
    "THE CULPRIT IS THE ONE WHO ",
    "THE GUILTY ONE IS THE ONE WHO ",
    "THE CULPRIT IS THE SUSPECT WHO ",
    "YOUR CULPRIT IS THE SUSPECT WHO ",
    "THE GUILTY ONE IS THE SUSPECT WHO ",
    "THE CULPRIT IS THE ONLY SUSPECT WHO ",
    "THE GUILTY PARTY IS THE SUSPECT WHO ",
    "THE GUILTY ONE IS THE ONLY SUSPECT WHO ",
    "THE GUILTY PARTY IS THE ONLY SUSPECT WHO ",
    "CULPRIT ",
    "GUILTY ONE ",
  ];
  return prefixes.map((p) => p + t);
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Traits only the culprit has among the case's suspects. */
export function uniqueTraits(culprit: Person, suspects: Person[]): string[] {
  const others = suspects.filter((p) => p !== culprit);
  return culprit.traits.filter((t) => !others.some((o) => o.traits.some((x) => norm(x) === norm(t))));
}

export function findPerson(cast: Person[], name: string | undefined): Person | undefined {
  if (!name) return undefined;
  const n = norm(name);
  return cast.find((p) => norm(p.name) === n) ?? cast.find((p) => norm(p.name).split(" ")[0] === n.split(" ")[0]) ?? cast.find((p) => norm(p.name).includes(n));
}

export const KEY_SOURCE_TEXT: Record<KeySource, string> = {
  first: "the culprit's first name",
  last: "the culprit's last name",
  missing: "the missing evidence",
  role: "the culprit's job",
  title: "this case's title",
};

const alpha = (s: string) => messageLetters(s);

/** Texts a key letter can come from, best first. */
export function keySources(c: { culprit?: Person; missing?: string; title: string }): [KeySource, string][] {
  const [first, ...rest] = (c.culprit?.name ?? "").split(/\s+/);
  const sources: [KeySource, string][] = [];
  if (c.culprit) sources.push(["first", alpha(first)], ["last", alpha(rest.join(""))]);
  if (c.missing) sources.push(["missing", alpha(c.missing)]);
  if (c.culprit) sources.push(["role", alpha(c.culprit.role.split(/\s+/).pop() ?? "")]);
  sources.push(["title", alpha(c.title)]);
  return sources;
}

/** Which letter of what goes into a Case Board box (the letter must equal `target`). */
export function chooseKey(target: string, box: number, c: { culprit?: Person; missing?: string; title: string }, seed: number): CaseKey | undefined {
  const sources = keySources(c);
  const rng = mulberry32(seed);
  for (const [source, text] of sources) {
    const at: number[] = [];
    for (let i = 0; i < text.length; i++) if (text[i] === target) at.push(i);
    if (at.length) return { box, letter: target, source, position: at[Math.floor(rng() * at.length)] + 1 };
  }
  return undefined;
}

/** Spread `count` key cases over `n` cases (indices). */
export function keyCaseIndices(n: number, count: number): number[] {
  if (count <= 0) return [];
  if (count >= n) return Array.from({ length: n }, (_, i) => i).slice(0, count);
  return Array.from({ length: count }, (_, i) => Math.min(n - 1, Math.floor(((i + 1) * n) / count) - 1));
}

export interface BuildCaseOptions {
  settings: MysterySettings;
  seed: number;
  shape?: ShapeKey;
}

export interface BuiltCase {
  case: MysteryCase;
  warnings: string[];
}

/** Build one printable case (grid included). */
export function buildCase(spec: CaseSpec, number: number, cast: Person[], target: { letter: string; box: number } | null, opts: BuildCaseOptions): BuiltCase {
  const warnings: string[] = [];
  const st = opts.settings;
  const suspects = spec.suspects.map((n) => findPerson(cast, n) ?? { name: n, role: "", traits: [] });
  const culprit = findPerson(suspects, spec.culprit);
  let trait: string | undefined;
  let wordings: string[] = [];
  if (st.hiddenMessage) {
    if (spec.message?.trim()) wordings = [spec.message.trim().toUpperCase()];
    else if (culprit) {
      const u = uniqueTraits(culprit, suspects);
      trait = u[0];
      if (trait) wordings = messageWordings(trait);
      else {
        warnings.push(`Case ${number}: no trait sets ${culprit.name} apart from the other suspects, so the message names the culprit.`);
        wordings = [`THE CULPRIT IS ${culprit.name.split(/\s+/)[0].toUpperCase()}`];
      }
    }
  }
  const missing = st.missingEvidence && spec.missing?.word.trim() ? spec.missing : undefined;
  const words = dedupe(spec.words.filter((w) => !missing || gridForm(w) !== gridForm(missing.word)));
  let grid = null;
  let seed = opts.seed;
  for (let i = 0; i < 6 && !grid; i++) {
    try {
      const g = generateCaseGrid({ words, extra: missing?.word.toUpperCase(), message: wordings.length ? wordings : "", dirs: directionsFor(st.difficulty), seed, shape: opts.shape });
      const check = checkCaseGrid(g.grid, words, missing?.word.toUpperCase(), g.message);
      if (check.ok) grid = g;
      else seed = seed * 31 + 7;
    } catch (e) {
      if (i === 5) throw new Error(`Case ${number} (${spec.title}): ${(e as Error).message}`);
      seed = seed * 31 + 7;
    }
  }
  if (!grid) throw new Error(`Case ${number} (${spec.title}) couldn't be built.`);
  if (grid.blanks.length) warnings.push(`Case ${number}: ${grid.blanks.length} empty square${grid.blanks.length === 1 ? "" : "s"} (add a word or two to fill them).`);
  let key: CaseKey | undefined;
  if (target) {
    key = chooseKey(target.letter, target.box, { culprit: st.hiddenMessage ? culprit : undefined, missing: missing?.word, title: spec.title }, opts.seed);
    if (!key) warnings.push(`Case ${number}: no letter ${target.letter} to give for box ${target.box}.`);
  }
  return {
    warnings,
    case: {
      number,
      title: spec.title,
      story: spec.story,
      lead: st.storyline ? spec.lead : undefined,
      words,
      missing: missing ? { word: missing.word.toUpperCase(), clue: missing.clue } : undefined,
      suspects,
      culprit: st.hiddenMessage ? culprit : undefined,
      trait,
      message: grid.message,
      key,
      templated: spec.templated,
      size: grid.size,
      mask: grid.mask,
      grid: grid.grid,
      placements: grid.placements,
      extra: grid.extra,
      messageCells: grid.messageCells,
      blanks: grid.blanks,
      shape: opts.shape,
    },
  };
}

function dedupe(words: string[]): string[] {
  const seen = new Set<string>();
  return words.map((w) => w.trim().toUpperCase()).filter((w) => {
    const k = gridForm(w);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Final phrase letters for the Case Board, one per key case. */
export const phraseLetters = (p: string) => messageLetters(p);

export interface BookPlan {
  cases: CaseSpec[];
  /** For each case: the phrase letter and box it gives, or null. */
  targets: ({ letter: string; box: number } | null)[];
  phrase: string;
}

/**
 * Give each letter of the final phrase to one case (its box number is the
 * letter's position). Letters are matched to cases whose culprit's name,
 * missing evidence or job contains them; the case title is the last resort.
 * Key cases are spread through the book when there are more cases than letters.
 */
export function planBook(book: CaseBook, cases: CaseSpec[], phrase: string, settings: Pick<MysterySettings, "storyline" | "hiddenMessage" | "missingEvidence">): BookPlan {
  const targets: BookPlan["targets"] = cases.map(() => null);
  if (!settings.storyline) return { cases, targets, phrase: "" };
  const letters = phraseLetters(phrase).slice(0, cases.length);
  const info = cases.map((c) => {
    const suspects = c.suspects.map((n) => findPerson(book.cast, n)).filter((p): p is Person => !!p);
    const culprit = settings.hiddenMessage ? findPerson(suspects, c.culprit) : undefined;
    const missing = settings.missingEvidence ? c.missing?.word : undefined;
    const src = keySources({ culprit, missing, title: c.title });
    return { good: new Set(src.filter(([k]) => k !== "title").map(([, t]) => t).join("")), any: new Set(src.map(([, t]) => t).join("")) };
  });
  // Preferred cases first (spread out), then the rest.
  const spread = keyCaseIndices(cases.length, letters.length);
  const order = [...spread, ...cases.map((_, i) => i).filter((i) => !spread.includes(i))];
  const owner: number[] = cases.map(() => -1); // case -> letter index
  const tryAssign = (li: number, seen: Set<number>, ok: (li: number, ci: number) => boolean): boolean => {
    for (const ci of order) {
      if (seen.has(ci) || !ok(li, ci)) continue;
      seen.add(ci);
      if (owner[ci] === -1 || tryAssign(owner[ci], seen, ok)) {
        owner[ci] = li;
        return true;
      }
    }
    return false;
  };
  const unmatched: number[] = [];
  for (let li = 0; li < letters.length; li++) if (!tryAssign(li, new Set(), (l, ci) => info[ci].good.has(letters[l]))) unmatched.push(li);
  for (const li of unmatched) {
    // Allow the case title too (re-matching earlier letters if needed), then any free case.
    if (tryAssign(li, new Set(), (l, ci) => info[ci].any.has(letters[l]))) continue;
    const ci = order.find((c) => owner[c] === -1);
    if (ci !== undefined) owner[ci] = li;
  }
  owner.forEach((li, ci) => {
    if (li >= 0) targets[ci] = { letter: letters[li], box: li + 1 };
  });
  return { cases, targets, phrase };
}

/** The cast members who appear in the book (all of them for a starter pack). */
function castInBook(cast: Person[], built: MysteryCase[]): Person[] {
  const named = new Set(built.flatMap((c) => c.suspects.map((p) => p.name)));
  const used = cast.filter((p) => named.has(p.name));
  // Keep anyone who never appears as a suspect but belongs to the story (e.g. the keeper).
  return cast.length <= 12 ? cast : used;
}

/** Board, cases and finale in print order. */
export function bookItems(book: CaseBook, built: MysteryCase[], phrase: string, storyline: boolean): MysteryItem[] {
  const out: MysteryItem[] = [];
  const keys = built.filter((c) => c.key).map((c) => ({ box: c.key!.box, case: c.number, letter: c.key!.letter }));
  const boxes = phraseLetters(phrase).length;
  if (storyline) out.push({ kind: "board", title: book.title, intro: book.intro, cast: castInBook(book.cast, built), boxes, phrase, keys, cases: built.length });
  built.forEach((c) => out.push({ kind: "case", case: c }));
  if (storyline) out.push({ kind: "finale", phrase, question: book.finale.question, epilogue: book.finale.epilogue, boxes });
  return out;
}

export interface ValidationResult {
  ok: boolean;
  problems: string[];
}

/** Independent check of the finished book. */
export function validateBook(items: MysteryItem[]): ValidationResult {
  const problems: string[] = [];
  const cases = items.filter((i): i is Extract<MysteryItem, { kind: "case" }> => i.kind === "case").map((i) => i.case);
  for (const c of cases) {
    const g = checkCaseGrid(c.grid, c.words, c.extra?.word, c.message);
    g.problems.forEach((p) => problems.push(`Case ${c.number}: ${p}`));
    if (c.culprit && c.trait) {
      const holders = c.suspects.filter((s) => s.traits.some((t) => norm(t) === norm(c.trait!)));
      if (holders.length !== 1 || holders[0] !== c.culprit) problems.push(`Case ${c.number}: the trait doesn't point to exactly one suspect.`);
      if (!messageLetters(c.message).endsWith(messageLetters(c.trait))) problems.push(`Case ${c.number}: the message doesn't name the trait.`);
    }
    if (c.key) {
      const src = keySourceText(c);
      if (src[c.key.position - 1] !== c.key.letter) problems.push(`Case ${c.number}: key letter mismatch.`);
    }
    if (c.grid.flat().some((v) => v === BLANK) !== c.blanks.length > 0) problems.push(`Case ${c.number}: blank squares are inconsistent.`);
  }
  const board = items.find((i) => i.kind === "board") as Extract<MysteryItem, { kind: "board" }> | undefined;
  if (board) {
    const letters = Array.from({ length: board.boxes }, (_, i) => cases.find((c) => c.key?.box === i + 1)?.key?.letter ?? "?").join("");
    if (letters !== phraseLetters(board.phrase)) problems.push(`The Case Board spells "${letters}", expected "${phraseLetters(board.phrase)}".`);
  }
  return { ok: problems.length === 0, problems };
}

/** The text a case's key letter is taken from. */
export function keySourceText(c: MysteryCase): string {
  const k = c.key;
  if (!k) return "";
  const [first, ...rest] = (c.culprit?.name ?? "").split(/\s+/);
  switch (k.source) {
    case "first":
      return alpha(first);
    case "last":
      return alpha(rest.join(""));
    case "missing":
      return alpha(c.missing?.word ?? "");
    case "role":
      return alpha(c.culprit?.role.split(/\s+/).pop() ?? "");
    default:
      return alpha(c.title);
  }
}

/** "Box 7 ← letter 2 of the culprit's first name". */
export function keyInstruction(k: CaseKey): string {
  return `Letter ${k.position} of ${KEY_SOURCE_TEXT[k.source]}`;
}

export const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

export interface GenerateMysteryInput {
  book: CaseBook;
  cases: CaseSpec[];
  phrase: string;
  settings: MysterySettings;
  /** Grid shape per case (square when missing). */
  shapes?: (ShapeKey | undefined)[];
  seed: number;
}

export interface GeneratedMystery {
  items: MysteryItem[];
  warnings: string[];
  /** Validation problems (should always be empty). */
  problems: string[];
}

/** Build, check and assemble a whole mystery book. */
export function generateMystery(input: GenerateMysteryInput, onCase?: (done: number, total: number) => void): GeneratedMystery {
  const { book, settings } = input;
  const plan = planBook(book, input.cases, input.phrase, settings);
  const warnings: string[] = [];
  const built: MysteryCase[] = [];
  plan.cases.forEach((spec, i) => {
    const b = buildCase(spec, i + 1, book.cast, plan.targets[i], { settings, seed: input.seed + i * 101, shape: input.shapes?.[i] });
    built.push(b.case);
    warnings.push(...b.warnings);
    onCase?.(i + 1, plan.cases.length);
  });
  const items = bookItems(book, built, plan.phrase, settings.storyline && !!plan.phrase);
  const v = validateBook(items);
  return { items, warnings, problems: v.problems };
}
