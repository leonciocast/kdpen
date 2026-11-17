"use client";
import React from "react";
import { BsArrowRepeat, BsGrid3X3, BsHandIndexThumb, BsLightningCharge, BsMagic } from "react-icons/bs";
import { ChoiceCards, FlowCtl, Question, QuestionFlow } from "@/components/ui/Flow";
import { Panel } from "@/components/ui/Panel";
import Callout from "@/components/ui/Callout";
import JobProgress from "@/components/ui/JobProgress";
import type { Progress } from "@/lib/jobs/types";
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
  create: (mode: "auto" | "manual") => Promise<boolean>;
  finishAll: () => void;
  /** Background generation in progress. */
  running: { progress: Progress | null; cancel: () => void } | null;
  flow: FlowCtl;
}

export default function StepPlace({ puzzles, active, setActive, updateActive, autoDirs, stale, create, finishAll, running, flow }: Props) {
  const puzzle = puzzles[active];
  const done = puzzles.filter((p) => p.grid).length;

  const pick = async (mode: "auto" | "manual") => {
    if (puzzles.length && !window.confirm(`Rebuild all ${puzzles.length.toLocaleString()} puzzles? Changes you made to them will be lost.`)) return;
    if (await create(mode)) flow.setSub("puzzles");
  };

  const how: Question = {
    key: "how",
    title: running ? "Building your puzzles…" : "How should the words go into the grids?",
    lead: running ? "Every word is being placed and every grid filled. Big books take a few seconds; you can cancel at any time." : "Most people let us do it. You can still change any puzzle afterwards.",
    hideNext: !!running || !puzzles.length,
    canNext: puzzles.length > 0,
    nextLabel: "Keep my puzzles",
    onNext: () => "puzzles",
    body: running ? (
      <JobProgress title="Building puzzles" progress={running.progress} onCancel={running.cancel} />
    ) : (
      <>
        <ChoiceCards
          label="Placement"
          value={null}
          onPick={pick}
          options={[
            { value: "auto", title: "Place all words for me", text: "Every puzzle is built and filled using your settings, even for 10,000+ words. Takes a few seconds.", icon: <BsLightningCharge />, testId: "mode-auto", badge: "Recommended", cta: "Place them for me" },
            { value: "manual", title: "Place words myself", text: "Advanced: choose where each word goes and which way it runs, with a live preview. Any direction is allowed.", icon: <BsHandIndexThumb />, testId: "mode-manual", cta: "Place them myself" },
          ]}
        />
        {puzzles.length > 0 && (
          <div className="pg-q-note">
            <span>
              You already have {puzzles.length.toLocaleString()} {puzzles.length === 1 ? "puzzle" : "puzzles"}
              {stale ? ", but your words or settings changed since they were made." : "."}
            </span>
            <button type="button" className="pg-link-btn" onClick={() => flow.setSub("puzzles")}>
              <BsGrid3X3 /> See my puzzles
            </button>
          </div>
        )}
      </>
    ),
  };

  const all = puzzles.length > 0 && done === puzzles.length;
  const work: Question = {
    key: "puzzles",
    wide: true,
    title: all ? "Your puzzles are ready" : "Place your words",
    lead: all
      ? "Click a word to move it, or simply press Next."
      : "Click a word, pick a direction, then click the grid. When you're happy, fill the empty squares to finish the puzzle.",
    canNext: done > 0 && !running,
    blockedHint: puzzles.length ? "Finish at least one puzzle to continue" : "Go back and choose how to place the words",
    hint: puzzles.length ? `${done.toLocaleString()} of ${puzzles.length.toLocaleString()} puzzles finished` : undefined,
    nextLabel: "Review",
    body: !puzzles.length ? (
      <div className="pg-empty-pointer">
        <span className="pg-icon-badge">
          <BsGrid3X3 />
        </span>
        <h4>No puzzles yet</h4>
        <p>Press Back and choose how to place the words.</p>
      </div>
    ) : (
      <>
        {stale && (
          <Callout tone="warn" className="mb-3">
            <div className="d-flex flex-wrap align-items-center gap-2">
              <span>You changed your words or settings since these puzzles were made.</span>
              <button type="button" className="btn btn-sm btn-light" onClick={() => flow.setSub("how")}>
                <BsArrowRepeat /> Rebuild them
              </button>
            </div>
          </Callout>
        )}
        <Panel
          tone="result"
          title="Your puzzles"
          icon={<BsGrid3X3 />}
          aside={
            <>
              <span className={`pg-badge ${all ? "ok" : "warn"}`}>
                {done} of {puzzles.length} finished
              </span>
              {!all && (
                <button type="button" className="btn btn-sm btn-primary" onClick={finishAll}>
                  <BsMagic /> Finish the rest automatically
                </button>
              )}
            </>
          }
        >
          <div className="mb-3">
            <PuzzleTabs puzzles={puzzles} active={active} onSelect={setActive} />
          </div>
          {puzzle && <Editor key={puzzle.id} puzzle={puzzle} update={updateActive} autoDirs={autoDirs} />}
        </Panel>
      </>
    ),
  };

  return <QuestionFlow questions={[how, work]} flow={flow} />;
}
