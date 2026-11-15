import { describe, expect, test } from "vitest";
import type { ConverseCommandOutput } from "@aws-sdk/client-bedrock-runtime";
import { AiError, bedrockLlm, extractToolInput, type ConverseSender } from "../src/lib/ai/bedrock";
import { checkAiCase, checkBook, checkOutline, clueOverlap, leadMismatch, oddTrait, placeNames, pointsAtOther, strayPlaces, unsuitable } from "../src/lib/ai/check";
import { generateAiBook, regenerateCase, type AiProgress } from "../src/lib/ai/generate";
import { casesPrompt, flavorFor, outlinePrompt } from "../src/lib/ai/prompts";
import { mockLlm } from "../src/lib/ai/mock";
import { GenerateRequest, toolSchema, AiOutline } from "../src/lib/ai/schema";
import { generateMystery } from "../src/lib/mystery/model";
import { TEMPLATE_CAST } from "../src/lib/mystery/templates";
import { DEFAULT_MYSTERY_SETTINGS } from "../src/lib/mystery/types";

const req = (o: Partial<GenerateRequest> = {}) => GenerateRequest.parse({ caseCount: 12, ...o });
const toolReply = (input: unknown, usage = { inputTokens: 100, outputTokens: 50 }): ConverseCommandOutput =>
  ({ output: { message: { role: "assistant", content: [{ toolUse: { toolUseId: "t1", name: "write_outline", input } }] } }, usage: { ...usage, totalTokens: 0 }, stopReason: "tool_use", metrics: { latencyMs: 1 }, $metadata: {} }) as unknown as ConverseCommandOutput;
const textReply = (text: string) => ({ output: { message: { role: "assistant", content: [{ text }] } }, usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 }, stopReason: "end_turn", $metadata: {} }) as unknown as ConverseCommandOutput;
const sender = (replies: (ConverseCommandOutput | Error)[]): ConverseSender & { calls: number } => {
  const s = {
    calls: 0,
    async send() {
      const r = replies[Math.min(s.calls, replies.length - 1)];
      s.calls++;
      if (r instanceof Error) throw r;
      return r;
    },
  };
  return s as never;
};
const named = (name: string, message = name) => Object.assign(new Error(message), { name });
const TOOL = { system: "s", prompt: "p", tool: { name: "write_outline", description: "d", schema: {} }, maxTokens: 100 };

describe("Bedrock wrapper (mocked client)", () => {
  test("valid tool output is returned with its token usage", async () => {
    const llm = bedrockLlm({ client: sender([toolReply({ a: 1 })]), modelId: "m" });
    const r = await llm(TOOL);
    expect(r.input).toEqual({ a: 1 });
    expect(r.usage).toEqual({ inputTokens: 100, outputTokens: 50 });
  });
  test("a JSON text reply is accepted; invalid JSON is retried", async () => {
    expect(extractToolInput(textReply('Here you go: {"x": 2}'), "write_outline")).toEqual({ x: 2 });
    const s = sender([textReply("Sorry, I can't produce JSON {oops"), toolReply({ ok: true })]);
    const r = await bedrockLlm({ client: s, backoffMs: 1 })(TOOL);
    expect(r.input).toEqual({ ok: true });
    expect(s.calls).toBe(2);
  });
  test("throttling backs off and retries, then gives a plain error", async () => {
    const s = sender([named("ThrottlingException"), named("ThrottlingException"), toolReply({ ok: 1 })]);
    expect((await bedrockLlm({ client: s, backoffMs: 1 })(TOOL)).input).toEqual({ ok: 1 });
    expect(s.calls).toBe(3);
    const always = sender([named("ThrottlingException")]);
    await expect(bedrockLlm({ client: always, backoffMs: 1, retries: 2 })(TOOL)).rejects.toMatchObject({ kind: "throttled" });
    expect(always.calls).toBe(3);
  });
  test("missing permissions fail fast as a setup problem", async () => {
    const s = sender([named("AccessDeniedException", "not authorized to perform bedrock:InvokeModel")]);
    await expect(bedrockLlm({ client: s, backoffMs: 1 })(TOOL)).rejects.toMatchObject({ kind: "config" });
    expect(s.calls).toBe(1);
  });
  test("a model that refuses a forced tool choice is asked again with auto", async () => {
    const s = sender([named("ValidationException", "tool_choice is not supported with thinking"), toolReply({ y: 1 })]);
    const r = await bedrockLlm({ client: s, modelId: "us.anthropic.claude-sonnet-4-6", backoffMs: 1 })(TOOL);
    expect(r.input).toEqual({ y: 1 });
  });
  test("tool schemas are plain JSON Schema objects", () => {
    const js = toolSchema(AiOutline);
    expect(js.type).toBe("object");
    expect(js.$schema).toBeUndefined();
  });
});

describe("speed and variety", () => {
  test("low effort is sent, and dropped once if the model rejects it", async () => {
    const seen: unknown[] = [];
    let n = 0;
    const client = {
      async send(cmd: { input: { additionalModelRequestFields?: unknown } }) {
        seen.push(cmd.input.additionalModelRequestFields);
        if (n++ === 0) throw named("ValidationException", "output_config: Extra inputs are not permitted");
        return toolReply({ a: 1 });
      },
    } as unknown as ConverseSender;
    const llm = bedrockLlm({ client, modelId: "us.anthropic.claude-sonnet-5-5", retries: 0 });
    expect((await llm(TOOL)).input).toEqual({ a: 1 });
    expect(await llm(TOOL)).toBeTruthy();
    expect(seen).toEqual([{ output_config: { effort: "low" } }, undefined, undefined]);
  });
  test("a surprise setting gets a seeded starting idea, and recent books are avoided", () => {
    const a = outlinePrompt(req({ setting: "surprise", seed: 1, avoid: ["The Lanterns of Marrowby Pier (winter 1894 seaside)"] }), 8);
    const b = outlinePrompt(req({ setting: "surprise", seed: 2 }), 8);
    expect(a).toMatch(/Marrowby/);
    expect(a).toMatch(/Starting idea/);
    expect(a).not.toEqual(b);
    const ideas = new Set(Array.from({ length: 20 }, (_, i) => flavorFor(i * 7919 + 13)));
    expect(ideas.size).toBeGreaterThan(15);
  });
  test("progress carries the title, case titles and written cases", async () => {
    const r = req({ caseCount: 6 });
    const seen: AiProgress[] = [];
    await generateAiBook(r, mockLlm(r), { onProgress: (p) => seen.push(p) });
    const last = seen[seen.length - 1];
    expect(last.title).toBeTruthy();
    expect(last.titles).toHaveLength(6);
    expect(seen.some((p) => (p.written?.length ?? 0) > 0 && (p.written?.length ?? 0) < 6 + 1)).toBe(true);
  });
});

describe("local checks and repairs", () => {
  const cast = TEMPLATE_CAST;
  const st = DEFAULT_MYSTERY_SETTINGS;
  const base = { index: 1, title: "The Stolen Spoon", story: "The silver spoon vanished from the dining room during supper.", words: ["Spoon", "TABLE", "candle", "NAPKIN", "PLATE", "GOBLET", "SALT", "PEPPER", "LADLE", "TRAY", "CLOTH", "VASE"], missing: { word: "SILVER", clue: "What the spoon was made of" }, suspects: [cast[0].name, cast[1].name, cast[2].name], culprit: cast[0].name, lead: "" };
  test("tidies words and keeps a buildable case", () => {
    const r = checkAiCase(base, cast, st, 11);
    expect(r.problems).toEqual([]);
    expect(r.spec.words).toContain("SPOON");
  });
  test("drops words inside other words and too-long words", () => {
    const r = checkAiCase({ ...base, words: [...base.words, "PLATES", "EXTRAORDINARY"] }, cast, st, 11);
    expect(r.spec.words).not.toContain("PLATE");
    expect(r.spec.words).not.toContain("EXTRAORDINARY");
    expect(r.repairs.join(" ")).toMatch(/PLATE/);
  });
  test("flags unsuitable words, unknown suspects and too few words", () => {
    expect(unsuitable("a bloody knife")).toMatch(/unsuitable/);
    expect(unsuitable("Sherlock was here")).toMatch(/borrows/);
    const r = checkAiCase({ ...base, words: ["BLOOD", "KEY", "MAP"], suspects: ["Nobody Known", cast[1].name, cast[0].name] }, cast, st, 11);
    expect(r.problems.join(" ")).toMatch(/unsuitable/);
    expect(r.problems.join(" ")).toMatch(/not in it/);
    expect(r.problems.join(" ")).toMatch(/usable evidence/);
  });
  test("a final answer longer than the Case Board is shortened", () => {
    const o = { title: "T", intro: "An intro that is long enough.", cast: cast.map((p) => ({ ...p, traits: p.traits.slice(0, 3) })), mastermind: "Vera Lark", finalAnswer: "THE MASTERMIND IS VERA LARK", finaleQuestion: "Who did it?", epilogue: "It was Vera all along, of course.", cases: Array.from({ length: 6 }, (_, i) => ({ title: `Case ${i + 1}`, culprit: cast[0].name, premise: "Something odd." })) };
    const r = checkOutline(o, 6, true);
    expect(r.outline.finalAnswer.replace(/ /g, "").length).toBeLessThanOrEqual(6);
  });
});

describe("book-wide checks (found in a real 24-case book)", () => {
  const cast = TEMPLATE_CAST;
  const st = DEFAULT_MYSTERY_SETTINGS;
  const base = { index: 4, title: "The Stolen Spoon", story: "The silver spoon vanished from the dining room during supper.", words: ["SPOON", "TABLE", "CANDLE", "NAPKIN", "PLATE", "GOBLET", "SALT", "PEPPER", "LADLE", "TRAY", "CLOTH", "VASE"], missing: { word: "SILVER", clue: "What the spoon was made of" }, suspects: [cast[0].name, cast[1].name, cast[2].name], culprit: cast[0].name, lead: "" };
  const spec = (word: string, clue: string) => ({ title: "t", story: "s", words: [], suspects: [], missing: { word, clue } });
  test("a missing word used twice, or a clue copied, is sent back for the later case", () => {
    const p = checkBook([spec("BUTTON", "Small and round, it fell off a coat"), spec("PARASOL", "A lacy shade for sunny days"), spec("BUTTON", "Sewn on a cuff"), spec("LADDER", "Something tall with rungs"), spec("RIBBON", "A lacy umbrella for sunny days")]);
    expect([...p.keys()]).toEqual([3, 5]);
    expect(p.get(3)!.join(" ")).toMatch(/BUTTON is already the missing word of case 1/);
    expect(p.get(5)!.join(" ")).toMatch(/almost like case 2/);
    expect(clueOverlap("Something with rungs", "A small brass key")).toBe(0);
  });
  test("a case at a batch boundary always gets a lead, and the prompt names the next case", () => {
    const r = checkAiCase(base, cast, st, 11, 1, { nextTitle: "The Fog on the Pier" });
    expect(r.spec.lead).toMatch(/The Fog on the Pier/);
    const last = checkAiCase(base, cast, st, 11, 1, { last: true });
    expect(last.spec.lead).toMatch(/Case Board/);
    const o = AiOutline.parse({ title: "The Test", intro: "An intro that is long enough.", place: "Heron Lake Spa", cast: cast.map((p) => ({ ...p, traits: p.traits.slice(0, 3) })), mastermind: cast[0].name, finalAnswer: "", finaleQuestion: "Who did it?", epilogue: "It was them all along.", cases: Array.from({ length: 8 }, (_, i) => ({ title: `Case title ${i + 1}`, culprit: cast[0].name, premise: "Something odd." })) });
    const prompt = casesPrompt(req({ caseCount: 8 }), o, 1, 4);
    expect(prompt).toMatch(/Next comes case 5, "Case title 5"/);
    expect(prompt).toMatch(/Place: Heron Lake Spa/);
    expect(casesPrompt(req({ caseCount: 8 }), o, 5, 8)).not.toMatch(/Next comes/);
  });
  test("one place name: the title and intro can't disagree", () => {
    expect(strayPlaces("The Lantern Baths of Saltwater Lake", "Heron Lake Spa")).toEqual(["Saltwater Lake"]);
    expect(strayPlaces("Steam rose over Heron Lake at dawn in the Grand Hall.", "Heron Lake Spa")).toEqual([]);
    expect(strayPlaces("Gideon Marsh left his satchel on a bench.", "Heron Lake Spa", "", ["Gideon Marsh"])).toEqual([]);
    const o = { title: "The Lantern Baths of Saltwater Lake", intro: "Guests at Heron Lake Spa whisper about the lanterns.", cast: cast.map((p) => ({ ...p, traits: p.traits.slice(0, 3) })), mastermind: cast[0].name, finalAnswer: "", finaleQuestion: "Who did it?", epilogue: "It was them all along.", cases: [{ title: "One", culprit: cast[0].name, premise: "Odd." }] };
    expect(checkOutline(o, 1, false).problems.join(" ")).toMatch(/one name/);
    expect(checkOutline({ ...o, place: "Heron Lake Spa" }, 1, false).problems.join(" ")).toMatch(/Saltwater Lake/);
    expect(checkOutline({ ...o, title: "The Lantern Baths of Heron Lake Spa", place: "Heron Lake Spa" }, 1, false).problems).toEqual([]);
    expect(checkAiCase({ ...base, story: "The spoon vanished at Saltwater Lake during supper." }, cast, st, 11, 1, { place: "Heron Lake Spa" }).problems.join(" ")).toMatch(/Heron Lake Spa/);
  });
  test("a missing word that a culprit trait already names is rewritten", () => {
    const who = cast[0];
    const r = checkAiCase({ ...base, missing: { word: who.traits[0].toUpperCase().replace(/[^A-Z ]/g, "").split(" ").filter((w) => w.length > 3).pop()!, clue: "x marks it" } }, cast, st, 11);
    expect(r.problems.join(" ")).toMatch(/gives it away/);
  });
});

describe("whole book with a mocked model", () => {
  test("outline, batches, repair round, then the engine builds every case", async () => {
    const r = req({ caseCount: 12, setting: "hotel" });
    const progress: string[] = [];
    const out = await generateAiBook(r, mockLlm(r), { chunkSize: 5, onProgress: (p) => progress.push(p.message) });
    expect(out.book.cases).toHaveLength(12);
    expect(progress.some((m) => /Polishing/.test(m))).toBe(true); // case 2 came back broken first
    expect(out.calls).toBeGreaterThanOrEqual(4);
    const built = generateMystery({ book: out.book, cases: out.book.cases, phrase: out.book.finale.phrase, settings: DEFAULT_MYSTERY_SETTINGS, seed: 20261115 });
    expect(built.problems).toEqual([]);
  });
  test("a case that never comes back clean is left out with a note", async () => {
    const r = req({ caseCount: 6 });
    const inner = mockLlm(r);
    // Always broken for case 3, even on rewrites.
    const llm: typeof inner = async (q, s) => {
      const res = await inner(q, s);
      const cs = (res.input as { cases?: { index: number; words: string[] }[] }).cases;
      cs?.forEach((c) => c.index === 3 && (c.words = ["KEY"]));
      return res;
    };
    const out = await generateAiBook(r, llm);
    expect(out.book.cases).toHaveLength(5);
    expect(out.notes.join(" ")).toMatch(/Case 3/);
  });
  test("regenerate one case", async () => {
    const r = req({ caseCount: 6 });
    const book = await generateAiBook(r, mockLlm(r));
    const one = await regenerateCase(r, book.outline, 4, { title: book.book.cases[3].title, words: book.book.cases[3].words }, mockLlm(r));
    expect(one.spec.title).toMatch(/Revisited/);
  });
  test("a broken outline is asked for again; three failures give a plain error", async () => {
    const r = req({ caseCount: 6 });
    let n = 0;
    const llm = async () => (n++, { input: { nope: true }, usage: { inputTokens: 1, outputTokens: 1 }, ms: 1 });
    await expect(generateAiBook(r, llm)).rejects.toBeInstanceOf(AiError);
    expect(n).toBe(3);
  });
});

describe("story checks (found in a real 24-case harbour book)", () => {
  const P = (name: string, traits: string[]) => ({ name, role: "Villager", traits });
  const odette = P("Odette Marsh", ["wears a navy cap", "carries a brass whistle"]);
  const cornelis = P("Cornelis Bright", ["wears a monocle", "has a bow tie"]);
  const felix = P("Felix Harrow", ["has a white mustache", "has a deep voice"]);
  const tobias = P("Tobias Reed", ["has a limp", "smokes no pipe, only chews"]);
  const cast = [odette, cornelis, felix, tobias];
  test("an invented town in a case title is a second place name", () => {
    expect(placeNames("Lost Letters of Lindenquay")).toEqual(["Lindenquay"]);
    expect(strayPlaces("Lost Letters of Lindenquay", "Vennmark Harbour")).toEqual(["Lindenquay"]);
    expect(strayPlaces("The Upside-Down Flags at Vennmark Harbour", "Vennmark Harbour")).toEqual([]);
    const base = { index: 4, title: "Lost Letters of Lindenquay", story: "The mail satchel is emptied at Vennmark Harbour.", words: ["SEAL", "LETTER", "BRUSH", "EASEL", "FRAME", "STAMP", "PARCEL", "PALETTE", "SATCHEL", "ENVELOPE", "CANVAS", "POSTCARD"], missing: { word: "TURPENTINE", clue: "A sharp smell" }, suspects: [odette.name, cornelis.name, felix.name], culprit: felix.name, lead: "Next, the lanterns go dark." };
    expect(checkAiCase(base, cast, DEFAULT_MYSTERY_SETTINGS, 11, 1, { place: "Vennmark Harbour" }).problems.join(" ")).toMatch(/not “Lindenquay”/);
  });
  test("a witness who sees another suspect's trait contradicts the case", () => {
    const story = "The key has vanished. A witness saw someone with a monocle slipping away.";
    expect(pointsAtOther(story, odette, [odette, cornelis, felix])).toEqual({ person: cornelis, thing: "monocle" });
    expect(pointsAtOther(story, cornelis, [odette, cornelis, felix])).toBeUndefined();
    // Naming a victim's belongings isn't a sighting.
    expect(pointsAtOther("Odette's brass whistle is gone from its hook.", felix, [odette, felix, cornelis])).toBeUndefined();
  });
  test("a trait that says what someone doesn't do is sent back", () => {
    expect(oddTrait("smokes no pipe, only chews")).toBe(true);
    expect(oddTrait("wears yellow boots")).toBe(false);
    const o = { title: "The Clockwork Ferry", intro: "In 1953 at Vennmark Harbour, things vanish.", place: "Vennmark Harbour", cast, mastermind: cornelis.name, finalAnswer: "", finaleQuestion: "Who?", epilogue: "Done.", cases: [{ title: "Lost Letters of Lindenquay", culprit: felix.name, premise: "Letters vanish." }] };
    const problems = checkOutline(o, 1, false).problems.join(" ");
    expect(problems).toMatch(/smokes no pipe/);
    expect(problems).toMatch(/A case names “Lindenquay”/);
  });
  test("a lead that jumps ahead to a later case is caught, and the prompt names each next case", () => {
    const c = (title: string, story: string, words: string[], lead = "") => ({ title, story, words, suspects: [odette.name, cornelis.name, felix.name], culprit: odette.name, lead });
    const specs = [
      c("The Vanishing Ribbon", "The winner's ribbon vanished from its table.", ["RIBBON", "TABLE", "CUSHION"], "Next, the captain's old compass is not where it should be, and Felix Harrow wants to know why."),
      c("Footprints on the Pier", "Oily footprints cross the pier to an empty boathouse.", ["PIER", "BOATHOUSE", "PLANK"], "Follow the footprints to Hugo's shed."),
      c("The Borrowed Oil", "Lantern oil is gone from Hugo's shed.", ["WICK", "CANDLE", "SHELF"], "Next, a captain loses his compass."),
      c("Captain's Missing Compass", "Captain Felix Harrow finds a painted toy where his compass was.", ["COMPASS", "TOY", "LOCKER"]),
    ];
    expect(leadMismatch(specs, 0)).toBe(3);
    expect(leadMismatch(specs, 1)).toBe(-1);
    expect(leadMismatch(specs, 2)).toBe(-1);
    expect(checkBook(specs, cast).get(1)!.join(" ")).toMatch(/describes case 4/);
    const o = AiOutline.parse({ title: "The Test", intro: "An intro that is long enough.", place: "Vennmark Harbour", cast: TEMPLATE_CAST.map((p) => ({ ...p, traits: p.traits.slice(0, 3) })), mastermind: TEMPLATE_CAST[0].name, finalAnswer: "", finaleQuestion: "Who did it?", epilogue: "It was them all along.", cases: Array.from({ length: 8 }, (_, i) => ({ title: `Case title ${i + 1}`, culprit: TEMPLATE_CAST[0].name, premise: "Something odd." })) });
    expect(casesPrompt(req({ caseCount: 8 }), o, 1, 4)).toMatch(/Its lead points to case 2, "Case title 2"/);
  });
  test("a lead that has the next case's wrong suspect seen is caught", () => {
    const specs = [
      { title: "Captain's Compass", story: "A compass is swapped for a toy.", words: ["COMPASS"], suspects: [odette.name, felix.name, tobias.name], culprit: tobias.name, lead: "Next, a key goes missing, and a monocle was seen nearby." },
      { title: "The Clock Tower Key", story: "The tower key has vanished.", words: ["KEY"], suspects: [odette.name, cornelis.name, felix.name], culprit: odette.name },
    ];
    expect(checkBook(specs, cast).get(1)!.join(" ")).toMatch(/points at Cornelis Bright/);
  });
});

