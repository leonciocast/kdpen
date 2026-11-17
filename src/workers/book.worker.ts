/// <reference lib="webworker" />
import { runJob } from "@/lib/jobs/run";
import { fetchFonts } from "@/lib/print/fonts";
import type { Job } from "@/lib/jobs/types";

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<Job>) => {
  try {
    const result = await runJob(e.data, {
      progress: (p) => ctx.postMessage({ kind: "progress", ...p }),
      loadFonts: (files) => fetchFonts(files, ctx.location.origin),
    });
    const transfer = e.data.type === "build" ? (result as { bytes: ArrayBuffer }[]).map((f) => f.bytes) : [];
    ctx.postMessage({ kind: "done", result }, transfer);
  } catch (err) {
    ctx.postMessage({ kind: "error", message: (err as Error)?.message ?? String(err) });
  }
};
