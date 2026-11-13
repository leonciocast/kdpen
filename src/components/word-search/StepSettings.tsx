"use client";
import React from "react";
import { BsSliders } from "react-icons/bs";
import Callout from "@/components/ui/Callout";
import InfoTip from "@/components/ui/InfoTip";
import { StepIntro } from "@/components/ui/Wizard";
import { DirectionOptions, MAX_GRID_SIZE, MIN_GRID_SIZE, gridForm } from "@/lib/wordsearch/engine";

interface Props {
  words: string[];
  gridSize: number;
  setGridSize: (n: number) => void;
  wordsPerPuzzle: number;
  setWordsPerPuzzle: (n: number) => void;
  dirOpts: DirectionOptions;
  setDirOpts: React.Dispatch<React.SetStateAction<DirectionOptions>>;
}

const PRESETS: { key: string; label: string; text: string; opts: DirectionOptions }[] = [
  { key: "easy", label: "Easy", text: "Across and down only", opts: { horizontal: true, vertical: true, diagonalDown: false, diagonalUp: false, reversed: false } },
  { key: "medium", label: "Medium", text: "Adds diagonals", opts: { horizontal: true, vertical: true, diagonalDown: true, diagonalUp: true, reversed: false } },
  { key: "hard", label: "Hard", text: "All 8 directions, incl. backwards", opts: { horizontal: true, vertical: true, diagonalDown: true, diagonalUp: true, reversed: true } },
];

const TOGGLES: { key: keyof DirectionOptions; label: string; arrows: string }[] = [
  { key: "horizontal", label: "Across", arrows: "→" },
  { key: "vertical", label: "Down", arrows: "↓" },
  { key: "diagonalDown", label: "Diagonal down", arrows: "↘" },
  { key: "diagonalUp", label: "Diagonal up", arrows: "↗" },
  { key: "reversed", label: "Backwards too", arrows: "← ↑ ↖ ↙" },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(v) ? v : lo)));

export default function StepSettings({ words, gridSize, setGridSize, wordsPerPuzzle, setWordsPerPuzzle, dirOpts, setDirOpts }: Props) {
  const tooLong = words.filter((w) => gridForm(w).length > gridSize);
  const longest = Math.max(0, ...words.map((w) => gridForm(w).length));
  const puzzles = Math.max(1, Math.ceil(words.length / wordsPerPuzzle));
  const activePreset = PRESETS.find((p) => JSON.stringify(p.opts) === JSON.stringify(dirOpts))?.key;
  const noDirs = !Object.entries(dirOpts).some(([k, v]) => k !== "reversed" && v);
  const letters = words.slice(0, wordsPerPuzzle).reduce((n, w) => n + gridForm(w).length, 0);
  const crowded = letters > gridSize * gridSize * 0.75;

  return (
    <div>
      <StepIntro icon={<BsSliders />} title="Puzzle settings">
        Choose the grid size, how many words go in each puzzle, and the difficulty.
      </StepIntro>
      <div className="row g-4">
        <div className="col-lg-6">
          <div className="pg-subtle p-3 h-100">
            <label className="form-label" htmlFor="gridSize">
              Grid size: <span className="text-primary">{gridSize} × {gridSize}</span>
              <InfoTip text="Bigger grids hold longer words and are harder to solve. 15×15 is a classic large-print size." />
            </label>
            <div className="d-flex align-items-center gap-3">
              <input id="gridSizeRange" type="range" className="form-range" min={MIN_GRID_SIZE} max={MAX_GRID_SIZE} value={gridSize} onChange={(e) => setGridSize(Number(e.target.value))} aria-label="Grid size slider" />
              <input id="gridSize" type="number" className="form-control" style={{ width: 84 }} min={MIN_GRID_SIZE} max={MAX_GRID_SIZE} value={gridSize} onChange={(e) => setGridSize(clamp(Number(e.target.value), MIN_GRID_SIZE, MAX_GRID_SIZE))} />
            </div>
            <div className="form-text">
              {MIN_GRID_SIZE} to {MAX_GRID_SIZE}. Your longest entry has {longest} letters.
            </div>

            <label className="form-label mt-3" htmlFor="wordsPerPuzzle">
              Words per puzzle
              <InfoTip text="Your list is split into puzzles of this many words. 10–15 works well for a 15×15 grid." />
            </label>
            <input id="wordsPerPuzzle" type="number" className="form-control" style={{ maxWidth: 140 }} min={1} max={60} value={wordsPerPuzzle} onChange={(e) => setWordsPerPuzzle(clamp(Number(e.target.value), 1, 60))} />
            <div className="mt-3">
              <span className="pg-badge info">
                {words.length} entries → {puzzles} puzzle{puzzles === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="form-label">
            Difficulty <span className="text-muted fw-normal">(directions for automatic placement)</span>
          </div>
          <div className="row g-2 mb-3" role="radiogroup" aria-label="Difficulty presets">
            {PRESETS.map((p) => (
              <div className="col-4" key={p.key}>
                <button type="button" role="radio" aria-checked={activePreset === p.key} className={`pg-option-card text-center ${activePreset === p.key ? "active" : ""}`} onClick={() => setDirOpts(p.opts)}>
                  <h3 className="mt-0">{p.label}</h3>
                  <p className="small">{p.text}</p>
                </button>
              </div>
            ))}
          </div>
          <div className="pg-subtle p-3">
            <div className="small fw-semibold mb-2">Or choose exact directions:</div>
            <div className="row g-1">
              {TOGGLES.map((t) => (
                <div className="col-sm-6" key={t.key}>
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" id={`dir-${t.key}`} checked={dirOpts[t.key]} onChange={() => setDirOpts((d) => ({ ...d, [t.key]: !d[t.key] }))} />
                    <label className="form-check-label" htmlFor={`dir-${t.key}`}>
                      <span className="me-1 text-primary fw-bold">{t.arrows}</span> {t.label}
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="form-text">These only affect automatic placement. When you place words yourself (next step) you can use any direction.</div>
        </div>
      </div>
      <div className="mt-3 d-grid gap-2">
        {noDirs && <Callout tone="warn">Pick at least one direction so words can be placed automatically.</Callout>}
        {tooLong.length > 0 && (
          <Callout tone="warn">
            {tooLong.length === 1 ? "This entry is" : "These entries are"} longer than {gridSize} letters and won&apos;t fit: <b>{tooLong.join(", ")}</b>. Make the grid at least {longest}×{longest}, or remove {tooLong.length === 1 ? "it" : "them"} in step 1.
          </Callout>
        )}
        {crowded && !tooLong.length && <Callout tone="warn">That&apos;s a lot of letters for a {gridSize}×{gridSize} grid. Some words may not fit; try a bigger grid or fewer words per puzzle.</Callout>}
      </div>
    </div>
  );
}
