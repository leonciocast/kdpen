"use client";
import React from "react";
import { BsXCircle } from "react-icons/bs";
import type { Progress } from "@/lib/jobs/types";

/** Progress bar with a cancel button for background jobs. */
export default function JobProgress({ progress, onCancel, title }: { progress: Progress | null; onCancel: () => void; title: string }) {
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className="pg-job" role="status" aria-live="polite" data-testid="job-progress">
      <div className="d-flex align-items-center gap-2">
        <span className="spinner-border spinner-border-sm text-primary" aria-hidden="true" />
        <strong className="flex-grow-1">{title}</strong>
        <button type="button" className="btn btn-light btn-sm" onClick={onCancel} data-testid="job-cancel">
          <BsXCircle /> Cancel
        </button>
      </div>
      <div className="small text-muted mt-1">
        {progress ? `${progress.phase}: ${progress.done.toLocaleString()} of ${progress.total.toLocaleString()} (${pct}%)` : "Starting…"} · You can keep using the page.
      </div>
      <div className="pg-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={title}>
        <div style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
