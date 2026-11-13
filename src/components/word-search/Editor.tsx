"use client";
import React, { useEffect, useMemo, useState } from "react";
import { BsArrowsMove, BsEraser, BsGrid3X3, BsMagic, BsTrash } from "react-icons/bs";
import { toast } from "react-toastify";
import Callout from "@/components/ui/Callout";
import InfoTip from "@/components/ui/InfoTip";
import PuzzleGrid from "./PuzzleGrid";
import {
  Cell,
  DirectionKey,
  LetterGrid,
  Placement,
  autoPlace,
  buildLetterGrid,
  cellsOf,
  checkPlacement,
  containedWordWarnings,
  fillGrid,
  lineBetween,
  makePlacement,
  mulberry32,
  placementCells,
  randomSeed,
} from "@/lib/wordsearch/engine";
import { DIR_ARROWS, DIR_NAMES, DirMode, PuzzleModel, colorsFor } from "./model";

interface Props {
  puzzle: PuzzleModel;
  update: (fn: (p: PuzzleModel) => PuzzleModel) => void;
  autoDirs: DirectionKey[];
}

const PAD: (DirectionKey | "free")[] = ["NW", "N", "NE", "W", "free", "E", "SW", "S", "SE"];

export default function Editor({ puzzle, update, autoDirs }: Props) {
  // The editor is keyed by puzzle id, so this runs once per puzzle.
  const [selected, setSelected] = useState<string | null>(() => puzzle.words.find((w) => !puzzle.placements.some((p) => p.word === w)) ?? null);
  const [dirMode, setDirMode] = useState<DirMode>("E");
  const [pendingStart, setPendingStart] = useState<Cell | null>(null);
  const [hover, setHover] = useState<Cell | null>(null);

  const placed = useMemo(() => new Set(puzzle.placements.map((p) => p.word)), [puzzle.placements]);
  const remaining = puzzle.words.filter((w) => !placed.has(w));
  const filled = puzzle.grid !== null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPendingStart(null);
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const placing = selected !== null && !placed.has(selected);

  const candidate = (start: Cell, target: Cell | null): Placement | null => {
    if (!placing || !selected) return null;
    let dir: DirectionKey | null = null;
    if (dirMode !== "free") dir = dirMode;
    else if (target) dir = lineBetween(start, target)?.dir ?? null;
    return dir ? makePlacement(selected, start[0], start[1], dir) : null;
  };

  const preview = useMemo(() => {
    if (filled || !hover || !placing) return null;
    let cand: Placement | null = null;
    if (dirMode !== "free") cand = candidate(hover, null);
    else if (pendingStart) cand = candidate(pendingStart, hover);
    else return { cells: [hover], valid: true, cand: null as Placement | null };
    if (!cand) return { cells: [hover], valid: false, cand: null };
    const check = checkPlacement(puzzle.size, puzzle.placements, cand);
    return { cells: cellsOf(cand.row, cand.col, cand.dir, cand.letters.length), valid: check.ok, cand, message: check.message };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hover, placing, dirMode, pendingStart, puzzle, selected, filled]);

  const place = (cand: Placement) => {
    const check = checkPlacement(puzzle.size, puzzle.placements, cand);
    if (!check.ok) {
      toast.error(check.message ?? "That spot doesn't work.");
      return;
    }
    update((p) => ({ ...p, placements: [...p.placements, cand], grid: null, unplaced: p.unplaced.filter((w) => w !== cand.word) }));
    setSelected(puzzle.words.find((w) => w !== cand.word && !placed.has(w)) ?? null);
    setPendingStart(null);
  };

  const onCellClick = (r: number, c: number) => {
    if (filled) return;
    if (!placing) {
      const hits = puzzle.placements.filter((p) => placementCells(p).some(([pr, pc]) => pr === r && pc === c));
      if (hits.length) {
        const idx = hits.findIndex((h) => h.word === selected);
        setSelected(hits[(idx + 1) % hits.length].word);
      } else setSelected(null);
      return;
    }
    if (dirMode !== "free") {
      const cand = candidate([r, c], null);
      if (cand) place(cand);
      return;
    }
    if (!pendingStart) return setPendingStart([r, c]);
    if (pendingStart[0] === r && pendingStart[1] === c) return setPendingStart(null);
    const cand = candidate(pendingStart, [r, c]);
    if (!cand) {
      toast.info("Pick a square in a straight line from the first letter: across, down or diagonal.");
      return;
    }
    place(cand);
  };

  const removeWord = (word: string, move: boolean) => {
    update((p) => ({ ...p, placements: p.placements.filter((x) => x.word !== word), grid: null }));
    setSelected(move ? word : null);
    setPendingStart(null);
    if (move) toast.info(`Now click where "${word}" should start.`);
  };

  const autoRest = () => {
    if (!autoDirs.length) return toast.error("Choose at least one direction in step 2 first.");
    const res = autoPlace(puzzle.size, puzzle.placements, remaining, autoDirs, mulberry32(randomSeed()));
    update((p) => ({ ...p, placements: [...p.placements, ...res.placements], unplaced: res.unplaced, grid: null }));
    setSelected(null);
    if (res.unplaced.length) toast.warning(`Couldn't fit: ${res.unplaced.join(", ")}. Try moving a word, a bigger grid, or more directions.`, { autoClose: 7000 });
    else toast.success(`Placed ${res.placements.length} more word${res.placements.length === 1 ? "" : "s"}.`);
  };

  const fill = () => {
    if (!puzzle.placements.length) return toast.error("Place at least one word first.");
    const res = fillGrid(puzzle.size, puzzle.placements, mulberry32(randomSeed()));
    update((p) => ({ ...p, grid: res.grid, unplaced: remaining, warnings: [...containedWordWarnings(p.placements.map((x) => x.word)), ...res.warnings] }));
    setSelected(null);
    if (remaining.length) toast.warning(`Left out of this puzzle: ${remaining.join(", ")}.`, { autoClose: 6000 });
    else toast.success("Puzzle finished! Every word appears exactly once.");
  };

  // Letters to draw: placed words + ghost preview of the word being placed.
  let letters: LetterGrid = puzzle.grid ? puzzle.grid.map((r) => r.slice()) : buildLetterGrid(puzzle.size, puzzle.placements);
  if (!filled && preview?.cand) {
    letters = letters.map((r) => r.slice());
    placementCells(preview.cand).forEach(([r, c], i) => {
      if (r >= 0 && c >= 0 && r < puzzle.size && c < puzzle.size && letters[r][c] === null) letters[r][c] = preview.cand!.letters[i];
    });
  }

  const instruction = filled
    ? "This puzzle is finished. To move words, clear the random letters first."
    : !selected
      ? remaining.length
        ? "Pick a word on the right, or click a placed word to move or remove it."
        : "All words are placed. Fill the empty squares to finish."
      : !placing
        ? `“${selected}” is selected. Move it or remove it with the buttons on the right.`
        : dirMode === "free"
          ? pendingStart
            ? `Now click any square in the direction “${selected}” should go.`
            : `Click the square for the first letter of “${selected}”.`
          : `Click the square for the first letter of “${selected}”. It will run ${DIR_NAMES[dirMode].toLowerCase()}.`;

  return (
    <div className="row g-4">
      <div className="col-lg-7 col-xl-8">
        <div className={`small mb-2 fw-semibold ${placing ? "text-primary" : "text-muted"}`} aria-live="polite" data-testid="editor-instruction">
          {instruction}
        </div>
        <div className="pg-grid-wrap">
          <PuzzleGrid
            id="active-grid"
            size={puzzle.size}
            letters={letters}
            placements={puzzle.placements}
            colors={colorsFor(puzzle)}
            solution="color"
            emphasizePlaced={!filled}
            preview={filled ? null : preview}
            pendingStart={filled ? null : pendingStart}
            selectedWord={selected}
            onCellClick={filled ? undefined : onCellClick}
            onCellHover={filled ? undefined : setHover}
          />
        </div>
        {preview && !preview.valid && preview.message && <div className="small text-danger mt-1">{preview.message}</div>}
      </div>

      <div className="col-lg-5 col-xl-4">
        {filled ? (
          <div className="pg-subtle p-3">
            <Callout tone="ok">Finished: {puzzle.placements.length} words hidden.</Callout>
            <div className="d-grid gap-2 mt-3">
              <button type="button" className="btn btn-outline-primary" onClick={() => update((p) => ({ ...p, grid: null }))}>
                <BsEraser /> Clear random letters to edit
              </button>
              <button type="button" className="btn btn-light" onClick={fill}>
                <BsMagic /> Shuffle random letters
              </button>
            </div>
          </div>
        ) : (
          <div className="pg-subtle p-3">
            <div className="form-label mb-1">1. Choose a word</div>
            <div className="d-flex flex-wrap gap-1 mb-3" style={{ maxHeight: 200, overflowY: "auto" }}>
              {puzzle.words.map((w) => (
                <button key={w} type="button" data-word={w} className={`pg-chip ${selected === w ? "selected" : placed.has(w) ? "placed" : ""}`} onClick={() => { setSelected(w); setPendingStart(null); }} aria-pressed={selected === w}>
                  {placed.has(w) && "✓ "}
                  {w}
                </button>
              ))}
            </div>

            {placing ? (
              <>
                <div className="form-label mb-1">
                  2. Choose a direction <InfoTip text="Any of the 8 directions works here. The center button lets you click the first letter, then any square toward the last letter." />
                </div>
                <div className="d-flex gap-3 align-items-center mb-2">
                  <div className="pg-dirpad" role="radiogroup" aria-label="Direction">
                    {PAD.map((k) => (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={dirMode === k}
                        aria-label={k === "free" ? "Free: click start then end" : DIR_NAMES[k]}
                        title={k === "free" ? "Click first letter, then last letter" : DIR_NAMES[k]}
                        className={`${dirMode === k ? "active" : ""} ${k === "free" ? "center" : ""}`}
                        data-dir={k}
                        onClick={() => {
                          setDirMode(k);
                          setPendingStart(null);
                        }}
                      >
                        {k === "free" ? "Start → end" : DIR_ARROWS[k]}
                      </button>
                    ))}
                  </div>
                  <div className="small text-muted">
                    <div className="fw-semibold text-body">{dirMode === "free" ? "Start → end" : DIR_NAMES[dirMode]}</div>
                    {dirMode === "free" ? "Click the first letter, then a square toward the last." : `Then click the first letter's square.`}
                    <div className="mt-1">
                      <span className="pg-kbd">Esc</span> cancels
                    </div>
                  </div>
                </div>
                <div className="form-label mb-1">3. Click the grid</div>
                <div className="small text-muted mb-3">Green shows where it will go. Red means it doesn&apos;t fit or a letter clashes. Words may share matching letters.</div>
              </>
            ) : selected ? (
              <div className="d-flex gap-2 mb-3">
                <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => removeWord(selected, true)}>
                  <BsArrowsMove /> Move “{selected}”
                </button>
                <button type="button" className="btn btn-light btn-sm text-danger" onClick={() => removeWord(selected, false)}>
                  <BsTrash /> Remove
                </button>
              </div>
            ) : null}

            <div className="pg-divider my-3" />
            <div className="d-grid gap-2">
              <button type="button" className="btn btn-outline-primary" onClick={autoRest} disabled={!remaining.length}>
                <BsMagic /> Auto-place {remaining.length ? `the other ${remaining.length}` : "remaining"}
              </button>
              <button type="button" className="btn btn-primary" onClick={fill} disabled={!puzzle.placements.length} data-testid="fill-letters">
                <BsGrid3X3 /> Fill empty squares &amp; finish
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  update((p) => ({ ...p, placements: [], grid: null, unplaced: [] }));
                  setSelected(puzzle.words[0] ?? null);
                }}
                disabled={!puzzle.placements.length}
              >
                <BsEraser /> Clear all placements
              </button>
            </div>
            <div className="form-text mt-2">
              Auto-place uses the directions from step 2 ({autoDirs.map((d) => DIR_ARROWS[d]).join(" ") || "none selected"}).
            </div>
          </div>
        )}
        {puzzle.unplaced.length > 0 && (
          <Callout tone="warn" className="mt-3">
            Not in this puzzle: <b>{puzzle.unplaced.join(", ")}</b>
          </Callout>
        )}
        {puzzle.warnings.map((w) => (
          <Callout key={w} className="mt-2">
            {w}
          </Callout>
        ))}
      </div>
    </div>
  );
}
