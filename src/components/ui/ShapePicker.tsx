"use client";
import React from "react";
import { BsCheckCircleFill, BsSearch } from "react-icons/bs";
import { CROSSWORD_SHAPES, OUTLINE_PAD, SHAPES, SUDOKU_SHAPES, ShapeCategory, ShapeKey, ShapeMix, maskBox, shapeCategory, shapeInfo, shapeMask, shapeOutline, suggestShapeForTheme, sudokuFrame } from "@/lib/shapes/shapes";
import type { Design, ToolKind } from "@/lib/design/types";

/** Shapes each tool can use (crossword: only shapes that still give well-connected crosswords; sudoku: frames around the 9×9). */
export function shapesFor(tool: ToolKind): ShapeKey[] {
  if (tool === "crossword") return CROSSWORD_SHAPES;
  if (tool === "sudoku") return SUDOKU_SHAPES;
  return SHAPES.map((s) => s.key);
}

const LETTERS = "AEIOURSTLNMDCBGHKPWYF";
const letterAt = (r: number, c: number) => LETTERS[(r * 7 + c * 13 + r * c) % LETTERS.length];

type P = [number, number];
const path = (pts: P[]) => "M" + pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join("L") + "Z";

function fillet(pts: P[], r: number): P[] {
  if (pts.length > 40) return pts;
  const out: P[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]);
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const rr = Math.min(r, la * 0.45, lb * 0.45);
    const p1: P = [p[0] + ((a[0] - p[0]) / la) * rr, p[1] + ((a[1] - p[1]) / la) * rr];
    const p2: P = [p[0] + ((b[0] - p[0]) / lb) * rr, p[1] + ((b[1] - p[1]) / lb) * rr];
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      const u = 1 - t;
      out.push([u * u * p1[0] + 2 * u * t * p[0] + t * t * p2[0], u * u * p1[1] + 2 * u * t * p[1] + t * t * p2[1]]);
    }
  }
  return out;
}

/** A real mini preview: the shape's mask with letters / cells, and the outline in the frame style. */
export function ShapeThumb({ shape, tool, grid, size = 12, shade = false }: { shape: ShapeKey; tool: ToolKind; grid: Design["grid"]; size?: number; shade?: boolean }) {
  const C = 10;
  const sw = Math.max(0.8, grid.frame * 0.75);
  const dash = grid.line === "dashed" ? `${sw * 3} ${sw * 2}` : grid.line === "dotted" ? `0.1 ${sw * 2.6}` : undefined;
  const cap = grid.line === "dotted" ? "round" : "butt";
  if (tool === "sudoku") {
    const n = 9;
    const frame = sudokuFrame(shape, n).map(([x, y]) => [x * C, y * C] as P);
    const pts = grid.border === "rounded" ? fillet(frame, C * 0.9) : frame;
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs) - 6, y0 = Math.min(...ys) - 6, x1 = Math.max(...xs) + 6, y1 = Math.max(...ys) + 6;
    const cells: React.ReactNode[] = [];
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const x = c * C;
        const y = r * C;
        if (grid.cells === "circles") cells.push(<circle key={`${r}${c}`} cx={x + C / 2} cy={y + C / 2} r={C * 0.42} fill="none" stroke="#9ca3af" strokeWidth={0.5} />);
        else if (grid.cells === "rounded" || grid.cells === "boxed") cells.push(<rect key={`${r}${c}`} x={x + 0.9} y={y + 0.9} width={C - 1.8} height={C - 1.8} rx={grid.cells === "rounded" ? 2.2 : 0} fill="none" stroke="#9ca3af" strokeWidth={0.5} />);
      }
    return (
      <svg viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`} className="pg-shape-svg" aria-hidden>
        {grid.shadow && grid.border !== "none" && shape !== "square" && <path d={path(pts.map(([x, y]) => [x + 3, y + 3]))} fill="#d1d5db" />}
        {shape !== "square" && <path d={path(pts)} fill={shade ? "#e2e2e2" : "#fff"} stroke={grid.border === "none" ? "none" : "#111"} strokeWidth={sw} strokeDasharray={dash} strokeLinecap={cap} />}
        {grid.cells === "plain" &&
          Array.from({ length: n + 1 }, (_, i) => (
            <g key={i}>
              <line x1={i * C} y1={0} x2={i * C} y2={n * C} stroke="#111" strokeWidth={i % 3 === 0 ? 1.6 : 0.4} />
              <line x1={0} y1={i * C} x2={n * C} y2={i * C} stroke="#111" strokeWidth={i % 3 === 0 ? 1.6 : 0.4} />
            </g>
          ))}
        {grid.cells !== "plain" && (
          <>
            {cells}
            {[3, 6].map((i) => (
              <g key={i}>
                <line x1={i * C} y1={1} x2={i * C} y2={n * C - 1} stroke="#111" strokeWidth={1} />
                <line x1={1} y1={i * C} x2={n * C - 1} y2={i * C} stroke="#111" strokeWidth={1} />
              </g>
            ))}
          </>
        )}
        {shape === "square" && <rect x={0} y={0} width={n * C} height={n * C} rx={grid.border === "rounded" ? 6 : 0} fill="none" stroke="#111" strokeWidth={Math.max(1.6, sw)} strokeDasharray={dash} strokeLinecap={cap} />}
        {[[0, 1, 5], [1, 4, 8], [2, 7, 2], [4, 0, 7], [4, 4, 1], [6, 2, 9], [7, 5, 3], [8, 8, 6], [3, 6, 4]].map(([r, c, v]) => (
          <text key={`${r}-${c}`} x={c * C + C / 2} y={r * C + C / 2 + 0.4} fontSize={6.4} textAnchor="middle" dominantBaseline="central" fontFamily="DejaVu Sans, Arial, sans-serif">
            {v}
          </text>
        ))}
      </svg>
    );
  }
  const mask = shapeMask(shape, size);
  const outline = shapeOutline(shape, size).map(([x, y]) => [x * C, y * C] as P);
  const pts = grid.border === "rounded" ? fillet(outline, C * 0.9) : outline;
  const [r0, c0, r1, c1] = maskBox(mask, size);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const pad = grid.border === "double" ? 9 : 5;
  const x0 = Math.min(...xs, (c0 - OUTLINE_PAD) * C) - pad;
  const y0 = Math.min(...ys, (r0 - OUTLINE_PAD) * C) - pad;
  const x1 = Math.max(...xs, (c1 + 1 + OUTLINE_PAD) * C) + pad + (grid.shadow ? 3 : 0);
  const y1 = Math.max(...ys, (r1 + 1 + OUTLINE_PAD) * C) + pad + (grid.shadow ? 3 : 0);
  const on = (r: number, c: number) => !mask || mask[r][c];
  const items: React.ReactNode[] = [];
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++) {
      if (!on(r, c)) continue;
      const x = c * C;
      const y = r * C;
      if (tool === "crossword") {
        const black = (r * 5 + c * 3 + ((r * c) % 4)) % 6 === 0;
        items.push(<rect key={`${r},${c}`} x={x} y={y} width={C} height={C} fill={black ? "#e5e7eb" : "#fff"} stroke="#111" strokeWidth={0.5} />);
        continue;
      }
      if (grid.cells === "circles") items.push(<circle key={`m${r},${c}`} cx={x + C / 2} cy={y + C / 2} r={C * 0.43} fill="none" stroke="#9ca3af" strokeWidth={0.5} />);
      else if (grid.cells === "boxed" || grid.cells === "rounded") items.push(<rect key={`m${r},${c}`} x={x + 0.8} y={y + 0.8} width={C - 1.6} height={C - 1.6} rx={grid.cells === "rounded" ? 2 : 0} fill="none" stroke="#9ca3af" strokeWidth={0.5} />);
      items.push(
        <text key={`${r},${c}`} x={x + C / 2} y={y + C / 2 + 0.3} fontSize={5.6} textAnchor="middle" dominantBaseline="central" fontFamily="DejaVu Sans, Arial, sans-serif" fill="#222">
          {letterAt(r, c)}
        </text>
      );
    }
  const lines: React.ReactNode[] = [];
  if (grid.lines && tool !== "crossword")
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++) {
        if (!on(r, c)) continue;
        if (c + 1 < size && on(r, c + 1)) lines.push(<line key={`v${r},${c}`} x1={(c + 1) * C} y1={r * C} x2={(c + 1) * C} y2={(r + 1) * C} stroke="#9ca3af" strokeWidth={0.4} />);
        if (r + 1 < size && on(r + 1, c)) lines.push(<line key={`h${r},${c}`} x1={c * C} y1={(r + 1) * C} x2={(c + 1) * C} y2={(r + 1) * C} stroke="#9ca3af" strokeWidth={0.4} />);
      }
  const noBorder = grid.border === "none" || grid.frame <= 0;
  const square = shape === "square";
  const rectPts: P[] = [[-OUTLINE_PAD * C, -OUTLINE_PAD * C], [(size + OUTLINE_PAD) * C, -OUTLINE_PAD * C], [(size + OUTLINE_PAD) * C, (size + OUTLINE_PAD) * C], [-OUTLINE_PAD * C, (size + OUTLINE_PAD) * C]];
  const shapePts = square ? (grid.border === "rounded" ? fillet(rectPts, C * 0.45) : rectPts) : pts;
  const scale = (k: number): P[] => {
    // Outer line of a double frame: grow about the centre.
    const cx = (Math.min(...shapePts.map((p) => p[0])) + Math.max(...shapePts.map((p) => p[0]))) / 2;
    const cy = (Math.min(...shapePts.map((p) => p[1])) + Math.max(...shapePts.map((p) => p[1]))) / 2;
    const w = Math.max(...shapePts.map((p) => p[0])) - Math.min(...shapePts.map((p) => p[0]));
    const f = (w + k * 2) / w;
    return shapePts.map(([x, y]) => [cx + (x - cx) * f, cy + (y - cy) * f]);
  };
  return (
    <svg viewBox={`${x0.toFixed(1)} ${y0.toFixed(1)} ${(x1 - x0).toFixed(1)} ${(y1 - y0).toFixed(1)}`} className="pg-shape-svg" aria-hidden>
      {grid.shadow && !noBorder && <path d={path(shapePts.map(([x, y]) => [x + 3, y + 3]))} fill="#d1d5db" />}
      <path d={path(shapePts)} fill={shade ? "#e2e2e2" : "#fff"} />
      {lines}
      {items}
      {!noBorder && <path d={path(shapePts)} fill="none" stroke="#111" strokeWidth={sw} strokeDasharray={dash} strokeLinecap={cap} strokeLinejoin="round" />}
      {!noBorder && grid.border === "double" && <path d={path(scale(Math.max(3, sw * 2.6)))} fill="none" stroke="#111" strokeWidth={Math.max(0.5, sw * 0.6)} strokeDasharray={dash} strokeLinecap={cap} />}
    </svg>
  );
}

const CATS: { id: ShapeCategory; label: string }[] = [
  { id: "basic", label: "Basic shapes" },
  { id: "animals", label: "Animals" },
  { id: "objects", label: "Holiday & objects" },
];

const MIX_LABELS: Record<ShapeMix, string> = {
  one: "Same shape",
  each: "Mix: new shape each puzzle",
  theme: "Mix: one per theme",
  animals: "Mix: random animals",
};

export function ShapePicker({
  tool,
  design,
  onChange,
  compact,
  themes = [],
}: {
  tool: ToolKind;
  design: Design;
  onChange: (kind: ShapeKey, mix: ShapeMix, shade?: boolean) => void;
  compact?: boolean;
  themes?: string[];
}) {
  const allowed = shapesFor(tool);
  const mix = design.shape.mix;
  const current = allowed.includes(design.shape.kind) ? design.shape.kind : "square";
  let suggested: { theme: string; key: ShapeKey } | null = null;
  for (const t of themes) {
    const hit = suggestShapeForTheme(t, allowed);
    if (hit && hit !== current) {
      suggested = { theme: t, key: hit };
      break;
    }
  }
  const [tab, setTab] = React.useState<ShapeCategory>(() => shapeCategory(shapeInfo(current)));
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  const matches = (s: (typeof SHAPES)[number]) => {
    if (!allowed.includes(s.key)) return false;
    if (!q) return true;
    const blob = [s.key, s.label, s.tag, ...(s.aliases ?? [])].join(" ").toLowerCase();
    return blob.includes(q);
  };
  const visibleCats = CATS.filter((c) => SHAPES.some((s) => shapeCategory(s) === c.id && matches(s)));
  const activeCat = q ? null : visibleCats.some((c) => c.id === tab) ? tab : visibleCats[0]?.id ?? "basic";

  return (
    <div data-testid="shape-picker">
      {tool !== "sudoku" && (
        <div className="pg-seg mb-3" role="radiogroup" aria-label="Shape for each puzzle">
          {(["one", "each", "theme", "animals"] as ShapeMix[]).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mix === m} className={mix === m ? "active" : ""} onClick={() => onChange(current, m, design.shape.shade)} data-testid={`shape-mix-${m}`}>
              {MIX_LABELS[m]}
            </button>
          ))}
        </div>
      )}
      <div className="form-check form-switch mb-3">
        <input className="form-check-input" type="checkbox" id="shape-shade" checked={design.shape.shade} onChange={(e) => onChange(current, mix, e.target.checked)} data-testid="shape-shade" />
        <label className="form-check-label" htmlFor="shape-shade">
          Light shaded silhouette
        </label>
      </div>
      {suggested && mix === "one" && (
        <div className="pg-shape-suggest" data-testid="shape-suggest">
          Your theme is “{suggested.theme}”.
          <button type="button" className="btn btn-sm btn-outline-primary ms-2" onClick={() => { onChange(suggested.key, "one", true); setTab(shapeCategory(shapeInfo(suggested.key))); }} data-testid="shape-suggest-apply">
            Use the {shapeInfo(suggested.key).label.toLowerCase()} shape
          </button>
        </div>
      )}
      <div className="pg-shape-toolbar">
          <div className="pg-seg" role="tablist" aria-label="Shape category">
            {CATS.filter((c) => SHAPES.some((s) => shapeCategory(s) === c.id && allowed.includes(s.key))).map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={!q && activeCat === c.id}
                className={!q && activeCat === c.id ? "active" : ""}
                onClick={() => { setTab(c.id); setQuery(""); }}
                data-testid={`shape-cat-${c.id}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        <label className="pg-shape-search">
          <BsSearch aria-hidden />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search animals and shapes" aria-label="Search animals and shapes" data-testid="shape-search" />
        </label>
      </div>
      {(q ? CATS.filter((c) => visibleCats.some((v) => v.id === c.id)) : CATS.filter((c) => c.id === activeCat)).map((c) => {
        const list = SHAPES.filter((s) => shapeCategory(s) === c.id && matches(s));
        if (!list.length) return null;
        return (
          <div key={c.id} className="mb-3">
            {q && <div className="pg-shape-group">{c.label}</div>}
            <div className={`pg-shape-grid ${compact ? "compact" : ""}`} role="radiogroup" aria-label={`${c.label} shapes`}>
              {list.map((s) => {
                const active = mix === "one" && current === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={mix !== "one"}
                    className={`pg-shape-card ${active ? "active" : ""}`}
                    onClick={() => onChange(s.key, "one", s.group === "animals" ? true : design.shape.shade)}
                    data-testid={`shape-${s.key}`}
                    title={s.label}
                  >
                    <ShapeThumb shape={s.key} tool={tool} grid={{ ...design.grid, frame: Math.max(design.grid.frame, 1.2), border: design.grid.border === "none" ? "square" : design.grid.border }} shade={s.group === "animals" || design.shape.shade} />
                    <span className="pg-shape-name">
                      {s.label}
                      {active && <BsCheckCircleFill className="pg-template-check" aria-label="Selected" />}
                    </span>
                    {s.tag && !compact && <span className="pg-shape-tag">{s.tag}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {q && !visibleCats.length && <p className="small text-muted mb-0">No shapes match “{query}”.</p>}
    </div>
  );
}

/** Ready-made frame looks; each sets outline style, thickness, line style and shadow together. */
export const FRAMES: { id: string; label: string; text: string; grid: Partial<Design["grid"]> }[] = [
  { id: "thin", label: "Thin line", text: "Light and airy", grid: { border: "square", frame: 0.8, line: "solid", shadow: false } },
  { id: "medium", label: "Medium line", text: "Clear, balanced", grid: { border: "square", frame: 1.6, line: "solid", shadow: false } },
  { id: "thick", label: "Thick line", text: "Bold, kid friendly", grid: { border: "square", frame: 3, line: "solid", shadow: false } },
  { id: "double", label: "Double line", text: "Classic book look", grid: { border: "double", frame: 1.2, line: "solid", shadow: false } },
  { id: "rounded", label: "Rounded corners", text: "Soft and friendly", grid: { border: "rounded", frame: 1.8, line: "solid", shadow: false } },
  { id: "dashed", label: "Dashed line", text: "Playful cut-out", grid: { border: "square", frame: 1.4, line: "dashed", shadow: false } },
  { id: "dotted", label: "Dotted line", text: "Light, decorative", grid: { border: "square", frame: 2.4, line: "dotted", shadow: false } },
  { id: "shadow", label: "Shadow", text: "Lifts off the page", grid: { border: "square", frame: 1.4, line: "solid", shadow: true } },
  { id: "none", label: "No outline", text: "Just the grid", grid: { border: "none", frame: 1.2, line: "solid", shadow: false } },
];

export function frameIdOf(g: Design["grid"]): string | null {
  const hit = FRAMES.find((f) => f.grid.border === g.border && f.grid.line === g.line && f.grid.shadow === g.shadow && (f.id === "none" || Math.abs((f.grid.frame ?? 0) - g.frame) < 0.05));
  return hit?.id ?? null;
}

export function FramePicker({ tool, design, onChange }: { tool: ToolKind; design: Design; onChange: (grid: Design["grid"]) => void }) {
  const current = frameIdOf(design.grid);
  const shape = shapesFor(tool).includes(design.shape.kind) && design.shape.mix === "one" ? design.shape.kind : tool === "sudoku" ? "square" : "circle";
  return (
    <div className="pg-shape-grid frames" role="radiogroup" aria-label="Frame style" data-testid="frame-picker">
      {FRAMES.map((f) => {
        const grid = { ...design.grid, ...f.grid };
        const active = current === f.id;
        return (
          <button key={f.id} type="button" role="radio" aria-checked={active} className={`pg-shape-card ${active ? "active" : ""}`} onClick={() => onChange(grid)} data-testid={`frame-${f.id}`}>
            <ShapeThumb shape={shape} tool={tool} grid={grid} size={10} />
            <span className="pg-shape-name">
              {f.label}
              {active && <BsCheckCircleFill className="pg-template-check" aria-label="Selected" />}
            </span>
            <span className="pg-shape-tag">{f.text}</span>
          </button>
        );
      })}
    </div>
  );
}

export const shapeLabel = (k: ShapeKey) => shapeInfo(k).label;
