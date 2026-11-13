"use client";
import { plural } from "@/lib/plural";
import React, { useMemo, useState } from "react";
import { BsSearch } from "react-icons/bs";
import { toast } from "react-toastify";
import PageHeader from "@/components/ui/PageHeader";
import BookExport from "@/components/ui/BookExport";
import InfoTip from "@/components/ui/InfoTip";
import { Stepper, WizardFooter } from "@/components/ui/Wizard";
import { DirectionOptions, allowedDirections, autoPlace, chunk, containedWordWarnings, fillGrid, generatePuzzle, mulberry32, randomSeed } from "@/lib/wordsearch/engine";
import { buildWordSearchBook, wordSearchContent } from "@/lib/wordsearch/pdf";
import PuzzleGrid, { SolutionStyle } from "./PuzzleGrid";
import StepWords from "./StepWords";
import StepSettings from "./StepSettings";
import StepPlace from "./StepPlace";
import StepReview from "./StepReview";
import { PuzzleModel, colorsFor, listedWords } from "./model";

const STEPS = [{ label: "Add words" }, { label: "Puzzle settings" }, { label: "Place words" }, { label: "Review & solution" }, { label: "Export book" }];

export default function WordSearch() {
  const [step, setStep] = useState(0);
  const [words, setWords] = useState<string[]>([]);
  const [gridSize, setGridSize] = useState(15);
  const [wordsPerPuzzle, setWordsPerPuzzle] = useState(12);
  const [dirOpts, setDirOpts] = useState<DirectionOptions>({ horizontal: true, vertical: true, diagonalDown: true, diagonalUp: true, reversed: false });
  const [puzzles, setPuzzles] = useState<PuzzleModel[]>([]);
  const [signature, setSignature] = useState("");
  const [active, setActive] = useState(0);
  const [solution, setSolution] = useState<SolutionStyle>("hidden");
  const [answersPerPage, setAnswersPerPage] = useState<1 | 2 | 4 | 6>(4);

  const dirs = useMemo(() => allowedDirections(dirOpts), [dirOpts]);
  const currentSig = `${gridSize}|${wordsPerPuzzle}|${words.join("\u0001")}`;
  const stale = puzzles.length > 0 && signature !== currentSig;
  const finished = puzzles.filter((p) => p.grid);

  const updateActive = (fn: (p: PuzzleModel) => PuzzleModel) => setPuzzles((prev) => prev.map((p, i) => (i === active ? fn(p) : p)));

  const autoBuild = (pzWords: string[], i: number, size: number, keep?: PuzzleModel): PuzzleModel => {
    const g = generatePuzzle(pzWords, size, dirs, mulberry32(randomSeed()));
    return { id: keep?.id ?? Date.now() + i, title: keep?.title ?? `Puzzle ${i + 1}`, size, words: pzWords, placements: g.placements, grid: g.grid, unplaced: g.unplaced, warnings: g.warnings };
  };

  const create = (mode: "auto" | "manual") => {
    if (!words.length) return toast.error("Add some words in step 1 first.");
    if (mode === "auto" && !dirs.length) return toast.error("Choose at least one direction in step 2.");
    const groups = chunk(words, wordsPerPuzzle);
    const list: PuzzleModel[] = groups.map((g, i) =>
      mode === "auto" ? autoBuild(g, i, gridSize) : { id: Date.now() + i, title: `Puzzle ${i + 1}`, size: gridSize, words: g, placements: [], grid: null, unplaced: [], warnings: containedWordWarnings(g) }
    );
    setPuzzles(list);
    setSignature(currentSig);
    setActive(0);
    setSolution("hidden");
    if (mode === "auto") {
      const misfits = list.flatMap((p, i) => p.unplaced.map((w) => `${w} (puzzle ${i + 1})`));
      if (misfits.length) toast.warning(`Some words didn't fit and were left out: ${misfits.join(", ")}`, { autoClose: 8000 });
      else toast.success(`${list.length} puzzle${list.length === 1 ? " is" : "s are"} ready.`);
    }
  };

  const finishAll = () => {
    if (!dirs.length) return toast.error("Choose at least one direction in step 2.");
    let misses = 0;
    setPuzzles((prev) =>
      prev.map((p) => {
        if (p.grid) return p;
        const rest = p.words.filter((w) => !p.placements.some((x) => x.word === w));
        const res = autoPlace(p.size, p.placements, rest, dirs, mulberry32(randomSeed()));
        const placements = [...p.placements, ...res.placements];
        misses += res.unplaced.length;
        if (!placements.length) return { ...p, unplaced: res.unplaced };
        const f = fillGrid(p.size, placements, mulberry32(randomSeed()));
        return { ...p, placements, grid: f.grid, unplaced: res.unplaced, warnings: [...containedWordWarnings(placements.map((x) => x.word)), ...f.warnings] };
      })
    );
    toast[misses ? "warning" : "success"](misses ? `Done. ${plural(misses, "word")} didn't fit and ${misses === 1 ? "was" : "were"} left out.` : "All puzzles are finished.");
  };

  const reshuffle = () => {
    const p = puzzles[active];
    if (!p?.grid) return;
    const f = fillGrid(p.size, p.placements, mulberry32(randomSeed()));
    updateActive((x) => ({ ...x, grid: f.grid }));
  };

  const regenerate = () => {
    const p = puzzles[active];
    if (!p) return;
    if (!dirs.length) return toast.error("Choose at least one direction in step 2.");
    updateActive((x) => autoBuild(x.words, active, x.size, x));
    toast.success("New layout created.");
  };

  const maxReachable = words.length === 0 ? 0 : finished.length === 0 ? 2 : 4;

  const nextInfo: { disabled: boolean; hint: React.ReactNode; label?: string } = (() => {
    switch (step) {
      case 0:
        return { disabled: !words.length, hint: words.length ? `${words.length} entr${words.length === 1 ? "y" : "ies"} in your list` : "Add at least one word to continue" };
      case 1:
        return { disabled: !words.length, hint: `${plural(Math.ceil(words.length / wordsPerPuzzle), "puzzle")}, ${gridSize}×${gridSize}` };
      case 2:
        return { disabled: !finished.length, hint: puzzles.length ? `${finished.length} of ${puzzles.length} puzzles finished` : "Choose automatic or manual placement" };
      case 3:
        return { disabled: !finished.length, hint: `${plural(finished.length, "puzzle")} will go in your book`, label: "Continue to export" };
      default:
        return { disabled: true, hint: "" };
    }
  })();

  const exportPuzzles = finished.map((p) => ({ title: p.title, size: p.size, grid: p.grid!, words: listedWords(p), placements: p.placements }));
  const { puzzlePages, answerPages } = wordSearchContent(exportPuzzles, answersPerPage);

  return (
    <div className="container pb-4">
      <PageHeader icon={<BsSearch />} title="Word Search" lead="Build word search puzzles step by step and export a print-ready book with answer keys." />
      <Stepper steps={STEPS} current={step} maxReachable={maxReachable} onSelect={setStep} />
      <div className="pg-card no-print">
        <div className="pg-card-body">
          {step === 0 && <StepWords words={words} setWords={setWords} gridSize={gridSize} />}
          {step === 1 && (
            <StepSettings words={words} gridSize={gridSize} setGridSize={setGridSize} wordsPerPuzzle={wordsPerPuzzle} setWordsPerPuzzle={setWordsPerPuzzle} dirOpts={dirOpts} setDirOpts={setDirOpts} />
          )}
          {step === 2 && <StepPlace puzzles={puzzles} active={active} setActive={setActive} updateActive={updateActive} autoDirs={dirs} stale={stale} create={create} finishAll={finishAll} />}
          {step === 3 && (
            <StepReview
              puzzles={puzzles}
              active={active}
              setActive={setActive}
              updateActive={updateActive}
              solution={solution}
              setSolution={setSolution}
              reshuffle={reshuffle}
              regenerate={regenerate}
              edit={() => setStep(2)}
            />
          )}
          {step === 4 && (
            <BookExport
              tool="word-search"
              toolDefaults={{ title: "Word Search Puzzle Book", subtitle: "Large Print Puzzles for Relaxing Fun" }}
              detail={`${finished.length} Word Search Puzzle${finished.length === 1 ? "" : "s"}`}
              contentPages={puzzlePages + answerPages}
              itemsLabel={`${plural(finished.length, "puzzle")} + ${plural(answerPages, "answer page")}`}
              fileBase="word-search-book"
              disabledReason={finished.length ? undefined : "Finish at least one puzzle first."}
              onPrint={() => window.print()}
              extraFields={
                <div className="col-sm-6">
                  <label className="form-label" htmlFor="answersPerPage">
                    Answer keys per page <InfoTip text="How many solved grids to fit on each answer page at the back of the book." />
                  </label>
                  <select id="answersPerPage" className="form-select" value={answersPerPage} onChange={(e) => setAnswersPerPage(Number(e.target.value) as 1 | 2 | 4 | 6)}>
                    {[1, 2, 4, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} per page
                      </option>
                    ))}
                  </select>
                </div>
              }
              build={(s, fonts) => buildWordSearchBook(exportPuzzles, { trim: s.trim, bleed: s.bleed, answersPerPage, frontMatter: s.frontMatter, padForKdp: s.padForKdp }, fonts)}
            />
          )}
        </div>
        <WizardFooter
          onBack={step > 0 ? () => setStep(step - 1) : undefined}
          onNext={step < STEPS.length - 1 ? () => setStep(step + 1) : undefined}
          nextDisabled={nextInfo.disabled}
          nextLabel={nextInfo.label}
          hint={nextInfo.hint}
        />
      </div>

      {/* Print output: puzzles, then answer keys when the solution is shown */}
      <div className="print-only">
        {finished.map((p) => (
          <div className="print-page" key={`print-${p.id}`}>
            <h2>{p.title}</h2>
            <PuzzleGrid size={p.size} letters={p.grid!} placements={p.placements} solution="hidden" maxWidth={680} />
            <div className="print-words">
              {listedWords(p).map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>
          </div>
        ))}
        {finished.map((p) => (
          <div className="print-page" key={`print-sol-${p.id}`}>
            <h2>{p.title}: Answers</h2>
            <PuzzleGrid size={p.size} letters={p.grid!} placements={p.placements} colors={colorsFor(p)} solution="bw" maxWidth={600} />
          </div>
        ))}
      </div>
    </div>
  );
}
