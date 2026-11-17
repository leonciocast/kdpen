"use client";
import React from "react";
import { SudokuPuzzle } from "@/lib/sudoku";

export default function SudokuGrid({ puzzle, showSolution, maxWidth = 520, id }: { puzzle: SudokuPuzzle; showSolution: boolean; maxWidth?: number; id?: string }) {
  const C = 40;
  const S = C * 9;
  return (
    <svg id={id} viewBox={`-2 -2 ${S + 4} ${S + 4}`} style={{ width: "100%", maxWidth, display: "block", margin: "0 auto" }} role="img" aria-label="Sudoku grid">
      <rect x={0} y={0} width={S} height={S} fill="#fff" />
      {puzzle.board.map((row, r) =>
        row.map((v, c) => {
          const shown = v || (showSolution ? puzzle.solution[r][c] : 0);
          return shown ? (
            <text key={`${r}-${c}`} x={c * C + C / 2} y={r * C + C / 2 + 1} textAnchor="middle" dominantBaseline="central" fontSize={22} fontWeight={v ? 700 : 500} fill={v ? "#0f172a" : "#4f46e5"} fontFamily="DejaVu Sans, Arial, sans-serif">
              {shown}
            </text>
          ) : null;
        })
      )}
      {Array.from({ length: 10 }, (_, i) => (
        <g key={i} stroke="#0f172a" strokeWidth={i % 3 === 0 ? 3 : 0.8}>
          <line x1={i * C} y1={0} x2={i * C} y2={S} />
          <line x1={0} y1={i * C} x2={S} y2={i * C} />
        </g>
      ))}
    </svg>
  );
}
