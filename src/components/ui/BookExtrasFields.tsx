"use client";
import React from "react";
import { BookExtras, DEFAULT_THANK_YOU } from "@/lib/print/book";
import { LIMITS } from "@/lib/limits";
import InfoTip from "./InfoTip";

const TOGGLES: { key: "belongsTo" | "toc" | "howTo" | "thankYou"; label: string; tip: string }[] = [
  { key: "belongsTo", label: "“This book belongs to” page", tip: "A framed page for the owner's name. Popular in gift books." },
  { key: "toc", label: "Table of contents", tip: "Lists the sections (themes or difficulty levels) and where the solutions start, with page numbers." },
  { key: "howTo", label: "How to play page", tip: "Rules plus a small solved example puzzle, drawn from a real mini puzzle." },
  { key: "thankYou", label: "Thank you / review page", tip: "A friendly last page asking readers to leave a review. Reviews help your book sell." },
];

/** Optional front and back matter for a book. */
export default function BookExtrasFields({ extras, setExtras }: { extras: BookExtras; setExtras: (e: BookExtras) => void }) {
  const set = (patch: Partial<BookExtras>) => setExtras({ ...extras, ...patch });
  return (
    <div className="d-grid gap-2">
      <div className="row g-1">
        {TOGGLES.map((t) => (
          <div className="col-sm-6" key={t.key}>
            <div className="form-check form-switch">
              <input className="form-check-input" type="checkbox" id={`ex-${t.key}`} checked={extras[t.key]} onChange={(e) => set({ [t.key]: e.target.checked })} data-testid={`extra-${t.key}`} />
              <label className="form-check-label" htmlFor={`ex-${t.key}`}>
                {t.label} <InfoTip text={t.tip} />
              </label>
            </div>
          </div>
        ))}
      </div>
      <div>
        <label className="form-label small" htmlFor="ex-intro">
          Introduction page <span className="text-muted fw-normal">(optional; leave empty to skip)</span>
        </label>
        <textarea id="ex-intro" className="form-control form-control-sm" rows={3} maxLength={2500} placeholder="A short welcome for your readers. Blank lines start new paragraphs." value={extras.intro} onChange={(e) => set({ intro: e.target.value })} />
      </div>
      {extras.thankYou && (
        <div>
          <label className="form-label small" htmlFor="ex-thanks">
            Thank-you message
          </label>
          <textarea id="ex-thanks" className="form-control form-control-sm" rows={3} maxLength={1200} value={extras.thankYouText} placeholder={DEFAULT_THANK_YOU} onChange={(e) => set({ thankYouText: e.target.value })} />
        </div>
      )}
      <div className="row g-2 align-items-end">
        <div className="col-sm-5">
          <label className="form-label small" htmlFor="ex-notes">
            Notes pages at the back
          </label>
          <input id="ex-notes" type="number" className="form-control form-control-sm" min={0} max={LIMITS.maxNotesPages} value={extras.notesPages} onChange={(e) => set({ notesPages: Math.max(0, Math.min(LIMITS.maxNotesPages, Math.round(Number(e.target.value) || 0))) })} />
        </div>
        <div className="col-sm-7">
          <div className="form-check form-switch">
            <input className="form-check-input" type="checkbox" id="ex-padnotes" checked={extras.padWithNotes} onChange={(e) => set({ padWithNotes: e.target.checked })} />
            <label className="form-check-label" htmlFor="ex-padnotes">
              Fill KDP padding with lined notes pages <InfoTip text="KDP books need at least 24 pages and an even count. Instead of empty pages, add useful lined notes pages." />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
