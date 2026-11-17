/**
 * AI mystery cases: request options and the JSON the model must return (zod),
 * plus the JSON Schemas handed to the model as tool input schemas.
 */
import { z } from "zod";

export const TONES = ["family", "teens", "noir"] as const;
export type Tone = (typeof TONES)[number];
export const TONE_LABEL: Record<Tone, string> = { family: "Family", teens: "Teens", noir: "Adult noir" };

export const MAX_AI_CASES = 200;
/** Longest evidence word the model may use (fits every grid at every difficulty). */
export const MAX_WORD = 11;
export const MIN_WORD = 3;

export const GenerateRequest = z.object({
  caseCount: z.number().int().min(1).max(MAX_AI_CASES),
  /** A setting id, a short free-text theme, or "surprise". */
  setting: z.string().trim().max(80).default("surprise"),
  tone: z.enum(TONES).default("family"),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  hiddenMessage: z.boolean().default(true),
  missingEvidence: z.boolean().default(true),
  storyline: z.boolean().default(true),
  maxWord: z.number().int().min(5).max(15).default(MAX_WORD),
  seed: z.number().int().optional(),
  /** Recent book titles and settings to steer away from (keeps each book different). */
  avoid: z.array(z.string().trim().transform((s) => s.slice(0, 140))).transform((a) => a.slice(0, 10)).default([]),
  locale: z.string().max(10).optional(),
});
export type GenerateRequest = z.infer<typeof GenerateRequest>;

const name = z.string().trim().min(2).max(40);
export const AiPerson = z.object({
  name,
  role: z.string().trim().min(2).max(40),
  traits: z.array(z.string().trim().min(3).max(40)).min(2).max(5),
});
export const AiOutline = z.object({
  title: z.string().trim().min(3).max(70),
  intro: z.string().trim().min(10).max(500),
  /** The one name of the main location, used word for word everywhere. */
  place: z.string().trim().max(60).optional(),
  cast: z.array(AiPerson).min(3).max(30),
  mastermind: name,
  finalAnswer: z.string().trim().max(40),
  finaleQuestion: z.string().trim().min(5).max(160),
  epilogue: z.string().trim().min(10).max(700),
  cases: z.array(z.object({ title: z.string().trim().min(3).max(60), culprit: name, premise: z.string().trim().min(5).max(240) })).min(1),
});
export type AiOutline = z.infer<typeof AiOutline>;

export const AiCase = z.object({
  index: z.number().int().min(1),
  title: z.string().trim().min(3).max(60),
  story: z.string().trim().min(20).max(500),
  words: z.array(z.string().trim().min(1).max(30)).min(6).max(18),
  missing: z.object({ word: z.string().trim().min(3).max(20), clue: z.string().trim().min(5).max(140) }),
  suspects: z.array(name).min(2).max(4),
  culprit: name,
  lead: z.string().trim().max(200).optional().default(""),
});
export type AiCase = z.infer<typeof AiCase>;
export const AiCaseBatch = z.object({ cases: z.array(AiCase).min(1) });

/** A JSON Schema for a tool input (no $schema key; Bedrock wants the bare object). */
export function toolSchema(s: z.ZodType): Record<string, unknown> {
  const js = z.toJSONSchema(s, { target: "draft-7", io: "input" }) as Record<string, unknown>;
  delete js.$schema;
  return js;
}
