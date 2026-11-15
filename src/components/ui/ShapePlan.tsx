"use client";
import React from "react";
import { BsArrowCounterclockwise, BsChevronLeft, BsChevronRight, BsCollection, BsDice5, BsHandIndexThumb, BsPinAngleFill, BsShuffle, BsSquare, BsStars, BsXLg } from "react-icons/bs";
import type { Design, ToolKind } from "@/lib/design/types";
import { ANIMAL_GROUPS, CATEGORIES, DEFAULT_STEPPED_COLOR, ShapeKey, defaultOutlineFor, isSteppedShape, shapeInfo } from "@/lib/shapes/shapes";
import { PLAN_LEAVES, PlanMode, leafOf, ThemeMode, leafCounts, planCats, planMode, planPool, planThemes, randomPlanSeed, shapeTargetsFor } from "@/lib/shapes/plan";
import type { ChoiceOption } from "./Flow";
import { ShapePicker, ShapeThumb, shapesFor } from "./ShapePicker";

type Setter = (fn: (d: Design) => void) => void;
export type PlanItem = { theme?: string; title?: string };

const MODE_MIX: Record<PlanMode, Design["shape"]["mix"]> = { one: "one", surprise: "each", pick: "pick", manual: "manual" };

export function planOptions(tool: ToolKind): ChoiceOption<PlanMode>[] {
  const noun = tool === "sudoku" ? "frame" : "shape";
  return [
    { value: "one", title: `One ${noun} for the whole book`, text: `Every puzzle uses the same ${noun}. Classic, calm and consistent.`, icon: <BsSquare />, testId: "plan-one", cta: `Pick the ${noun}` },
    { value: "surprise", title: "Surprise me: every page different", text: `Each puzzle gets a different ${noun}, picked at random from all categories. Shuffle until you love it.`, icon: <BsStars />, testId: "plan-surprise", badge: "Fun", cta: "See my lineup" },
    { value: "pick", title: "Random from categories I choose", text: `Tick one or more categories, like Animals and Food. Each puzzle gets a different ${noun} from them.`, icon: <BsCollection />, testId: "plan-pick", cta: "Choose categories" },
    { value: "manual", title: "Pick page by page", text: `Choose the exact ${noun} for every puzzle yourself, with quick helpers for big books.`, icon: <BsHandIndexThumb />, testId: "plan-manual", cta: "Start picking" },
  ];
}

/** Outline a puzzle actually gets: in mixed books cell-built shapes keep their stepped look. */
export const effectiveOutline = (design: Design, k: ShapeKey): Design["shape"]["outline"] =>
  design.shape.mix !== "one" && design.shape.outline === "smooth" && isSteppedShape(k) ? "stepped" : design.shape.outline;

/** Plain words for the footer / status line. */
export function planSummary(design: Design, tool: ToolKind, count: number): string {
  const noun = tool === "sudoku" ? "frame" : "shape";
  const mode = planMode(design.shape.mix);
  const allowed = shapesFor(tool);
  if (mode === "one") return `${shapeInfo(allowed.includes(design.shape.kind) ? design.shape.kind : "square").label}`;
  if (mode === "manual") return `Page by page (${Object.keys(design.shape.pins ?? {}).filter((i) => Number(i) < count).length} of ${count} picked)`;
  const pool = planPool(design.shape, allowed).length;
  if (mode === "surprise") return `Surprise mix · ${pool} ${noun}s`;
  return `Random from ${planCats(design.shape).length ? catNames(design.shape) : "no categories"} · ${pool} ${noun}s`;
}

function catNames(shape: Design["shape"]): string {
  const cats = planCats(shape);
  const animalAll = ANIMAL_GROUPS.every((g) => cats.includes(`animals:${g.id}`));
  const names: string[] = [];
  for (const c of CATEGORIES) {
    if (c.id === "animals") {
      if (animalAll) names.push("Animals");
      else for (const g of ANIMAL_GROUPS) if (cats.includes(`animals:${g.id}`)) names.push(g.label);
    } else if (cats.includes(c.id)) names.push(c.label);
  }
  return names.length > 3 ? `${names.slice(0, 3).join(", ")} +${names.length - 3}` : names.join(" & ");
}

/** Switch plan mode. Random → page by page starts from the lineup the user is looking at. */
export function applyPlanMode(d: Design, mode: PlanMode, tool: ToolKind, list: PlanItem[]) {
  const from = planMode(d.shape.mix);
  if (from === mode) return;
  const allowed = shapesFor(tool);
  if (mode === "manual" && (from === "surprise" || from === "pick")) {
    const t = shapeTargetsFor(d.shape, list, allowed);
    d.shape.pins = Object.fromEntries(t.map((k, i) => [String(i), k]));
  } else if (mode !== "one") {
    delete d.shape.pins;
  }
  if (mode === "pick") {
    const cats = planCats(d.shape);
    d.shape.cats = cats.length ? cats : ANIMAL_GROUPS.map((g) => `animals:${g.id}`);
  }
  if (mode === "surprise" || mode === "pick") d.shape.seed = d.shape.seed ?? randomPlanSeed();
  if ((d.shape.mix === "theme" || d.shape.mix === "animals") && !d.shape.themes) d.shape.themes = planThemes(d.shape);
  d.shape.mix = MODE_MIX[mode];
  // Mixed books: cell-built shapes keep their stepped look automatically, silhouettes stay smooth.
  if (mode !== "one" && d.shape.outline === "stepped") d.shape.outline = "smooth";
  if (mode === "one") d.shape.outline = defaultOutlineFor(d.shape.kind);
  d.shape.outlineColor = d.shape.outlineColor ?? DEFAULT_STEPPED_COLOR;
}

/** One shape for the whole book (also the shade rule the picker always used). */
export function chooseOneShape(d: Design, kind: ShapeKey) {
  const familyChange = isSteppedShape(kind) !== isSteppedShape(d.shape.kind);
  d.shape.kind = kind;
  d.shape.shade = isSteppedShape(kind) ? false : shapeInfo(kind).group === "animals" ? true : d.shape.shade;
  if (familyChange) d.shape.outline = defaultOutlineFor(kind);
  d.shape.outlineColor = d.shape.outlineColor ?? DEFAULT_STEPPED_COLOR;
}

const PAGE = 24;

/** The card picture for each category (first one the tool can use). */
const CAT_REP: Record<string, ShapeKey[]> = {
  basic: ["hexagon", "circle", "octagon", "square"],
  stepped: ["sunburst", "arch", "blockheart", "stairs"],
  hollow: ["ring", "windowframe", "boxframe"],
  clusters: ["islands5", "corners", "checkers"],
  letters: ["letterA", "digit8"],
  animals: ["elephant", "cat", "owl"],
  nature: ["cloud", "raindrop", "moon"],
  holiday: ["heart", "pumpkin", "tree"],
  food: ["apple", "pear", "cherry"],
  objects: ["house", "car", "bulb"],
};

const thumbGrid = (design: Design): Design["grid"] => ({ ...design.grid, frame: Math.max(design.grid.frame, 1.2), border: design.grid.border === "none" ? "square" : design.grid.border });

const LineupThumb = React.memo(function LineupThumb({ k, tool, design }: { k: ShapeKey; tool: ToolKind; design: Design }) {
  return <ShapeThumb shape={k} tool={tool} grid={thumbGrid(design)} size={tool === "sudoku" ? 9 : ["clusters", "letters"].includes(leafOf(k)) ? 16 : 12} shade={!isSteppedShape(k) && (shapeInfo(k).group === "animals" || design.shape.shade)} outlineStyle={effectiveOutline(design, k)} outlineColor={design.shape.outlineColor} />;
});

/** "Puzzle 1, 2, 3…" strip: the shape every puzzle gets. Pages of 24 so a 500-puzzle book stays quick. */
export function Lineup({ tool, design, targets, focus, onSelect, pins, labels }: { tool: ToolKind; design: Design; targets: ShapeKey[]; focus: number; onSelect: (i: number) => void; pins: Record<string, ShapeKey>; labels: PlanItem[] }) {
  const [page, setPage] = React.useState(() => Math.floor(focus / PAGE));
  const pages = Math.max(1, Math.ceil(targets.length / PAGE));
  const [lastFocus, setLastFocus] = React.useState(focus);
  if (lastFocus !== focus) {
    setLastFocus(focus);
    if (Math.floor(focus / PAGE) !== page) setPage(Math.floor(focus / PAGE));
  }
  const p = Math.min(page, pages - 1);
  const start = p * PAGE;
  const slice = targets.slice(start, start + PAGE);
  const rowRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = rowRef.current?.querySelector<HTMLElement>(".pg-lineup-item.active");
    if (el && rowRef.current) {
      const r = rowRef.current;
      const left = el.offsetLeft - r.offsetLeft;
      if (left < r.scrollLeft || left + el.offsetWidth > r.scrollLeft + r.clientWidth) r.scrollTo({ left: Math.max(0, left - 40), behavior: "smooth" });
    }
  }, [focus, p]);
  const pinnedCount = Object.keys(pins).filter((i) => Number(i) < targets.length).length;
  return (
    <div className="pg-lineup" data-testid="lineup">
      <div className="pg-lineup-head">
        <span className="pg-shape-group mb-0">Shape lineup</span>
        <span className="small text-muted" data-testid="lineup-range">
          Puzzles {targets.length ? start + 1 : 0}–{start + slice.length} of {targets.length}
          {pinnedCount > 0 && design.shape.mix !== "manual" ? ` · ${pinnedCount} pinned` : ""}
        </span>
        {pages > 1 && (
          <span className="pg-lineup-pager">
            <button type="button" className="btn btn-light btn-sm btn-icon" aria-label="Previous puzzles" disabled={p === 0} onClick={() => setPage(p - 1)} data-testid="lineup-prev">
              <BsChevronLeft />
            </button>
            <button type="button" className="btn btn-light btn-sm btn-icon" aria-label="Next puzzles" disabled={p >= pages - 1} onClick={() => setPage(p + 1)} data-testid="lineup-next">
              <BsChevronRight />
            </button>
          </span>
        )}
      </div>
      <div className="pg-lineup-row" ref={rowRef} role="listbox" aria-label="Shape of each puzzle">
        {slice.map((k, j) => {
          const i = start + j;
          const pinned = !!pins[String(i)] && design.shape.mix !== "manual";
          const picked = !!pins[String(i)] && design.shape.mix === "manual";
          return (
            <button
              key={i}
              type="button"
              role="option"
              aria-selected={focus === i}
              className={`pg-lineup-item ${focus === i ? "active" : ""} ${pinned ? "pinned" : ""} ${design.shape.mix === "manual" && !picked ? "unpicked" : ""}`}
              onClick={() => onSelect(i)}
              title={`Puzzle ${i + 1}${labels[i]?.title ? ` · ${labels[i].title}` : ""}: ${shapeInfo(k).label}${pinned ? " (pinned)" : ""}`}
              data-testid={`lineup-${i}`}
              data-shape={k}
              data-leaf={leafOf(k)}
              data-theme={labels[i]?.theme ?? ""}
            >
              <span className="pg-lineup-num">{i + 1}</span>
              {pinned && <BsPinAngleFill className="pg-lineup-pin" aria-label="Pinned" />}
              <LineupThumb k={k} tool={tool} design={design} />
              <span className="pg-lineup-name">{shapeInfo(k).label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Tick categories (Animals splits into its groups) with live counts. */
export function CategoryChooser({ tool, design, set }: { tool: ToolKind; design: Design; set: Setter }) {
  const allowed = shapesFor(tool);
  const counts = leafCounts(allowed);
  const cats = planCats(design.shape);
  const toggle = (ids: string[], on: boolean) =>
    set((d) => {
      const cur = new Set(planCats(d.shape));
      ids.forEach((id) => (on ? cur.add(id) : cur.delete(id)));
      d.shape.mix = "pick";
      d.shape.cats = PLAN_LEAVES.map((l) => l.id).filter((id) => cur.has(id));
    });
  const animalIds = ANIMAL_GROUPS.map((g) => `animals:${g.id}`).filter((id) => counts[id] > 0);
  const animalsOn = animalIds.filter((id) => cats.includes(id)).length;
  const sample = (cat: string, ids: string[]): ShapeKey => {
    const rep = (CAT_REP[cat] ?? []).find((k) => allowed.includes(k));
    return rep ?? allowed.find((k) => ids.includes(leafOf(k))) ?? "square";
  };
  const all = PLAN_LEAVES.filter((l) => counts[l.id] > 0).map((l) => l.id);
  const cards = CATEGORIES.map((c) => {
    const ids = c.id === "animals" ? animalIds : [c.id];
    const n = ids.reduce((a, id) => a + (counts[id] ?? 0), 0);
    if (!n) return null;
    const on = c.id === "animals" ? animalsOn === animalIds.length : cats.includes(c.id);
    const partial = c.id === "animals" && animalsOn > 0 && !on;
    return (
      <button key={c.id} type="button" role="checkbox" aria-checked={on ? true : partial ? "mixed" : false} className={`pg-plan-cat ${on ? "on" : ""} ${partial ? "partial" : ""}`} onClick={() => toggle(ids, !on)} data-testid={`plan-cat-${c.id}`}>
        <span className="pg-plan-check" aria-hidden>{on ? "✓" : partial ? "–" : ""}</span>
        <ShapeThumb shape={sample(c.id, ids)} tool={tool} grid={thumbGrid(design)} size={["clusters", "letters"].includes(c.id) ? 16 : 12} shade={c.id === "animals"} outlineColor={design.shape.outlineColor} />
        <span className="pg-plan-cat-name">{c.label}</span>
        <span className="pg-plan-cat-count">{c.id === "animals" && partial ? `${ids.filter((id) => cats.includes(id)).reduce((a, id) => a + counts[id], 0)} of ${n}` : n} {tool === "sudoku" ? "frames" : "shapes"}</span>
      </button>
    );
  });
  return (
    <div data-testid="category-chooser">
      <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
        <span className="pg-shape-group mb-0 me-auto">Categories to mix</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggle(all, true)} data-testid="plan-cats-all">Select all</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggle(all, false)} data-testid="plan-cats-none">Clear</button>
      </div>
      <div className="pg-plan-cats" role="group" aria-label="Categories">{cards}</div>
      {animalIds.length > 0 && (
        <div className="pg-plan-groups mt-2" role="group" aria-label="Animal groups">
          <span className="small text-muted me-1">Animal groups:</span>
          {ANIMAL_GROUPS.filter((g) => counts[`animals:${g.id}`] > 0).map((g) => {
            const id = `animals:${g.id}`;
            const on = cats.includes(id);
            return (
              <button key={g.id} type="button" role="checkbox" aria-checked={on} className={`pg-plan-chip ${on ? "on" : ""}`} onClick={() => toggle([id], !on)} data-testid={`plan-group-${g.id}`}>
                {on && <span aria-hidden>✓ </span>}
                {g.label} <span className="pg-shape-count">{counts[id]}</span>
              </button>
            );
          })}
        </div>
      )}
      {!cats.length && <div className="pg-plan-warn mt-2" data-testid="plan-cats-empty">Pick at least one category so every puzzle gets a shape.</div>}
    </div>
  );
}

/** Everything under "Pick a shape" once a plan is chosen. */
export function ShapePlanPanel({ tool, design, set, list, themes, focus, setFocus, compact }: { tool: ToolKind; design: Design; set: Setter; list: PlanItem[]; themes: string[]; focus: number; setFocus: (i: number) => void; compact?: boolean }) {
  const allowed = shapesFor(tool);
  const mode = planMode(design.shape.mix);
  const targets = React.useMemo(() => shapeTargetsFor(design.shape, list, allowed), [design.shape, list, allowed]);
  const pins = design.shape.pins ?? {};
  const [editing, setEditing] = React.useState(false);
  const [jump, setJump] = React.useState(0);
  const f = Math.min(focus, Math.max(0, targets.length - 1));
  const noun = tool === "sudoku" ? "frame" : "shape";
  const pool = planPool(design.shape, allowed);
  const themeMode = planThemes(design.shape);
  const hasThemes = themes.length > 0;

  const shade = (
    <div className="form-check form-switch mb-0">
      <input className="form-check-input" type="checkbox" id={`shape-shade${compact ? "-c" : ""}`} checked={design.shape.shade && design.shape.outline !== "stepped"} onChange={(e) => set((d) => { d.shape.shade = e.target.checked; })} data-testid="shape-shade" disabled={design.shape.outline === "stepped"} />
      <label className="form-check-label" htmlFor={`shape-shade${compact ? "-c" : ""}`}>
        Light shaded silhouette{design.shape.outline === "stepped" ? " (off for stepped outlines)" : ""}
      </label>
    </div>
  );

  const pin = (i: number, k: ShapeKey | null) =>
    set((d) => {
      const next = { ...(d.shape.pins ?? {}) };
      if (k) next[String(i)] = k;
      else delete next[String(i)];
      if (Object.keys(next).length) d.shape.pins = next;
      else delete d.shape.pins;
    });

  if (mode === "one") {
    return (
      <div data-testid="plan-panel" data-mode="one">
        <div className="mb-3">{shade}</div>
        <ShapePicker tool={tool} design={design} themes={themes} compact={compact} onPick={(k) => set((d) => chooseOneShape(d, k))} />
      </div>
    );
  }

  const lineup = list.length ? (
    <Lineup
      tool={tool}
      design={design}
      targets={targets}
      focus={f}
      pins={pins}
      labels={list}
      onSelect={(i) => {
        if (i === f && mode !== "manual") setEditing((e) => !e);
        else setEditing(mode !== "manual" ? true : editing);
        setFocus(i);
        setJump((n) => n + 1);
      }}
    />
  ) : (
    <div className="pg-plan-note">Your puzzles will follow this plan as soon as they are made.</div>
  );

  const randomTools = (
    <div className="pg-plan-tools">
      <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => set((d) => { d.shape.seed = randomPlanSeed(); })} disabled={pool.length < 2} data-testid="plan-shuffle">
        <BsShuffle /> Shuffle {noun}s
      </button>
      <span className="small text-muted" data-testid="plan-pool">
        {pool.length} {noun}s in the mix{pool.length && list.length > pool.length ? ` · each is used once before any repeats` : list.length ? " · no repeats" : ""}
      </span>
      {Object.keys(pins).length > 0 && (
        <button type="button" className="btn btn-ghost btn-sm ms-auto" onClick={() => set((d) => { delete d.shape.pins; })} data-testid="plan-unpin-all">
          <BsArrowCounterclockwise /> Unpin all
        </button>
      )}
    </div>
  );

  const themeSeg = hasThemes && (
    <div className="pg-plan-themes">
      <span className="small fw-semibold me-1">Themes</span>
      <div className="pg-seg" role="radiogroup" aria-label="Themes">
        {(
          [
            ["off", "Ignore themes"],
            ["match", "Match theme names"],
            ["group", "One shape per theme"],
          ] as [ThemeMode, string][]
        ).map(([v, label]) => (
          <button key={v} type="button" role="radio" aria-checked={themeMode === v} className={themeMode === v ? "active" : ""} onClick={() => set((d) => { d.shape.themes = v; })} data-testid={`plan-themes-${v}`}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );

  const focused = targets[f];
  const editor =
    list.length > 0 && focused ? (
      mode === "manual" ? (
        <div className="pg-plan-editor" data-testid="page-editor">
          <div className="pg-plan-editor-head">
            <strong>
              Puzzle {f + 1}
              {list[f]?.title ? <span className="text-muted fw-normal"> · {list[f].title}</span> : null}
            </strong>
            <span className="small text-muted">{pins[String(f)] ? shapeInfo(focused).label : `${shapeInfo(focused).label} (default)`}</span>
            <span className="ms-auto d-flex gap-2 flex-wrap">
              <button type="button" className="btn btn-light btn-sm" disabled={f === 0} onClick={() => setFocus(f - 1)} data-testid="page-prev"><BsChevronLeft /> Prev</button>
              <button type="button" className="btn btn-light btn-sm" disabled={f >= targets.length - 1} onClick={() => setFocus(f + 1)} data-testid="page-next">Next <BsChevronRight /></button>
            </span>
          </div>
          <div className="pg-plan-helpers">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => set((d) => { d.shape.kind = focused; })} data-testid="manual-apply-rest" title="Pages you haven't picked yet use this shape">
              Use {shapeInfo(focused).label.toLowerCase()} for every unpicked page
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              data-testid="manual-fill-random"
              onClick={() =>
                set((d) => {
                  const empty = list.map((_, i) => i).filter((i) => !d.shape.pins?.[String(i)]);
                  if (!empty.length) return;
                  const rnd = shapeTargetsFor({ kind: d.shape.kind, mix: "each", seed: randomPlanSeed(), pins: d.shape.pins }, list, allowed);
                  d.shape.pins = { ...(d.shape.pins ?? {}), ...Object.fromEntries(empty.map((i) => [String(i), rnd[i]])) };
                })
              }
            >
              <BsDice5 /> Fill unpicked pages randomly
            </button>
            {Object.keys(pins).length > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set((d) => { delete d.shape.pins; })} data-testid="manual-clear">
                <BsArrowCounterclockwise /> Clear all picks
              </button>
            )}
          </div>
          <ShapePicker
            tool={tool}
            design={design}
            themes={list[f]?.theme ? [list[f].theme as string] : themes}
            compact
            selected={focused}
            testId="page-picker"
            follow={jump}
            onPick={(k) => {
              pin(f, k);
              if (f < targets.length - 1) setFocus(f + 1);
            }}
          />
        </div>
      ) : editing ? (
        <div className="pg-plan-editor" data-testid="override-editor">
          <div className="pg-plan-editor-head">
            <strong>Puzzle {f + 1}</strong>
            <span className="small text-muted">{pins[String(f)] ? `Pinned: ${shapeInfo(focused).label}` : `Random pick: ${shapeInfo(focused).label}`}</span>
            <span className="ms-auto d-flex gap-2">
              {pins[String(f)] && (
                <button type="button" className="btn btn-light btn-sm" onClick={() => pin(f, null)} data-testid="override-unpin">
                  <BsShuffle /> Back to random
                </button>
              )}
              <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Close" onClick={() => setEditing(false)} data-testid="override-close">
                <BsXLg />
              </button>
            </span>
          </div>
          <div className="small text-muted mb-2">Pick a shape to pin it to this puzzle. Pinned puzzles keep their shape when you shuffle.</div>
          <ShapePicker tool={tool} design={design} themes={list[f]?.theme ? [list[f].theme as string] : themes} compact selected={focused} testId="override-picker" follow={jump} onPick={(k) => pin(f, k)} />
        </div>
      ) : (
        <div className="small text-muted">Click any puzzle in the lineup to preview it, or to pin a different {noun} to it.</div>
      )
    ) : null;

  return (
    <div data-testid="plan-panel" data-mode={mode} className="d-grid gap-3">
      {mode === "pick" && <CategoryChooser tool={tool} design={design} set={set} />}
      {mode !== "manual" && randomTools}
      {mode !== "manual" && themeSeg}
      {lineup}
      {editor}
      {shade}
    </div>
  );
}
