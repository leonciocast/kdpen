"use client";
/** Pieces of the AI mystery flow: the magic button, progress, and the quiet "Customize" options. */
import React, { useEffect, useState } from "react";
import { BsCheck2, BsMagic, BsStars } from "react-icons/bs";
import type { AiProgress } from "@/lib/ai/generate";
import { TONES, TONE_LABEL, type Tone } from "@/lib/ai/schema";
import { SETTINGS } from "@/lib/mystery/templates";
import { plural } from "@/lib/plural";

/** "✨ New mystery". With a book already on screen, a second click confirms the replacement. */
export function MagicButton({ onGo, replaces, disabled, size = "lg", testId = "my-ai-magic" }: { onGo: () => void; replaces?: string; disabled?: boolean; size?: "lg" | "sm"; testId?: string }) {
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (!asking) return;
    const t = setTimeout(() => setAsking(false), 6000);
    return () => clearTimeout(t);
  }, [asking]);
  if (asking)
    return (
      <span className="pg-magic-confirm" role="group" aria-label="Replace this mystery?">
        <span>Replace “{replaces}”?</span>
        <button type="button" className={`btn btn-primary ${size === "sm" ? "btn-sm" : ""}`} data-testid={`${testId}-confirm`} onClick={() => (setAsking(false), onGo())}>
          <BsStars aria-hidden="true" /> Yes, new mystery
        </button>
        <button type="button" className="pg-link-btn" onClick={() => setAsking(false)}>
          Keep it
        </button>
      </span>
    );
  return (
    <button type="button" className={`pg-magic ${size}`} data-testid={testId} disabled={disabled} onClick={() => (replaces ? setAsking(true) : onGo())}>
      <BsStars aria-hidden="true" /> New mystery
    </button>
  );
}

/** Writing progress: the book title and its cases appear as soon as the outline is in. */
export function AiProgressPanel({ p, onCancel }: { p: AiProgress | null; onCancel: () => void }) {
  const total = p?.total ?? 0;
  const done = p?.written?.length ?? p?.done ?? 0;
  const pct = !p || p.phase === "outline" ? 7 : p.phase === "done" ? 100 : 10 + (88 * done) / Math.max(1, total);
  const written = new Set(p?.written ?? []);
  return (
    <div className="pg-ai-progress" role="status" aria-live="polite" data-testid="my-ai-progress">
      <div className="pg-ai-progress-head">
        <span className="pg-ai-progress-title">{p?.title ? `“${p.title}”` : "A new mystery"}</span>
        <button type="button" className="pg-link-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <div className="pg-progress">
        <div style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="pg-ai-progress-msg">
        <BsStars aria-hidden="true" /> {p?.message ?? "Writing the storyline…"}
        {total > 0 && p?.phase !== "outline" && <span className="pg-ai-progress-count">{done} of {plural(total, "case")}</span>}
      </div>
      {p?.titles?.length ? (
        <ol className="pg-ai-titles" data-testid="my-ai-progress-titles">
          {p.titles.slice(0, 60).map((t, i) => (
            <li key={i} className={written.has(i + 1) ? "done" : ""}>
              <span className="pg-ai-tick">{written.has(i + 1) ? <BsCheck2 aria-label="written" /> : i + 1}</span> {t}
            </li>
          ))}
          {p.titles.length > 60 && <li className="more">and {p.titles.length - 60} more</li>}
        </ol>
      ) : (
        <div className="pg-ai-progress-note">First the storyline and the cast, then the cases. Every case is checked so it can be solved.</div>
      )}
    </div>
  );
}

export interface AiPrefs {
  setting: string;
  tone: Tone;
  count: number;
}
export const describePrefs = (p: AiPrefs) => `${plural(p.count, "case")} · ${TONE_LABEL[p.tone]} · ${p.setting === "surprise" ? "surprise setting" : (SETTINGS.find((s) => s.id === p.setting)?.name ?? p.setting)}`;

/** Setting chips, tone and number of cases (inside a quiet disclosure). */
export function AiCustomize({ prefs, set, disabled, max }: { prefs: AiPrefs; set: (p: AiPrefs) => void; disabled?: boolean; max: number }) {
  return (
    <div className="pg-ai">
      <div className="pg-ai-group">
        <div className="pg-ai-label">Setting</div>
        <div className="pg-ai-chips" role="radiogroup" aria-label="Setting">
          {[{ id: "surprise", name: "Surprise me" }, ...SETTINGS].map((st) => (
            <button key={st.id} type="button" role="radio" aria-checked={prefs.setting === st.id} className={`pg-chip ${prefs.setting === st.id ? "selected" : ""}`} data-testid={`my-ai-setting-${st.id}`} disabled={disabled} onClick={() => set({ ...prefs, setting: st.id })}>
              {st.id === "surprise" && <BsMagic aria-hidden="true" />} {st.name}
            </button>
          ))}
        </div>
      </div>
      <div className="pg-ai-row">
        <div className="pg-ai-group">
          <div className="pg-ai-label">Tone</div>
          <div className="pg-seg" role="radiogroup" aria-label="Tone">
            {TONES.map((t) => (
              <button key={t} type="button" role="radio" aria-checked={prefs.tone === t} className={prefs.tone === t ? "active" : ""} data-testid={`my-ai-tone-${t}`} disabled={disabled} onClick={() => set({ ...prefs, tone: t })}>
                {TONE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
        <div className="pg-ai-group">
          <label className="pg-ai-label" htmlFor="myAiCount">
            Cases
          </label>
          <div className="pg-ai-count">
            {[6, 12, 24].map((n) => (
              <button key={n} type="button" className={`pg-chip ${prefs.count === n ? "selected" : ""}`} disabled={disabled} onClick={() => set({ ...prefs, count: n })}>
                {n}
              </button>
            ))}
            <input id="myAiCount" type="number" min={1} max={max} className="form-control form-control-sm" style={{ width: "5.5rem" }} value={prefs.count} data-testid="my-ai-count" disabled={disabled} onChange={(e) => set({ ...prefs, count: Math.max(1, Math.min(max, Math.round(Number(e.target.value) || 1))) })} />
          </div>
        </div>
      </div>
      {prefs.tone === "noir" && <p className="pg-ai-hint">Adult noir stays restrained: crimes happen off the page, with no gore or bad language.</p>}
    </div>
  );
}
