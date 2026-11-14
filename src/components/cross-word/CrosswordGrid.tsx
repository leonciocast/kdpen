"use client";
import React from "react";
import { Crossword, cellNumbers } from "@/lib/crossword/engine";
import { shapeOutline } from "@/lib/shapes/shapes";

export default function CrosswordGrid({ cw, showAnswers, maxWidth = 620, id }: { cw: Crossword; showAnswers: boolean; maxWidth?: number; id?: string }) {
  const C = 36;
  const nums = cellNumbers(cw);
  const pad = 2;
  let view = `${-pad} ${-pad} ${cw.width * C + pad * 2} ${cw.height * C + pad * 2}`;
  let outline: string | null = null;
  if (cw.shape && cw.canvas && cw.offset) {
    const [r0, c0] = cw.offset;
    const pts = shapeOutline(cw.shape, cw.canvas).map(([x, y]) => [(x - c0) * C, (y - r0) * C]);
    outline = "M" + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L") + "Z";
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const x0 = Math.min(0, ...xs) - 4;
    const y0 = Math.min(0, ...ys) - 4;
    view = `${x0} ${y0} ${Math.max(cw.width * C, ...xs) + 4 - x0} ${Math.max(cw.height * C, ...ys) + 4 - y0}`;
  }
  return (
    <svg id={id} viewBox={view} data-shape={cw.shape ?? "square"} style={{ width: "100%", maxWidth, display: "block", margin: "0 auto" }} role="img" aria-label="Crossword grid">
      {outline && <path d={outline} fill="#fff" stroke="#111" strokeWidth={2.5} strokeLinejoin="round" data-testid="cw-outline" />}
      {cw.grid.map((row, r) =>
        row.map((ch, c) =>
          ch ? (
            <g key={`${r}-${c}`}>
              <rect x={c * C} y={r * C} width={C} height={C} fill="#fff" stroke="#111" strokeWidth={1.6} />
              {nums.has(`${r},${c}`) && (
                <text x={c * C + 3} y={r * C + 11} fontSize={10} fontWeight={600} fill="#333" fontFamily="DejaVu Sans, Arial, sans-serif">
                  {nums.get(`${r},${c}`)}
                </text>
              )}
              {showAnswers && (
                <text x={c * C + C / 2} y={r * C + C / 2 + 4} textAnchor="middle" dominantBaseline="central" fontSize={18} fontWeight={700} fill="#4338ca" fontFamily="DejaVu Sans, Arial, sans-serif">
                  {ch}
                </text>
              )}
            </g>
          ) : null
        )
      )}
    </svg>
  );
}

export function ClueList({ cw }: { cw: Crossword }) {
  const across = cw.placements.filter((p) => p.across).sort((a, b) => a.number - b.number);
  const down = cw.placements.filter((p) => !p.across).sort((a, b) => a.number - b.number);
  return (
    <div className="row g-3">
      {[
        ["Across", across],
        ["Down", down],
      ].map(([title, list]) => (
        <div className="col-sm-6" key={title as string}>
          <h3 className="h6 fw-bold">{title as string}</h3>
          <ol className="list-unstyled small mb-0 d-grid gap-1">
            {(list as typeof across).map((p) => (
              <li key={`${p.number}-${p.across}`}>
                <b className="me-1">{p.number}.</b>
                {p.clue} <span className="text-muted">({p.letters.length})</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
