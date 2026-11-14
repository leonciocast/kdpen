"use client";
import { tidyHandlers } from "@/components/ui/tidyText";
import { tidyLines, tidySpaces } from "@/lib/text";
import { plural } from "@/lib/plural";
import React, { useMemo, useRef, useState } from "react";
import { BsArrowRepeat, BsDownload, BsGrid1X2, BsLightningCharge, BsListUl, BsMagic, BsPlusLg, BsPuzzle, BsSearch, BsTrash } from "react-icons/bs";
import { toast } from "react-toastify";
import PageHeader from "@/components/ui/PageHeader";
import BookExport from "@/components/ui/BookExport";
import DesignStep from "@/components/ui/DesignStep";
import ItemPager from "@/components/ui/ItemPager";
import JobProgress from "@/components/ui/JobProgress";
import { useDesign } from "@/components/ui/useDesign";
import Callout from "@/components/ui/Callout";
import CsvDrop, { downloadText } from "@/components/ui/CsvDrop";
import EmptyState from "@/components/ui/EmptyState";
import InfoTip from "@/components/ui/InfoTip";
import { StepIntro, Stepper, WizardFooter } from "@/components/ui/Wizard";
import { CROSSWORD_MAX_LETTERS, CROSSWORD_MAX_WORDS, ClueEntry, Crossword, generateCrossword, parseClueLine, validateEntries } from "@/lib/crossword/engine";
import { buildCrosswordBook, CrosswordItem } from "@/lib/crossword/pdf";
import { balancedChunks } from "@/lib/wordsearch/bulk";
import { mulberry32, randomSeed } from "@/lib/wordsearch/engine";
import { JobCancelled, startJob } from "@/lib/jobs/client";
import type { Progress } from "@/lib/jobs/types";
import { LIMITS } from "@/lib/limits";
import { DEFAULT_EXTRAS } from "@/lib/print/book";
import { DEFAULT_FRONT_MATTER } from "@/lib/print/frontMatter";
import type { Design } from "@/lib/design/types";
import type { FontData } from "@/lib/print/fonts";
import CrosswordGrid, { ClueList } from "./CrosswordGrid";

const STEPS = [{ label: "Words & clues" }, { label: "Build & review" }, { label: "Design" }, { label: "Export book" }];

const SAMPLE = [
  "LION - King of the jungle",
  "ORANGE - Citrus fruit and a color",
  "PIANO - Instrument with 88 keys",
  "EAGLE - Bird with sharp eyes",
  "ICE CREAM - Frozen summer treat",
  "RAINBOW - Arc of colors after rain",
  "CANDLE - Wax light",
  "APPLE - Keeps the doctor away",
  "NORTH - Opposite of south",
  "GARDEN - Where flowers grow",
];

interface CwPuzzle {
  id: number;
  title: string;
  theme?: string;
  entries: ClueEntry[];
  cw: Crossword;
}

const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const SHOW = 200;

let sampleCache: CrosswordItem[] | null = null;
function sampleItems(): CrosswordItem[] {
  if (!sampleCache) {
    const entries = SAMPLE.map((l) => parseClueLine(l) as ClueEntry);
    sampleCache = [0, 1].map((i) => ({ cw: generateCrossword(entries, mulberry32(7 + i)), title: i ? "More Everyday Things" : "Everyday Things" }));
  }
  return sampleCache;
}

/** Group entries by theme (keeping order), then split each group into balanced crosswords. */
function groupsFor(entries: ClueEntry[], per: number) {
  const byTheme = new Map<string, ClueEntry[]>();
  for (const e of entries) {
    const k = (e.theme ?? "").trim();
    if (!byTheme.has(k)) byTheme.set(k, []);
    byTheme.get(k)!.push(e);
  }
  const out: { title: string; theme?: string; entries: ClueEntry[] }[] = [];
  for (const [theme, list] of Array.from(byTheme.entries())) {
    const chunks = balancedChunks(list, per);
    chunks.forEach((c, i) => out.push({ title: theme ? (chunks.length > 1 ? `${theme} ${i + 1}` : theme) : "", theme: theme || undefined, entries: c }));
  }
  return out.map((g, i) => ({ ...g, title: g.title || `Crossword ${i + 1}` }));
}

export default function CrossWordGenerator() {
  const [step, setStep] = useState(0);
  const [input, setInput] = useState("");
  const [entries, setEntries] = useState<ClueEntry[]>([]);
  const [perPuzzle, setPerPuzzle] = useState(12);
  const [puzzles, setPuzzles] = useState<CwPuzzle[]>([]);
  const [active, setActive] = useState(0);
  const [showAnswers, setShowAnswers] = useState(false);
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState<{ progress: Progress | null; cancel: () => void } | null>(null);
  const designApi = useDesign("crossword");
  const idRef = useRef(1);

  const add = (cands: { answer: string; clue: string; theme?: string }[], source: string) => {
    const res = validateEntries(cands, entries);
    res.errors.slice(0, 4).forEach((m) => toast.error(m));
    if (res.errors.length > 4) toast.error(`…and ${res.errors.length - 4} more entries couldn't be added.`);
    res.skipped.slice(0, 3).forEach((m) => toast.warning(m));
    if (res.skipped.length > 3) toast.warning(`…and ${res.skipped.length - 3} more were skipped.`);
    if (res.limitReached) toast.error(`You've reached the limit of ${CROSSWORD_MAX_WORDS.toLocaleString()} words.`);
    if (res.added.length) {
      setEntries((prev) => [...prev, ...res.added]);
      toast.success(`Added ${res.added.length.toLocaleString()} clue${res.added.length === 1 ? "" : "s"}${source}.`);
    }
    return res;
  };

  const handleAdd = () => {
    const lines = tidyLines(input, { keepTabs: true }).split("\n").filter(Boolean);
    if (!lines.length) return toast.error("Please type at least one word and clue first.");
    const cands: { answer: string; clue: string }[] = [];
    const bad: string[] = [];
    lines.forEach((l) => {
      const r = parseClueLine(l);
      if ("error" in r) {
        bad.push(l);
        toast.error(r.error);
      } else cands.push(r);
    });
    const res = add(cands, "");
    const rejected = cands.filter((c) => !res.added.some((a) => a.answer === c.answer) && res.errors.some((e) => e.includes(c.answer))).map((c) => `${c.answer} - ${c.clue}`);
    setInput([...bad, ...rejected].join("\n"));
  };

  const handleCsv = (rows: string[][]) => {
    const cands: { answer: string; clue: string; theme?: string }[] = [];
    rows.forEach((row, i) => {
      const cells = row.map((c) => tidySpaces(String(c ?? "")));
      if (!cells[0]) return;
      if (i === 0 && /^(word|answer)s?$/i.test(cells[0])) return;
      const clue = cells[1] ?? "";
      if (!clue) return;
      const theme = cells.slice(2).filter(Boolean).join(" ");
      cands.push(theme ? { answer: cells[0].toUpperCase(), clue, theme } : { answer: cells[0].toUpperCase(), clue });
    });
    if (!cands.length) return toast.error("No words with clues found. The CSV needs columns: word, clue (and an optional theme).");
    add(cands, " from your file");
  };

  const groups = useMemo(() => groupsFor(entries, perPuzzle), [entries, perPuzzle]);
  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    const list = entries.map((e, i) => ({ ...e, i }));
    return q ? list.filter((e) => e.answer.includes(q) || e.clue.toUpperCase().includes(q) || (e.theme ?? "").toUpperCase().includes(q)) : list;
  }, [entries, query]);

  const build = async () => {
    if (entries.length < 2) return toast.error("Add at least 2 words to build a crossword.");
    const job = startJob({ type: "cw-generate", groups }, (p) => setRunning((r) => (r ? { ...r, progress: p } : r)));
    setRunning({ progress: null, cancel: job.cancel });
    try {
      const out = await job.promise;
      const list = out.map((r, i) => ({ id: idRef.current++, title: r.title, theme: r.theme, entries: groups[i].entries, cw: r.cw }));
      setPuzzles(list);
      setActive(0);
      const left = list.flatMap((p) => p.cw.leftOut);
      if (left.length) toast.warning(`These words didn't connect to the others and were left out: ${left.slice(0, 15).join(", ")}${left.length > 15 ? ` and ${left.length - 15} more` : ""}. Try words that share more letters.`, { autoClose: 9000 });
      else toast.success(`${plural(list.length, "crossword")} ${list.length === 1 ? "is" : "are"} ready.`);
    } catch (e) {
      if (e instanceof JobCancelled) toast.info("Stopped. Your previous crosswords were kept.");
      else toast.error(`Sorry, the crosswords couldn't be built: ${(e as Error).message}`);
    } finally {
      setRunning(null);
    }
  };

  const regenerate = () => {
    const p = puzzles[active];
    if (!p) return;
    setPuzzles((prev) => prev.map((x, i) => (i === active ? { ...x, cw: generateCrossword(p.entries, mulberry32(randomSeed())) } : x)));
  };

  const puzzle = puzzles[active];
  const usable = useMemo(() => puzzles.filter((p) => p.cw.placements.length > 1), [puzzles]);
  const maxReachable = entries.length < 2 ? 0 : usable.length ? 3 : 1;
  const themes = useMemo(() => new Set(usable.map((p) => p.theme).filter(Boolean)).size, [usable]);
  const toItem = (p: CwPuzzle): CrosswordItem => ({ cw: p.cw, title: p.title, theme: p.theme });

  const sampleBuilder = (design: Design, fonts: FontData) => {
    const own = usable.slice(0, 2).map(toItem);
    const items = own.length ? (own.length === 1 ? [own[0], own[0]] : own) : sampleItems();
    return buildCrosswordBook(items, { trim: "8.5x11", bleed: false, frontMatter: { ...DEFAULT_FRONT_MATTER, title: "Crossword Puzzle Book", subtitle: "Easy Crosswords for Every Day" }, extras: { ...DEFAULT_EXTRAS, notesPages: 0, padWithNotes: false }, design, answersPerPage: 2, padForKdp: false }, fonts);
  };

  return (
    <div className="container pb-4">
      <PageHeader icon={<BsPuzzle />} title="Crossword" lead="Turn your words and clues into numbered crosswords, from one puzzle to hundreds, then export a print-ready book." />
      <Stepper steps={STEPS} current={step} maxReachable={maxReachable} onSelect={setStep} />
      <div className="pg-card">
        <div className="pg-card-body">
          {step === 0 && (
            <div>
              <StepIntro icon={<BsListUl />} title="Add words and clues">
                Write one per line as <b>WORD - clue</b>, or upload a CSV with thousands of clues. Phrases are fine: they go in the grid without spaces.
              </StepIntro>
              <div className="row g-4">
                <div className="col-lg-6">
                  <label htmlFor="clueInput" className="form-label">
                    Words and clues
                    <InfoTip text={`Separate the word and clue with " - ", ":" or a tab. Up to ${CROSSWORD_MAX_LETTERS} letters per word and ${CROSSWORD_MAX_WORDS.toLocaleString()} words in total.`} />
                  </label>
                  <textarea id="clueInput" className="form-control" rows={7} placeholder={"LION - King of the jungle\nICE CREAM - Frozen summer treat\nPIANO - Instrument with 88 keys"} value={input} onChange={(e) => setInput(e.target.value)} {...tidyHandlers(setInput, { keepTabs: true })} />
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    <button type="button" className="btn btn-primary" onClick={handleAdd}>
                      <BsPlusLg /> Add to list
                    </button>
                    {!entries.length && (
                      <button type="button" className="btn btn-light" onClick={() => add(SAMPLE.map((l) => parseClueLine(l) as { answer: string; clue: string }), "")}>
                        <BsMagic /> Try a sample list
                      </button>
                    )}
                  </div>
                  <div className="mt-3">
                    <CsvDrop onRows={handleCsv} label="Upload a CSV file" hint="Columns: word, clue, and an optional theme/title that groups clues into titled crosswords. A header row is optional." />
                  </div>
                </div>
                <div className="col-lg-6">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="form-label m-0">
                      Your list <span className="pg-badge neutral ms-1" data-testid="clue-count">{entries.length.toLocaleString()} / {CROSSWORD_MAX_WORDS.toLocaleString()}</span>
                    </span>
                    <div className="d-flex gap-1">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          downloadText(
                            entries.length ? "crossword-clues.csv" : "crossword-template.csv",
                            ["Word,Clue,Theme", ...(entries.length ? entries : SAMPLE.slice(0, 3).map((l) => ({ ...(parseClueLine(l) as ClueEntry), theme: "Everyday" }))).map((e) => `${esc(e.answer)},${esc(e.clue)},${esc(e.theme ?? "")}`)].join("\n") + "\n"
                          )
                        }
                      >
                        <BsDownload /> {entries.length ? "Download CSV" : "CSV template"}
                      </button>
                      {entries.length > 0 && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm text-danger"
                          onClick={() => {
                            if (window.confirm("Remove all words and clues?")) {
                              setEntries([]);
                              setPuzzles([]);
                            }
                          }}
                        >
                          <BsTrash /> Clear
                        </button>
                      )}
                    </div>
                  </div>
                  {entries.length === 0 ? (
                    <EmptyState icon={<BsListUl />} title="No clues yet">
                      Words and clues you add will appear here. You can edit clues right in the list.
                    </EmptyState>
                  ) : (
                    <>
                      {entries.length > 12 && (
                        <div className="input-group input-group-sm mb-2">
                          <span className="input-group-text">
                            <BsSearch />
                          </span>
                          <input className="form-control" placeholder="Search words, clues or themes" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search your clues" />
                        </div>
                      )}
                      <div className="pg-list">
                        {filtered.slice(0, SHOW).map((e) => (
                          <div className="pg-list-row" key={e.answer}>
                            <span className="pg-num">{e.i + 1}</span>
                            <span className="fw-semibold text-nowrap" style={{ minWidth: "6rem" }}>
                              {e.answer}
                            </span>
                            <input className="form-control form-control-sm" aria-label={`Clue for ${e.answer}`} value={e.clue} onChange={(ev) => setEntries((prev) => prev.map((x) => (x.answer === e.answer ? { ...x, clue: ev.target.value } : x)))} />
                            {e.theme && <span className="pg-badge neutral text-truncate" style={{ maxWidth: 110 }}>{e.theme}</span>}
                            <button type="button" className="btn btn-ghost btn-icon" aria-label={`Remove ${e.answer}`} onClick={() => setEntries((prev) => prev.filter((x) => x.answer !== e.answer))}>
                              <BsTrash />
                            </button>
                          </div>
                        ))}
                      </div>
                      {filtered.length > SHOW && <div className="form-text">Showing {SHOW} of {filtered.length.toLocaleString()}. Use search to find a clue.</div>}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <StepIntro icon={<BsGrid1X2 />} title="Build and review">
                Your list is split into crosswords (by theme, if your file has one). Words that can&apos;t connect to the others are left out and listed below.
              </StepIntro>
              <div className="pg-subtle p-3 mb-3 d-flex flex-wrap align-items-end gap-3">
                <div>
                  <label className="form-label" htmlFor="perPuzzle">
                    Words per crossword <InfoTip text={`8–15 words make a nicely connected crossword. Maximum ${LIMITS.maxCluesPerCrossword}.`} />
                  </label>
                  <input id="perPuzzle" type="number" min={2} max={LIMITS.maxCluesPerCrossword} className="form-control" style={{ width: 120 }} value={perPuzzle} onChange={(e) => setPerPuzzle(Math.max(2, Math.min(LIMITS.maxCluesPerCrossword, Number(e.target.value) || 2)))} />
                </div>
                <span className="pg-badge info mb-2">
                  {plural(entries.length, "word")} → {plural(groups.length, "crossword")}
                </span>
                <button type="button" className="btn btn-primary ms-auto" onClick={build} disabled={!!running} data-testid="build-crosswords">
                  <BsLightningCharge /> {puzzles.length ? "Rebuild all" : "Build crosswords"}
                </button>
              </div>
              {running ? (
                <JobProgress title="Building crosswords" progress={running.progress} onCancel={running.cancel} />
              ) : !puzzle ? (
                <EmptyState
                  icon={<BsPuzzle />}
                  title="Ready when you are"
                  action={
                    <button type="button" className="btn btn-primary" onClick={build}>
                      <BsLightningCharge /> Build crosswords
                    </button>
                  }
                >
                  Click Build to create your crosswords.
                </EmptyState>
              ) : (
                <>
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                    <ItemPager titles={puzzles.map((p) => p.title)} active={active} onSelect={setActive} label="Crosswords" />
                    <div className="ms-auto d-flex gap-2 align-items-center">
                      <div className="form-check form-switch m-0">
                        <input className="form-check-input" type="checkbox" role="switch" id="cwAnswers" checked={showAnswers} onChange={(e) => setShowAnswers(e.target.checked)} />
                        <label className="form-check-label fw-semibold" htmlFor="cwAnswers">
                          Show answers
                        </label>
                      </div>
                      <button type="button" className="btn btn-light btn-sm" onClick={regenerate}>
                        <BsArrowRepeat /> New layout
                      </button>
                    </div>
                  </div>
                  <div className="row g-4">
                    <div className="col-lg-7">
                      <div className="pg-grid-wrap p-2">
                        <CrosswordGrid id="cw-grid" cw={puzzle.cw} showAnswers={showAnswers} />
                      </div>
                    </div>
                    <div className="col-lg-5">
                      <label className="form-label" htmlFor="cwTitle">
                        Title
                      </label>
                      <input id="cwTitle" className="form-control mb-3" value={puzzle.title} onChange={(e) => setPuzzles((prev) => prev.map((x, i) => (i === active ? { ...x, title: e.target.value } : x)))} />
                      <ClueList cw={puzzle.cw} />
                      {puzzle.cw.leftOut.length > 0 && (
                        <Callout tone="warn" className="mt-3">
                          Left out (no shared letters): <b>{puzzle.cw.leftOut.join(", ")}</b>
                        </Callout>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 2 && <DesignStep tool="crossword" api={designApi} buildSample={sampleBuilder} listName="clue list" />}

          {step === 3 && (
            <BookExport
              tool="crossword"
              toolDefaults={{ title: "Crossword Puzzle Book", subtitle: "Easy Crosswords for Every Day" }}
              itemNoun="crossword"
              itemCount={usable.length}
              sectionCount={themes}
              design={designApi.design}
              items={() => ({ tool: "crossword", items: usable.map(toItem) })}
              fileBase="crossword-book"
              disabledReason={usable.length ? undefined : "Build at least one crossword first."}
              defaultAnswersPerPage={2}
            />
          )}
        </div>
        <WizardFooter
          onBack={step > 0 ? () => setStep(step - 1) : undefined}
          onNext={step < STEPS.length - 1 ? () => setStep(step + 1) : undefined}
          nextDisabled={step === 0 ? entries.length < 2 : !usable.length || !!running}
          nextLabel={step === 1 ? "Choose a design" : step === 2 ? "Continue to export" : undefined}
          hint={step === 0 ? (entries.length < 2 ? "Add at least 2 words with clues" : `${entries.length.toLocaleString()} words ready`) : step === 1 ? (puzzles.length ? `${plural(usable.length, "crossword")} ready` : "Build your crosswords to continue") : step === 2 ? `Template: ${designApi.design.name}` : ""}
        />
      </div>
    </div>
  );
}
