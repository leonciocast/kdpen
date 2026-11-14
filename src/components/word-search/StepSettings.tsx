"use client";
import React, { useMemo } from "react";
import { BsBook, BsEmojiSmile, BsFire, BsLightningCharge, BsSpeedometer2 } from "react-icons/bs";
import { Panel } from "@/components/ui/Panel";
import { ChoiceCards, FlowCtl, Question, QuestionFlow } from "@/components/ui/Flow";
import Callout from "@/components/ui/Callout";
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
  flow: FlowCtl;
}

export default function StepSettings({ settings, setSettings, specs, wordCount, themeCount, flow }: Props) {
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
  const resetDirs = () => set({ dirOpts: dirOptsFor(settings.difficulty) });

  const summary = (
    <Panel tone="summary" title="Your book so far" icon={<BsBook />} testId="split-stats" className="mt-4">
      <div className="pg-summary-row">
        <div>
          <span>Words</span>
          <b>{wordCount.toLocaleString()}</b>
        </div>
        <div>
          <span>Puzzles</span>
          <b>{specs.length.toLocaleString()}</b>
        </div>
        {specs.length > 0 && (
          <div>
            <span>Grid</span>
            <b>{stats.min === stats.max ? `${stats.min}×${stats.min}` : `${stats.min}–${stats.max}`}</b>
          </div>
        )}
        <div>
          <span>Difficulty</span>
          <b>{p.label}</b>
        </div>
      </div>
      <span className="visually-hidden">
        {wordCount.toLocaleString()} words → {plural(specs.length, "puzzle")}
      </span>
    </Panel>
  );

  const ICONS: Record<string, React.ReactNode> = { easy: <BsEmojiSmile />, medium: <BsSpeedometer2 />, hard: <BsLightningCharge />, expert: <BsFire /> };

  const difficulty: Question = {
    key: "difficulty",
    title: "How hard should the puzzles be?",
    lead: "This sets the directions, grid size, overlaps and filler letters for the whole book.",
    wide: true,
    hint: `${p.label} selected`,
    body: (
      <ChoiceCards
        label="Difficulty"
        cols={4}
        value={settings.difficulty}
        onPick={(d) => {
          set({ difficulty: d, dirOpts: dirOptsFor(d) });
          flow.setSub("size");
        }}
        options={WS_DIFFICULTIES.map((d) => ({ value: d.id, title: d.label, text: d.description, icon: ICONS[d.id], testId: `difficulty-${d.id}`, badge: d.id === "medium" ? "Popular" : undefined, cta: "Choose" }))}
      />
    ),
  };

  const size: Question = {
    key: "size",
    title: "How many words in each puzzle?",
    lead: `Your list is split into puzzles of up to this many words. 20–36 fills a page nicely (max ${LIMITS.maxWordsPerPuzzle}).`,
    canNext: settings.wordsPerPuzzle > 0,
    body: (
      <>
        <div className="d-flex align-items-center gap-3" style={{ maxWidth: 560 }}>
          <input type="range" className="form-range" min={4} max={LIMITS.maxWordsPerPuzzle} value={settings.wordsPerPuzzle} onChange={(e) => set({ wordsPerPuzzle: Number(e.target.value) })} aria-label="Words per puzzle slider" />
          <input id="wordsPerPuzzle" type="number" className="form-control pg-q-big-number" min={1} max={LIMITS.maxWordsPerPuzzle} value={settings.wordsPerPuzzle} onChange={(e) => set({ wordsPerPuzzle: clamp(Number(e.target.value), 1, LIMITS.maxWordsPerPuzzle) })} aria-label="Words per puzzle" autoFocus />
        </div>
        <div className="mt-4">
          <div className="fw-bold mb-2">Grid size</div>
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
        </div>
        <div className="mt-3 d-grid gap-2">
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
        {summary}
      </>
    ),
  };

  const rules: Question = {
    key: "rules",
    title: "Any special rules for the directions?",
    optional: true,
    lead: `The ${p.label.toLowerCase()} difficulty already picked the directions for you. Change them only if you want something special.`,
    canNext: !noDirs,
    blockedHint: "Pick at least one direction",
    nextLabel: "Place words",
    skipLabel: "Skip, use recommended",
    onSkip: () => {
      if (custom) resetDirs();
    },
    body: (
      <>
        <div className="small fw-semibold mb-2">
          Directions {custom ? <span className="pg-badge warn ms-1">custom</span> : <span className="text-muted fw-normal">(set by the difficulty)</span>}
          {custom && (
            <button type="button" className="pg-link-btn ms-2" onClick={resetDirs}>
              Reset
            </button>
          )}
        </div>
        <div className="row g-2">
          {TOGGLES.map((t) => (
            <div className="col-sm-6" key={t.key}>
              <label className={`pg-check-card ${dirOpts[t.key] ? "on" : ""}`} htmlFor={`dir-${t.key}`}>
                <input className="form-check-input m-0" type="checkbox" id={`dir-${t.key}`} checked={dirOpts[t.key]} onChange={() => set({ dirOpts: { ...dirOpts, [t.key]: !dirOpts[t.key] } })} />
                <span className="text-primary fw-bold">{t.arrows}</span> {t.label}
              </label>
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
        {noDirs && (
          <Callout tone="warn" className="mt-3">
            Pick at least one direction so words can be placed automatically.
          </Callout>
        )}
      </>
    ),
  };

  return <QuestionFlow questions={[difficulty, size, rules]} flow={flow} />;
}
