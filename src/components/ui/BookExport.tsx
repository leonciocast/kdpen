"use client";
import React, { useMemo, useState } from "react";
import { BsBook, BsCheckCircleFill, BsFilePdf, BsPrinter } from "react-icons/bs";
import { toast } from "react-toastify";
import { FrontMatter } from "@/lib/print/frontMatter";
import { TRIM_SIZES, TrimKey, insideMargin } from "@/lib/print/kdp";
import { RenderedBook, PdfFonts, loadPdfFonts, planKinds, savePdf } from "@/lib/print/book";
import { BookFormatFields, FrontMatterForm, FrontMatterPreview } from "./FrontMatterPanel";
import { useFrontMatter } from "./useFrontMatter";
import { StepIntro } from "./Wizard";
import Callout from "./Callout";

export interface ExportSettings {
  trim: TrimKey;
  bleed: boolean;
  padForKdp: boolean;
  frontMatter: FrontMatter | null;
}

interface Props {
  tool: string;
  toolDefaults: Partial<FrontMatter>;
  /** Short line for the title page, e.g. "12 Word Search Puzzles". */
  detail: string;
  /** Number of content pages (puzzles + answers) the book will have. */
  contentPages: number;
  itemsLabel: string;
  extraFields?: React.ReactNode;
  build: (s: ExportSettings, fonts: PdfFonts) => RenderedBook;
  fileBase: string;
  onPrint: () => void;
  disabledReason?: string;
  title?: string;
  intro?: string;
}

export default function BookExport({ tool, toolDefaults, detail, contentPages, itemsLabel, extraFields, build, fileBase, onPrint, disabledReason, title = "Export your book", intro }: Props) {
  const { fm, update, reset } = useFrontMatter(tool, toolDefaults);
  const [includeFm, setIncludeFm] = useState(true);
  const [trim, setTrim] = useState<TrimKey>("8.5x11");
  const [bleed, setBleed] = useState(false);
  const [pad, setPad] = useState(true);
  const [busy, setBusy] = useState(false);

  const plan = useMemo(() => {
    const noop = () => {};
    const kinds = planKinds({
      frontMatter: includeFm ? fm : null,
      howTo: { heading: "", paragraphs: [] },
      content: Array.from({ length: Math.max(1, contentPages) }, () => noop),
      padForKdp: pad,
    });
    return { pages: kinds.length, blanks: kinds.filter((k) => k === "blank").length };
  }, [includeFm, fm, contentPages, pad]);

  const download = async () => {
    setBusy(true);
    try {
      const fonts = await loadPdfFonts();
      const book = build({ trim, bleed, padForKdp: pad, frontMatter: includeFm ? fm : null }, fonts);
      savePdf(book.pdf, `${fileBase}_${trim}${bleed ? "_bleed" : ""}.pdf`);
      toast.success(`Your PDF is ready: ${book.pageCount} pages.`);
    } catch (e) {
      toast.error(`Sorry, the PDF couldn't be created: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const t = TRIM_SIZES[trim];
  return (
    <div>
      <StepIntro icon={<BsBook />} title={title}>
        {intro ?? "Set the book size and your title and copyright pages, then download a print-ready PDF interior for Amazon KDP."}
      </StepIntro>
      <div className="row g-4">
        <div className="col-lg-7">
          <section className="pg-subtle p-3 mb-3" aria-labelledby="fmt-title">
            <h3 id="fmt-title" className="pg-section-title mb-3">
              Book format
            </h3>
            <BookFormatFields trim={trim} setTrim={setTrim} bleed={bleed} setBleed={setBleed} pad={pad} setPad={setPad} extra={extraFields} />
          </section>
          <section className="pg-subtle p-3" aria-labelledby="fm-title-h">
            <h3 id="fm-title-h" className="pg-section-title mb-3">
              Title &amp; copyright pages
            </h3>
            <FrontMatterForm fm={fm} update={update} reset={reset} enabled={includeFm} setEnabled={setIncludeFm} />
          </section>
        </div>
        <div className="col-lg-5">
          <div className="position-sticky" style={{ top: 84 }}>
            {includeFm && (
              <div className="mb-3">
                <div className="form-label">Preview</div>
                <FrontMatterPreview fm={fm} trim={trim} detail={detail} />
              </div>
            )}
            <div className="pg-card pg-card-body">
              <h3 className="pg-section-title">Your book</h3>
              <ul className="list-unstyled small my-3 d-grid gap-2">
                <li className="d-flex justify-content-between">
                  <span className="text-muted">Contents</span> <span className="fw-semibold text-end">{itemsLabel}</span>
                </li>
                <li className="d-flex justify-content-between">
                  <span className="text-muted">Trim size</span>
                  <span className="fw-semibold">
                    {t.width}&quot; × {t.height}&quot;{bleed ? " + bleed" : ""}
                  </span>
                </li>
                <li className="d-flex justify-content-between">
                  <span className="text-muted">Pages</span>
                  <span className="fw-semibold">
                    {plan.pages}
                    {plan.blanks ? ` (${plan.blanks} blank at the end)` : ""}
                  </span>
                </li>
                <li className="d-flex justify-content-between">
                  <span className="text-muted">Inside margin (gutter)</span> <span className="fw-semibold">{insideMargin(plan.pages)}&quot;</span>
                </li>
              </ul>
              <div className="small d-grid gap-1 mb-3 text-muted">
                {["Fonts embedded", "Mirrored margins & page numbers", "Answer keys at the back"].map((x) => (
                  <span key={x}>
                    <BsCheckCircleFill className="text-success me-1" /> {x}
                  </span>
                ))}
              </div>
              {disabledReason && <Callout tone="warn" className="mb-3">{disabledReason}</Callout>}
              <div className="d-grid gap-2">
                <button type="button" className="btn btn-primary btn-lg" onClick={download} disabled={busy || !!disabledReason} data-testid="download-pdf">
                  {busy ? <span className="spinner-border spinner-border-sm" role="status" aria-label="Creating PDF" /> : <BsFilePdf />}
                  {busy ? "Creating PDF…" : "Download KDP PDF"}
                </button>
                <button type="button" className="btn btn-light" onClick={onPrint} disabled={!!disabledReason}>
                  <BsPrinter /> Print puzzles
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
