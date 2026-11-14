"use client";
import React, { useMemo } from "react";
import { BsSliders } from "react-icons/bs";
import Callout from "@/components/ui/Callout";
import InfoTip from "@/components/ui/InfoTip";
import { StepIntro } from "@/components/ui/Wizard";
import { DirectionOptions, gridForm } from "@/lib/wordsearch/engine";
import { WS_DIFFICULTIES, WsDifficulty, presetFor } from "@/lib/wordsearch/difficulty";
import { PuzzleSpec } from "@/lib/wordsearch/bulk";
import { LIMITS } from "@/lib/limits";
import { plural } from "@/lib/plural";

export interface WsSettings {
  difficulty: WsDifficulty;
  dirOpts: DirectionOptions;
  wordsPerPuzzle: number;
  sizeMode: "auto" | "fixed";
  gridSize: number;
  groupByTheme: boolean;
}

export function dirOptsFor(d: WsDifficulty): DirectionOptions {
  const dirs = presetFor(d).dirs;
  return { horizontal: dirs.includes("E"), vertical: dirs.includes("S"), diagonalDown: dirs.includes("SE"), diagonalUp: dirs.includes("NE"), reversed: dirs.includes("W") };
}

const TOGGLES: { key: keyof DirectionOptions; label: string; arrows: string }[] = [
  { key: "horizontal", label: "Across", arrows: "→" },
  { key: "vertical", label: "Down", arrows: "↓" },
  { key: "diagonalDown", label: "Diagonal down", arrows: "↘" },
  { key: "diagonalUp", label: "Diagonal up", arrows: "↗" },
  { key: "reversed", label: "Backwards too", arrows: "← ↑ ↖ ↙" },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(v) ? v : lo)));

interface Props {
  settings: WsSettings;
  setSettings: (s: WsSettings) => void;
  specs: PuzzleSpec[];
  wordCount: number;
  themeCount: number;
}

export default function StepSettings({ settings, setSettings, specs, wordCount, themeCount }: Props) {
  const set = (patch: Partial<WsSettings>) => setSettings({ ...settings, ...patch });
  const { dirOpts } = settings;
  const custom = JSON.stringify(dirOpts) !== JSON.stringify(dirOptsFor(settings.difficulty));
  const noDirs = !Object.entries(dirOpts).some(([k, v]) => k !== "reversed" && v);
  const stats = useMemo(() => {
    const sizes = specs.map((s) => s.size);
    const longest = Math.max(0, ...specs.flatMap((s) => s.words.map((w) => gridForm(w).length)));
    const crowded = specs.filter((s) => s.words.reduce((n, w) => n + gridForm(w).length, 0) > s.size * s.size * 0.78).length;
    return { min: Math.min(...sizes), max: Math.max(...sizes), longest, crowded };
  }, [specs]);

  return (
    <div>
      <StepIntro icon={<BsSliders />} title="Puzzle settings">
        Pick a difficulty for the whole book, how many words go in each puzzle, and the grid size. Your list is split into puzzles automatically.
      </StepIntro>
      <div className="form-label">Difficulty</div>
      <div className="row g-2 mb-3" role="radiogroup" aria-label="Difficulty presets">
        {WS_DIFFICULTIES.map((p) => (
          <div className="col-6 col-md-3" key={p.id}>
            <button
              type="button"
              role="radio"
              aria-checked={settings.difficulty === p.id}
              className={`pg-option-card text-center h-100 ${settings.difficulty === p.id ? "active" : ""}`}
              onClick={() => set({ difficulty: p.id, dirOpts: dirOptsFor(p.id) })}
              data-testid={`difficulty-${p.id}`}
            >
              <h3 className="mt-0">{p.label}</h3>
              <p className="small">{p.description}</p>
            </button>
          </div>
        ))}
      </div>
      <div className="row g-4">
        <div className="col-lg-6">
          <div className="pg-subtle p-3 h-100">
            <label className="form-label" htmlFor="wordsPerPuzzle">
              Words per puzzle
              <InfoTip text={`Your list is split into puzzles of up to this many words (max ${LIMITS.maxWordsPerPuzzle}), with balanced sizes so no puzzle is left nearly empty. 20–36 suits a full page.`} />
            </label>
            <div className="d-flex align-items-center gap-3">
              <input type="range" className="form-range" min={4} max={LIMITS.maxWordsPerPuzzle} value={settings.wordsPerPuzzle} onChange={(e) => set({ wordsPerPuzzle: Number(e.target.value) })} aria-label="Words per puzzle slider" />
              <input id="wordsPerPuzzle" type="number" className="form-control" style={{ width: 84 }} min={1} max={LIMITS.maxWordsPerPuzzle} value={settings.wordsPerPuzzle} onChange={(e) => set({ wordsPerPuzzle: clamp(Number(e.target.value), 1, LIMITS.maxWordsPerPuzzle) })} />
            </div>

            <div className="form-label mt-3">Grid size</div>
            <div className="pg-seg mb-2" role="radiogroup" aria-label="Grid size mode">
              <button type="button" role="radio" aria-checked={settings.sizeMode === "auto"} className={settings.sizeMode === "auto" ? "active" : ""} onClick={() => set({ sizeMode: "auto" })}>
                Automatic (recommended)
              </button>
              <button type="button" role="radio" aria-checked={settings.sizeMode === "fixed"} className={settings.sizeMode === "fixed" ? "active" : ""} onClick={() => set({ sizeMode: "fixed" })}>
                Same size for all
              </button>
            </div>
            {settings.sizeMode === "fixed" ? (
              <div className="d-flex align-items-center gap-3">
                <input id="gridSizeRange" type="range" className="form-range" min={LIMITS.minGridSize} max={LIMITS.maxGridSize} value={settings.gridSize} onChange={(e) => set({ gridSize: Number(e.target.value) })} aria-label="Grid size slider" />
                <input id="gridSize" type="number" className="form-control" style={{ width: 84 }} min={LIMITS.minGridSize} max={LIMITS.maxGridSize} value={settings.gridSize} onChange={(e) => set({ gridSize: clamp(Number(e.target.value), LIMITS.minGridSize, LIMITS.maxGridSize) })} aria-label="Grid size" />
              </div>
            ) : (
              <div className="form-text">Each puzzle gets the right size for its words and the difficulty. A grid grows by one if a word doesn&apos;t fit, so no word is ever dropped silently.</div>
            )}
            {themeCount > 0 && (
              <div className="form-check form-switch mt-3">
                <input className="form-check-input" type="checkbox" id="groupByTheme" checked={settings.groupByTheme} onChange={(e) => set({ groupByTheme: e.target.checked })} />
                <label className="form-check-label" htmlFor="groupByTheme">
                  Group words by theme ({themeCount} themes) and use the theme as the puzzle title
                </label>
              </div>
            )}
            <div className="mt-3 d-flex flex-wrap gap-2" data-testid="split-stats">
              <span className="pg-badge info">
                {wordCount.toLocaleString()} words → {plural(specs.length, "puzzle")}
              </span>
              {specs.length > 0 && (
                <span className="pg-badge neutral">
                  grid {stats.min === stats.max ? `${stats.min}×${stats.min}` : `${stats.min}–${stats.max}`}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="pg-subtle p-3">
            <div className="small fw-semibold mb-2">
              Directions {custom ? <span className="pg-badge warn ms-1">custom</span> : <span className="text-muted fw-normal">(set by the difficulty; adjust if you like)</span>}
            </div>
            <div className="row g-1">
              {TOGGLES.map((t) => (
                <div className="col-sm-6" key={t.key}>
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" id={`dir-${t.key}`} checked={dirOpts[t.key]} onChange={() => set({ dirOpts: { ...dirOpts, [t.key]: !dirOpts[t.key] } })} />
                    <label className="form-check-label" htmlFor={`dir-${t.key}`}>
                      <span className="me-1 text-primary fw-bold">{t.arrows}</span> {t.label}
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <div className="form-text">These affect automatic placement. When you place words yourself (next step) you can use any direction.</div>
            <ul className="small text-muted mt-2 mb-0 ps-3">
              <li>Overlapping letters: {presetFor(settings.difficulty).overlapWeight > 0.4 ? "many" : presetFor(settings.difficulty).overlapWeight > 0 ? "some" : "few"}</li>
              <li>Filler letters: {presetFor(settings.difficulty).decoys === "none" ? "random" : presetFor(settings.difficulty).decoys === "letters" ? "look-alike letters from your words" : "decoy word fragments"}</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="mt-3 d-grid gap-2">
        {noDirs && <Callout tone="warn">Pick at least one direction so words can be placed automatically.</Callout>}
        {settings.sizeMode === "fixed" && stats.longest > settings.gridSize && (
          <Callout tone="warn">
            Your longest word has {stats.longest} letters, so grids holding it will be made {stats.longest}×{stats.longest}.
          </Callout>
        )}
        {settings.sizeMode === "fixed" && stats.crowded > 0 && (
          <Callout tone="warn">
            {plural(stats.crowded, "puzzle")} {stats.crowded === 1 ? "is" : "are"} very full for a {settings.gridSize}×{settings.gridSize} grid. Those grids will grow a little if needed; or choose Automatic.
          </Callout>
        )}
      </div>
    </div>
  );
}
