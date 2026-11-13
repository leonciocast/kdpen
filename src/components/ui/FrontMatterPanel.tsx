"use client";
import React from "react";
import { BsArrowCounterclockwise } from "react-icons/bs";
import { DEFAULT_NOTICE, FrontMatter, copyrightDetails, isbnLooksValid, resolveNotice } from "@/lib/print/frontMatter";
import { TRIM_SIZES, TrimKey } from "@/lib/print/kdp";
import InfoTip from "./InfoTip";

interface Props {
  fm: FrontMatter;
  update: (patch: Partial<FrontMatter>) => void;
  reset: () => void;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
}

function Field({ id, label, tip, children }: { id: string; label: string; tip?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="form-label" htmlFor={id}>
        {label}
        {tip && <InfoTip text={tip} />}
      </label>
      {children}
    </div>
  );
}

export function FrontMatterForm({ fm, update, reset, enabled, setEnabled }: Props) {
  const placeholderAuthor = fm.author.trim() === "Your Name";
  return (
    <div>
      <div className="form-check form-switch mb-3">
        <input className="form-check-input" type="checkbox" role="switch" id="fm-enabled" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <label className="form-check-label fw-semibold" htmlFor="fm-enabled">
          Include a title page and copyright page
        </label>
      </div>
      <fieldset disabled={!enabled} style={{ opacity: enabled ? 1 : 0.55 }}>
        <div className="row g-3">
          <div className="col-12">
            <Field id="fm-title" label="Book title">
              <input id="fm-title" className="form-control" value={fm.title} onChange={(e) => update({ title: e.target.value })} />
            </Field>
          </div>
          <div className="col-12">
            <Field id="fm-subtitle" label="Subtitle" tip="Optional. Shown under the title, e.g. “Large Print Puzzles for Adults”.">
              <input id="fm-subtitle" className="form-control" value={fm.subtitle} onChange={(e) => update({ subtitle: e.target.value })} />
            </Field>
          </div>
          <div className="col-sm-6">
            <Field id="fm-author" label="Author or brand">
              <input id="fm-author" className={`form-control ${placeholderAuthor ? "border-warning" : ""}`} value={fm.author} onChange={(e) => update({ author: e.target.value })} />
            </Field>
            {placeholderAuthor && <div className="form-text text-warning-emphasis">Replace “Your Name” with your pen name or brand.</div>}
          </div>
          <div className="col-sm-6">
            <Field id="fm-imprint" label="Imprint / publisher" tip="Your publishing name. Leave blank if you publish under your own name.">
              <input id="fm-imprint" className="form-control" value={fm.imprint} onChange={(e) => update({ imprint: e.target.value })} />
            </Field>
          </div>
          <div className="col-6 col-sm-3">
            <Field id="fm-year" label="Year">
              <input id="fm-year" className="form-control" inputMode="numeric" maxLength={4} value={fm.year} onChange={(e) => update({ year: e.target.value.replace(/[^\d]/g, "") })} />
            </Field>
          </div>
          <div className="col-6 col-sm-4">
            <Field id="fm-edition" label="Edition">
              <input id="fm-edition" className="form-control" value={fm.edition} onChange={(e) => update({ edition: e.target.value })} />
            </Field>
          </div>
          <div className="col-sm-5">
            <Field id="fm-isbn" label="ISBN (optional)" tip="KDP can assign a free ISBN. Paste it here if you have one, or leave blank.">
              <input id="fm-isbn" className={`form-control ${isbnLooksValid(fm.isbn) ? "" : "is-invalid"}`} value={fm.isbn} placeholder="978-…" onChange={(e) => update({ isbn: e.target.value })} />
              <div className="invalid-feedback">ISBNs have 10 or 13 digits.</div>
            </Field>
          </div>
          <div className="col-12">
            <div className="d-flex justify-content-between align-items-end">
              <label className="form-label" htmlFor="fm-notice">
                Copyright notice
                <InfoTip text="{year}, {author} and {imprint} are filled in automatically. Separate paragraphs with a blank line." />
              </label>
              {fm.notice !== DEFAULT_NOTICE && (
                <button type="button" className="btn btn-ghost btn-sm mb-1" onClick={() => update({ notice: DEFAULT_NOTICE })}>
                  <BsArrowCounterclockwise /> Use default text
                </button>
              )}
            </div>
            <textarea id="fm-notice" className="form-control" rows={6} value={fm.notice} onChange={(e) => update({ notice: e.target.value })} />
          </div>
          <div className="col-12">
            <Field id="fm-dedication" label="Dedication (optional)" tip="Gets its own page after the copyright page.">
              <input id="fm-dedication" className="form-control" value={fm.dedication} placeholder="For my family…" onChange={(e) => update({ dedication: e.target.value })} />
            </Field>
          </div>
          <div className="col-12">
            <Field id="fm-website" label="Website or contact line (optional)">
              <input id="fm-website" className="form-control" value={fm.website} placeholder="www.yourwebsite.com" onChange={(e) => update({ website: e.target.value })} />
            </Field>
          </div>
        </div>
        <div className="d-flex justify-content-between align-items-center mt-3">
          <span className="form-text m-0">Saved automatically in this browser.</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
            <BsArrowCounterclockwise /> Reset all fields
          </button>
        </div>
      </fieldset>
    </div>
  );
}

/** Scaled HTML mock-ups of the title page and copyright page. */
export function FrontMatterPreview({ fm, trim, detail }: { fm: FrontMatter; trim: TrimKey; detail: string }) {
  const t = TRIM_SIZES[trim];
  const W = 210;
  const H = (W * t.height) / t.width;
  const k = W / (t.width * 72); // px per pt
  const pad = 0.6 * 72 * k;
  const paras = resolveNotice(fm).split(/\n\s*\n/).filter(Boolean);
  return (
    <div className="pg-book-preview" aria-label="Preview of title and copyright pages">
      <div>
        <div className="pg-page" style={{ width: W, height: H, padding: pad, textAlign: "center" }} data-testid="title-preview">
          <div style={{ position: "absolute", top: H * 0.17, left: W * 0.2, right: W * 0.2, borderTop: "2px solid #111", height: 4, borderBottom: "1px solid #111" }} />
          <div style={{ position: "absolute", top: H * 0.27, left: pad, right: pad }}>
            <div style={{ fontWeight: 700, fontSize: 34 * k * (trim === "6x9" ? 0.78 : 1), lineHeight: 1.15 }}>{fm.title || "Puzzle Book"}</div>
            {fm.subtitle && <div style={{ fontSize: 15 * k, color: "#555", marginTop: 6 * k }}>{fm.subtitle}</div>}
            <div style={{ margin: `${12 * k}px auto`, width: 120 * k, borderTop: "1px solid #111" }} />
            <div style={{ fontFamily: "system-ui, sans-serif", fontSize: Math.max(6, 11 * k), letterSpacing: 1, color: "#666", textTransform: "uppercase" }}>{detail}</div>
          </div>
          <div style={{ position: "absolute", top: H * 0.76, left: 0, right: 0, fontSize: 17 * k }}>{fm.author}</div>
          <div style={{ position: "absolute", top: H * 0.9, left: 0, right: 0, fontFamily: "system-ui, sans-serif", fontSize: Math.max(5.5, 9.5 * k), letterSpacing: 1.5, color: "#777", textTransform: "uppercase" }}>{fm.imprint}</div>
        </div>
        <div className="pg-page-label">Title page</div>
      </div>
      <div>
        <div className="pg-page" style={{ width: W, height: H, padding: pad, display: "flex", flexDirection: "column", justifyContent: "flex-end", fontSize: Math.max(4.5, 9 * k), lineHeight: 1.5 }} data-testid="copyright-preview">
          <div style={{ fontWeight: 700, fontSize: Math.max(5.5, 11 * k), marginBottom: 6 * k }}>{fm.title}</div>
          {paras.map((p, i) => (
            <p key={i} style={{ margin: `0 0 ${5 * k}px`, color: "#333" }}>
              {p}
            </p>
          ))}
          <div style={{ marginTop: 4 * k, color: "#333" }}>
            {copyrightDetails(fm).map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
        </div>
        <div className="pg-page-label">Copyright page</div>
      </div>
    </div>
  );
}

export function BookFormatFields({
  trim,
  setTrim,
  bleed,
  setBleed,
  pad,
  setPad,
  extra,
}: {
  trim: TrimKey;
  setTrim: (t: TrimKey) => void;
  bleed: boolean;
  setBleed: (b: boolean) => void;
  pad: boolean;
  setPad: (b: boolean) => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="row g-3">
      <div className="col-sm-6">
        <label className="form-label" htmlFor="trim">
          Trim size <InfoTip text="The finished size of your paperback. Choose the same size when you set up the book on KDP." />
        </label>
        <select id="trim" className="form-select" value={trim} onChange={(e) => setTrim(e.target.value as TrimKey)}>
          {(Object.keys(TRIM_SIZES) as TrimKey[]).map((key) => (
            <option key={key} value={key}>
              {TRIM_SIZES[key].label}
            </option>
          ))}
        </select>
      </div>
      {extra}
      <div className="col-12">
        <div className="form-check">
          <input className="form-check-input" type="checkbox" id="bleed" checked={bleed} onChange={(e) => setBleed(e.target.checked)} />
          <label className="form-check-label" htmlFor="bleed">
            Bleed <span className="text-muted">(adds 0.125&quot; width, 0.25&quot; height)</span>
            <InfoTip text="Only needed if something prints to the very edge of the page. Puzzle interiors usually don't need bleed. Pick the matching option on KDP." />
          </label>
        </div>
        <div className="form-check">
          <input className="form-check-input" type="checkbox" id="pad" checked={pad} onChange={(e) => setPad(e.target.checked)} />
          <label className="form-check-label" htmlFor="pad">
            KDP page count <span className="text-muted">(even number, at least 24 pages)</span>
            <InfoTip text="KDP paperbacks need at least 24 pages. Blank pages are added at the end if needed." />
          </label>
        </div>
      </div>
    </div>
  );
}
