"use client";
/** Run a job in a Web Worker (keeps the page responsive) with progress and cancel. */
import { fetchFonts } from "../print/fonts";
import { isCancelled, runJob } from "./run";
import type { Job, JobResultMap, Progress } from "./types";

export interface RunningJob<T> {
  promise: Promise<T>;
  cancel: () => void;
}

export class JobCancelled extends Error {
  constructor() {
    super("Cancelled");
  }
}

function createWorker(): Worker | null {
  try {
    return new Worker(new URL("../../workers/book.worker.ts", import.meta.url), { type: "module" });
  } catch {
    return null;
  }
}

export function startJob<J extends Job>(job: J, onProgress: (p: Progress) => void): RunningJob<JobResultMap[J["type"]]> {
  const worker = typeof Worker !== "undefined" ? createWorker() : null;
  if (!worker) return startInline(job, onProgress);
  let settle: { reject: (e: Error) => void } | null = null;
  const promise = new Promise<JobResultMap[J["type"]]>((resolve, reject) => {
    settle = { reject };
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.kind === "progress") onProgress({ phase: m.phase, done: m.done, total: m.total });
      else if (m.kind === "done") {
        worker.terminate();
        resolve(m.result);
      } else if (m.kind === "error") {
        worker.terminate();
        reject(new Error(m.message));
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || "The background task failed."));
    };
    worker.postMessage(job);
  });
  return {
    promise,
    cancel: () => {
      worker.terminate();
      (settle as { reject: (e: Error) => void } | null)?.reject(new JobCancelled());
    },
  };
}

/** Fallback without workers: same code, yielding to the UI between items. */
function startInline<J extends Job>(job: J, onProgress: (p: Progress) => void): RunningJob<JobResultMap[J["type"]]> {
  let cancelled = false;
  const promise = runJob(job, {
    progress: onProgress,
    loadFonts: (files) => fetchFonts(files),
    breathe: () => new Promise((r) => setTimeout(r, 0)),
    cancelled: () => cancelled,
  }).catch((e) => {
    throw isCancelled(e) ? new JobCancelled() : e;
  });
  return { promise, cancel: () => (cancelled = true) };
}
