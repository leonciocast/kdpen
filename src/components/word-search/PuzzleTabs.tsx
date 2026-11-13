"use client";
import React from "react";
import { PuzzleModel } from "./model";

export default function PuzzleTabs({ puzzles, active, onSelect }: { puzzles: PuzzleModel[]; active: number; onSelect: (i: number) => void }) {
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
