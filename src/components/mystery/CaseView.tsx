"use client";
import React, { useMemo } from "react";
import type { MysteryCase } from "@/lib/mystery/types";
import { keyInstruction } from "@/lib/mystery/model";
import { BLANK } from "@/lib/mystery/engine";

const DIR: Record<string, [number, number]> = { E: [0, 1], W: [0, -1], S: [1, 0], N: [-1, 0], SE: [1, 1], NW: [-1, -1], NE: [-1, 1], SW: [1, -1] };

function cellsOf(p: { letters: string; row: number; col: number; dir: string }): string[] {
  const [dr, dc] = DIR[p.dir] ?? [0, 1];
  return Array.from(p.letters, (_, i) => `${p.row + dr * i},${p.col + dc * i}`);
}

/** A case file on screen: brief, suspects, grid and evidence (optionally solved). */
export default function CaseView({ c, solved }: { c: MysteryCase; solved: boolean }) {
  const { word, extra, message } = useMemo(() => {
    const word = new Set(c.placements.flatMap(cellsOf));
    const extra = new Set(c.extra ? cellsOf(c.extra) : []);
    const message = new Set(c.messageCells.map(([r, k]) => `${r},${k}`));
    return { word, extra, message };
  }, [c]);
  // Crop shaped grids to their used rows / columns.
  const rows = c.grid.map((row, r) => ({ r, row })).filter(({ row }) => row.some((v) => v));
  const cols = c.grid[0].map((_, k) => k).filter((k) => c.grid.some((row) => row[k]));
  return (
    <div className="pg-case" data-testid="my-case-view">
      <div className="pg-case-head">
        <span className="pg-case-num">Case {c.number}</span>
        <h3 className="pg-case-title">{c.title}</h3>
        {c.templated && <span className="pg-case-tag">Templated</span>}
      </div>
      <p className="pg-case-story">{c.story}</p>
      {c.suspects.length > 0 && (
        <div className="pg-case-suspects">
          {c.suspects.map((p) => (
            <div key={p.name} className={`pg-suspect ${solved && c.culprit === p ? "culprit" : ""}`}>
              <div className="pg-suspect-name">{p.name}</div>
              {p.role && <div className="pg-suspect-role">{p.role}</div>}
              <div className="pg-suspect-traits">{p.traits.join(" · ")}</div>
            </div>
          ))}
        </div>
      )}
      <div className="pg-case-body">
        <div className="pg-case-grid" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)` }} aria-label={`Letter grid, ${c.size} by ${c.size}`}>
          {rows.map(({ r, row }) =>
            cols.map((k) => {
              const v = row[k];
              const key = `${r},${k}`;
              const cls = !v ? "off" : v === BLANK ? "blank" : solved ? (extra.has(key) ? "extra" : word.has(key) ? "word" : message.has(key) ? "msg" : "") : "";
              return (
                <span key={key} className={`pg-cg-cell ${cls}`}>
                  {v === BLANK ? "·" : v}
                </span>
              );
            }),
          )}
        </div>
        <div className="pg-case-side">
          <div className="pg-case-label">Evidence</div>
          <ul className="pg-case-words">
            {c.words.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          {c.missing && (
            <>
              <div className="pg-case-label">Missing evidence</div>
              <p className="pg-case-clue">
                {c.missing.clue} ({c.missing.word.replace(/[^A-ZÑ]/g, "").length} letters){solved && <strong> {c.missing.word}</strong>}
              </p>
            </>
          )}
          {c.message && solved && (
            <>
              <div className="pg-case-label">Hidden message</div>
              <p className="pg-case-msg" data-testid="my-case-message">
                {c.message}
              </p>
            </>
          )}
          {solved && c.culprit && (
            <p className="pg-case-answer">
              Culprit: <strong>{c.culprit.name}</strong>
            </p>
          )}
          {c.key && (
            <p className="pg-case-key">
              <span className="pg-keybox">{c.key.box}</span> {keyInstruction(c.key)}
              {solved && <strong> = {c.key.letter}</strong>}
            </p>
          )}
        </div>
      </div>
      {c.lead && <p className="pg-case-lead">Next lead: {c.lead}</p>}
    </div>
  );
}
