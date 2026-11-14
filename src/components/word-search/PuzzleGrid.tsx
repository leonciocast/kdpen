"use client";
import React from "react";
import { Cell, LetterGrid, Placement, placementCells } from "@/lib/wordsearch/engine";
import { placementCapsule, pointsToSvgPath } from "@/lib/wordsearch/geometry";
import { OUTLINE_PAD, ShapeKey, maskBox, letteredOutlines, shapeMask } from "@/lib/shapes/shapes";

export type SolutionStyle = "hidden" | "color" | "bw";

export interface PuzzleGridProps {
  size: number;
  /** Grid shape; cells outside it are hidden and can't be clicked. */
  shape?: ShapeKey;
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
  /** Squares where the selected word can go (subtly shaded). */
  startCells?: Set<string>;
  /** Squares that can't be used right now (not-allowed cursor). */
  blockedCells?: Set<string>;
  maxWidth?: number;
  id?: string;
}

const CELL = 32;

const PuzzleGrid: React.FC<PuzzleGridProps> = ({
  size,
  shape,
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
  startCells,
  blockedCells,
  maxWidth = 640,
  id,
}) => {
  const pad = 6;
  const side = size * CELL;
  const mask = shapeMask(shape, size);
  const on = (r: number, c: number) => !mask || !!mask[r]?.[c];
  let view = `${-pad - 2} ${-pad - 2} ${side + pad * 2 + 4} ${side + pad * 2 + 4}`;
  let outlinePath: string | null = null;
  if (mask) {
    const rings = letteredOutlines(shape, size).map((ring) => ring.map(([x, y]) => [x * CELL, y * CELL] as [number, number]));
    const pts = rings[0] ?? [];
    outlinePath = rings.map((ring) => "M" + ring.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L") + "Z").join("");
    const [r0, c0, r1, c1] = maskBox(mask, size);
    const xs = rings.flatMap((ring) => ring.map((p) => p[0]));
    const ys = rings.flatMap((ring) => ring.map((p) => p[1]));
    const x0 = Math.min((c0 - OUTLINE_PAD) * CELL, ...xs) - 4;
    const y0 = Math.min((r0 - OUTLINE_PAD) * CELL, ...ys) - 4;
    const x1 = Math.max((c1 + 1 + OUTLINE_PAD) * CELL, ...xs) + 4;
    const y1 = Math.max((r1 + 1 + OUTLINE_PAD) * CELL, ...ys) + 4;
    view = `${x0.toFixed(1)} ${y0.toFixed(1)} ${(x1 - x0).toFixed(1)} ${(y1 - y0).toFixed(1)}`;
  }
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
      viewBox={view}
      data-shape={shape ?? "square"}
      style={{ width: "100%", maxWidth, userSelect: "none", touchAction: "manipulation" }}
      role="grid"
      aria-label="Word search grid"
      onMouseLeave={() => onCellHover?.(null)}
    >
      {outlinePath ? (
        <path d={outlinePath} fill="#fff" fillRule="evenodd" stroke="#000" strokeWidth={2.5} strokeLinejoin="round" data-testid="grid-outline" />
      ) : (
        <rect x={-pad} y={-pad} width={side + pad * 2} height={side + pad * 2} fill="#fff" stroke="#000" strokeWidth={2.5} />
      )}

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

      {/* Valid squares for the word being placed */}
      {startCells &&
        Array.from(startCells).map((k) => {
          const [r, c] = k.split(",").map(Number);
          return <rect key={`ok-${k}`} x={c * CELL + 1} y={r * CELL + 1} width={CELL - 2} height={CELL - 2} rx={5} fill="#4f46e5" fillOpacity={0.09} pointerEvents="none" />;
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
          if (!on(r, c)) return null;
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
                  style={{ cursor: blockedCells?.has(key) ? "not-allowed" : "pointer" }}
                  data-state={blockedCells?.has(key) ? "blocked" : startCells?.has(key) ? "start" : "ok"}
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
