"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { BsBook, BsBoxArrowUpRight, BsCheckCircleFill, BsDownload, BsFilePdf } from "react-icons/bs";
import { toast } from "react-toastify";
import { FrontMatter } from "@/lib/print/frontMatter";
import { TRIM_SIZES, TrimKey, insideMargin } from "@/lib/print/kdp";
import { BookExtras, DEFAULT_EXTRAS } from "@/lib/print/book";
import { estimatePages, planVolumes } from "@/lib/print/estimate";
import { LIMITS } from "@/lib/limits";
import { plural } from "@/lib/plural";
import type { Design, ToolKind } from "@/lib/design/types";
import type { BookSettings, BuildItems, Job } from "@/lib/jobs/types";
import { JobCancelled, startJob, RunningJob } from "@/lib/jobs/client";
import type { Progress } from "@/lib/jobs/types";
import { BookFormatFields, FrontMatterForm, FrontMatterPreview } from "./FrontMatterPanel";
import { useFrontMatter } from "./useFrontMatter";
import { StepIntro } from "./Wizard";
import Callout from "./Callout";
import InfoTip from "./InfoTip";
import BookExtrasFields from "./BookExtrasFields";
import JobProgress from "./JobProgress";

type PerPage = 1 | 2 | 4 | 6;
const nowMs = () => performance.now();
const EXTRAS_KEY = "puzzle-generator.extras.v1";

function loadExtras(tool: string): BookExtras {
  if (typeof window === "undefined") return DEFAULT_EXTRAS;
  try {
    const raw = localStorage.getItem(`${EXTRAS_KEY}.${tool}`);
    return raw ? { ...DEFAULT_EXTRAS, ...JSON.parse(raw) } : DEFAULT_EXTRAS;
  } catch {
    return DEFAULT_EXTRAS;
  }
}

interface Props {
  tool: ToolKind;
  toolDefaults: Partial<FrontMatter>;
  /** e.g. "puzzle", "crossword". */
  itemNoun: string;
  itemCount: number;
  /** Extra TOC sections such as themes or difficulty levels. */
  sectionCount: number;
  design: Design;
  /** Items to put in the book (only called when building). */
  items: () => BuildItems;
  fileBase: string;
  disabledReason?: string;
  /** Sudoku: choose how many puzzles per page. */
  perPageChoice?: boolean;
  defaultAnswersPerPage?: PerPage;
}

interface Built {
  name: string;
  pages: number;
  size: number;
  url: string;
}

export default function BookExport({ tool, toolDefaults, itemNoun, itemCount, sectionCount, design, items, fileBase, disabledReason, perPageChoice, defaultAnswersPerPage = 4 }: Props) {
  const { fm, update, reset } = useFrontMatter(tool, toolDefaults);
  const [includeFm, setIncludeFm] = useState(true);
  const [trim, setTrim] = useState<TrimKey>("8.5x11");
  const [bleed, setBleed] = useState(false);
  const [pad, setPad] = useState(true);
  const [extras, setExtras] = useState<BookExtras>(() => loadExtras(tool));
  const [answersPerPage, setAnswersPerPage] = useState<PerPage>(defaultAnswersPerPage);
  const [perPage, setPerPage] = useState<PerPage>(1);
  const [autoSplit, setAutoSplit] = useState(true);
  const [job, setJob] = useState<RunningJob<unknown> | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [files, setFiles] = useState<Built[]>([]);
  const filesRef = useRef<Built[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(`${EXTRAS_KEY}.${tool}`, JSON.stringify(extras));
    } catch {
      /* storage unavailable */
    }
  }, [extras, tool]);

  // Free the PDF blobs when leaving the page.
  useEffect(() => () => filesRef.current.forEach((f) => URL.revokeObjectURL(f.url)), []);

  const frontMatter = includeFm ? fm : null;
  const layout = useMemo(() => ({ perPage: perPageChoice ? perPage : 1, answersPerPage, sectionCount }), [perPageChoice, perPage, answersPerPage, sectionCount]);
  const pagesFor = useMemo(() => (n: number) => estimatePages({ items: n, layout, frontMatter, extras, padForKdp: pad }), [layout, frontMatter, extras, pad]);
  const single = itemCount > 0 ? pagesFor(itemCount) : 0;
  const over = single > LIMITS.kdpMaxPages;
  const plan = useMemo(() => {
    if (itemCount <= 0) return { ranges: [] as [number, number][], pages: [] as number[], maxItemsPerVolume: 0 };
    try {
      return over && autoSplit ? planVolumes(itemCount, pagesFor) : { ranges: [[0, itemCount]] as [number, number][], pages: [single], maxItemsPerVolume: itemCount };
    } catch {
      return { ranges: [] as [number, number][], pages: [] as number[], maxItemsPerVolume: 0 };
    }
  }, [itemCount, over, autoSplit, pagesFor, single]);
  const blocked = disabledReason || (over && !autoSplit ? `This book would have ${single} pages. KDP allows at most ${LIMITS.kdpMaxPages}. Turn on automatic volumes or use fewer ${itemNoun}s.` : "");

  const clearFiles = () => {
    filesRef.current.forEach((f) => URL.revokeObjectURL(f.url));
    filesRef.current = [];
    setFiles([]);
  };

  const build = async () => {
    clearFiles();
    const settings: BookSettings = { trim, bleed, padForKdp: pad, frontMatter, extras, design, answersPerPage, perPage: perPageChoice ? perPage : undefined };
    const job = { type: "build", settings, volumes: plan.ranges, fileBase, ...items() } as Job;
    const started = nowMs();
    const running = startJob(job, setProgress);
    setJob(running as RunningJob<unknown>);
    setProgress(null);
    try {
      const out = (await running.promise) as { name: string; pages: number; bytes: ArrayBuffer }[];
      const built = out.map((f) => ({ name: f.name, pages: f.pages, size: f.bytes.byteLength, url: URL.createObjectURL(new Blob([f.bytes], { type: "application/pdf" })) }));
      filesRef.current = built;
      setFiles(built);
      const secs = ((nowMs() - started) / 1000).toFixed(1);
      toast.success(built.length > 1 ? `${built.length} volumes are ready (${secs}s).` : `Your PDF is ready: ${built[0].pages} pages (${secs}s).`);
      if (built.length === 1) download(built[0]);
    } catch (e) {
      if (e instanceof JobCancelled) toast.info("PDF creation cancelled.");
      else toast.error(`Sorry, the PDF couldn't be created: ${(e as Error).message}`);
    } finally {
      setJob(null);
    }
  };

  const download = (f: Built) => {
    const a = document.createElement("a");
    a.href = f.url;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const t = TRIM_SIZES[trim];
  const answerChoices: PerPage[] = tool === "crossword" ? [1, 2, 4] : [1, 2, 4, 6];
  const volumes = plan.ranges.length;
  const biggest = Math.max(0, ...plan.pages);

  return (
    <div>
      <StepIntro icon={<BsBook />} title="Export your book">
        Choose the size, the extra pages and your title page, then create a print-ready PDF interior for Amazon KDP. Big books are built in the background, so the page stays responsive.
      </StepIntro>
      <div className="row g-4">
        <div className="col-lg-7">
          <section className="pg-subtle p-3 mb-3" aria-labelledby="fmt-title">
            <h3 id="fmt-title" className="pg-section-title mb-3">
              Book format
            </h3>
            <BookFormatFields
              trim={trim}
              setTrim={setTrim}
              bleed={bleed}
              setBleed={setBleed}
              pad={pad}
              setPad={setPad}
              extra={
                <>
                  {perPageChoice && (
                    <div className="col-sm-6">
                      <label className="form-label" htmlFor="perPage">
                        Puzzles per page <InfoTip text="1 per page gives the biggest grids; 4 or 6 make a thicker-value book with smaller grids." />
                      </label>
                      <select id="perPage" className="form-select" value={perPage} onChange={(e) => setPerPage(Number(e.target.value) as PerPage)} data-testid="per-page">
                        {[1, 2, 4, 6].map((n) => (
                          <option key={n} value={n}>
                            {n} per page
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="col-sm-6">
                    <label className="form-label" htmlFor="answersPerPage">
                      Solutions per page <InfoTip text="How many solved puzzles fit on each answer page at the back of the book." />
                    </label>
                    <select id="answersPerPage" className="form-select" value={answersPerPage} onChange={(e) => setAnswersPerPage(Number(e.target.value) as PerPage)}>
                      {answerChoices.map((n) => (
                        <option key={n} value={n}>
                          {n} per page
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              }
            />
          </section>
          <section className="pg-subtle p-3 mb-3" aria-labelledby="extras-title">
            <h3 id="extras-title" className="pg-section-title mb-3">
              Extra pages
            </h3>
            <BookExtrasFields extras={extras} setExtras={setExtras} />
          </section>
          <section className="pg-subtle p-3" aria-labelledby="fm-title-h">
            <h3 id="fm-title-h" className="pg-section-title mb-3">
              Title, copyright &amp; dedication
            </h3>
            <FrontMatterForm fm={fm} update={update} reset={reset} enabled={includeFm} setEnabled={setIncludeFm} />
          </section>
        </div>
        <div className="col-lg-5">
          <div className="position-sticky" style={{ top: 84 }}>
            {includeFm && (
              <div className="mb-3">
                <div className="form-label">Title page preview</div>
                <FrontMatterPreview fm={fm} trim={trim} detail={`${itemCount.toLocaleString()} ${itemNoun[0].toUpperCase()}${itemNoun.slice(1)}${itemCount === 1 ? "" : "s"}`} />
              </div>
            )}
            <div className="pg-card pg-card-body" data-testid="book-stats">
              <h3 className="pg-section-title">Your book</h3>
              <ul className="list-unstyled small my-3 d-grid gap-2">
                <li className="pg-stat">
                  <span className="text-muted">Contents</span>
                  <span className="fw-semibold text-end">{plural(itemCount, itemNoun)} + solutions</span>
                </li>
                <li className="pg-stat">
                  <span className="text-muted">Trim size</span>
                  <span className="fw-semibold">
                    {t.width}&quot; × {t.height}&quot;{bleed ? " + bleed" : ""}
                  </span>
                </li>
                <li className="pg-stat">
                  <span className="text-muted">Estimated pages</span>
                  <span className="fw-semibold" data-testid="page-estimate">
                    {volumes > 1 ? `${volumes} volumes, up to ${biggest} pages each` : single.toLocaleString()}
                  </span>
                </li>
                <li className="pg-stat">
                  <span className="text-muted">KDP page limit</span>
                  <span className="fw-semibold">
                    {LIMITS.kdpMinPages}–{LIMITS.kdpMaxPages} pages
                  </span>
                </li>
                {!over && single > 0 && (
                  <li className="pg-stat">
                    <span className="text-muted">Inside margin (gutter)</span>
                    <span className="fw-semibold">{insideMargin(single)}&quot;</span>
                  </li>
                )}
              </ul>
              {over && (
                <Callout tone="warn" className="mb-3">
                  <div>
                    {single.toLocaleString()} pages is more than KDP&apos;s {LIMITS.kdpMaxPages}-page limit.
                    <div className="form-check mt-2">
                      <input className="form-check-input" type="checkbox" id="autoSplit" checked={autoSplit} onChange={(e) => setAutoSplit(e.target.checked)} data-testid="auto-split" />
                      <label className="form-check-label" htmlFor="autoSplit">
                        Split into {plan.ranges.length > 1 ? plan.ranges.length : "several"} volumes automatically (Volume 1, 2…), each its own PDF
                      </label>
                    </div>
                  </div>
                </Callout>
              )}
              <div className="small d-grid gap-1 mb-3 text-muted">
                {["Fonts embedded, vector pages (small files)", "Mirrored margins & page numbers", "Solutions at the back"].map((x) => (
                  <span key={x}>
                    <BsCheckCircleFill className="text-success me-1" /> {x}
                  </span>
                ))}
              </div>
              {blocked && (
                <Callout tone="warn" className="mb-3">
                  {blocked}
                </Callout>
              )}
              {job ? (
                <JobProgress title="Creating your PDF" progress={progress} onCancel={() => job.cancel()} />
              ) : (
                <div className="d-grid gap-2">
                  <button type="button" className="btn btn-primary btn-lg" onClick={build} disabled={!!blocked || volumes === 0} data-testid="download-pdf">
                    <BsFilePdf /> {volumes > 1 ? `Create ${volumes} PDF volumes` : "Create & download KDP PDF"}
                  </button>
                </div>
              )}
              {files.length > 0 && (
                <div className="mt-3 d-grid gap-2" data-testid="built-files">
                  {files.map((f) => (
                    <div key={f.name} className="d-flex align-items-center gap-2 small">
                      <BsFilePdf className="text-danger flex-shrink-0" />
                      <span className="flex-grow-1 text-truncate" title={f.name}>
                        <span className="fw-semibold">{f.name}</span>
                        <span className="text-muted d-block">
                          {f.pages} pages · {(f.size / 1024 / 1024).toFixed(1)} MB
                        </span>
                      </span>
                      <button type="button" className="btn btn-light btn-sm" onClick={() => download(f)} title="Download">
                        <BsDownload /> Download
                      </button>
                      <a className="btn btn-ghost btn-sm" href={f.url} target="_blank" rel="noreferrer" title="Open the PDF in a new tab to view or print">
                        <BsBoxArrowUpRight /> Open
                      </a>
                    </div>
                  ))}
                  <div className="form-text">To print at home, open the PDF and use your browser&apos;s print button.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
