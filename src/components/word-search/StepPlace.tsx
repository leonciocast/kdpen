"use client";
import React from "react";
import { BsArrowRepeat, BsCursor, BsHandIndexThumb, BsLightningCharge, BsMagic } from "react-icons/bs";
import Callout from "@/components/ui/Callout";
import JobProgress from "@/components/ui/JobProgress";
import type { Progress } from "@/lib/jobs/types";
import { StepIntro } from "@/components/ui/Wizard";
import { DirectionKey } from "@/lib/wordsearch/engine";
import Editor from "./Editor";
import PuzzleTabs from "./PuzzleTabs";
import { PuzzleModel } from "./model";

interface Props {
  puzzles: PuzzleModel[];
  active: number;
  setActive: (i: number) => void;
  updateActive: (fn: (p: PuzzleModel) => PuzzleModel) => void;
  autoDirs: DirectionKey[];
  stale: boolean;
  create: (mode: "auto" | "manual") => void;
  finishAll: () => void;
  /** Background generation in progress. */
  running: { progress: Progress | null; cancel: () => void } | null;
}

export default function StepPlace({ puzzles, active, setActive, updateActive, autoDirs, stale, create, finishAll, running }: Props) {
  const puzzle = puzzles[active];
  const done = puzzles.filter((p) => p.grid).length;

  if (running) {
    return (
      <div>
        <StepIntro icon={<BsCursor />} title="Building your puzzles">
          Every word is being placed and every grid filled. Big books take a few seconds; you can cancel at any time.
        </StepIntro>
        <JobProgress title="Building puzzles" progress={running.progress} onCancel={running.cancel} />
      </div>
    );
  }

  if (!puzzles.length) {
    return (
      <div>
        <StepIntro icon={<BsCursor />} title="Place the words">
          Let us place every word for you, or place them yourself one by one. You can mix both: place a few by hand and auto-place the rest.
        </StepIntro>
        <div className="row g-3">
          <div className="col-md-6">
            <button type="button" className="pg-option-card" onClick={() => create("auto")} data-testid="mode-auto">
              <span className="pg-icon-badge">
                <BsLightningCharge />
              </span>
              <h3>Automatic</h3>
              <p>Every puzzle is built and filled using your step 2 settings, even for 10,000+ words. You can still edit any puzzle afterwards.</p>
            </button>
          </div>
          <div className="col-md-6">
            <button type="button" className="pg-option-card" onClick={() => create("manual")} data-testid="mode-manual">
              <span className="pg-icon-badge">
                <BsHandIndexThumb />
              </span>
              <h3>Place words myself</h3>
              <p>Choose where each word goes and which way it runs, with a live preview. Any direction is allowed.</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <StepIntro icon={<BsCursor />} title="Place the words">
        Click a word, pick a direction, then click the grid. When you&apos;re happy, fill the empty squares to finish the puzzle.
      </StepIntro>
      {stale && (
        <Callout tone="warn" className="mb-3">
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span>You changed your words or settings since these puzzles were made.</span>
            <button type="button" className="btn btn-sm btn-light" onClick={() => window.confirm("Rebuild all puzzles? Manual placements will be lost.") && create("manual")}>
              <BsArrowRepeat /> Rebuild for manual placement
            </button>
            <button type="button" className="btn btn-sm btn-light" onClick={() => window.confirm("Rebuild all puzzles automatically? Manual placements will be lost.") && create("auto")}>
              <BsLightningCharge /> Rebuild automatically
            </button>
          </div>
        </Callout>
      )}
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <PuzzleTabs puzzles={puzzles} active={active} onSelect={setActive} />
        <span className="ms-auto d-flex align-items-center gap-2">
          <span className={`pg-badge ${done === puzzles.length ? "ok" : "warn"}`}>
            {done} of {puzzles.length} finished
          </span>
          {done < puzzles.length && (
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={finishAll}>
              <BsMagic /> Finish the rest automatically
            </button>
          )}
        </span>
      </div>
      {puzzle && <Editor key={puzzle.id} puzzle={puzzle} update={updateActive} autoDirs={autoDirs} />}
    </div>
  );
}
