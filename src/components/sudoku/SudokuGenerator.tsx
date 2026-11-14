"use client";
import { plural } from "@/lib/plural";
import React, { useMemo, useState } from "react";
import { BsArrowRepeat, BsEye, BsGrid3X3Gap, BsLightningCharge, BsSliders } from "react-icons/bs";
import { toast } from "react-toastify";
import PageHeader from "@/components/ui/PageHeader";
import BookExport from "@/components/ui/BookExport";
import DesignStep from "@/components/ui/DesignStep";
import EmptyState from "@/components/ui/EmptyState";
import InfoTip from "@/components/ui/InfoTip";
import ItemPager from "@/components/ui/ItemPager";
import JobProgress from "@/components/ui/JobProgress";
import { useDesign } from "@/components/ui/useDesign";
import { StepIntro, Stepper, WizardFooter } from "@/components/ui/Wizard";
import { SUDOKU_DIFFICULTIES, SUDOKU_MAX_PUZZLES, SudokuDifficulty, SudokuMix, SudokuPuzzle, capitalize, generateSudoku, mixPlan } from "@/lib/sudoku";
import { buildSudokuBook, demoSudoku } from "@/lib/sudoku/pdf";
import { JobCancelled, startJob } from "@/lib/jobs/client";
import type { Progress } from "@/lib/jobs/types";
import { DEFAULT_EXTRAS } from "@/lib/print/book";
import { DEFAULT_FRONT_MATTER } from "@/lib/print/frontMatter";
import type { Design } from "@/lib/design/types";
import type { FontData } from "@/lib/print/fonts";
import SudokuGrid from "./SudokuGrid";

const STEPS = [{ label: "Choose puzzles" }, { label: "Review & solution" }, { label: "Design" }, { label: "Export book" }];
const DIFF_TEXT: Record<SudokuDifficulty, string> = {
  easy: "Plenty of numbers to start",
  medium: "A steady challenge",
  hard: "For experienced solvers",
  expert: "Very few clues",
};
const QUICK: { label: string; mix: SudokuMix }[] = [
  { label: "All easy", mix: { easy: 50, medium: 0, hard: 0, expert: 0 } },
  { label: "Easy → hard (100)", mix: { easy: 30, medium: 40, hard: 30, expert: 0 } },
  { label: "Balanced (200)", mix: { easy: 50, medium: 50, hard: 50, expert: 50 } },
  { label: "Challenge (100)", mix: { easy: 0, medium: 20, hard: 50, expert: 30 } },
];

let sample: SudokuPuzzle[] | null = null;
const samplePuzzles = () => (sample ??= [demoSudoku(), demoSudoku(), demoSudoku(), demoSudoku()]);

export default function SudokuGenerator() {
  const [step, setStep] = useState(0);
  const [mix, setMix] = useState<SudokuMix>({ easy: 10, medium: 0, hard: 0, expert: 0 });
  const [puzzles, setPuzzles] = useState<SudokuPuzzle[]>([]);
  const [active, setActive] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [running, setRunning] = useState<{ progress: Progress | null; cancel: () => void } | null>(null);
  const designApi = useDesign("sudoku");

  const total = SUDOKU_DIFFICULTIES.reduce((n, d) => n + mix[d], 0);
  const setCount = (d: SudokuDifficulty, v: number) => {
    const others = total - mix[d];
    setMix({ ...mix, [d]: Math.max(0, Math.min(SUDOKU_MAX_PUZZLES - others, Math.round(Number.isFinite(v) ? v : 0))) });
  };

  const generate = async () => {
    if (!total) return toast.error("Choose at least one puzzle.");
    const job = startJob({ type: "sd-generate", plan: mixPlan(mix) }, (p) => setRunning((r) => (r ? { ...r, progress: p } : r)));
    setRunning({ progress: null, cancel: job.cancel });
    const t0 = performance.now();
    try {
      const list = await job.promise;
      setPuzzles(list);
      setActive(0);
      setShowSolution(false);
      toast.success(`${plural(list.length, "sudoku puzzle")} ${list.length === 1 ? "is" : "are"} ready (${((performance.now() - t0) / 1000).toFixed(1)}s).`);
      setStep(1);
    } catch (e) {
      if (e instanceof JobCancelled) toast.info("Stopped. Nothing was changed.");
      else toast.error(`Sorry, the puzzles couldn't be generated: ${(e as Error).message}`);
    } finally {
      setRunning(null);
    }
  };

  const puzzle = puzzles[active];
  const levels = useMemo(() => new Set(puzzles.map((p) => p.difficulty)).size, [puzzles]);
  const sampleBuilder = (design: Design, fonts: FontData) => {
    const items = puzzles.length >= 2 ? puzzles.slice(0, 4) : samplePuzzles();
    return buildSudokuBook(items, { trim: "8.5x11", bleed: false, frontMatter: { ...DEFAULT_FRONT_MATTER, title: "Sudoku Puzzle Book", subtitle: "Puzzles with Solutions" }, extras: { ...DEFAULT_EXTRAS, notesPages: 0, padWithNotes: false }, design, puzzlesPerPage: 2, answersPerPage: 4, padForKdp: false }, fonts);
  };
  const subtitle = levels > 1 ? "Easy to Hard Puzzles with Solutions" : `${capitalize(puzzles[0]?.difficulty ?? "easy")} Puzzles with Solutions`;

  return (
    <div className="container pb-4">
      <PageHeader icon={<BsGrid3X3Gap />} title="Sudoku" lead="Generate up to 1,000 sudoku puzzles from easy to expert, each with one solution, and export a print-ready book." />
      <Stepper steps={STEPS} current={step} maxReachable={puzzles.length ? 3 : 0} onSelect={setStep} />
      <div className="pg-card">
        <div className="pg-card-body">
          {step === 0 && (
            <div>
              <StepIntro icon={<BsSliders />} title="Choose your puzzles">
                Choose how many puzzles of each difficulty you want. The book goes from easiest to hardest, with a section per level.
              </StepIntro>
              <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
                <span className="small fw-semibold">Quick picks:</span>
                {QUICK.map((q) => (
                  <button key={q.label} type="button" className="btn btn-light btn-sm" onClick={() => setMix(q.mix)}>
                    {q.label}
                  </button>
                ))}
              </div>
              <div className="row g-2 mb-3">
                {SUDOKU_DIFFICULTIES.map((d) => (
                  <div className="col-6 col-md-3" key={d}>
                    <div className={`pg-option-card text-center ${mix[d] ? "active" : ""}`}>
                      <h3 className="mt-0">{capitalize(d)}</h3>
                      <p className="small mb-2">{DIFF_TEXT[d]}</p>
                      <label className="visually-hidden" htmlFor={`count-${d}`}>
                        {capitalize(d)} puzzles
                      </label>
                      <input id={`count-${d}`} type="number" className="form-control text-center mx-auto" style={{ maxWidth: 110 }} min={0} max={SUDOKU_MAX_PUZZLES} value={mix[d]} onChange={(e) => setCount(d, Number(e.target.value))} data-testid={`count-${d}`} />
                    </div>
                  </div>
                ))}
              </div>
              {running ? (
                <JobProgress title="Generating sudoku" progress={running.progress} onCancel={running.cancel} />
              ) : (
                <div className="d-flex flex-wrap align-items-center gap-3">
                  <button type="button" className="btn btn-primary btn-lg" onClick={generate} disabled={!total} data-testid="generate-sudoku">
                    <BsLightningCharge /> Generate {plural(total, "puzzle")}
                  </button>
                  <span className="form-text">
                    Up to {SUDOKU_MAX_PUZZLES.toLocaleString()} in total. Every puzzle is unique with exactly one solution. <InfoTip text="Generation runs in the background; hundreds of puzzles take a few seconds." />
                  </span>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div>
              <StepIntro icon={<BsEye />} title="Review your puzzles">
                Look through each puzzle and its solution. Replace any puzzle you don&apos;t like.
              </StepIntro>
              {!puzzle ? (
                <EmptyState icon={<BsGrid3X3Gap />} title="No puzzles yet">
                  Go back and generate some puzzles.
                </EmptyState>
              ) : (
                <div className="row g-4">
                  <div className="col-lg-7">
                    <SudokuGrid id="sudoku-grid" puzzle={puzzle} showSolution={showSolution} />
                  </div>
                  <div className="col-lg-5">
                    <div className="pg-subtle p-3">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="fw-bold">
                          Puzzle {active + 1} of {puzzles.length.toLocaleString()}
                        </span>
                        <span className="pg-badge info">{capitalize(puzzle.difficulty)}</span>
                      </div>
                      <div className="mb-3">
                        <ItemPager titles={puzzles.map((p, i) => (puzzles.length > 10 ? `${capitalize(p.difficulty)}` : String(i + 1)))} active={active} onSelect={setActive} label="Puzzles" />
                      </div>
                      <div className="form-check form-switch">
                        <input className="form-check-input" type="checkbox" role="switch" id="sdSolution" checked={showSolution} onChange={(e) => setShowSolution(e.target.checked)} />
                        <label className="form-check-label fw-semibold" htmlFor="sdSolution">
                          Show solution
                        </label>
                      </div>
                      <div className="d-grid gap-2 mt-3">
                        <button type="button" className="btn btn-light" onClick={() => setPuzzles((prev) => prev.map((p, i) => (i === active ? generateSudoku(p.difficulty) : p)))}>
                          <BsArrowRepeat /> Replace this puzzle
                        </button>
                        <button type="button" className="btn btn-outline-primary" onClick={() => setStep(0)}>
                          <BsSliders /> Change difficulty or count
                        </button>
                      </div>
                      <div className="form-text mt-2">Bold numbers are the starting clues. Solution numbers are shown in color.</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && <DesignStep tool="sudoku" api={designApi} buildSample={sampleBuilder} />}

          {step === 3 && (
            <BookExport
              tool="sudoku"
              toolDefaults={{ title: "Sudoku Puzzle Book", subtitle }}
              itemNoun="puzzle"
              itemCount={puzzles.length}
              sectionCount={Math.max(0, levels - 1)}
              design={designApi.design}
              items={() => ({ tool: "sudoku", items: puzzles })}
              fileBase="sudoku-book"
              disabledReason={puzzles.length ? undefined : "Generate puzzles first."}
              perPageChoice
              defaultAnswersPerPage={6}
            />
          )}
        </div>
        <WizardFooter
          onBack={step > 0 ? () => setStep(step - 1) : undefined}
          onNext={step < STEPS.length - 1 && puzzles.length ? () => setStep(step + 1) : undefined}
          nextDisabled={!puzzles.length || !!running}
          nextLabel={step === 1 ? "Choose a design" : step === 2 ? "Continue to export" : undefined}
          hint={step === 0 ? (puzzles.length ? `${plural(puzzles.length, "puzzle")} generated` : "Generate puzzles to continue") : step === 2 ? `Template: ${designApi.design.name}` : `${plural(puzzles.length, "puzzle")}`}
        />
      </div>
    </div>
  );
}
