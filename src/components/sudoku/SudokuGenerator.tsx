"use client";
import { plural } from "@/lib/plural";
import React, { useMemo, useState } from "react";
import { BsArrowRepeat, BsBarChartFill, BsEmojiSmile, BsEye, BsFire, BsGraphUpArrow, BsGrid3X3Gap, BsLightningCharge, BsSliders } from "react-icons/bs";
import { ChoiceCards, FINISH, Question, QuestionFlow } from "@/components/ui/Flow";
import { useStages } from "@/components/ui/useStages";
import { Panel, SubStep } from "@/components/ui/Panel";
import { toast } from "react-toastify";
import PageHeader from "@/components/ui/PageHeader";
import BookExport from "@/components/ui/BookExport";
import DesignStep from "@/components/ui/DesignStep";
import ItemPager from "@/components/ui/ItemPager";
import JobProgress from "@/components/ui/JobProgress";
import { useDesign } from "@/components/ui/useDesign";
import { Stepper } from "@/components/ui/Wizard";
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
const QUICK_ICONS = [<BsEmojiSmile key="a" />, <BsGraphUpArrow key="b" />, <BsBarChartFill key="c" />, <BsFire key="d" />];
const QUICK: { label: string; mix: SudokuMix }[] = [
  { label: "All easy", mix: { easy: 50, medium: 0, hard: 0, expert: 0 } },
  { label: "Easy → hard (100)", mix: { easy: 30, medium: 40, hard: 30, expert: 0 } },
  { label: "Balanced (200)", mix: { easy: 50, medium: 50, hard: 50, expert: 50 } },
  { label: "Challenge (100)", mix: { easy: 0, medium: 20, hard: 50, expert: 30 } },
];

let sample: SudokuPuzzle[] | null = null;
const samplePuzzles = () => (sample ??= [demoSudoku(), demoSudoku(), demoSudoku(), demoSudoku()]);

export default function SudokuGenerator() {
  const { step, goTo, flow: stage } = useStages(STEPS.length);
  const [genKey, setGenKey] = useState("");
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
      setGenKey(JSON.stringify(mix));
      setActive(0);
      setShowSolution(false);
      toast.success(`${plural(list.length, "sudoku puzzle")} ${list.length === 1 ? "is" : "are"} ready (${((performance.now() - t0) / 1000).toFixed(1)}s).`);
      goTo(1, "review");
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

  const mixKey = JSON.stringify(mix);
  const presetOf = QUICK.find((q) => JSON.stringify(q.mix) === mixKey);
  const mixLine = (m: SudokuMix) =>
    SUDOKU_DIFFICULTIES.filter((d) => m[d])
      .map((d) => `${m[d]} ${d}`)
      .join(" · ");

  const chooseQs: Question[] = [
    {
      key: "mix",
      wide: true,
      title: "What kind of sudoku book?",
      lead: "Pick a ready-made mix, or choose your own numbers. You can adjust them on the next screen.",
      hideNext: true,
      body: (
        <ChoiceCards
          label="Puzzle mix"
          cols={3}
          value={presetOf ? presetOf.label : null}
          onPick={(v) => {
            const q = QUICK.find((x) => x.label === v);
            if (q) setMix(q.mix);
            stage(0).setSub("counts");
          }}
          options={[
            ...QUICK.map((q, i) => ({ value: q.label, title: q.label, text: mixLine(q.mix), icon: QUICK_ICONS[i], testId: `quick-${i}`, badge: i === 1 ? "Popular" : undefined })),
            { value: "custom", title: "Choose my own numbers", text: "Set exactly how many easy, medium, hard and expert puzzles you want.", icon: <BsSliders />, testId: "quick-custom" },
          ]}
        />
      ),
    },
    {
      key: "counts",
      wide: true,
      title: running ? "Generating your puzzles…" : "How many puzzles of each level?",
      lead: running ? "Every puzzle is unique with exactly one solution. Hundreds take a few seconds." : `Type a number in each box (0 skips a level). Up to ${SUDOKU_MAX_PUZZLES.toLocaleString()} in total. The book goes from easiest to hardest.`,
      canNext: total > 0 && !running,
      blockedHint: running ? "Generating…" : "Choose at least one puzzle",
      nextLabel: puzzles.length && genKey === mixKey ? "Next" : `Generate ${plural(total, "puzzle")}`,
      nextIcon: puzzles.length && genKey === mixKey ? undefined : <BsLightningCharge />,
      nextTestId: "generate-sudoku",
      onNext: () => {
        if (puzzles.length && genKey === mixKey) return FINISH;
        generate();
        return false;
      },
      body: running ? (
        <JobProgress title="Generating sudoku" progress={running.progress} onCancel={running.cancel} />
      ) : (
        <div className="row g-3">
          {SUDOKU_DIFFICULTIES.map((d) => (
            <div className="col-6 col-md-3" key={d}>
              <div className={`pg-option-card text-center h-100 ${mix[d] ? "active" : ""}`}>
                <h3 className="mt-0">{capitalize(d)}</h3>
                <p className="small mb-2">{DIFF_TEXT[d]}</p>
                <label className="visually-hidden" htmlFor={`count-${d}`}>
                  {capitalize(d)} puzzles
                </label>
                <input id={`count-${d}`} type="number" className="form-control text-center mx-auto pg-big-input pg-q-big-number" min={0} max={SUDOKU_MAX_PUZZLES} value={mix[d]} onChange={(e) => setCount(d, Number(e.target.value))} data-testid={`count-${d}`} autoFocus={d === "easy"} />
              </div>
            </div>
          ))}
        </div>
      ),
    },
  ];

  const reviewQs: Question[] = [
    {
      key: "review",
      wide: true,
      title: "Check your puzzles",
      lead: "Look through your puzzles and their solutions. Everything here is optional: if they look good, press Next.",
      canNext: puzzles.length > 0,
      blockedHint: "Generate puzzles first",
      hint: plural(puzzles.length, "puzzle"),
      nextLabel: "Choose a design",
      body: !puzzle ? (
        <div className="pg-empty-pointer">
          <span className="pg-icon-badge">
            <BsGrid3X3Gap />
          </span>
          <h4>No puzzles yet</h4>
          <p>Go back to step 1 and press Generate.</p>
        </div>
      ) : (
                <div className="row g-4">
                  <div className="col-lg-7">
                    <Panel tone="result" title="Puzzle preview" icon={<BsEye />}>
                      <SudokuGrid id="sudoku-grid" puzzle={puzzle} showSolution={showSolution} />
                    </Panel>
                  </div>
                  <div className="col-lg-5">
                    <Panel tone="action" title="Check your puzzles" icon={<BsGrid3X3Gap />}>
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
                        <button type="button" className="btn btn-outline-primary" onClick={() => goTo(0, "counts")}>
                          <BsSliders /> Change difficulty or count
                        </button>
                      </div>
                      <div className="form-text mt-2">Bold numbers are the starting clues. Solution numbers are shown in color.</div>
                    </Panel>
                  </div>
                </div>
      ),
    },
  ];

  return (
    <div className="container pb-4">
      <PageHeader icon={<BsGrid3X3Gap />} title="Sudoku" lead="Generate up to 1,000 sudoku puzzles from easy to expert, each with one solution, and export a print-ready book." />
      <Stepper steps={STEPS} current={step} maxReachable={puzzles.length ? 3 : 0} onSelect={goTo} />
      <div className="pg-card pg-wizard-card">
        {step === 0 && <QuestionFlow flow={stage(0)} questions={chooseQs} />}
        {step === 1 && <QuestionFlow flow={stage(1)} questions={reviewQs} />}
        {step === 2 && <DesignStep tool="sudoku" api={designApi} buildSample={sampleBuilder} flow={stage(2)} />}
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
            flow={stage(3)}
          />
        )}
      </div>
    </div>
  );
}
