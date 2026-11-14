"use client";
import { plural } from "@/lib/plural";
import React, { useMemo, useRef, useState } from "react";
import { BsSearch } from "react-icons/bs";
import { toast } from "react-toastify";
import PageHeader from "@/components/ui/PageHeader";
import BookExport from "@/components/ui/BookExport";
import DesignStep from "@/components/ui/DesignStep";
import { useDesign } from "@/components/ui/useDesign";
import { Stepper, WizardFooter } from "@/components/ui/Wizard";
import { allowedDirections, autoPlace, containedWordWarnings, fillGrid, mulberry32, randomSeed } from "@/lib/wordsearch/engine";
import { buildWordSearchBook, BookPuzzle } from "@/lib/wordsearch/pdf";
import { presetFor } from "@/lib/wordsearch/difficulty";
import { splitIntoPuzzles } from "@/lib/wordsearch/bulk";
import { generateOneWordSearch } from "@/lib/jobs/run";
import { JobCancelled, startJob } from "@/lib/jobs/client";
import type { Progress } from "@/lib/jobs/types";
import { DEFAULT_EXTRAS } from "@/lib/print/book";
import { DEFAULT_FRONT_MATTER } from "@/lib/print/frontMatter";
import type { Design } from "@/lib/design/types";
import type { FontData } from "@/lib/print/fonts";
import { SolutionStyle } from "./PuzzleGrid";
import StepWords from "./StepWords";
import StepSettings, { WsSettings, dirOptsFor } from "./StepSettings";
import StepPlace from "./StepPlace";
import StepReview from "./StepReview";
import { PuzzleModel, SAMPLE_WORDS, WordEntry, listedWords } from "./model";

const STEPS = [{ label: "Add words" }, { label: "Puzzle settings" }, { label: "Place words" }, { label: "Review & solution" }, { label: "Design" }, { label: "Export book" }];

let sampleCache: BookPuzzle[] | null = null;
function samplePuzzles(): BookPuzzle[] {
  if (!sampleCache) {
    const p = presetFor("medium");
    sampleCache = [0, 1].map((i) => {
      const g = generateOneWordSearch({ title: i ? "Beach Day" : "Summer Fun", theme: "", words: SAMPLE_WORDS, size: 14 }, { dirs: p.dirs, overlapWeight: p.overlapWeight, decoys: "none" }, 11 + i);
      return { title: g.title, size: g.size, grid: g.grid, words: SAMPLE_WORDS, placements: g.placements };
    });
  }
  return sampleCache;
}

const toBook = (p: PuzzleModel): BookPuzzle => ({ title: p.title, theme: p.theme, size: p.size, grid: p.grid!, words: listedWords(p), placements: p.placements });

export default function WordSearch() {
  const [step, setStep] = useState(0);
  const [entries, setEntries] = useState<WordEntry[]>([]);
  const [settings, setSettings] = useState<WsSettings>({ difficulty: "medium", dirOpts: dirOptsFor("medium"), wordsPerPuzzle: 20, sizeMode: "auto", gridSize: 15, groupByTheme: true });
  const [puzzles, setPuzzles] = useState<PuzzleModel[]>([]);
  const [signature, setSignature] = useState("");
  const [active, setActive] = useState(0);
  const [solution, setSolution] = useState<SolutionStyle>("hidden");
  const [running, setRunning] = useState<{ progress: Progress | null; cancel: () => void } | null>(null);
  const designApi = useDesign("word-search");
  const idRef = useRef(1);

  const preset = presetFor(settings.difficulty);
  const dirs = useMemo(() => allowedDirections(settings.dirOpts), [settings.dirOpts]);
  const themeCount = useMemo(() => new Set(entries.map((e) => e.theme).filter(Boolean)).size, [entries]);
  const specs = useMemo(
    () => splitIntoPuzzles(entries, { wordsPerPuzzle: settings.wordsPerPuzzle, size: settings.sizeMode === "auto" ? "auto" : settings.gridSize, density: preset.density, groupByTheme: settings.groupByTheme }),
    [entries, settings.wordsPerPuzzle, settings.sizeMode, settings.gridSize, settings.groupByTheme, preset.density]
  );
  const currentSig = useMemo(() => `${JSON.stringify(settings)}|${entries.length}|${entries.map((e) => e.word + (e.theme ?? "")).join("\u0001")}`, [settings, entries]);
  const stale = puzzles.length > 0 && signature !== currentSig;
  const finished = useMemo(() => puzzles.filter((p) => p.grid), [puzzles]);
  const genSettings = { dirs, overlapWeight: preset.overlapWeight, decoys: preset.decoys };

  const updateActive = (fn: (p: PuzzleModel) => PuzzleModel) => setPuzzles((prev) => prev.map((p, i) => (i === active ? fn(p) : p)));

  const create = async (mode: "auto" | "manual") => {
    if (!entries.length) return toast.error("Add some words in step 1 first.");
    if (mode === "auto" && !dirs.length) return toast.error("Choose at least one direction in step 2.");
    setSolution("hidden");
    setActive(0);
    if (mode === "manual") {
      setPuzzles(specs.map((s) => ({ id: idRef.current++, title: s.title, theme: s.theme || undefined, size: s.size, words: s.words, placements: [], grid: null, unplaced: [], warnings: containedWordWarnings(s.words) })));
      setSignature(currentSig);
      return;
    }
    const job = startJob({ type: "ws-generate", specs, settings: genSettings }, (p) => setRunning((r) => (r ? { ...r, progress: p } : r)));
    setRunning({ progress: null, cancel: job.cancel });
    const t0 = performance.now();
    try {
      const out = await job.promise;
      const list: PuzzleModel[] = out.map((g) => ({ id: idRef.current++, title: g.title, theme: g.theme || undefined, size: g.size, words: g.words, placements: g.placements, grid: g.grid, unplaced: g.unplaced, warnings: g.warnings }));
      setPuzzles(list);
      setSignature(currentSig);
      const misfits = list.flatMap((p, i) => p.unplaced.map((w) => `${w} (puzzle ${i + 1})`));
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      if (misfits.length) toast.warning(`Some words didn't fit and were left out: ${misfits.slice(0, 12).join(", ")}${misfits.length > 12 ? ` and ${misfits.length - 12} more` : ""}`, { autoClose: 9000 });
      else toast.success(`${plural(list.length, "puzzle")} ${list.length === 1 ? "is" : "are"} ready (${secs}s).`);
    } catch (e) {
      if (e instanceof JobCancelled) toast.info("Stopped. Your previous puzzles were kept.");
      else toast.error(`Sorry, the puzzles couldn't be built: ${(e as Error).message}`);
    } finally {
      setRunning(null);
    }
  };

  const finishAll = () => {
    if (!dirs.length) return toast.error("Choose at least one direction in step 2.");
    let misses = 0;
    setPuzzles((prev) =>
      prev.map((p) => {
        if (p.grid) return p;
        const rest = p.words.filter((w) => !p.placements.some((x) => x.word === w));
        const res = autoPlace(p.size, p.placements, rest, dirs, mulberry32(randomSeed()), { overlapWeight: preset.overlapWeight });
        const placements = [...p.placements, ...res.placements];
        misses += res.unplaced.length;
        if (!placements.length) return { ...p, unplaced: res.unplaced };
        const f = fillGrid(p.size, placements, mulberry32(randomSeed()), 300, preset.decoys);
        return { ...p, placements, grid: f.grid, unplaced: res.unplaced, warnings: [...containedWordWarnings(placements.map((x) => x.word)), ...f.warnings] };
      })
    );
    toast[misses ? "warning" : "success"](misses ? `Done. ${plural(misses, "word")} didn't fit and ${misses === 1 ? "was" : "were"} left out.` : "All puzzles are finished.");
  };

  const reshuffle = () => {
    const p = puzzles[active];
    if (!p?.grid) return;
    const f = fillGrid(p.size, p.placements, mulberry32(randomSeed()), 300, preset.decoys);
    updateActive((x) => ({ ...x, grid: f.grid }));
  };

  const regenerate = () => {
    const p = puzzles[active];
    if (!p) return;
    if (!dirs.length) return toast.error("Choose at least one direction in step 2.");
    const g = generateOneWordSearch({ title: p.title, theme: p.theme ?? "", words: p.words, size: p.size }, genSettings);
    updateActive((x) => ({ ...x, size: g.size, placements: g.placements, grid: g.grid, unplaced: g.unplaced, warnings: g.warnings }));
    toast.success("New layout created.");
  };

  const sampleBuilder = (design: Design, fonts: FontData) => {
    const own = finished.slice(0, 2).map(toBook);
    const items = own.length ? (own.length === 1 ? [own[0], own[0]] : own) : samplePuzzles();
    return buildWordSearchBook(items, { trim: "8.5x11", bleed: false, answersPerPage: 2, frontMatter: { ...DEFAULT_FRONT_MATTER, title: "Word Search Puzzle Book", subtitle: "Large Print Puzzles for Relaxing Fun" }, extras: { ...DEFAULT_EXTRAS, notesPages: 0, padWithNotes: false }, design, padForKdp: false }, fonts);
  };

  const maxReachable = entries.length === 0 ? 0 : finished.length === 0 ? 2 : 5;
  const exportThemes = useMemo(() => new Set(finished.map((p) => p.theme).filter(Boolean)).size, [finished]);

  const nextInfo: { disabled: boolean; hint: React.ReactNode; label?: string } = (() => {
    switch (step) {
      case 0:
        return { disabled: !entries.length, hint: entries.length ? `${entries.length.toLocaleString()} entr${entries.length === 1 ? "y" : "ies"} in your list` : "Add at least one word to continue" };
      case 1:
        return { disabled: !entries.length, hint: `${plural(specs.length, "puzzle")}, ${preset.label.toLowerCase()} difficulty` };
      case 2:
        return { disabled: !finished.length || !!running, hint: puzzles.length ? `${finished.length.toLocaleString()} of ${puzzles.length.toLocaleString()} puzzles finished` : "Choose automatic or manual placement" };
      case 3:
        return { disabled: !finished.length, hint: `${plural(finished.length, "puzzle")} will go in your book`, label: "Choose a design" };
      case 4:
        return { disabled: !finished.length, hint: `Template: ${designApi.design.name}`, label: "Continue to export" };
      default:
        return { disabled: true, hint: "" };
    }
  })();

  return (
    <div className="container pb-4">
      <PageHeader icon={<BsSearch />} title="Word Search" lead="Build word search puzzles step by step, from a dozen words to 20,000, and export a print-ready book with answer keys." />
      <Stepper steps={STEPS} current={step} maxReachable={maxReachable} onSelect={setStep} />
      <div className="pg-card">
        <div className="pg-card-body">
          {step === 0 && <StepWords entries={entries} setEntries={setEntries} />}
          {step === 1 && <StepSettings settings={settings} setSettings={setSettings} specs={specs} wordCount={entries.length} themeCount={themeCount} />}
          {step === 2 && <StepPlace puzzles={puzzles} active={active} setActive={setActive} updateActive={updateActive} autoDirs={dirs} stale={stale} create={create} finishAll={finishAll} running={running} />}
          {step === 3 && (
            <StepReview puzzles={puzzles} active={active} setActive={setActive} updateActive={updateActive} solution={solution} setSolution={setSolution} reshuffle={reshuffle} regenerate={regenerate} edit={() => setStep(2)} />
          )}
          {step === 4 && <DesignStep tool="word-search" api={designApi} buildSample={sampleBuilder} listName="word list" />}
          {step === 5 && (
            <BookExport
              tool="word-search"
              toolDefaults={{ title: "Word Search Puzzle Book", subtitle: "Large Print Puzzles for Relaxing Fun" }}
              itemNoun="puzzle"
              itemCount={finished.length}
              sectionCount={exportThemes}
              design={designApi.design}
              items={() => ({ tool: "word-search", items: finished.map(toBook) })}
              fileBase="word-search-book"
              disabledReason={finished.length ? undefined : "Finish at least one puzzle first."}
            />
          )}
        </div>
        <WizardFooter onBack={step > 0 ? () => setStep(step - 1) : undefined} onNext={step < STEPS.length - 1 ? () => setStep(step + 1) : undefined} nextDisabled={nextInfo.disabled} nextLabel={nextInfo.label} hint={nextInfo.hint} />
      </div>
    </div>
  );
}
