/**
 * Server side of AI cases: is it configured, a small in-memory job store (polling),
 * a per-IP rate limit, and token/cost logging. Server-only.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AiError, bedrockLlm, costOf, DEFAULT_MODEL, type Llm } from "./bedrock";
import { generateAiBook, type AiBook, type AiProgress } from "./generate";
import { mockLlm } from "./mock";
import type { GenerateRequest } from "./schema";

export const isMock = () => process.env.BEDROCK_MOCK === "1";

/** True when credentials for the standard AWS chain look present (never reads or returns them). */
export function aiConfigured(): boolean {
  if (process.env.BEDROCK_DISABLED === "1") return false;
  if (isMock()) return true;
  const e = process.env;
  if (e.AWS_ACCESS_KEY_ID && e.AWS_SECRET_ACCESS_KEY) return true;
  if (e.AWS_BEARER_TOKEN_BEDROCK || e.AWS_PROFILE || e.AWS_WEB_IDENTITY_TOKEN_FILE || e.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI || e.AWS_CONTAINER_CREDENTIALS_FULL_URI) return true;
  try {
    return fs.existsSync(path.join(os.homedir(), ".aws", "credentials"));
  } catch {
    return false;
  }
}
export const modelId = () => process.env.BEDROCK_MODEL_ID ?? DEFAULT_MODEL;

export function llmFor(req: GenerateRequest): Llm {
  return isMock() ? mockLlm(req, { delayMs: Number(process.env.BEDROCK_MOCK_DELAY ?? 150) }) : bedrockLlm();
}

export function log(id: string, label: string, u: { inputTokens: number; outputTokens: number }, ms: number) {
  console.log(`[ai-cases] ${id} ${label} in=${u.inputTokens} out=${u.outputTokens} ~$${costOf(u).toFixed(4)} ${(ms / 1000).toFixed(1)}s${isMock() ? " (mock)" : ""}`);
}

// ---------------------------------------------------------------- rate limit
const WINDOW_MS = 10 * 60 * 1000;
const hits = new Map<string, number[]>();
/** At most `max` requests per IP in 10 minutes (books count 1, single-case rewrites count too). */
export function rateLimited(ip: string, max = Number(process.env.AI_RATE_LIMIT ?? 20)): number {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= max) {
    hits.set(ip, list);
    return Math.ceil((WINDOW_MS - (now - list[0])) / 1000);
  }
  list.push(now);
  hits.set(ip, list);
  return 0;
}
export function clientIp(h: Headers): string {
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}

// ---------------------------------------------------------------- jobs
export interface Job {
  id: string;
  ip: string;
  status: "running" | "done" | "failed" | "cancelled";
  progress: AiProgress;
  result?: AiBook;
  error?: string;
  started: number;
  ctl: AbortController;
}
const g = globalThis as unknown as { __aiJobs?: Map<string, Job> };
const jobs = (g.__aiJobs ??= new Map());
const JOB_TIMEOUT_MS = Number(process.env.AI_JOB_TIMEOUT_MS ?? 20 * 60 * 1000);

export function startJob(req: GenerateRequest, ip: string): Job | string {
  const running = [...jobs.values()].filter((j) => j.ip === ip && j.status === "running").length;
  if (running >= 2) return "Two books are already being written. Please wait for one to finish.";
  // Forget old jobs (an hour is plenty to pick up a result).
  for (const [k, j] of jobs) if (Date.now() - j.started > 60 * 60 * 1000) jobs.delete(k);
  const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const ctl = new AbortController();
  const job: Job = { id, ip, status: "running", progress: { phase: "outline", done: 0, total: req.caseCount, message: "Starting…" }, started: Date.now(), ctl };
  jobs.set(id, job);
  const timer = setTimeout(() => ctl.abort(), JOB_TIMEOUT_MS);
  generateAiBook(req, llmFor(req), { signal: ctl.signal, onProgress: (p) => (job.progress = p), onCall: (label, r) => log(id, label, r.usage, r.ms) })
    .then((res) => {
      job.result = res;
      job.status = "done";
      console.log(`[ai-cases] ${id} book ${req.caseCount} cases: ${res.book.cases.length} kept, ${res.calls} calls, in=${res.usage.inputTokens} out=${res.usage.outputTokens} ~$${costOf(res.usage).toFixed(3)} ${(res.ms / 1000).toFixed(0)}s model=${modelId()}${isMock() ? " (mock)" : ""}`);
    })
    .catch((e) => {
      job.status = ctl.signal.aborted && job.status === "cancelled" ? "cancelled" : "failed";
      job.error = e instanceof AiError ? e.message : "The AI service couldn't write the cases right now. Please try again.";
      if (!(e instanceof AiError)) console.error(`[ai-cases] ${id} failed:`, (e as Error)?.message);
      else console.warn(`[ai-cases] ${id} ${e.kind}: ${e.message}`);
    })
    .finally(() => clearTimeout(timer));
  return job;
}
export const getJob = (id: string) => jobs.get(id);
export function cancelJob(id: string): boolean {
  const j = jobs.get(id);
  if (!j || j.status !== "running") return false;
  j.status = "cancelled";
  j.ctl.abort();
  return true;
}
