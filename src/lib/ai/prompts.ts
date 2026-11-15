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

export function settingText(setting: string): string {
  const s = SETTINGS.find((x) => x.id === setting);
  if (s) return `${s.name}: ${s.blurb}`;
  if (!setting || setting === "surprise") return "Surprise me: invent a fresh, specific and atmospheric setting (a place and an era) that suits the tone.";
  return setting;
}

export function outlinePrompt(r: GenerateRequest, castSize: number): string {
  return `Plan a connected detective book of exactly ${r.caseCount} cases.
Setting: ${settingText(r.setting)}
Tone: ${TONE_TEXT[r.tone]}
Write:
- title: the book title (original, at most 8 words).
- intro: 2 to 3 sentences that set up the overarching mystery for the reader.
- cast: ${castSize} invented people (first and last name, a role, 3 or 4 traits). Make traits varied so that in any group of three, most people have at least one trait the other two don't share. Names must be easy to read and all different.
- mastermind: the cast member behind the whole storyline.
- finalAnswer: ${r.storyline ? `the answer the Case Board spells at the end, at most ${r.caseCount} letters (letters and spaces only), usually the mastermind's name or a short phrase like "THE KEEPER LIED".` : `an empty string.`}
- finaleQuestion: the question on the last page, and epilogue: 2 to 4 sentences revealing the truth.
- cases: exactly ${r.caseCount} entries in story order, each with a title (at most 6 words, all titles different), the culprit of that case (a cast member; spread culprits across the cast) and a one-line premise. Each case should hint toward the next one, building to the mastermind.`;
}

export function casesPrompt(r: GenerateRequest, o: AiOutline, from: number, to: number, feedback?: Map<number, string[]>): string {
  const cast = o.cast.map((p) => `- ${p.name} (${p.role}): ${p.traits.join("; ")}`).join("\n");
  const list = o.cases
    .slice(from - 1, to)
    .map((c, k) => {
      const n = from + k;
      const fb = feedback?.get(n);
      return `${n}. "${c.title}". Culprit: ${c.culprit}. ${c.premise}${fb?.length ? `\n   Your previous version of this case had problems, fix them: ${fb.join(" ")}` : ""}`;
    })
    .join("\n");
  return `Book: "${o.title}". ${o.intro}
Setting: ${settingText(r.setting)}
Tone: ${TONE_TEXT[r.tone]}
Cast (use these exact names):
${cast}

Write cases ${from} to ${to} of ${o.cases.length}:
${list}

For each case give:
- index (the case number above) and title (as above).
- story: 2 or 3 sentences (at most 60 words) describing the crime scene and what is wrong, without naming the culprit.
- words: 12 evidence words for this scene (UPPERCASE, letters only, ${MIN_WORD}-${r.maxWord} letters, none inside another).
- missing: one more evidence word (${MIN_WORD}-${r.maxWord} letters, not in the list and not inside any listed word) and a one-sentence clue that points to it without saying it.
- suspects: three different cast names, one of them the culprit; the culprit must have at least one trait that neither other suspect has.
- culprit: the culprit's exact name.
- lead: one sentence pointing to the next case${to === o.cases.length ? " (for the last case, send the reader to the Case Board)" : ""}.`;
}
