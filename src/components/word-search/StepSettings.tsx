"use client";
import React, { useMemo } from "react";
import { BsBook, BsSliders } from "react-icons/bs";
import { Panel, SubStep } from "@/components/ui/Panel";
import Callout from "@/components/ui/Callout";
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

  const p = presetFor(settings.difficulty);
  return (
    <div>
      <StepIntro icon={<BsSliders />} title="Puzzle settings">
        Three quick choices. The recommended values already work well, so you can also just press Next.
      </StepIntro>
      <div className="row g-4">
        <div className="col-lg-8">
          <Panel tone="action" title="Set up your puzzles" icon={<BsSliders />}>
            <SubStep n={1} title="Choose a difficulty" hint="Applies to the whole book: directions, grid size, overlaps and filler letters.">
              <div className="row g-2" role="radiogroup" aria-label="Difficulty presets">
                {WS_DIFFICULTIES.map((d) => (
                  <div className="col-6 col-md-3" key={d.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={settings.difficulty === d.id}
                      className={`pg-option-card text-center h-100 ${settings.difficulty === d.id ? "active" : ""}`}
                      onClick={() => set({ difficulty: d.id, dirOpts: dirOptsFor(d.id) })}
                      data-testid={`difficulty-${d.id}`}
                    >
                      <h3 className="mt-0">{d.label}</h3>
                      <p className="small">{d.description}</p>
                    </button>
                  </div>
                ))}
              </div>
            </SubStep>
            <SubStep n={2} title="Words per puzzle" hint={`Your list is split into puzzles of up to this many words (max ${LIMITS.maxWordsPerPuzzle}). 20–36 fills a page nicely.`}>
              <div className="d-flex align-items-center gap-3" style={{ maxWidth: 460 }}>
                <input type="range" className="form-range" min={4} max={LIMITS.maxWordsPerPuzzle} value={settings.wordsPerPuzzle} onChange={(e) => set({ wordsPerPuzzle: Number(e.target.value) })} aria-label="Words per puzzle slider" />
                <input id="wordsPerPuzzle" type="number" className="form-control" style={{ width: 84 }} min={1} max={LIMITS.maxWordsPerPuzzle} value={settings.wordsPerPuzzle} onChange={(e) => set({ wordsPerPuzzle: clamp(Number(e.target.value), 1, LIMITS.maxWordsPerPuzzle) })} aria-label="Words per puzzle" />
              </div>
            </SubStep>
            <SubStep n={3} title="Grid size">
              <div className="pg-seg mb-2" role="radiogroup" aria-label="Grid size mode">
                <button type="button" role="radio" aria-checked={settings.sizeMode === "auto"} className={settings.sizeMode === "auto" ? "active" : ""} onClick={() => set({ sizeMode: "auto" })}>
                  Automatic (recommended)
                </button>
                <button type="button" role="radio" aria-checked={settings.sizeMode === "fixed"} className={settings.sizeMode === "fixed" ? "active" : ""} onClick={() => set({ sizeMode: "fixed" })}>
                  Same size for all
                </button>
              </div>
              {settings.sizeMode === "fixed" ? (
                <div className="d-flex align-items-center gap-3" style={{ maxWidth: 460 }}>
                  <input id="gridSizeRange" type="range" className="form-range" min={LIMITS.minGridSize} max={LIMITS.maxGridSize} value={settings.gridSize} onChange={(e) => set({ gridSize: Number(e.target.value) })} aria-label="Grid size slider" />
                  <input id="gridSize" type="number" className="form-control" style={{ width: 84 }} min={LIMITS.minGridSize} max={LIMITS.maxGridSize} value={settings.gridSize} onChange={(e) => set({ gridSize: clamp(Number(e.target.value), LIMITS.minGridSize, LIMITS.maxGridSize) })} aria-label="Grid size" />
                </div>
              ) : (
                <div className="form-text m-0">Each puzzle gets the right size for its words. A grid grows by one if a word doesn&apos;t fit, so no word is dropped.</div>
              )}
            </SubStep>
          </Panel>

          <details className="pg-panel pg-panel-options pg-more mt-3">
            <summary className="pg-panel-head">
              <span className="pg-num-badge quiet">4</span>
              <h3 className="pg-panel-title">
                More options <span className="pg-optional">optional</span>
              </h3>
              <span className="pg-more-toggle">Show</span>
            </summary>
            <div className="pg-panel-body">
              <div className="small fw-semibold mb-2">
                Directions {custom ? <span className="pg-badge warn ms-1">custom</span> : <span className="text-muted fw-normal">(set by the difficulty)</span>}
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
              <div className="form-text">These affect automatic placement. When you place words yourself you can use any direction.</div>
              {themeCount > 0 && (
                <div className="form-check form-switch mt-3">
                  <input className="form-check-input" type="checkbox" id="groupByTheme" checked={settings.groupByTheme} onChange={(e) => set({ groupByTheme: e.target.checked })} />
                  <label className="form-check-label" htmlFor="groupByTheme">
                    Group words by theme ({themeCount} {themeCount === 1 ? "theme" : "themes"}) and use the theme as the puzzle title
                  </label>
                </div>
              )}
            </div>
          </details>

          <div className="mt-3 d-grid gap-2">
            {noDirs && <Callout tone="warn">Pick at least one direction (More options) so words can be placed automatically.</Callout>}
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
        <div className="col-lg-4">
          <div className="position-sticky" style={{ top: 84 }}>
            <Panel tone="summary" title="Your book so far" icon={<BsBook />} testId="split-stats">
              <ul className="list-unstyled d-grid gap-2 mb-0 small">
                <li className="pg-stat">
                  <span className="text-muted">Words</span>
                  <b>{wordCount.toLocaleString()}</b>
                </li>
                <li className="pg-stat">
                  <span className="text-muted">Puzzles</span>
                  <b>{specs.length.toLocaleString()}</b>
                </li>
                {specs.length > 0 && (
                  <li className="pg-stat">
                    <span className="text-muted">Grid</span>
                    <b>{stats.min === stats.max ? `${stats.min}×${stats.min}` : `${stats.min}–${stats.max}`}</b>
                  </li>
                )}
                <li className="pg-stat">
                  <span className="text-muted">Difficulty</span>
                  <b>
                    {p.label}
                    {custom ? " (custom directions)" : ""}
                  </b>
                </li>
                <li className="pg-stat">
                  <span className="text-muted">Filler letters</span>
                  <b>{p.decoys === "none" ? "Random" : p.decoys === "letters" ? "Look-alike" : "Decoy fragments"}</b>
                </li>
              </ul>
              <span className="visually-hidden">
                {wordCount.toLocaleString()} words → {plural(specs.length, "puzzle")}
              </span>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
