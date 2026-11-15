/** Browser side of AI cases: status, start + poll a job, rewrite one case. No secrets here. */
import type { AiProgress } from "@/lib/ai/generate";
import type { AiOutline, GenerateRequest } from "@/lib/ai/schema";
import type { CaseBook, CaseSpec } from "@/lib/mystery/types";

export interface AiStatus {
  configured: boolean;
  mock: boolean;
  model: string;
}
export interface AiResult {
  book: CaseBook;
  outline: AiOutline;
  caseNotes: string[][];
  indexes: number[];
  notes: string[];
}

export async function aiStatus(): Promise<AiStatus> {
  try {
    const r = await fetch("/api/mystery/status", { cache: "no-store" });
    if (r.ok) return (await r.json()) as AiStatus;
  } catch {
    /* offline */
  }
  return { configured: false, mock: false, model: "" };
}

export class AiNotConfigured extends Error {}

async function errorOf(r: Response): Promise<string> {
  try {
    const j = (await r.json()) as { error?: string; code?: string };
    if (j.code === "not-configured") throw new AiNotConfigured(j.error);
    return j.error ?? "The AI service couldn't answer right now.";
  } catch (e) {
    if (e instanceof AiNotConfigured) throw e;
    return "The AI service couldn't answer right now.";
  }
}

/** Start a book and poll it; resolves with the result. `cancel()` stops it. */
export function generateBook(options: GenerateRequest, onProgress: (p: AiProgress) => void): { promise: Promise<AiResult>; cancel: () => void } {
  let id = "";
  let stopped = false;
  const cancel = () => {
    stopped = true;
    if (id) void fetch(`/api/mystery/generate/${id}`, { method: "DELETE" }).catch(() => {});
  };
  const promise = (async () => {
    const r = await fetch("/api/mystery/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(options) });
    if (!r.ok) throw new Error(await errorOf(r));
    id = ((await r.json()) as { id: string }).id;
    for (;;) {
      await new Promise((res) => setTimeout(res, 900));
      if (stopped) throw new DOMException("Cancelled", "AbortError");
      const s = await fetch(`/api/mystery/generate/${id}`, { cache: "no-store" });
      if (!s.ok) throw new Error(await errorOf(s));
      const j = (await s.json()) as { status: string; progress: AiProgress; error?: string; result?: AiResult };
      onProgress(j.progress);
      if (j.status === "done" && j.result) return j.result;
      if (j.status === "cancelled") throw new DOMException("Cancelled", "AbortError");
      if (j.status === "failed") throw new Error(j.error ?? "The cases couldn't be written. Please try again.");
    }
  })();
  return { promise, cancel };
}

export async function regenerateOne(options: GenerateRequest, outline: AiOutline, index: number, old: CaseSpec): Promise<{ spec: CaseSpec; notes: string[] }> {
  const r = await fetch("/api/mystery/regenerate-case", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ options, outline, index, avoid: { title: old.title, words: old.words.slice(0, 20) } }) });
  if (!r.ok) throw new Error(await errorOf(r));
  return (await r.json()) as { spec: CaseSpec; notes: string[] };
}
