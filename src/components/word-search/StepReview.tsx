"use client";
import React, { useState } from "react";
import { BsArrowRepeat, BsCheck2Square, BsEye, BsMagic, BsPencil } from "react-icons/bs";
import { Panel, SubStep } from "@/components/ui/Panel";
import Callout from "@/components/ui/Callout";
import { FlowCtl, QuestionFlow } from "@/components/ui/Flow";
import PuzzleGrid, { SolutionStyle } from "./PuzzleGrid";
import PuzzleTabs from "./PuzzleTabs";
import { PuzzleModel, colorsFor, listedWords } from "./model";

interface Props {
  puzzles: PuzzleModel[];
  active: number;
  setActive: (i: number) => void;
  updateActive: (fn: (p: PuzzleModel) => PuzzleModel) => void;
  solution: SolutionStyle;
  setSolution: (s: SolutionStyle) => void;
  reshuffle: () => void;
  regenerate: () => void;
  edit: () => void;
  flow: FlowCtl;
}

export default function StepReview({ puzzles, active, setActive, updateActive, solution, setSolution, reshuffle, regenerate, edit, flow }: Props) {
  const [style, setStyle] = useState<"color" | "bw">("color");
  const puzzle = puzzles[active];
  const show = solution !== "hidden";
  if (!puzzle) return <QuestionFlow flow={flow} questions={[{ key: "review", title: "Check your puzzles", body: <p>No puzzles yet. Go back and place your words.</p>, canNext: false, blockedHint: "Finish at least one puzzle first" }]} />;
  const body = (
    <div>
      <div className="row g-4">
        <div className="col-lg-7 col-xl-8">
          <Panel tone="result" title="Puzzle preview" icon={<BsEye />}>
          <div className="mb-3">
            <PuzzleTabs puzzles={puzzles} active={active} onSelect={setActive} />
          </div>
          {puzzle.grid ? (
            <div className="pg-grid-wrap">
              <PuzzleGrid id="review-grid" size={puzzle.size} shape={puzzle.shape} letters={puzzle.grid} placements={puzzle.placements} colors={colorsFor(puzzle)} solution={solution} />
            </div>
          ) : (
            <Callout tone="warn">
              This puzzle isn&apos;t finished yet, so it won&apos;t be in your book.{" "}
              <button type="button" className="btn btn-sm btn-light ms-1" onClick={edit}>
                <BsPencil /> Finish it
              </button>
            </Callout>
          )}
          </Panel>
        </div>
        <div className="col-lg-5 col-xl-4">
          <Panel tone="action" title="Check this puzzle" icon={<BsCheck2Square />}>
            <SubStep n={1} title="Check the answers">
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id="showSolution"
                checked={show}
                onChange={(e) => setSolution(e.target.checked ? style : "hidden")}
                disabled={!puzzle.grid}
              />
              <label className="form-check-label fw-semibold" htmlFor="showSolution">
                Show solution
              </label>
            </div>
            <div className="btn-group btn-group-sm mt-2" role="group" aria-label="Solution style">
              {(["color", "bw"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`btn ${style === s ? "btn-outline-primary fw-bold" : "btn-light"}`}
                  onClick={() => {
                    setStyle(s);
                    if (show) setSolution(s);
                  }}
                >
                  {s === "color" ? "Colored" : "Black & white"}
                </button>
              ))}
            </div>
            </SubStep>
            <SubStep n={2} optional title="Rename it">
              <label className="visually-hidden" htmlFor="puzzleTitle">
                Puzzle title
              </label>
              <input id="puzzleTitle" className="form-control" value={puzzle.title} onChange={(e) => updateActive((p) => ({ ...p, title: e.target.value }))} />
            </SubStep>
          </Panel>
          <Panel tone="options" title="Change this puzzle" optional className="mt-3">
            <div className="form-label small">Words ({listedWords(puzzle).length})</div>
            <div className="d-flex flex-wrap gap-2 small mb-3">
              {listedWords(puzzle).map((w) => (
                <span key={w} className="pg-badge neutral">
                  {w}
                </span>
              ))}
            </div>
            <div className="d-grid gap-2">
              <button type="button" className="btn btn-light" onClick={reshuffle} disabled={!puzzle.grid}>
                <BsMagic /> Shuffle random letters
              </button>
              <button type="button" className="btn btn-light" onClick={regenerate}>
                <BsArrowRepeat /> New automatic layout
              </button>
              <button type="button" className="btn btn-outline-primary" onClick={edit}>
                <BsPencil /> Edit word positions
              </button>
            </div>
          </Panel>
          {puzzle.unplaced.length > 0 && (
            <Callout tone="warn" className="mt-3">
              Not in this puzzle: <b>{puzzle.unplaced.join(", ")}</b>
            </Callout>
          )}
          {puzzle.warnings.map((w) => (
            <Callout key={w} className="mt-2">
              {w}
            </Callout>
          ))}
        </div>
      </div>
    </div>
  );
  const finished = puzzles.filter((p) => p.grid).length;
  return (
    <QuestionFlow
      flow={flow}
      questions={[
        {
          key: "review",
          wide: true,
          title: "Check your puzzles",
          lead: "Look through your puzzles and their answers. Everything here is optional: if they look good, press Next.",
          canNext: finished > 0,
          blockedHint: "Finish at least one puzzle first",
          hint: `${finished.toLocaleString()} ${finished === 1 ? "puzzle" : "puzzles"} will go in your book`,
          nextLabel: "Choose a design",
          body,
        },
      ]}
    />
  );
}
