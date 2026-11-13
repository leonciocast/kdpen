"use client";
import React, { useState } from "react";
import { BsArrowRepeat, BsEye, BsMagic, BsPencil } from "react-icons/bs";
import Callout from "@/components/ui/Callout";
import { StepIntro } from "@/components/ui/Wizard";
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
}

export default function StepReview({ puzzles, active, setActive, updateActive, solution, setSolution, reshuffle, regenerate, edit }: Props) {
  const [style, setStyle] = useState<"color" | "bw">("color");
  const puzzle = puzzles[active];
  if (!puzzle) return null;
  const show = solution !== "hidden";
  return (
    <div>
      <StepIntro icon={<BsEye />} title="Review your puzzles">
        Check each puzzle, rename it, and look at the answer key. Black &amp; white shows exactly how answers print in the book.
      </StepIntro>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <PuzzleTabs puzzles={puzzles} active={active} onSelect={setActive} />
      </div>
      <div className="row g-4">
        <div className="col-lg-7 col-xl-8">
          {puzzle.grid ? (
            <div className="pg-grid-wrap">
              <PuzzleGrid id="review-grid" size={puzzle.size} letters={puzzle.grid} placements={puzzle.placements} colors={colorsFor(puzzle)} solution={solution} />
            </div>
          ) : (
            <Callout tone="warn">
              This puzzle isn&apos;t finished yet, so it won&apos;t be in your book.{" "}
              <button type="button" className="btn btn-sm btn-light ms-1" onClick={edit}>
                <BsPencil /> Finish it
              </button>
            </Callout>
          )}
        </div>
        <div className="col-lg-5 col-xl-4">
          <div className="pg-subtle p-3">
            <label className="form-label" htmlFor="puzzleTitle">
              Puzzle title
            </label>
            <input id="puzzleTitle" className="form-control mb-3" value={puzzle.title} onChange={(e) => updateActive((p) => ({ ...p, title: e.target.value }))} />
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
                  className={`btn ${style === s ? "btn-primary" : "btn-light"}`}
                  onClick={() => {
                    setStyle(s);
                    if (show) setSolution(s);
                  }}
                >
                  {s === "color" ? "Colored" : "Black & white"}
                </button>
              ))}
            </div>
            <div className="pg-divider" />
            <div className="form-label">Words ({listedWords(puzzle).length})</div>
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
          </div>
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
}
