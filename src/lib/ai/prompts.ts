/** Prompts for AI-written mystery books. Original content only, no gore, no real people. */
import { SETTINGS } from "../mystery/templates";
import { MAX_WORD, MIN_WORD, type AiOutline, type GenerateRequest, type Tone } from "./schema";

const TONE_TEXT: Record<Tone, string> = {
  family: "Family friendly (ages 8 and up): cosy mysteries such as thefts, pranks, sabotage and disappearances. Nobody is hurt. No murder shown, no weapons, no scary content.",
  teens: "For teens: tense and clever, a little spooky is fine, but no gore and no graphic violence. Crimes are thefts, sabotage, blackmail and the occasional off-page poisoning that the victim survives.",
  noir: "Adult noir: moody, rain-soaked, sharp dialogue. Murders may happen off the page, described with restraint. Absolutely no gore, no graphic violence, no sexual content, no profanity.",
};

export const SYSTEM = `You write original detective puzzle books: each case is a word search with a short story, three suspects, evidence words hidden in the grid, a missing piece of evidence and a hidden message that names the culprit through a trait.
Rules you always follow:
- Everything is your own original writing: invented places, invented people, invented events. Never use real people, celebrities, brands, or characters, titles or plots from existing books, games or films (for example, never Sherlock Holmes, Poirot, Clue/Cluedo or any "Kill Grid" book).
- No gore, no graphic violence, no profanity, no slurs, no sexual content, nothing hateful.
- Suspect traits are short visible facts written in the third person present, like "wears a green scarf", "has a limp", "carries a brass key" (3 to 6 words, no names inside).
- Evidence words are single English words, UPPERCASE letters only (no spaces, digits, hyphens or apostrophes), ${MIN_WORD} to ${MAX_WORD} letters, concrete nouns that fit the scene. No word may appear inside another word of the same case (forwards or backwards), e.g. not both VINE and VINEYARD.
- Always answer by calling the provided tool with JSON that matches its schema exactly.`;

// Seeded inspiration for "Surprise me", so every book starts from somewhere new.
const ERAS = ["the 1890s", "the 1920s", "the 1930s", "the 1950s", "the 1960s", "the 1970s", "the 1980s", "the present day", "the near future", "the 1840s", "the 1910s", "the 2000s"];
const PLACES = ["a fishing village", "a mountain observatory", "a riverboat", "a botanical garden", "a lighthouse island", "a winter carnival", "a desert railway town", "a floating market", "a vineyard harvest", "an old opera house", "a seaside boarding school", "a clockmaker's street", "a snowbound monastery", "a canal city", "a lakeside spa", "a traveling theatre", "a hill-town bakery fair", "an ice-skating palace", "a museum of maps", "a tea plantation", "a jazz-age airship", "a lantern festival", "a salt marsh farm", "a puppet theatre", "a chess tournament", "a perfume workshop", "a kite festival", "a royal stables"];
const NAMES = ["English and Scottish", "Irish and Welsh", "Scandinavian", "Italian and French", "Spanish and Portuguese", "Dutch and German", "Greek and Turkish", "Polish and Czech", "a mix from many countries", "Caribbean and British", "Japanese and Korean", "Indian and Persian", "West African and French", "Latin American"];

export function flavorFor(seed: number): string {
  const pick = <T,>(a: T[], k: number) => a[Math.abs(Math.floor(seed / k)) % a.length];
  return `${pick(PLACES, 1)} in ${pick(ERAS, 7)}, with ${pick(NAMES, 53)} names`;
}

export function settingText(setting: string, seed?: number): string {
  const s = SETTINGS.find((x) => x.id === setting);
  if (s) return `${s.name}: ${s.blurb}`;
  if (!setting || setting === "surprise") return `Surprise me: invent a fresh, specific and atmospheric setting (a place and an era) that suits the tone.${seed !== undefined ? ` Starting idea, use it freely: ${flavorFor(seed)}.` : ""}`;
  return setting;
}

export function outlinePrompt(r: GenerateRequest, castSize: number): string {
  return `Plan a connected detective book of exactly ${r.caseCount} cases.
Setting: ${settingText(r.setting, r.seed)}
Tone: ${TONE_TEXT[r.tone]}${r.avoid.length ? `
These were used recently, so make this book clearly different (new title, place, era and names): ${r.avoid.join("; ")}.` : ""}
Write:
- title: the book title (original, at most 8 words).
- place: the one name of the main location (for example "Heron Lake Spa"). Use it word for word everywhere: if the title names the place it must use this exact name, and the intro and every premise use it too. Never give the same place a second name.
- intro: 2 to 3 sentences that set up the overarching mystery for the reader.
- cast: ${castSize} invented people (first and last name, a role, 3 or 4 traits). Make traits varied so that in any group of three, most people have at least one trait the other two don't share. Names must be easy to read and all different.
- mastermind: the cast member behind the whole storyline.
- finalAnswer: ${r.storyline ? `the answer the Case Board spells at the end, at most ${r.caseCount} letters (letters and spaces only), usually the mastermind's name or a short phrase like "THE KEEPER LIED".` : `an empty string.`}
- finaleQuestion: the question on the last page, and epilogue: 2 to 4 sentences revealing the truth.
- cases: exactly ${r.caseCount} entries in story order, each with a title (at most 6 words, all titles different), the culprit of that case (a cast member; spread culprits across the cast) and a premise of at most 15 words. Each case should hint toward the next one, building to the mastermind.`;
}

export function casesPrompt(r: GenerateRequest, o: AiOutline, from: number, to: number, feedback?: Map<number, string[]>): string {
  const cast = o.cast.map((p) => `- ${p.name} (${p.role}): ${p.traits.join("; ")}`).join("\n");
  const list = o.cases
    .slice(from - 1, to)
    .map((c, k) => {
      const n = from + k;
      const fb = feedback?.get(n);
      const after = o.cases[n];
      return `${n}. "${c.title}". Culprit: ${c.culprit}. ${c.premise}${after ? ` Its lead points to case ${n + 1}, "${after.title}".` : ""}${fb?.length ? `\n   Your previous version of this case had problems, fix them: ${fb.join(" ")}` : ""}`;
    })
    .join("\n");
  const next = to < o.cases.length ? o.cases[to] : undefined;
  return `Book: "${o.title}". ${o.intro}${o.place ? `
Place: ${o.place} (always call it exactly this, never another name).` : ""}
Tone: ${TONE_TEXT[r.tone]}
Cast (use these exact names):
${cast}

Write cases ${from} to ${to} of ${o.cases.length}:
${list}${next ? `
(Next comes case ${to + 1}, "${next.title}": ${next.premise} Don't write it, but case ${to}'s lead must point to it.)` : ""}

For each case give:
- index (the case number above) and title (as above).
- story: 2 or 3 sentences (at most 60 words) describing the crime scene and what is wrong, without naming the culprit.
- words: 12 evidence words for this scene (UPPERCASE, letters only, ${MIN_WORD}-${r.maxWord} letters, none inside another).
- missing: one more evidence word (${MIN_WORD}-${r.maxWord} letters, not in the list and not inside any listed word) and a one-sentence clue that points to it without saying it. Every case in the book needs a different missing word and a clue worded its own way, and the missing word must not appear in the culprit's traits (the hidden message would give it away).
- suspects: three different cast names, one of them the culprit; the culprit must have at least one trait that neither other suspect has.
- culprit: the culprit's exact name.
- lead: one sentence pointing to the very next case (the one named after “Its lead points to”), never to a later one, and without hinting at a suspect; required for every case${to === o.cases.length ? " (for the last case, send the reader to the Case Board)" : ""}.`;
}
