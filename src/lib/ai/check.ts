/**
 * Local checks and repairs for AI-written cases: tidy the evidence words, keep the
 * suspects inside the cast, make sure the hidden message can point to exactly one
 * suspect, filter unsuitable words, and prove each case builds with our engine.
 */
import { gridForm } from "../wordsearch/engine";
import { buildCase, findPerson, uniqueTraits } from "../mystery/model";
import type { CaseSpec, MysterySettings, Person } from "../mystery/types";
import { MIN_WORD, type AiCase, type AiOutline } from "./schema";

/** Words that never belong in these books (gore, profanity, slurs). Whole-word match. */
const BLOCKED = [
  "blood", "bloody", "gore", "gory", "guts", "entrails", "decapitate", "decapitated", "dismember", "dismembered", "mutilate", "mutilated", "corpse", "torture", "tortured", "behead", "beheaded", "slaughter", "massacre", "suicide", "rape", "drug", "drugs", "cocaine", "heroin",
  "fuck", "fucking", "shit", "bitch", "bastard", "asshole", "damn", "crap", "piss", "dick", "cock", "pussy", "slut", "whore", "nazi",
];
const BLOCK_RE = new RegExp(`\\b(${BLOCKED.join("|")})\\b`, "i");
/** A few famous names and titles the books must not borrow. */
const BORROWED = /\b(sherlock|holmes|watson|poirot|marple|moriarty|kill\s*grid|agatha christie|cluedo|clue board game)\b/i;

export function unsuitable(text: string): string | null {
  const m = text.match(BLOCK_RE);
  if (m) return `uses an unsuitable word (“${m[1].toLowerCase()}”)`;
  const b = text.match(BORROWED);
  if (b) return `borrows a well-known name (“${b[1]}”)`;
  return null;
}

const letters = (w: string) => gridForm(w).replace(/[^A-Z]/g, "");
const within = (a: string, b: string) => b.includes(a) || b.includes([...a].reverse().join(""));

export interface CaseCheck {
  spec: CaseSpec;
  /** Fixed silently (shown in the review notes). */
  repairs: string[];
  /** Still wrong: ask the model to rewrite this case. */
  problems: string[];
}

/** Where a case sits in the book (for its lead and the place name). */
export interface CaseContext {
  /** The book's one place name. */
  place?: string;
  /** Title of the next case (none for the last case). */
  nextTitle?: string;
  last?: boolean;
}

// Geographic names only (a lake, a bay, a village…), not rooms like "the Grand Hall".
const PLACE_NOUN = "Lake|Loch|Bay|Island|Isle|Harbor|Harbour|Valley|Village|Springs|Falls|Cove|Point|Marsh|Creek|River|Town|City|Moor|Fen|Sound|Peninsula|Heights";
const PLACE_RE = new RegExp(`\\b((?:[A-Z][a-z'’]+ ){1,2}(?:${PLACE_NOUN}))\\b`, "g");
const CAP = /^(The|A|An|At|In|On|Of|By|And|To|From|Under|Over|Beyond)\s+/;
// One-word invented town names like "Lindenquay" or "Marlowhaven" (the ending gives them away).
const TOWN_RE = /\b([A-Z][a-z]{2,}(?:quay|haven|ville|burgh|borough|bury|mouth|minster|chester|caster|stead|ford))\b/g;
/** Named places in a text, like "Heron Lake", "Saltwater Lake" or "Lindenquay". */
export function placeNames(text: string): string[] {
  const multi = [...text.matchAll(PLACE_RE)].map((m) => m[1].replace(CAP, "").trim()).filter((p) => p.split(" ").length >= 2);
  const towns = [...text.matchAll(TOWN_RE)].map((m) => m[1]).filter((t) => !multi.some((p) => p.includes(t)));
  return [...new Set([...multi, ...towns])];
}
/** Places a text names that the book's place name (or the extra text) doesn't. */
export function strayPlaces(text: string, place: string, also = "", people: string[] = []): string[] {
  const known = `${place} ${also}`.toLowerCase();
  const names = people.map((n) => n.toLowerCase());
  return placeNames(text).filter((p) => {
    // "Gideon Marsh" is a person, not a marsh.
    if (names.some((n) => n.includes(p.toLowerCase()) || p.toLowerCase().includes(n))) return false;
    const words = p.toLowerCase().split(" ");
    // Same proper name with a different place noun ("Heron Lake" vs "Heron Lake Spa") is fine.
    return !known.includes(p.toLowerCase()) && !known.includes(words[0]);
  });
}

const wordsOf = (t: string) => t.toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean);
const singular = (w: string) => w.replace(/(ies)$/, "y").replace(/(es|s)$/, "");

/** The thing a trait is about: "wears a monocle" -> "monocle" (too short or vague words don't count). */
const traitThing = (t: string) => {
  const w = wordsOf(t);
  const last = singular(w[w.length - 1] ?? "");
  return last.length >= 4 ? last : "";
};
const SEEN_RE = /\b(seen|saw|spotted|noticed|glimpsed|witness|witnesses)\b/i;
/**
 * A sentence that has someone seen with another suspect's trait ("a witness saw someone with a
 * monocle") points the reader at that suspect, so it contradicts the case when they're not the culprit.
 */
export function pointsAtOther(text: string, culprit: Person, suspects: Person[]): { person: Person; thing: string } | undefined {
  const own = new Set(culprit.traits.map(traitThing).filter(Boolean));
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if (!SEEN_RE.test(sentence)) continue;
    const said = new Set(wordsOf(sentence).map(singular));
    for (const p of suspects) {
      if (p.name === culprit.name) continue;
      const thing = p.traits.map(traitThing).find((x) => x && !own.has(x) && said.has(x));
      if (thing) return { person: p, thing };
    }
  }
  return undefined;
}
/** A trait has to say what someone visibly has or does, not what they don't ("smokes no pipe, only chews"). */
export function oddTrait(t: string): boolean {
  return /\b(no|not|never|only|without|nobody|none)\b|n't\b/i.test(t);
}
/** The trait that gives the missing word away (it names the same thing), if any. */
export function traitNaming(word: string, traits: string[]): string | undefined {
  const w = singular(word.toLowerCase());
  return traits.find((t) => wordsOf(t).some((x) => singular(x) === w));
}

/** Repair what can be repaired locally; report the rest. */
export function checkAiCase(c: AiCase, cast: Person[], st: MysterySettings, maxWord: number, seed = 1, ctx: CaseContext = {}): CaseCheck {
  const repairs: string[] = [];
  const problems: string[] = [];
  const bad = [c.title, c.story, c.lead, c.missing.clue, ...c.words, c.missing.word].map(unsuitable).find(Boolean);
  if (bad) problems.push(`The case ${bad}.`);
  // Evidence words: letters only, uppercase, within length, unique, none inside another.
  const missing = letters(c.missing.word);
  const seen = new Set<string>();
  let words: string[] = [];
  for (const raw of c.words) {
    const w = letters(raw);
    if (w !== raw.trim().toUpperCase()) repairs.push(`“${raw}” became ${w || "nothing"}`);
    if (w.length < MIN_WORD || w.length > maxWord) {
      repairs.push(`left off “${raw}” (${w.length < MIN_WORD ? "too short" : "too long"})`);
      continue;
    }
    if (seen.has(w) || w === missing) continue;
    seen.add(w);
    words.push(w);
  }
  words = words.filter((w) => {
    const host = words.find((o) => o !== w && o.length >= w.length && within(w, o));
    const inMissing = missing && within(w, missing);
    if (host || inMissing) repairs.push(`left off ${w} (part of ${host ?? missing})`);
    return !host && !inMissing;
  });
  if (words.length < 8) problems.push(`Only ${words.length} usable evidence words; write 10 to 14 words of ${MIN_WORD}–${maxWord} letters, letters only, none inside another.`);
  let missingWord = missing;
  if (missing.length < MIN_WORD || missing.length > maxWord) {
    problems.push(`The missing evidence “${c.missing.word}” must be one word of ${MIN_WORD}–${maxWord} letters.`);
    missingWord = "";
  } else if (words.some((w) => within(missing, w))) problems.push(`The missing evidence ${missing} hides inside another evidence word; pick a different one.`);
  // Suspects: three people from the cast, culprit among them.
  const sus = [...new Set(c.suspects.map((n) => findPerson(cast, n)?.name).filter((n): n is string => !!n))];
  const unknown = c.suspects.filter((n) => !findPerson(cast, n));
  if (unknown.length) problems.push(`Suspects must come from the cast list; ${unknown.join(", ")} ${unknown.length === 1 ? "is" : "are"} not in it.`);
  const culprit = findPerson(cast, c.culprit);
  if (!culprit) problems.push(`The culprit ${c.culprit} is not in the cast.`);
  else if (!sus.includes(culprit.name)) {
    if (sus.length >= 3) sus[sus.length - 1] = culprit.name;
    else sus.push(culprit.name);
    repairs.push(`added the culprit ${culprit.name} to the suspects`);
  }
  if (sus.length < 3 && !unknown.length) problems.push("Every case needs three different suspects from the cast.");
  if (culprit && st.hiddenMessage) {
    const people = sus.map((n) => findPerson(cast, n)).filter((p): p is Person => !!p);
    if (!uniqueTraits(culprit, people).length) problems.push(`${culprit.name} shares every trait with another suspect, so the hidden message can't point to one person. Choose suspects so the culprit has a trait the other two don't.`);
  }
  if (culprit && missingWord && st.missingEvidence) {
    const t = traitNaming(missingWord, culprit.traits);
    if (t) problems.push(`The missing evidence ${missingWord} is also in ${culprit.name}'s trait “${t}”, which gives it away; pick a different missing word.`);
  }
  if (culprit) {
    const others = pointsAtOther(c.story, culprit, sus.map((n) => findPerson(cast, n)).filter((p): p is Person => !!p));
    if (others) problems.push(`The story has someone seen with a ${others.thing}, which points at ${others.person.name}, but the culprit is ${culprit.name}; don't hint at another suspect.`);
  }
  if (ctx.place) {
    const stray = strayPlaces(`${c.title} ${c.story} ${c.lead ?? ""}`, ctx.place, "", cast.map((p) => p.name));
    if (stray.length) problems.push(`Call the place “${ctx.place}” as in the rest of the book, not “${stray[0]}”.`);
  }
  let lead = c.lead?.trim() || "";
  if (!lead && ctx.nextTitle) {
    lead = `The trail leads on to “${ctx.nextTitle}”.`;
    repairs.push("added a lead to the next case");
  } else if (!lead && ctx.last && st.storyline) {
    lead = "Every key is in your notes now. Take them to the Case Board.";
    repairs.push("added a lead to the Case Board");
  }
  const spec: CaseSpec = {
    title: c.title.trim(),
    story: c.story.trim(),
    words,
    missing: missingWord ? { word: missingWord, clue: c.missing.clue.trim() } : undefined,
    suspects: sus.slice(0, 3),
    culprit: culprit?.name,
    lead: lead || undefined,
  };
  // Finally, the engine must build it as a square case.
  if (!problems.length) {
    try {
      buildCase(spec, c.index, cast, null, { settings: st, seed });
    } catch {
      problems.push("The evidence doesn't fit a grid with the hidden message; use fewer or shorter words.");
    }
  }
  return { spec, repairs, problems };
}

/** Check the outline: cast names unique, traits usable, culprits known, final answer usable. */
export function checkOutline(o: AiOutline, caseCount: number, storyline: boolean): { outline: AiOutline; repairs: string[]; problems: string[] } {
  const repairs: string[] = [];
  const problems: string[] = [];
  const names = new Set<string>();
  const cast = o.cast.filter((p) => {
    const k = p.name.toLowerCase();
    if (names.has(k)) return false;
    names.add(k);
    return true;
  });
  const bad = [o.title, o.intro, o.epilogue, o.finaleQuestion, ...cast.flatMap((p) => [p.name, p.role, ...p.traits]), ...o.cases.flatMap((c) => [c.title, c.premise])].map(unsuitable).find(Boolean);
  if (bad) problems.push(`The outline ${bad}.`);
  if (cast.length < 3) problems.push("The cast needs at least three people.");
  for (const p of cast) {
    const odd = p.traits.find(oddTrait);
    if (odd) problems.push(`${p.name}'s trait “${odd}” says what they don't do; give them a simple visible trait instead, like “wears a green scarf”.`);
  }
  if (o.place) {
    const stray = strayPlaces(`${o.title} ${o.intro}`, o.place, "", cast.map((p) => p.name));
    if (stray.length) problems.push(`The place is “${o.place}”; use that exact name in the title and intro instead of “${stray[0]}”.`);
    const inCases = o.cases.map((c) => strayPlaces(`${c.title} ${c.premise}`, o.place!, "", cast.map((p) => p.name))[0]).find(Boolean);
    if (inCases) problems.push(`A case names “${inCases}”; every case happens in “${o.place}”, so use that name (or none).`);
  } else {
    const people = cast.map((p) => p.name);
    const inTitle = placeNames(o.title).filter((p) => strayPlaces(p, "", "", people).length);
    const inIntro = placeNames(o.intro).filter((p) => strayPlaces(p, "", "", people).length);
    if (inTitle.length && inIntro.length && inTitle.every((p) => strayPlaces(p, inIntro.join(" ")).length))
      problems.push(`The title names “${inTitle[0]}” but the intro names “${inIntro[0]}”; give the place one name (and set "place").`);
  }
  if (o.cases.length < caseCount) problems.push(`The outline lists ${o.cases.length} cases; it must list exactly ${caseCount}.`);
  let finalAnswer = letters(o.finalAnswer) ? o.finalAnswer.toUpperCase().replace(/[^A-Z ]/g, "").replace(/\s+/g, " ").trim() : "";
  if (storyline && letters(finalAnswer).length > caseCount) {
    // Too long for the Case Board: use the mastermind's surname or first name if it fits.
    const parts = o.mastermind.toUpperCase().replace(/[^A-Z ]/g, "").split(/\s+/).filter(Boolean);
    const fit = [parts.join(" "), parts[parts.length - 1], parts[0], "SOLVED", "CLUE"].find((p) => p && p.replace(/ /g, "").length <= caseCount) ?? "";
    repairs.push(`shortened the final answer to ${fit || "nothing (too few cases for a Case Board)"}`);
    finalAnswer = fit;
  }
  return { outline: { ...o, cast, cases: o.cases.slice(0, caseCount), finalAnswer }, repairs, problems };
}

const STOP = new Set("a an the of for to in on at by with and or from its it is this that your you one some something used when what".split(" "));
const LEAD_STOP = new Set([...STOP, ..."next then soon after where while there their his her he she who whose now case puzzle trail lead leads clue clues follow find found head look have been gone another missing".split(" ")]);
const leadWords = (t: string) => new Set(wordsOf(t).map(singular).filter((w) => w.length > 2 && !LEAD_STOP.has(w)));
/**
 * The case a lead really describes, when it's clearly not the next one (cases are written in
 * batches, so a lead can jump ahead). Words shared by many cases (the place, the running motif)
 * don't count. Returns the 0-based index of the case it reads like, or -1 when it fits.
 */
export function leadMismatch(specs: (CaseSpec | null)[], i: number): number {
  const lead = specs[i]?.lead;
  if (!lead || i + 1 >= specs.length || !specs[i + 1]) return -1;
  const texts = specs.map((s) => (s ? leadWords(`${s.title} ${s.story} ${s.words.join(" ")} ${s.missing?.word ?? ""}`) : new Set<string>()));
  const df = new Map<string, number>();
  texts.forEach((t) => t.forEach((w) => df.set(w, (df.get(w) ?? 0) + 1)));
  const words = [...leadWords(lead)].filter((w) => (df.get(w) ?? 0) <= Math.max(2, specs.length * 0.25));
  const score = texts.map((t) => words.filter((w) => t.has(w)).length);
  let best = -1;
  score.forEach((v, k) => {
    if (k !== i && k !== i + 1 && (best < 0 || v > score[best])) best = k;
  });
  return best >= 0 && score[best] >= 3 && score[best] - score[i + 1] >= 3 ? best : -1;
}
const clueWords = (t: string) => new Set(wordsOf(t).map(singular).filter((w) => w.length > 2 && !STOP.has(w)));
/** Share of content words two clues have in common (0..1). */
export function clueOverlap(a: string, b: string): number {
  const x = clueWords(a), y = clueWords(b);
  if (!x.size || !y.size) return 0;
  let common = 0;
  for (const w of x) if (y.has(w)) common++;
  return common / Math.min(x.size, y.size);
}

/**
 * Checks across the whole book (cases are written in parallel batches, so these can only
 * be seen afterwards): every missing word is different, and no two clues are near copies.
 * Problems go to the later case, naming what's already taken.
 */
export function checkBook(specs: (CaseSpec | null)[], cast: Person[] = []): Map<number, string[]> {
  const out = new Map<number, string[]>();
  const add = (i: number, p: string) => out.set(i + 1, [...(out.get(i + 1) ?? []), p]);
  const taken = specs.map((s) => s?.missing?.word).filter((w): w is string => !!w);
  specs.forEach((s, i) => {
    if (!s?.missing) return;
    const m = s.missing;
    const j = specs.findIndex((o, k) => k < i && o?.missing && singular(o.missing.word.toLowerCase()) === singular(m.word.toLowerCase()));
    if (j >= 0) {
      add(i, `The missing evidence ${m.word} is already the missing word of case ${j + 1}; every case needs its own (already used: ${[...new Set(taken)].join(", ")}).`);
      return;
    }
    const k = specs.findIndex((o, q) => q < i && o?.missing && clueOverlap(o.missing.clue, m.clue) >= 0.6);
    if (k >= 0) add(i, `The clue “${m.clue}” reads almost like case ${k + 1}'s clue; word it differently.`);
  });
  specs.forEach((s, i) => {
    const j = leadMismatch(specs, i);
    if (j >= 0) add(i, `The lead “${s!.lead}” describes case ${j + 1} (“${specs[j]!.title}”), but it must point to the next case, ${i + 2} (“${specs[i + 1]!.title}”).`);
    // A lead that has the next case's wrong suspect "seen" sends the reader the wrong way.
    const next = specs[i + 1];
    const culprit = next?.culprit ? findPerson(cast, next.culprit) : undefined;
    if (s?.lead && next && culprit) {
      const other = pointsAtOther(s.lead, culprit, next.suspects.map((n) => findPerson(cast, n)).filter((p): p is Person => !!p));
      if (other) add(i, `The lead has someone seen with a ${other.thing}, which points at ${other.person.name}, but case ${i + 2}'s culprit is ${culprit.name}; leave that hint out.`);
    }
  });
  return out;
}
