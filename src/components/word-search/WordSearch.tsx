"use client";
import { plural } from "@/lib/plural";
import React, { useMemo, useRef, useState } from "react";
import { BsSearch } from "react-icons/bs";
import { toast } from "react-toastify";
import PageHeader from "@/components/ui/PageHeader";
import BookExport from "@/components/ui/BookExport";
import DesignStep from "@/components/ui/DesignStep";
import { useDesign } from "@/components/ui/useDesign";
import { Stepper } from "@/components/ui/Wizard";
import { useStages } from "@/components/ui/useStages";
import { Placement, allowedDirections, autoPlace, checkPlacement, containedWordWarnings, fillGrid, gridForm, mulberry32, randomSeed } from "@/lib/wordsearch/engine";
import { ShapeKey, shapeInfo, shapeStartSize, shapeTargetsFor, shapedGrid } from "@/lib/shapes/shapes";
import { LIMITS } from "@/lib/limits";
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

const sampleCache = new Map<string, BookPuzzle>();
function samplePuzzle(i: number, shape: ShapeKey): BookPuzzle {
  const key = `${i}:${shape}`;
  let hit = sampleCache.get(key);
  if (!hit) {
    const p = presetFor("medium");
    const g = generateOneWordSearch({ title: i ? "Beach Day" : "Summer Fun", theme: "", words: SAMPLE_WORDS, size: 14, shape }, { dirs: p.dirs, overlapWeight: p.overlapWeight, decoys: "none" }, 11 + i);
    hit = { title: g.title, size: g.size, grid: g.grid, words: SAMPLE_WORDS, placements: g.placements, shape: g.shape };
    sampleCache.set(key, hit);
  }
  return hit;
}

/** Shape of every puzzle for a design (one shape, mixed, or random animals). */
export function shapeTargets(d: Design, list: { theme?: string }[]): ShapeKey[] {
  return shapeTargetsFor(d.shape, list);
}

const shapeOf = (p: { shape?: ShapeKey }): ShapeKey => p.shape ?? "square";

/** Quick in-thread re-fit of one puzzle into another shape (design preview only). */
const previewCache = new Map<string, BookPuzzle>();
function previewFit(p: PuzzleModel, shape: ShapeKey): BookPuzzle {
  if (shapeOf(p) === shape) return toBook(p);
  const key = `${p.id}:${shape}:${p.words.join("|")}`;
  let hit = previewCache.get(key);
  if (!hit) {
    const pr = presetFor("medium");
    const g = generateOneWordSearch({ title: p.title, theme: p.theme ?? "", words: p.words, size: p.baseSize ?? p.size, baseSize: p.baseSize ?? p.size, shape }, { dirs: pr.dirs, overlapWeight: pr.overlapWeight, decoys: "none" }, 7);
    hit = { title: p.title, theme: p.theme, size: g.size, grid: g.grid, words: g.words, placements: g.placements, shape: g.shape };
    previewCache.set(key, hit);
  }
  return hit;
}

/** Move placements so the old layout sits in the middle of a resized canvas. */
function recentre(ps: Placement[], from: number, to: number): Placement[] {
  const o = Math.floor((to - from) / 2);
  return o ? ps.map((p) => ({ ...p, row: p.row + o, col: p.col + o })) : ps;
}

const toBook = (p: PuzzleModel): BookPuzzle => ({ title: p.title, theme: p.theme, size: p.size, grid: p.grid!, words: listedWords(p), placements: p.placements, shape: p.shape });

export default function WordSearch() {
  const [entries, setEntries] = useState<WordEntry[]>([]);
  const [settings, setSettings] = useState<WsSettings>({ difficulty: "medium", dirOpts: dirOptsFor("medium"), wordsPerPuzzle: 20, sizeMode: "auto", gridSize: 15, groupByTheme: true });
  const [puzzles, setPuzzles] = useState<PuzzleModel[]>([]);
  const [signature, setSignature] = useState("");
  const [active, setActive] = useState(0);
  const [solution, setSolution] = useState<SolutionStyle>("hidden");
  const [running, setRunning] = useState<{ progress: Progress | null; cancel: () => void } | null>(null);
  const rawDesignApi = useDesign("word-search");
  const idRef = useRef(1);
  const [refit, setRefit] = useState<{ progress: Progress | null; cancel: () => void } | null>(null);

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

  const create = async (mode: "auto" | "manual"): Promise<boolean> => {
    if (!entries.length) {
      toast.error("Add some words in step 1 first.");
      return false;
    }
    if (mode === "auto" && !dirs.length) {
      toast.error("Choose at least one direction in step 2.");
      return false;
    }
    setSolution("hidden");
    setActive(0);
    if (mode === "manual") {
      const targets = shapeTargets(rawDesignApi.design, specs);
      setPuzzles(
        specs.map((s, i) => {
          const shape = targets[i];
          const longest = Math.max(1, ...s.words.map((w) => gridForm(w).length));
          const size = shapeStartSize(shape, s.size, longest, LIMITS.maxShapeGridSize);
          return { id: idRef.current++, title: s.title, theme: s.theme || undefined, size, baseSize: s.size, ...(shape !== "square" ? { shape } : {}), words: s.words, placements: [], grid: null, unplaced: [], warnings: containedWordWarnings(s.words) };
        })
      );
      setSignature(currentSig);
      return true;
    }
    const targets = shapeTargets(rawDesignApi.design, specs);
    const job = startJob({ type: "ws-generate", specs: specs.map((s, i) => ({ ...s, shape: targets[i] })), settings: genSettings }, (p) => setRunning((r) => (r ? { ...r, progress: p } : r)));
    setRunning({ progress: null, cancel: job.cancel });
    const t0 = performance.now();
    try {
      const out = await job.promise;
      const list: PuzzleModel[] = out.map((g) => ({ id: idRef.current++, title: g.title, theme: g.theme || undefined, size: g.size, baseSize: g.baseSize, shape: g.shape, words: g.words, placements: g.placements, grid: g.grid, unplaced: g.unplaced, warnings: g.warnings }));
      setPuzzles(list);
      setSignature(currentSig);
      const misfits = list.flatMap((p, i) => p.unplaced.map((w) => `${w} (puzzle ${i + 1})`));
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      if (misfits.length) toast.warning(`Some words didn't fit and were left out: ${misfits.slice(0, 12).join(", ")}${misfits.length > 12 ? ` and ${misfits.length - 12} more` : ""}`, { autoClose: 9000 });
      else toast.success(`${plural(list.length, "puzzle")} ${list.length === 1 ? "is" : "are"} ready (${secs}s).`);
      return true;
    } catch (e) {
      if (e instanceof JobCancelled) toast.info("Stopped. Your previous puzzles were kept.");
      else toast.error(`Sorry, the puzzles couldn't be built: ${(e as Error).message}`);
      return false;
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
        const ga = shapedGrid(p.size, p.shape);
        const res = autoPlace(ga, p.placements, rest, dirs, mulberry32(randomSeed()), { overlapWeight: preset.overlapWeight });
        const placements = [...p.placements, ...res.placements];
        misses += res.unplaced.length;
        if (!placements.length) return { ...p, unplaced: res.unplaced };
        const f = fillGrid(ga, placements, mulberry32(randomSeed()), 300, preset.decoys);
        return { ...p, placements, grid: f.grid, unplaced: res.unplaced, warnings: [...containedWordWarnings(placements.map((x) => x.word)), ...f.warnings] };
      })
    );
    toast[misses ? "warning" : "success"](misses ? `Done. ${plural(misses, "word")} didn't fit and ${misses === 1 ? "was" : "were"} left out.` : "All puzzles are finished.");
  };

  const reshuffle = () => {
    const p = puzzles[active];
    if (!p?.grid) return;
    const f = fillGrid(shapedGrid(p.size, p.shape), p.placements, mulberry32(randomSeed()), 300, preset.decoys);
    updateActive((x) => ({ ...x, grid: f.grid }));
  };

  const regenerate = () => {
    const p = puzzles[active];
    if (!p) return;
    if (!dirs.length) return toast.error("Choose at least one direction in step 2.");
    const g = generateOneWordSearch({ title: p.title, theme: p.theme ?? "", words: p.words, size: p.baseSize ?? p.size, baseSize: p.baseSize ?? p.size, shape: p.shape }, genSettings);
    updateActive((x) => ({ ...x, size: g.size, placements: g.placements, grid: g.grid, unplaced: g.unplaced, warnings: g.warnings }));
    toast.success("New layout created.");
  };

  /**
   * The shape lives in the design, but puzzles are made earlier: when the
   * design's shape changes, re-fit every puzzle into its new shape (in the
   * background worker). Hand-placed words that still fit inside are kept.
   */
  const reshape = async (d: Design) => {
    const targets = shapeTargets(d, puzzles);
    const todo = puzzles.map((p, i) => ({ p, shape: targets[i] })).filter(({ p, shape }) => shapeOf(p) !== shape);
    if (!todo.length) return;
    refit?.cancel();
    // Unfinished (hand-placing) puzzles: new canvas, keep the words that fit inside the shape.
    const manualMap = new Map<number, PuzzleModel>();
    let movedBack = 0;
    for (const { p, shape } of todo.filter((t) => !t.p.grid)) {
      const base = p.baseSize ?? p.size;
      const longest = Math.max(1, ...p.words.map((w) => gridForm(w).length));
      const size = shapeStartSize(shape, base, longest, LIMITS.maxShapeGridSize);
      const ga = shapedGrid(size, shape);
      const kept: Placement[] = [];
      for (const pl of recentre(p.placements, p.size, size)) if (checkPlacement(ga, kept, pl).ok) kept.push(pl);
      movedBack += p.placements.length - kept.length;
      manualMap.set(p.id, { ...p, size, baseSize: base, shape: shape === "square" ? undefined : shape, placements: kept, grid: null });
    }
    if (manualMap.size) setPuzzles((prev) => prev.map((p) => manualMap.get(p.id) ?? p));
    if (movedBack) toast.info(`${plural(movedBack, "hand-placed word")} didn't fit inside the new shape and went back to the list.`);
    const auto = todo.filter((t) => t.p.grid);
    if (!auto.length) return;
    const jobDirs = dirs.length ? dirs : preset.dirs;
    const specs = auto.map(({ p, shape }) => {
      const base = p.baseSize ?? p.size;
      const longest = Math.max(1, ...p.words.map((w) => gridForm(w).length));
      const next = shapeStartSize(shape, base, longest, LIMITS.maxShapeGridSize);
      return { title: p.title, theme: p.theme ?? "", words: p.words, size: base, baseSize: base, shape, ...(p.manual ? { fixed: recentre(p.placements, p.size, next) } : {}) };
    });
    const ids = auto.map((t) => t.p.id);
    const job = startJob({ type: "ws-generate", specs, settings: { ...genSettings, dirs: jobDirs } }, (pr) => setRefit((r) => (r ? { ...r, progress: pr } : r)));
    setRefit({ progress: null, cancel: job.cancel });
    try {
      const out = await job.promise;
      const byId = new Map(ids.map((id, k) => [id, out[k]]));
      setPuzzles((prev) =>
        prev.map((p) => {
          const g = byId.get(p.id);
          return g ? { ...p, size: g.size, baseSize: g.baseSize, shape: g.shape, placements: g.placements, grid: g.grid, unplaced: g.unplaced, warnings: g.warnings } : p;
        })
      );
      const misfits = out.reduce((a, g) => a + g.unplaced.length, 0);
      if (misfits) toast.warning(`${plural(misfits, "word")} couldn't fit inside the shape and ${misfits === 1 ? "is" : "are"} listed as left out. Try a roomier shape or fewer words per puzzle.`, { autoClose: 9000 });
    } catch (e) {
      if (!(e instanceof JobCancelled)) toast.error(`Sorry, the puzzles couldn't be re-shaped: ${(e as Error).message}`);
    } finally {
      setRefit((r) => (r && r.cancel === job.cancel ? null : r));
    }
  };

  const designApi = {
    ...rawDesignApi,
    setDesign: (d: Design) => {
      rawDesignApi.setDesign(d);
      if (d.shape.kind !== rawDesignApi.design.shape.kind || d.shape.mix !== rawDesignApi.design.shape.mix) void reshape(d);
    },
  };

  const shapeStatus = refit ? (
    <span data-testid="reshape-progress">
      Fitting your puzzles into the new shape{refit.progress ? `: ${refit.progress.done} of ${refit.progress.total}` : "…"}
    </span>
  ) : finished.length ? (
    <span data-testid="reshape-done">
      {finished.length === 1 ? "Your puzzle uses" : `All ${finished.length} puzzles use`} {rawDesignApi.design.shape.mix === "one" ? `the ${shapeInfo(rawDesignApi.design.shape.kind).label.toLowerCase()} shape` : rawDesignApi.design.shape.mix === "animals" ? "a different animal each time" : "mixed shapes"}. Every word sits inside it.
    </span>
  ) : null;

  const sampleBuilder = (design: Design, fonts: FontData) => {
    const targets = shapeTargets(design, finished.length ? finished : [{}, {}]);
    const own = finished.slice(0, 2).map((p, i) => previewFit(p, targets[i]));
    const items = own.length ? (own.length === 1 ? [own[0], own[0]] : own) : [samplePuzzle(0, targets[0]), samplePuzzle(1, targets[1])];
    return buildWordSearchBook(items, { trim: "8.5x11", bleed: false, answersPerPage: 2, frontMatter: { ...DEFAULT_FRONT_MATTER, title: "Word Search Puzzle Book", subtitle: "Large Print Puzzles for Relaxing Fun" }, extras: { ...DEFAULT_EXTRAS, notesPages: 0, padWithNotes: false }, design, padForKdp: false }, fonts);
  };

  const maxReachable = entries.length === 0 ? 0 : finished.length === 0 ? 2 : 5;
  const exportThemes = useMemo(() => new Set(finished.map((p) => p.theme).filter(Boolean)).size, [finished]);

  const { step, goTo, flow } = useStages(STEPS.length);

  return (
    <div className="container pb-4">
      <PageHeader icon={<BsSearch />} title="Word Search" lead="Build word search puzzles step by step, from a dozen words to 20,000, and export a print-ready book with answer keys." />
      <Stepper steps={STEPS} current={step} maxReachable={maxReachable} onSelect={goTo} />
      <div className="pg-card pg-wizard-card">
        <>
          {step === 0 && <StepWords entries={entries} setEntries={setEntries} flow={flow(0)} />}
          {step === 1 && <StepSettings settings={settings} setSettings={setSettings} specs={specs} wordCount={entries.length} themeCount={themeCount} flow={flow(1)} />}
          {step === 2 && <StepPlace puzzles={puzzles} active={active} setActive={setActive} updateActive={updateActive} autoDirs={dirs} stale={stale} create={create} finishAll={finishAll} running={running} flow={flow(2)} />}
          {step === 3 && (
            <StepReview puzzles={puzzles} active={active} setActive={setActive} updateActive={updateActive} solution={solution} setSolution={setSolution} reshuffle={reshuffle} regenerate={regenerate} edit={() => goTo(2, "puzzles")} flow={flow(3)} />
          )}
          {step === 4 && <DesignStep tool="word-search" api={designApi} buildSample={sampleBuilder} listName="word list" shapeStatus={shapeStatus} busy={!!refit} flow={flow(4)} themes={[...new Set(finished.map((p) => p.theme).filter((t): t is string => !!t))]} previewKey={`${rawDesignApi.design.shape.kind}:${rawDesignApi.design.shape.mix}:${finished.map((p) => `${p.shape ?? "square"}:${p.size}`).join("|")}`} />}
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
              disabledReason={refit ? "Fitting puzzles into the new shape. One moment…" : finished.length ? undefined : "Finish at least one puzzle first."}
              flow={flow(5)}
            />
          )}
        </>
      </div>
    </div>
  );
}
