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

/** Letter blanks grouped by word, like the printed page. */
function Blanks({ text, fill }: { text: string; fill?: boolean }) {
  const words = text.toUpperCase().split(/\s+/).map((w) => w.replace(/[^A-ZÑ]/g, "")).filter(Boolean);
  return (
    <span className="pg-blanks" aria-label={fill ? text : `${words.map((w) => w.length).join(", ")} letters`}>
      {words.map((w, i) => (
        <span key={i} className="pg-blank-word">
          {Array.from(w, (ch, k) => (
            <span key={k} className="pg-blank">
              {fill ? ch : ""}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}

/** A case file on screen, matching the printed casebook page: title, story, suspects, the grid, evidence and detective notes. */
export default function CaseView({ c, solved }: { c: MysteryCase; solved: boolean }) {
  const { word, extra, message } = useMemo(() => {
    const word = new Set(c.placements.flatMap(cellsOf));
    const extra = new Set(c.extra ? cellsOf(c.extra) : []);
    const message = new Set(c.messageCells.map(([r, k]) => `${r},${k}`));
    return { word, extra, message };
  }, [c]);
  // Crop shaped grids to their used rows / columns; the tiles draw the shape.
  const rows = c.grid.map((row, r) => ({ r, row })).filter(({ row }) => row.some((v) => v));
  const cols = c.grid[0].map((_, k) => k).filter((k) => c.grid.some((row) => row[k]));
  const words = [...c.words].sort((a, b) => a.localeCompare(b));
  return (
    <article className="pg-case" data-testid="my-case-view">
      <header className="pg-case-head">
        <div className="pg-case-kicker">
          Case file · No. {String(c.number).padStart(2, "0")}
          {c.templated && <span className="pg-case-tag">Templated</span>}
        </div>
        <h3 className="pg-case-title">{c.title}</h3>
      </header>
      <p className="pg-case-story">{c.story}</p>
      {c.suspects.length > 0 && (
        <section aria-label="Suspects">
          <div className="pg-case-label muted">Suspects</div>
          <div className="pg-case-suspects" style={{ gridTemplateColumns: `repeat(${c.suspects.length}, minmax(0, 1fr))` }}>
            {c.suspects.map((p) => (
              <div key={p.name} className={`pg-suspect ${solved && c.culprit === p ? "culprit" : ""}`}>
                <div className="pg-suspect-name">{p.name}</div>
                {p.role && <div className="pg-suspect-role">{p.role}</div>}
                <ul className="pg-suspect-traits">
                  {p.traits.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="pg-case-puzzle">
        <div className="pg-case-grid" style={{ "--cols": cols.length, "--rows": rows.length } as React.CSSProperties} aria-label={`Letter grid, ${rows.length} rows by ${cols.length} columns`}>
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
      </div>
      <div className="pg-case-foot">
        <section className="pg-case-evidence" aria-label="Evidence">
          <div className="pg-case-label">Evidence</div>
          <ul className="pg-case-words">
            {words.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
        <section className="pg-case-notes" aria-label="Detective notes">
          <div className="pg-case-label">Detective notes</div>
          {c.missing && (
            <div className="pg-note">
              <div className="pg-note-title">Missing evidence</div>
              <p className="pg-note-text">
                {c.missing.clue} ({c.missing.word.replace(/[^A-ZÑ]/g, "").length} letters)
              </p>
              <Blanks text={c.missing.word} fill={solved} />
            </div>
          )}
          {c.message && (
            <div className="pg-note">
              <div className="pg-note-title">Hidden message</div>
              {solved ? (
                <p className="pg-case-msg" data-testid="my-case-message">
                  {c.message}
                </p>
              ) : (
                <Blanks text={c.message} />
              )}
            </div>
          )}
          {c.culprit && (
            <div className="pg-note pg-note-line">
              <span className="pg-note-title">Culprit</span>
              <span className="pg-note-fill">{solved ? c.culprit.name : ""}</span>
            </div>
          )}
          {c.key && (
            <div className="pg-note pg-note-key">
              <span className="pg-keybox">
                <span>{c.key.box}</span>
                {solved && <strong>{c.key.letter}</strong>}
              </span>
              <span>
                <span className="pg-note-title">Case Board · box {c.key.box}</span>
                <span className="pg-note-text">{keyInstruction(c.key)}</span>
              </span>
            </div>
          )}
        </section>
      </div>
      {c.lead && (
        <footer className="pg-case-lead">
          <span className="pg-case-label">Next lead</span> {c.lead}
        </footer>
      )}
    </article>
  );
}
