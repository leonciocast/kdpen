/**
 * Write a whole connected mystery book with a model: an outline first (cast, culprits,
 * final answer), then the cases in batches. Every case is checked and repaired locally,
 * and only the cases that still fail are sent back for a rewrite (a bounded number of times).
 */
import type { z } from "zod";
import type { CaseBook, CaseSpec, MysterySettings } from "../mystery/types";
import { AiError, type Llm, type ToolResult, type Usage } from "./bedrock";
import { checkAiCase, checkBook, checkOutline, type CaseContext } from "./check";
import { casesPrompt, outlinePrompt, SYSTEM } from "./prompts";
import { AiCase, AiOutline, toolSchema, type GenerateRequest } from "./schema";

export interface AiProgress {
  phase: "outline" | "cases" | "repair" | "done";
  done: number;
  total: number;
  message: string;
  /** Book title and case titles, as soon as the outline is in. */
  title?: string;
  titles?: string[];
  /** Case numbers (1-based) already written and checked. */
  written?: number[];
}
export interface AiStats {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  calls: number;
  ms: number;
  model: string;
}
export interface AiBook {
  book: CaseBook;
  outline: AiOutline;
  /** Per case: what was fixed or still needs a look (plain words). */
  caseNotes: string[][];
  /** Outline position (1-based) of each kept case. */
  indexes: number[];
  notes: string[];
  usage: Usage;
  calls: number;
  ms: number;
}
/** Price function injected by the server (keeps this module free of env reads). */
export type CostFn = (u: Usage) => number;
export interface GenerateOptions {
  onProgress?: (p: AiProgress) => void;
  onCall?: (label: string, r: ToolResult) => void;
  signal?: AbortSignal;
  chunkSize?: number;
  concurrency?: number;
  /** Rewrite rounds for failing cases. */
  maxRounds?: number;
}

const OUTLINE_TOOL = { name: "write_outline", description: "Return the book outline: title, intro, cast, mastermind, final answer, finale and the list of cases." };
const CASES_TOOL = { name: "write_cases", description: "Return the requested cases with their stories, evidence words, missing evidence, suspects, culprit and lead." };
const CASES_SCHEMA = { type: "object", properties: { cases: { type: "array", items: toolSchema(AiCase) } }, required: ["cases"] } as Record<string, unknown>;

const settingsOf = (r: GenerateRequest): MysterySettings => ({ difficulty: r.difficulty, hiddenMessage: r.hiddenMessage, missingEvidence: r.missingEvidence, storyline: r.storyline, style: "dossier" });
export const castSizeFor = (n: number) => Math.max(6, Math.min(24, Math.round(6 + n / 4)));
const issues = (e: z.ZodError) => e.issues.slice(0, 6).map((i) => `${i.path.join(".") || "root"}: ${i.message}`).join("; ");

/** Run `f` over items with at most `n` running at once. */
async function pool<T>(items: T[], n: number, f: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await f(items[i++]);
  }));
}

export async function generateAiBook(req: GenerateRequest, llm: Llm, opts: GenerateOptions = {}): Promise<AiBook> {
  const t0 = Date.now();
  const usage: Usage = { inputTokens: 0, outputTokens: 0 };
  let calls = 0;
  const call: Llm = async (r, signal) => {
    const out = await llm(r, signal ?? opts.signal);
    calls++;
    usage.inputTokens += out.usage.inputTokens;
    usage.outputTokens += out.usage.outputTokens;
    opts.onCall?.(r.tool.name, out);
    return out;
  };
  const N = req.caseCount;
  const progress = (p: AiProgress) => opts.onProgress?.(p);

  // 1. Outline (two tries with feedback).
  progress({ phase: "outline", done: 0, total: N, message: "Writing the storyline…" });
  let outline: AiOutline | null = null;
  const notes: string[] = [];
  let feedback = "";
  for (let attempt = 0; attempt < 3 && !outline; attempt++) {
    const r = await call({ system: SYSTEM, prompt: outlinePrompt(req, castSizeFor(N)) + feedback, tool: { ...OUTLINE_TOOL, schema: toolSchema(AiOutline) }, maxTokens: Math.min(32000, 2500 + N * 90) });
    const parsed = AiOutline.safeParse(r.input);
    if (!parsed.success) {
      feedback = `\n\nYour previous answer didn't match the schema (${issues(parsed.error)}). Answer again with the full outline.`;
      continue;
    }
    const chk = checkOutline(parsed.data, N, req.storyline);
    if (chk.problems.length) {
      feedback = `\n\nFix these problems from your previous answer: ${chk.problems.join(" ")}`;
      continue;
    }
    outline = chk.outline;
    notes.push(...chk.repairs.map((x) => `Outline: ${x}.`));
  }
  if (!outline) throw new AiError("The storyline couldn't be written. Please try again.", "bad-output");
  const cast = outline.cast.map((p) => ({ name: p.name, role: p.role, traits: p.traits }));
  const st = settingsOf(req);

  // 2. Cases in batches, then rewrites for the ones that fail.
  const specs: (CaseSpec | null)[] = Array(N).fill(null);
  const caseNotes: string[][] = Array.from({ length: N }, () => []);
  const problems = new Map<number, string[]>();
  // Small batches, many at once: a batch's time grows with its length, so 4 cases x 6 in
  // parallel is far faster than 8 cases x 2 (Bedrock quotas allow this easily).
  const size = opts.chunkSize ?? (N <= 6 ? 3 : 4);
  const done = new Set<number>();
  const titles = outline.cases.map((c) => c.title);
  const tell = (phase: AiProgress["phase"], message: string) => progress({ phase, done: done.size, total: N, message, title: outline!.title, titles, written: [...done].sort((a, b) => a - b) });
  const ctxOf = (i: number): CaseContext => ({ place: outline!.place, nextTitle: outline!.cases[i]?.title, last: i === N });
  // Cross-case checks (unique missing words, clues not copied) once every batch is in.
  const bookCheck = () => {
    for (const [i, p] of checkBook(specs)) {
      problems.set(i, [...(problems.get(i) ?? []), ...p]);
      done.delete(i);
    }
  };
  const writeRange = async (idxs: number[], fb?: Map<number, string[]>) => {
    const from = idxs[0];
    const to = idxs[idxs.length - 1];
    let r: ToolResult;
    try {
      r = await call({ system: SYSTEM, prompt: casesPrompt(req, outline!, from, to, fb), tool: { ...CASES_TOOL, schema: CASES_SCHEMA }, maxTokens: Math.min(32000, 800 + (to - from + 1) * 650) });
    } catch (e) {
      if (e instanceof AiError && (e.kind === "config" || opts.signal?.aborted)) throw e;
      for (const i of idxs) problems.set(i, ["The reply was missing or unreadable; write this case again."]);
      return;
    }
    const raw = (r.input as { cases?: unknown[] } | null)?.cases;
    const got = new Map<number, AiCase>();
    if (Array.isArray(raw))
      raw.forEach((c, k) => {
        const p = AiCase.safeParse(c);
        if (p.success) got.set(p.data.index >= from && p.data.index <= to ? p.data.index : from + k, p.data);
      });
    for (const i of idxs) {
      const c = got.get(i);
      if (!c) {
        problems.set(i, [`Case ${i} was missing or didn't match the schema; include it with every field.`]);
        continue;
      }
      const chk = checkAiCase({ ...c, index: i }, cast, st, req.maxWord, 20261115 + (i - 1) * 101, ctxOf(i));
      specs[i - 1] = chk.spec;
      const was = fb?.get(i);
      caseNotes[i - 1] = [...(was?.length && !chk.problems.length ? [`rewritten once to fix: ${was.join(" ").replace(/\.$/, "")}`] : []), ...chk.repairs];
      if (chk.problems.length) problems.set(i, chk.problems);
      else {
        problems.delete(i);
        done.add(i);
      }
    }
    tell(problems.size && done.size + problems.size >= N ? "repair" : "cases", done.size >= N ? "Checking every case…" : `Writing case ${Math.min(N, done.size + 1)} of ${N}…`);
  };
  const chunks: number[][] = [];
  for (let a = 1; a <= N; a += size) chunks.push(Array.from({ length: Math.min(size, N - a + 1) }, (_, k) => a + k));
  tell("cases", `Writing case 1 of ${N}…`);
  await pool(chunks, opts.concurrency ?? 6, (c) => writeRange(c));
  bookCheck();

  for (let round = 0; round < (opts.maxRounds ?? 2) && problems.size; round++) {
    const failing = [...problems.keys()].sort((a, b) => a - b);
    tell("repair", `Polishing ${failing.length === 1 ? "1 case" : `${failing.length} cases`}…`);
    const fb = new Map(problems);
    const groups: number[][] = [];
    // Contiguous runs, at most `size` long, so each request stays small.
    for (const i of failing) {
      const g = groups[groups.length - 1];
      if (g && g[g.length - 1] === i - 1 && g.length < size) g.push(i);
      else groups.push([i]);
    }
    await pool(groups, opts.concurrency ?? 6, (g) => writeRange(g, fb));
    bookCheck();
  }
  // Whatever still fails: keep it if it builds (with a note), otherwise leave it out.
  const kept: CaseSpec[] = [];
  const keptNotes: string[][] = [];
  const indexes: number[] = [];
  specs.forEach((s, k) => {
    const p = problems.get(k + 1);
    if (!s || (p && p.some((x) => /grid|usable evidence|schema|unreadable|unsuitable|borrows|not in the cast|three different/.test(x)))) {
      notes.push(`Case ${k + 1} (“${outline!.cases[k]?.title ?? "untitled"}”) couldn't be written cleanly, so it was left out. Use “Regenerate this case” to try again.`);
      return;
    }
    kept.push(s);
    indexes.push(k + 1);
    keptNotes.push([...caseNotes[k], ...(p ?? [])]);
  });
  if (!kept.length) throw new AiError("The cases couldn't be written. Please try again.", "bad-output");
  tell("done", "Done");
  const phrase = req.storyline ? outline.finalAnswer : "";
  return {
    book: { title: outline.title, intro: outline.intro, cast, cases: kept, finale: { phrase, question: outline.finaleQuestion, epilogue: outline.epilogue } },
    outline,
    caseNotes: keptNotes,
    indexes,
    notes,
    usage,
    calls,
    ms: Date.now() - t0,
  };
}

/** Write one case again (a fresh take), keeping the book's outline and cast. */
export async function regenerateCase(req: GenerateRequest, outline: AiOutline, index: number, avoid: { title?: string; words?: string[] }, llm: Llm, signal?: AbortSignal): Promise<{ spec: CaseSpec; notes: string[]; usage: Usage }> {
  const cast = outline.cast.map((p) => ({ name: p.name, role: p.role, traits: p.traits }));
  const usage: Usage = { inputTokens: 0, outputTokens: 0 };
  let fb = new Map<number, string[]>([[index, [`Write a fresh version that differs from the previous one${avoid.title ? ` (“${avoid.title}”)` : ""}${avoid.words?.length ? `; use different evidence words than ${avoid.words.slice(0, 8).join(", ")}` : ""}. A new title is welcome.`]]]);
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await llm({ system: SYSTEM, prompt: casesPrompt(req, outline, index, index, fb).replace(/\(as above\)/, "(a new one is welcome)"), tool: { ...CASES_TOOL, schema: CASES_SCHEMA }, maxTokens: 2000 }, signal);
    usage.inputTokens += r.usage.inputTokens;
    usage.outputTokens += r.usage.outputTokens;
    const raw = (r.input as { cases?: unknown[] } | null)?.cases?.[0];
    const p = AiCase.safeParse(raw);
    if (!p.success) {
      fb = new Map([[index, [`Your answer didn't match the schema (${issues(p.error)}).`]]]);
      continue;
    }
    const chk = checkAiCase({ ...p.data, index }, cast, settingsOf(req), req.maxWord, 20261115 + (index - 1) * 101, { place: outline.place, nextTitle: outline.cases[index]?.title, last: index === outline.cases.length });
    if (!chk.problems.length) return { spec: chk.spec, notes: chk.repairs, usage };
    fb = new Map([[index, chk.problems]]);
  }
  throw new AiError("This case couldn't be rewritten cleanly. Please try again.", "bad-output");
}
