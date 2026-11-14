"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { BsBook, BsBoxArrowUpRight, BsCheckCircleFill, BsDownload, BsEye, BsFilePdf } from "react-icons/bs";
import { Panel } from "./Panel";
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
import { FlowCtl, Question, QuestionFlow } from "./Flow";
import Callout from "./Callout";
import InfoTip from "./InfoTip";
import BookExtrasFields from "./BookExtrasFields";
import JobProgress from "./JobProgress";
import BookPreview, { PreviewPdf, Sorter } from "./preview/BookPreview";
import { CheckFix, Slot, applyOrderFix, arrangementSignature, defaultSlots, describePages, isDefaultOrder, readinessChecks, reorderPuzzles, restoreDeleted, seededShuffle } from "@/lib/print/arrange";

type PerPage = 1 | 2 | 4 | 6;

/** Keeps a value while the user moves between wizard steps (the component unmounts in between). */
const sticky = new Map<string, unknown>();
function useSticky<T>(key: string, init: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => (sticky.has(key) ? (sticky.get(key) as T) : init));
  return [
    v,
    (n: T) => {
      sticky.set(key, n);
      setV(n);
    },
  ];
}
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
  flow: FlowCtl;
}

interface Arranged {
  sig: string;
  slots: Slot[];
  past: Slot[][];
  future: Slot[][];
}

interface Built {
  name: string;
  pages: number;
  size: number;
  url: string;
}

export default function BookExport({ tool, toolDefaults, itemNoun, itemCount, sectionCount, design, items, fileBase, disabledReason, perPageChoice, defaultAnswersPerPage = 4, flow }: Props) {
  const { fm, update, reset } = useFrontMatter(tool, toolDefaults);
  const [includeFm, setIncludeFm] = useSticky(`${tool}.fm`, true);
  const [trim, setTrim] = useSticky<TrimKey>(`${tool}.trim`, "8.5x11");
  const [bleed, setBleed] = useSticky(`${tool}.bleed`, false);
  const [pad, setPad] = useSticky(`${tool}.pad`, true);
  const [extras, setExtras] = useState<BookExtras>(() => loadExtras(tool));
  const [answersPerPage, setAnswersPerPage] = useSticky<PerPage>(`${tool}.answers`, defaultAnswersPerPage);
  const [perPage, setPerPage] = useSticky<PerPage>(`${tool}.perPage`, 1);
  const [autoSplit, setAutoSplit] = useSticky(`${tool}.split`, true);
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
  // ---- page arrangement (preview)
  const shape = useMemo(() => ({ items: itemCount, perPage: layout.perPage, answersPerPage }), [itemCount, layout.perPage, answersPerPage]);
  const defaults = useMemo(() => (itemCount > 0 ? defaultSlots({ frontMatter, extras, sectionCount: sectionCount + 2, hasHowTo: true, padForKdp: pad }, shape) : []), [itemCount, frontMatter, extras, sectionCount, pad, shape]);
  const sig = useMemo(() => arrangementSignature(defaults, shape), [defaults, shape]);
  const [arr, setArr] = useSticky<Arranged | null>(`${tool}.arrange`, null);
  const custom = arr && arr.sig === sig ? arr : null;
  const staleOrder = !!arr && arr.sig !== sig && !isDefaultOrder(arr.slots, defaults);
  const slots = custom?.slots ?? defaults;
  const desc = useMemo(() => describePages(slots, shape, extras, pad, itemNoun[0].toUpperCase() + itemNoun.slice(1)), [slots, shape, extras, pad, itemNoun]);
  const arranged = !!custom && !isDefaultOrder(custom.slots, defaults);
  const changeSlots = (next: Slot[]) => setArr({ sig, slots: next, past: [...(custom?.past ?? []), slots].slice(-100), future: [] });
  const undo = () => {
    if (!custom?.past.length) return;
    setArr({ sig, slots: custom.past[custom.past.length - 1], past: custom.past.slice(0, -1), future: [slots, ...custom.future] });
  };
  const redo = () => {
    if (!custom?.future.length) return;
    setArr({ sig, slots: custom.future[0], past: [...custom.past, slots], future: custom.future.slice(1) });
  };

  const blocked = disabledReason || (over && !autoSplit ? `This book would have ${single} pages. KDP allows at most ${LIMITS.kdpMaxPages}. Turn on automatic volumes or use fewer ${itemNoun}s.` : "");

  const clearFiles = () => {
    filesRef.current.forEach((f) => URL.revokeObjectURL(f.url));
    filesRef.current = [];
    setFiles([]);
  };

  // One volume: the book is built from the arranged pages (the preview uses the very same job).
  const canArrange = plan.ranges.length === 1 && !over && itemCount > 0;
  const makeJob = (): Job => {
    const settings: BookSettings = { trim, bleed, padForKdp: pad, frontMatter, extras, design, answersPerPage, perPage: perPageChoice ? perPage : undefined };
    return { type: "build", settings, volumes: plan.ranges, fileBase, ...(canArrange ? { slots: desc.resolved.slots } : {}), ...items() } as Job;
  };
  const pageTotal = canArrange ? desc.pages.length : single;

  const build = async () => {
    clearFiles();
    const job = makeJob();
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

  // ---- live preview build (debounced, cancels the previous one)
  const [preview, setPreview] = useState<PreviewPdf | null>(null);
  const [pvBusy, setPvBusy] = useState(false);
  const [pvProgress, setPvProgress] = useState<Progress | null>(null);
  const [pvError, setPvError] = useState<string | null>(null);
  const onPreview = flow.sub === "preview" && canArrange && !disabledReason;
  const pvKey = JSON.stringify([trim, bleed, pad, frontMatter, extras, design, answersPerPage, perPageChoice ? perPage : 0, desc.resolved.slots, itemCount]);
  const makeJobRef = useRef(makeJob);
  const keysRef = useRef<string[]>([]);
  useEffect(() => {
    makeJobRef.current = makeJob;
    keysRef.current = desc.pages.map((p) => p.key);
  });
  const pvVersion = useRef(0);
  const pvFirst = useRef(true);
  useEffect(() => {
    if (!onPreview) return;
    let running: RunningJob<unknown> | null = null;
    let alive = true;
    const timer = window.setTimeout(
      () => {
        pvFirst.current = false;
        setPvBusy(true);
        setPvError(null);
        const keys = keysRef.current;
        const started = nowMs();
        running = startJob(makeJobRef.current(), (p) => alive && setPvProgress(p)) as RunningJob<unknown>;
        running.promise.then(
          (out) => {
            if (!alive) return;
            const f = (out as { bytes: ArrayBuffer }[])[0];
            (window as unknown as { __kdpenPreviewMs?: number }).__kdpenPreviewMs = nowMs() - started;
            setPreview({ bytes: f.bytes, keys, version: ++pvVersion.current });
            setPvBusy(false);
            setPvProgress(null);
          },
          (e) => {
            if (!alive || e instanceof JobCancelled) return;
            setPvError((e as Error).message);
            setPvBusy(false);
          },
        );
      },
      pvFirst.current ? 0 : 450,
    );
    return () => {
      alive = false;
      window.clearTimeout(timer);
      running?.cancel();
    };
  }, [onPreview, pvKey]);

  const sorters: Sorter[] = useMemo(() => {
    const per = Math.max(1, shape.perPage);
    const sortBy = (label: string, key: string, value: (it: Record<string, unknown>) => string | number) => ({
      key,
      label,
      apply: () => {
        const list = items().items as unknown as Record<string, unknown>[];
        const v = (ref: number) => value(list[ref * per] ?? {});
        changeSlots(reorderPuzzles(slots, (refs) => refs.slice().sort((a, b) => (v(a) < v(b) ? -1 : v(a) > v(b) ? 1 : a - b))));
      },
    });
    const rank: Record<string, number> = { easy: 0, medium: 1, hard: 2, expert: 3 };
    const out: Sorter[] = [];
    if (tool === "sudoku") out.push(sortBy("Sort easy → hard", "difficulty", (it) => rank[String(it.difficulty)] ?? 9));
    else if (sectionCount > 0) out.push(sortBy("Group by theme (A–Z)", "theme", (it) => String(it.theme ?? "").toLowerCase()));
    out.push({ key: "original", label: `Original ${itemNoun} order`, apply: () => changeSlots(reorderPuzzles(slots, (refs) => refs.slice().sort((a, b) => a - b))) });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, shape, tool, sectionCount, itemNoun, sig, custom]);

  const checks = useMemo(
    () => readinessChecks({ pages: desc.pages, frontMatter, padForKdp: pad, originalItems: itemCount, items: desc.resolved.itemOrder.length, unit: itemNoun }),
    [desc, frontMatter, pad, itemCount, itemNoun],
  );
  const onFix = (f: CheckFix) => {
    if (f === "size" || f === "title" || f === "extras") flow.setSub(f);
    else if (f === "undo-delete") changeSlots(restoreDeleted(slots, shape));
    else changeSlots(applyOrderFix(slots, f));
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
  const extrasOn = [extras.belongsTo, extras.toc, extras.howTo, extras.thankYou, !!extras.intro.trim(), extras.notesPages > 0].filter(Boolean).length;
  const answerChoices: PerPage[] = tool === "crossword" ? [1, 2, 4] : [1, 2, 4, 6];
  const volumes = plan.ranges.length;
  const biggest = Math.max(0, ...plan.pages);

  const sizeQ: Question = {
    key: "size",
    title: "What size is your book?",
    lead: "8.5 × 11 inch large print is the most popular for puzzle books. The other settings are already right for Amazon KDP.",
    hint: `${t.width}" × ${t.height}"${bleed ? " + bleed" : ""}`,
    body: (
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
    ),
  };

  const titleQ: Question = {
    key: "title",
    wide: true,
    title: "Your title and copyright pages",
    lead: "These are the first pages of your book. Put your pen name or brand as the author.",
    body: (
      <div className="row g-4">
        <div className="col-lg-7">
          <FrontMatterForm fm={fm} update={update} reset={reset} enabled={includeFm} setEnabled={setIncludeFm} />
        </div>
        <div className="col-lg-5">
          <div className="position-sticky" style={{ top: 84 }}>
            {includeFm ? (
              <Panel tone="result" title="Preview" icon={<BsEye />}>
                <FrontMatterPreview fm={fm} trim={trim} detail={`${itemCount.toLocaleString()} ${itemNoun[0].toUpperCase()}${itemNoun.slice(1)}${itemCount === 1 ? "" : "s"}`} />
              </Panel>
            ) : (
              <Callout>Your book will start straight with the puzzles.</Callout>
            )}
          </div>
        </div>
      </div>
    ),
  };

  const extrasQ: Question = {
    key: "extras",
    title: "Add extra pages?",
    optional: true,
    lead: `A “This book belongs to” page, contents, how to play, notes and more. ${extrasOn} ${extrasOn === 1 ? "is" : "are"} turned on already.`,
    skipLabel: "Skip, keep these",
    body: <BookExtrasFields extras={extras} setExtras={setExtras} />,
  };

  const previewQ: Question = {
    key: "preview",
    wide: true,
    title: "Preview & arrange your book",
    lead: canArrange ? "Every page exactly as it will print. Drag pages to change the order: page numbers, puzzle numbers, answers and the contents page follow automatically." : "This book is split into several volumes, so each volume keeps the standard page order.",
    nextLabel: "Looks good",
    body: canArrange ? (
      <>
        {staleOrder && (
          <Callout tone="warn" className="mb-3">
            <span>
              Your earlier page order was reset because the book changed (different {itemNoun}s or extra pages).{" "}
              <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={() => setArr(null)}>
                OK
              </button>
            </span>
          </Callout>
        )}
        <BookPreview
          pages={desc.pages}
          slots={slots}
          onChange={changeSlots}
          undo={undo}
          redo={redo}
          canUndo={!!custom?.past.length}
          canRedo={!!custom?.future.length}
          onReset={() => changeSlots(defaults)}
          isDefault={!arranged}
          pdf={preview}
          building={pvBusy}
          progress={pvProgress}
          error={pvError}
          checks={checks}
          onFix={onFix}
          trim={trim}
          bleed={bleed}
          unit={itemNoun[0].toUpperCase() + itemNoun.slice(1)}
          sorters={sorters}
          onShuffle={() => changeSlots(reorderPuzzles(slots, (refs) => seededShuffle(refs, Math.floor(Math.random() * 1e9))))}
          notify={(m) => toast.info(m)}
        />
      </>
    ) : (
      <Callout>
        {disabledReason || `Your book has ${single.toLocaleString()} pages, more than KDP's ${LIMITS.kdpMaxPages}, so it will be created as ${volumes} volumes in the standard order. To arrange pages yourself, use fewer ${itemNoun}s per book.`}
      </Callout>
    ),
  };

  const createQ: Question = {
    key: "create",
    title: files.length ? "Your book is ready" : "Create your book",
    lead: files.length ? "Download it below, or change anything and create it again." : "Everything is set. Press the big button to create your print-ready PDF.",
    hideNext: true,
    body: (
      <>
      {files.length > 0 && !job && (
        <div className="pg-next-tip mb-3 mt-0">
          <BsCheckCircleFill /> <span>{files.length === 1 ? "Done! Your PDF was downloaded." : `Done! Your ${files.length} volumes are ready: download each one below.`} Upload {files.length === 1 ? "it" : "them"} to Amazon KDP as your paperback interior.</span>
        </div>
      )}
      <Panel tone="summary" title="Your book" icon={<BsBook />} testId="book-stats">
              <ul className="list-unstyled small mb-3 d-grid gap-2">
                <li className="pg-stat">
                  <span className="text-muted">Contents</span>
                  <span className="fw-semibold text-end">{plural(canArrange ? desc.resolved.itemOrder.length : itemCount, itemNoun)} + solutions</span>
                </li>
                {canArrange && arranged && (
                  <li className="pg-stat">
                    <span className="text-muted">Page order</span>
                    <span className="fw-semibold" data-testid="order-custom">
                      Your arrangement{" "}
                      <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={() => flow.setSub("preview")}>
                        edit
                      </button>
                    </span>
                  </li>
                )}
                <li className="pg-stat">
                  <span className="text-muted">Trim size</span>
                  <span className="fw-semibold">
                    {t.width}&quot; × {t.height}&quot;{bleed ? " + bleed" : ""}
                  </span>
                </li>
                <li className="pg-stat">
                  <span className="text-muted">Estimated pages</span>
                  <span className="fw-semibold" data-testid="page-estimate">
                    {volumes > 1 ? `${volumes} volumes, up to ${biggest} pages each` : pageTotal.toLocaleString()}
                  </span>
                </li>
                <li className="pg-stat">
                  <span className="text-muted">KDP page limit</span>
                  <span className="fw-semibold">
                    {LIMITS.kdpMinPages}–{LIMITS.kdpMaxPages} pages
                  </span>
                </li>
                {!over && pageTotal > 0 && pageTotal <= LIMITS.kdpMaxPages && (
                  <li className="pg-stat">
                    <span className="text-muted">Inside margin (gutter)</span>
                    <span className="fw-semibold">{insideMargin(pageTotal)}&quot;</span>
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
                  <button type="button" className={`btn btn-lg ${files.length ? "btn-outline-primary" : "btn-primary pg-create-btn"}`} onClick={build} disabled={!!blocked || volumes === 0} data-testid="download-pdf">
                    <BsFilePdf /> {files.length ? "Create it again" : volumes > 1 ? `Create ${volumes} PDF volumes` : "Create & download KDP PDF"}
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
      </Panel>
      </>
    ),
  };

  return <QuestionFlow flow={flow} questions={[sizeQ, titleQ, extrasQ, previewQ, createQ]} />;
}
