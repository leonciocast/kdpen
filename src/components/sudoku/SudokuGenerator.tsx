"use client";
import { plural } from "@/lib/plural";
import React, { useState } from "react";
import { BsArrowRepeat, BsEye, BsGrid3X3Gap, BsLightningCharge, BsSliders } from "react-icons/bs";
import { toast } from "react-toastify";
import PageHeader from "@/components/ui/PageHeader";
import BookExport from "@/components/ui/BookExport";
import EmptyState from "@/components/ui/EmptyState";
import InfoTip from "@/components/ui/InfoTip";
import { StepIntro, Stepper, WizardFooter } from "@/components/ui/Wizard";
import { SUDOKU_DIFFICULTIES, SUDOKU_MAX_PUZZLES, SudokuDifficulty, SudokuPuzzle, capitalize, generateSudoku, generateSudokus } from "@/lib/sudoku";
import { buildSudokuBook } from "@/lib/sudoku/pdf";
import SudokuGrid from "./SudokuGrid";

const STEPS = [{ label: "Choose puzzles" }, { label: "Review & solution" }, { label: "Export book" }];
const DIFF_TEXT: Record<SudokuDifficulty, string> = {
  easy: "Plenty of numbers to start",
  medium: "A steady challenge",
  hard: "For experienced solvers",
  expert: "Very few clues",
};

export default function SudokuGenerator() {
  const [step, setStep] = useState(0);
  const [difficulty, setDifficulty] = useState<SudokuDifficulty>("easy");
  const [count, setCount] = useState(10);
  const [puzzles, setPuzzles] = useState<SudokuPuzzle[]>([]);
  const [active, setActive] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [perPage, setPerPage] = useState<1 | 2 | 4>(1);

  const generate = () => {
    const list = generateSudokus(count, difficulty);
    setPuzzles(list);
    setActive(0);
    setShowSolution(false);
    toast.success(`${list.length} ${difficulty} sudoku puzzle${list.length === 1 ? " is" : "s are"} ready.`);
    setStep(1);
  };

  const puzzle = puzzles[active];
  const answerPages = Math.ceil(puzzles.length / 4);
  return (
    <div className="container pb-4">
      <PageHeader icon={<BsGrid3X3Gap />} title="Sudoku" lead="Generate sudoku puzzles from easy to expert, each with one solution, and export a print-ready book." />
      <Stepper steps={STEPS} current={step} maxReachable={puzzles.length ? 2 : 0} onSelect={setStep} />
      <div className="pg-card no-print">
        <div className="pg-card-body">
          {step === 0 && (
            <div>
              <StepIntro icon={<BsSliders />} title="Choose your puzzles">
                Pick a difficulty and how many puzzles you want, then generate them.
              </StepIntro>
              <div className="form-label">Difficulty</div>
              <div className="row g-2 mb-4" role="radiogroup" aria-label="Difficulty">
                {SUDOKU_DIFFICULTIES.map((d) => (
                  <div className="col-6 col-md-3" key={d}>
                    <button type="button" role="radio" aria-checked={difficulty === d} className={`pg-option-card text-center ${difficulty === d ? "active" : ""}`} onClick={() => setDifficulty(d)}>
                      <h3 className="mt-0">{capitalize(d)}</h3>
                      <p className="small">{DIFF_TEXT[d]}</p>
                    </button>
                  </div>
                ))}
              </div>
              <div className="d-flex flex-wrap align-items-end gap-3">
                <div>
                  <label className="form-label" htmlFor="count">
                    Number of puzzles <InfoTip text={`Between 1 and ${SUDOKU_MAX_PUZZLES}. Each one is unique.`} />
                  </label>
                  <input id="count" type="number" className="form-control" style={{ width: 140 }} min={1} max={SUDOKU_MAX_PUZZLES} value={count} onChange={(e) => setCount(Math.max(1, Math.min(SUDOKU_MAX_PUZZLES, Number(e.target.value) || 1)))} />
                </div>
                <button type="button" className="btn btn-primary btn-lg" onClick={generate} data-testid="generate-sudoku">
                  <BsLightningCharge /> Generate {count} puzzle{count === 1 ? "" : "s"}
                </button>
              </div>
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
                          Puzzle {active + 1} of {puzzles.length}
                        </span>
                        <span className="pg-badge info">{capitalize(puzzle.difficulty)}</span>
                      </div>
                      <div className="pg-tabs mb-3" role="tablist" style={{ maxHeight: 160, overflowY: "auto" }}>
                        {puzzles.map((_, i) => (
                          <button key={i} type="button" role="tab" aria-selected={i === active} className={`pg-tab ${i === active ? "active" : ""}`} onClick={() => setActive(i)}>
                            {i + 1}
                          </button>
                        ))}
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

          {step === 2 && (
            <BookExport
              tool="sudoku"
              toolDefaults={{ title: "Sudoku Puzzle Book", subtitle: `${capitalize(difficulty)} Puzzles with Solutions` }}
              detail={`${puzzles.length} Sudoku Puzzle${puzzles.length === 1 ? "" : "s"}`}
              contentPages={Math.ceil(puzzles.length / perPage) + answerPages}
              itemsLabel={`${plural(puzzles.length, "puzzle")} + ${plural(answerPages, "solution page")}`}
              fileBase="sudoku-book"
              disabledReason={puzzles.length ? undefined : "Generate puzzles first."}
              onPrint={() => window.print()}
              extraFields={
                <div className="col-sm-6">
                  <label className="form-label" htmlFor="perPage">
                    Puzzles per page
                  </label>
                  <select id="perPage" className="form-select" value={perPage} onChange={(e) => setPerPage(Number(e.target.value) as 1 | 2 | 4)}>
                    <option value={1}>1 per page (large print)</option>
                    <option value={2}>2 per page</option>
                    <option value={4}>4 per page</option>
                  </select>
                </div>
              }
              build={(s, fonts) => buildSudokuBook(puzzles, { trim: s.trim, bleed: s.bleed, frontMatter: s.frontMatter, puzzlesPerPage: perPage, padForKdp: s.padForKdp }, fonts)}
            />
          )}
        </div>
        <WizardFooter
          onBack={step > 0 ? () => setStep(step - 1) : undefined}
          onNext={step === 0 ? (puzzles.length ? () => setStep(1) : undefined) : step === 1 ? () => setStep(2) : undefined}
          nextDisabled={!puzzles.length}
          hint={step === 0 ? (puzzles.length ? `${puzzles.length} puzzles already generated` : "Generate puzzles to continue") : step === 1 ? `${puzzles.length} puzzles ready` : ""}
        />
      </div>

      <div className="print-only">
        {puzzles.map((p, i) => (
          <div className="print-page" key={`p-${i}`}>
            <h2>
              Sudoku {i + 1} · {capitalize(p.difficulty)}
            </h2>
            <SudokuGrid puzzle={p} showSolution={false} maxWidth={560} />
          </div>
        ))}
        {puzzles.map((p, i) => (
          <div className="print-page" key={`s-${i}`}>
            <h2>Sudoku {i + 1}: Solution</h2>
            <SudokuGrid puzzle={p} showSolution maxWidth={480} />
          </div>
        ))}
      </div>
    </div>
  );
}
