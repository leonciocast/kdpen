import { describe, expect, test } from "vitest";
import type { ConverseCommandOutput } from "@aws-sdk/client-bedrock-runtime";
import { AiError, bedrockLlm, extractToolInput, type ConverseSender } from "../src/lib/ai/bedrock";
import { checkAiCase, checkOutline, unsuitable } from "../src/lib/ai/check";
import { generateAiBook, regenerateCase, type AiProgress } from "../src/lib/ai/generate";
import { flavorFor, outlinePrompt } from "../src/lib/ai/prompts";
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
