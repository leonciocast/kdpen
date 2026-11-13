"use client";
import React from "react";
import { Cell, LetterGrid, Placement, placementCells } from "@/lib/wordsearch/engine";
import { placementCapsule, pointsToSvgPath } from "@/lib/wordsearch/geometry";

export type SolutionStyle = "hidden" | "color" | "bw";

export interface PuzzleGridProps {
  size: number;
  letters: LetterGrid;
  placements: Placement[];
  colors?: Record<string, string>;
  solution: SolutionStyle;
  /** Placed-word letters are bold and dark in the editor before the grid is filled. */
  emphasizePlaced?: boolean;
  preview?: { cells: Cell[]; valid: boolean } | null;
  pendingStart?: Cell | null;
  selectedWord?: string | null;
  onCellClick?: (row: number, col: number) => void;
  onCellHover?: (cell: Cell | null) => void;
  maxWidth?: number;
  id?: string;
}

const CELL = 32;

const PuzzleGrid: React.FC<PuzzleGridProps> = ({
  size,
  letters,
  placements,
  colors = {},
  solution,
  emphasizePlaced = false,
  preview,
  pendingStart,
  selectedWord,
  onCellClick,
  onCellHover,
  maxWidth = 640,
  id,
}) => {
  const pad = 6;
  const side = size * CELL;
  const interactive = Boolean(onCellClick);
  const previewKeys = new Set((preview?.cells ?? []).map(([r, c]) => `${r},${c}`));
  const placedKeys = new Set<string>();
  if (emphasizePlaced || solution !== "hidden") {
    for (const p of placements) {
      for (const [r, c] of placementCells(p)) placedKeys.add(`${r},${c}`);
    }
  }

  return (
    <svg
      id={id}
      viewBox={`${-pad - 2} ${-pad - 2} ${side + pad * 2 + 4} ${side + pad * 2 + 4}`}
      style={{ width: "100%", maxWidth, userSelect: "none", touchAction: "manipulation" }}
      role="grid"
      aria-label="Word search grid"
      onMouseLeave={() => onCellHover?.(null)}
    >
      <rect x={-pad} y={-pad} width={side + pad * 2} height={side + pad * 2} fill="#fff" stroke="#000" strokeWidth={2.5} />

      {/* Solution capsules ("circled words") */}
      {solution !== "hidden" &&
        placements.map((p) => {
          const isSel = selectedWord === p.word;
          return (
            <path
              key={`cap-${p.word}`}
              d={pointsToSvgPath(placementCapsule(p, 0, 0, CELL, 0.42))}
              fill={solution === "color" ? colors[p.word] ?? "#ffe08a" : "#e4e4e4"}
              fillOpacity={solution === "color" ? 0.75 : 0.6}
              stroke={isSel ? "#0d6efd" : "#222"}
              strokeWidth={isSel ? 2.5 : 1.4}
            />
          );
        })}

      {/* Preview of where the selected word would go */}
      {preview &&
        preview.cells.map(([r, c]) =>
          r >= 0 && c >= 0 && r < size && c < size ? (
            <rect
              key={`pv-${r}-${c}`}
              x={c * CELL + 2}
              y={r * CELL + 2}
              width={CELL - 4}
              height={CELL - 4}
              rx={6}
              fill={preview.valid ? "#198754" : "#dc3545"}
              fillOpacity={0.3}
            />
          ) : null
        )}

      {pendingStart && (
        <rect
          x={pendingStart[1] * CELL + 1}
          y={pendingStart[0] * CELL + 1}
          width={CELL - 2}
          height={CELL - 2}
          rx={6}
          fill="none"
          stroke="#0d6efd"
          strokeWidth={3}
        />
      )}

      {letters.map((row, r) =>
        row.map((ch, c) => {
          const key = `${r},${c}`;
          const onSolution = placedKeys.has(key);
          const dim = solution !== "hidden" && !onSolution;
          return (
            <g key={key}>
              {interactive && (
                <rect
                  x={c * CELL}
                  y={r * CELL}
                  width={CELL}
                  height={CELL}
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  onClick={() => onCellClick?.(r, c)}
                  onMouseEnter={() => onCellHover?.([r, c])}
                  data-cell={key}
                />
              )}
              {ch ? (
                <text
                  x={c * CELL + CELL / 2}
                  y={r * CELL + CELL / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={CELL * 0.58}
                  fontFamily="DejaVu Sans, Arial, sans-serif"
                  fontWeight={(emphasizePlaced || solution !== "hidden") && onSolution ? 700 : 400}
                  fill={dim ? "#9a9a9a" : previewKeys.has(key) ? "#0a3622" : "#000"}
                  pointerEvents="none"
                >
                  {ch}
                </text>
              ) : (
                <circle cx={c * CELL + CELL / 2} cy={r * CELL + CELL / 2} r={1.6} fill="#c8c8c8" pointerEvents="none" />
              )}
            </g>
          );
        })
      )}
    </svg>
  );
};

export default PuzzleGrid;
