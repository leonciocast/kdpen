"use client";
import React from "react";
import { BsChevronLeft, BsChevronRight } from "react-icons/bs";
import { PuzzleModel } from "./model";

const TAB_LIMIT = 10;

/** Tabs for a few puzzles; a compact pager (previous / list / next) for big books. */
export default function PuzzleTabs({ puzzles, active, onSelect }: { puzzles: PuzzleModel[]; active: number; onSelect: (i: number) => void }) {
  if (puzzles.length > TAB_LIMIT) {
    const unfinished = puzzles.filter((p) => !p.grid).length;
    return (
      <div className="pg-pager" data-testid="puzzle-pager">
        <button type="button" className="btn btn-light btn-sm" onClick={() => onSelect(Math.max(0, active - 1))} disabled={active === 0} aria-label="Previous puzzle">
          <BsChevronLeft />
        </button>
        <select className="form-select form-select-sm" value={active} onChange={(e) => onSelect(Number(e.target.value))} aria-label="Choose a puzzle">
          {puzzles.map((p, i) => (
            <option key={p.id} value={i}>
              {i + 1}. {p.title}
              {p.grid ? "" : " (not finished)"}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-light btn-sm" onClick={() => onSelect(Math.min(puzzles.length - 1, active + 1))} disabled={active === puzzles.length - 1} aria-label="Next puzzle">
          <BsChevronRight />
        </button>
        <span className="small text-muted">
          {active + 1} of {puzzles.length.toLocaleString()}
          {unfinished ? ` · ${unfinished} not finished` : ""}
        </span>
      </div>
    );
  }
  return (
    <div className="pg-tabs" role="tablist" aria-label="Puzzles">
      {puzzles.map((p, i) => (
        <button key={p.id} type="button" role="tab" aria-selected={i === active} className={`pg-tab ${i === active ? "active" : ""}`} onClick={() => onSelect(i)}>
          <span className={`pg-dot ${p.grid ? "ok" : "warn"}`} aria-hidden="true" />
          {p.title}
          <span className="visually-hidden">{p.grid ? "(finished)" : "(not finished)"}</span>
        </button>
      ))}
    </div>
  );
}
