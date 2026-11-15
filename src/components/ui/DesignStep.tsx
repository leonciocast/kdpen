"use client";
import React, { useEffect, useRef, useState } from "react";
import { BsCheck2Circle, BsCheckCircleFill, BsDownload, BsEye, BsSliders, BsTrash, BsUpload, BsArrowCounterclockwise, BsSave } from "react-icons/bs";
import { Panel } from "./Panel";
import { toast } from "react-toastify";
import { TEMPLATES, templateDesign } from "@/lib/design/templates";
import { DESIGN_OPTIONS, designFromJson, designToJson } from "@/lib/design/presets";
import { FONT_FAMILIES, FONT_KEYS, FontKey } from "@/lib/design/fonts";
import { Design, TOOL_HEADER, ToolKind } from "@/lib/design/types";
import { fetchFonts, familiesFor, filesFor, FontData } from "@/lib/print/fonts";
import type { PageKind, RenderedBook } from "@/lib/print/book";
import { ChoiceCards, FlowCtl, Question, QuestionFlow } from "./Flow";
import InfoTip from "./InfoTip";
import PdfPreview from "./PdfPreview";
import { downloadText } from "./CsvDrop";
import type { DesignApi } from "./useDesign";
import { FramePicker, frameIdOf } from "./ShapePicker";
import { ShapePlanPanel, PlanItem, applyPlanMode, planOptions, planSummary } from "./ShapePlan";
import { DEFAULT_STEPPED_COLOR, OUTLINE_COLORS } from "@/lib/shapes/shapes";
import { PlanMode, planCats, planMode } from "@/lib/shapes/plan";

const LABELS: Record<string, string> = {
  rule: "Thin rule", banner: "Bold banner", ribbon: "Ribbon", underline: "Underlined", boxed: "Boxed", tab: "Tab", minimal: "Minimal",
  circle: "Circle", rounded: "Rounded", diamond: "Diamond", hexagon: "Hexagon",
  none: "None", magnifier: "Magnifier", star: "Star", heart: "Heart", leaf: "Leaf", sun: "Sun", snowflake: "Snowflake", flower: "Flower", pencil: "Pencil",
  dots: "Dots", diagonal: "Diagonal lines", waves: "Waves", confetti: "Confetti", grid: "Graph paper", corners: "Corner ornaments", snow: "Snowflakes",
  square: "Square", double: "Double",
  rows: "Alternate rows", checker: "Checkerboard",
  plain: "7", dashes: "– 7 –", pill: "Pill",
  entered: "As entered", alpha: "A → Z", length: "Short → long",
  solid: "Solid", dashed: "Dashed", dotted: "Dotted",
  circles: "Circles",
};

type PreviewTab = { id: string; label: string; find: (kinds: PageKind[]) => number };
const TABS: PreviewTab[] = [
  { id: "puzzle", label: "Puzzle page", find: (k) => k.indexOf("content") },
  { id: "answers", label: "Solutions", find: (k) => k.lastIndexOf("content") },
  { id: "belongs", label: "Belongs to", find: (k) => k.indexOf("belongs") },
  { id: "howto", label: "How to play", find: (k) => k.indexOf("howto") },
  { id: "toc", label: "Contents", find: (k) => k.indexOf("toc") },
  { id: "title", label: "Title page", find: (k) => k.indexOf("title") },
  { id: "thanks", label: "Thank you", find: (k) => k.indexOf("thanks") },
];

function Seg<T extends string>({ value, options, onChange, label, labels }: { value: T; options: readonly T[]; onChange: (v: T) => void; label: string; labels?: Record<string, string> }) {
  return (
    <div className="pg-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={value === o} className={value === o ? "active" : ""} onClick={() => onChange(o)}>
          {labels?.[o] ?? LABELS[o] ?? o}
        </button>
      ))}
    </div>
  );
}

function Section({ title, children, open }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="pg-accordion" open={open}>
      <summary>{title}</summary>
      <div className="pg-accordion-body">{children}</div>
    </details>
  );
}

/** Remembers "I chose to customize" while the user moves between wizard steps. */
const customizingByTool = new Map<string, boolean>();

interface Props {
  tool: ToolKind;
  api: DesignApi;
  /** Build a small sample book (the focused puzzle and the next, their solutions and the front pages) with this design. */
  buildSample: (design: Design, fonts: FontData, focus: number) => RenderedBook;
  /** "word list" / "clue list"; omit when the puzzle has no list (sudoku). */
  listName?: string;
  /** Status of re-fitting the user's puzzles into the chosen shape (word search / crossword). */
  shapeStatus?: React.ReactNode;
  /** Puzzles are being re-shaped: hold the user on this step until it is done. */
  busy?: boolean;
  flow: FlowCtl;
  /** Puzzle themes, used to suggest a matching animal shape. */
  themes?: string[];
  /** Changes when the puzzles themselves are re-shaped, so the preview reloads. */
  previewKey?: string;
  /** The book's puzzles in order (title / theme), for the shape plan lineup. */
  planList?: PlanItem[];
}

const SHAPE_LEAD: Record<ToolKind, string> = {
  "word-search": "The letters fill the shape you pick — a heart, a star, or an animal silhouette — and every word stays inside it. Grids grow a little when a shape needs more room, so no word is ever dropped.",
  crossword: "The crossword is built inside the shape: every word stays within its outline. Only shapes that still give well-connected crosswords are offered, including the animals that work well.",
  mystery: "Each case grid fills the shape you pick, and the leftover letters still spell the hidden message exactly. Grids grow a little when a shape needs more room.",
  sudoku: "A sudoku must stay a 9×9 square to be solvable, so the shape is a decorative frame around the grid (animals sit the grid in the body). You can also round or circle the cells in the next step.",
};

const NO_ITEMS: PlanItem[] = [];

export default function DesignStep({ tool, api, buildSample, listName, shapeStatus, busy, flow, themes = [], previewKey, planList = NO_ITEMS }: Props) {
  const [focus, setFocusState] = useState(0);
  const setFocus = (i: number) => setFocusState(Math.max(0, Math.min(i, Math.max(0, planList.length - 1))));
  const [customizing, setCustomizingState] = useState(() => flow.sub === "customize" || !!customizingByTool.get(tool));
  const setCustomizing = (v: boolean) => {
    customizingByTool.set(tool, v);
    setCustomizingState(v);
  };
  const { design, setDesign, presets, savePreset, deletePreset } = api;
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [kinds, setKinds] = useState<PageKind[]>([]);
  const [tab, setTab] = useState("puzzle");
  const [presetName, setPresetName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const buildRef = useRef(buildSample);
  useEffect(() => {
    buildRef.current = buildSample;
  });

  // Rebuild the sample PDF shortly after the last change.
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const fonts = await fetchFonts(filesFor(familiesFor(design)));
        if (cancelled) return;
        const book = buildRef.current(design, fonts, design.shape.mix === "one" ? 0 : focus);
        if (cancelled) return;
        setKinds(book.kinds);
        setBytes(book.pdf.output("arraybuffer"));
      } catch (e) {
        if (!cancelled) toast.error(`Preview failed: ${(e as Error).message}`);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [design, previewKey, focus]);

  const set = (fn: (d: Design) => void) => {
    const d: Design = JSON.parse(JSON.stringify(design));
    fn(d);
    setDesign(d);
  };
  const tabs = TABS.filter((t) => t.find(kinds) >= 0);
  const current = tabs.find((t) => t.id === tab) ?? tabs[0];
  const pageIndex = current ? current.find(kinds) : 0;

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const d = designFromJson(await file.text());
      setDesign(d);
      toast.success(`Design “${d.name}” loaded.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const fontSelect = (id: string, label: string, value: FontKey, onChange: (k: FontKey) => void) => (
    <div className="col-sm-4">
      <label className="form-label small" htmlFor={id}>
        {label}
      </label>
      <select id={id} className="form-select form-select-sm" value={value} onChange={(e) => onChange(e.target.value as FontKey)}>
        {FONT_KEYS.map((k) => (
          <option key={k} value={k}>
            {FONT_FAMILIES[k].label}
          </option>
        ))}
      </select>
    </div>
  );

  const preview = (
    <div className="position-sticky" style={{ top: 84 }}>
            <Panel tone="result" title="Live preview" icon={<BsEye />}>
            <div className="pg-seg mb-2" role="tablist" aria-label="Preview page">
              {tabs.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={current?.id === t.id} className={current?.id === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
            <PdfPreview bytes={bytes} page={pageIndex + 1} label={`Preview: ${current?.label ?? "page"}`} />
            <div className="form-text">This is the real PDF page. Your own puzzles use the same layout.</div>
            </Panel>
    </div>
  );

  const pickTemplate: Question = {
    key: "template",
    wide: true,
    title: "Pick a look for your pages",
    lead: "Click a template and watch the preview on the right. Every template is black & white safe for KDP.",
    hint: `Template: ${design.name}`,
    body: (
      <div className="row g-4">
        <div className="col-lg-7">
          <div className="pg-template-grid" role="radiogroup" aria-label="Templates">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={design.template === t.id}
                className={`pg-template-card ${design.template === t.id ? "active" : ""}`}
                onClick={() => setDesign({ ...templateDesign(t.id), header: { ...templateDesign(t.id).header, text: design.header.text }, shape: design.shape })}
                data-testid={`template-${t.id}`}
              >
                <strong>
                  {t.name}
                  {design.template === t.id && <BsCheckCircleFill className="pg-template-check" aria-label="Selected" />}
                </strong>
                <span>{t.description}</span>
              </button>
            ))}
          </div>

        </div>
        <div className="col-lg-5">{preview}</div>
      </div>
    ),
  };

  const mode = planMode(design.shape.mix);
  const noun = tool === "sudoku" ? "frame" : "shape";
  const pickPlan: Question = {
    key: "plan",
    title: tool === "sudoku" ? "How should frames change across your book?" : "How should shapes change across your book?",
    lead: tool === "sudoku" ? "Keep one frame for every sudoku, or let every page wear a different one." : "Keep one shape for every puzzle, or give every page its own. You can change this any time.",
    wide: true,
    hint: `Plan: ${planOptions(tool).find((o) => o.value === mode)?.title}`,
    body: (
      <ChoiceCards<PlanMode>
        label="Shape plan"
        value={mode}
        cols={2}
        onPick={(m) => {
          set((d) => applyPlanMode(d, m, tool, planList));
          flow.setSub("shape");
        }}
        options={planOptions(tool)}
      />
    ),
  };

  const shapeTitles: Record<PlanMode, string> = {
    one: tool === "sudoku" ? "Pick a frame shape" : "Pick a shape",
    surprise: `Your surprise ${noun} lineup`,
    pick: "Choose the categories to mix",
    manual: `Pick a ${noun} for each page`,
  };
  const shapeLeads: Record<PlanMode, string> = {
    one: SHAPE_LEAD[tool],
    surprise: `Every puzzle gets a different ${noun} from all categories. Shuffle for a new mix, or click a puzzle to pin the ${noun} you want.`,
    pick: `Each puzzle gets a different ${noun} from the categories you tick. Click a puzzle in the lineup to pin a ${noun} to it.`,
    manual: `Click a puzzle, then click its ${noun}. We jump to the next puzzle for you. Pages you skip use the default ${noun}.`,
  };
  const catsMissing = mode === "pick" && !planCats(design.shape).length;
  const pickShape: Question = {
    key: "shape",
    wide: true,
    title: shapeTitles[mode],
    lead: shapeLeads[mode],
    hint: busy ? "Fitting your puzzles into the shapes…" : `${tool === "sudoku" ? "Frame" : "Shape"}: ${planSummary(design, tool, planList.length)}`,
    canNext: !busy && !catsMissing,
    blockedHint: catsMissing ? "Pick at least one category" : "Fitting your puzzles into the shapes…",
    body: (
      <div className="row g-4">
        <div className="col-lg-7">
          <ShapePlanPanel tool={tool} design={design} set={set} list={planList} themes={themes} focus={focus} setFocus={setFocus} />
          {(tool === "word-search" || tool === "mystery") && (
            <div className="mt-3">
              <Seg label="Shape outline" value={design.shape.outline} options={DESIGN_OPTIONS.OUTLINES} labels={{ smooth: "Artist (smooth)", stepped: "Stepped cell outline", snug: "Snug (hugs letters)", blocky: "Blocky / pixel" }} onChange={(v) => set((d) => { d.shape.outline = v; if (v === "stepped") d.shape.shade = false; })} />
              {design.shape.outline === "stepped" && (
                <div className="pg-outline-colors mt-2" data-testid="outline-colors">
                  <span className="form-label small mb-0">Outline colour</span>
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    {OUTLINE_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`pg-color-chip ${(design.shape.outlineColor || DEFAULT_STEPPED_COLOR).toLowerCase() === c.hex.toLowerCase() ? "active" : ""}`}
                        style={{ background: c.hex }}
                        aria-label={c.label}
                        title={c.label}
                        data-testid={`outline-color-${c.id}`}
                        onClick={() => set((d) => { d.shape.outlineColor = c.hex; })}
                      />
                    ))}
                    <input
                      type="color"
                      className="form-control form-control-color pg-swatch"
                      aria-label="Custom outline colour"
                      data-testid="outline-color-custom"
                      value={design.shape.outlineColor || DEFAULT_STEPPED_COLOR}
                      onChange={(e) => set((d) => { d.shape.outlineColor = e.target.value; })}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          {shapeStatus && <div className="pg-shape-status small" aria-live="polite">{shapeStatus}</div>}
        </div>
        <div className="col-lg-5">{preview}</div>
      </div>
    ),
  };

  const cellChoices = tool === "sudoku" ? (["plain", "rounded", "circles"] as const) : (["plain", "boxed", "rounded", "circles"] as const);
  const frameExtras = (
    <div className="d-grid gap-3 mt-3" data-testid="frame-extras">
      {tool !== "crossword" && (
        <div>
          <div className="form-label small mb-1">{tool === "sudoku" ? "Number cells" : "Letter cells"}</div>
          <div className="pg-seg" role="radiogroup" aria-label="Cell style">
            {cellChoices.map((o) => (
              <button key={o} type="button" role="radio" aria-checked={design.grid.cells === o} className={design.grid.cells === o ? "active" : ""} onClick={() => set((d) => (d.grid.cells = o))} data-testid={`cells-${o}`}>
                {o === "plain" ? (tool === "sudoku" ? "Square" : "Plain") : o === "boxed" ? "Boxed" : o === "rounded" ? "Rounded boxes" : "Circles"}
              </button>
            ))}
          </div>
        </div>
      )}
      {(tool === "word-search" || tool === "mystery") && (
        <div className="form-check form-switch">
          <input className="form-check-input" type="checkbox" id="ds-lines2" checked={design.grid.lines} onChange={(e) => set((d) => (d.grid.lines = e.target.checked))} data-testid="inner-lines" />
          <label className="form-check-label" htmlFor="ds-lines2">
            Thin lines between the letters
          </label>
        </div>
      )}
      {listName && (
        <div>
          <div className="form-label small mb-1">Box around the {listName}</div>
          <Seg label={`Box around the ${listName}`} value={design.list.box} options={DESIGN_OPTIONS.LIST_BOXES} onChange={(v) => set((d) => (d.list.box = v))} />
        </div>
      )}
    </div>
  );

  const pickFrame: Question = {
    key: "frame",
    wide: true,
    title: "Pick a frame",
    lead: "How the outline around the grid is drawn. All frames are crisp vector lines that print well in black & white.",
    hint: `Frame: ${frameIdOf(design.grid) ?? "custom"}`,
    body: (
      <div className="row g-4">
        <div className="col-lg-7">
          <FramePicker tool={tool} design={design} onChange={(g) => set((d) => (d.grid = g))} />
          {frameExtras}
        </div>
        <div className="col-lg-5">{preview}</div>
      </div>
    ),
  };

  const tune: Question = {
    key: "tune",
    title: "Happy with this design?",
    lead: `You picked “${design.name}”. Most people use it as it is. You can also fine-tune fonts, header, grid and more.`,
    hideNext: true,
    body: (
      <ChoiceCards
        label="Customize the design?"
        value={null}
        onPick={(v) => {
          if (v === "keep") {
            setCustomizing(false);
            return flow.onFinish();
          }
          setCustomizing(true);
          flow.setSub("customize");
        }}
        options={[
          { value: "keep", title: "Use it as it is", text: "Go straight to creating your book. You can come back and change the design any time.", icon: <BsCheck2Circle />, testId: "design-keep", badge: "Recommended", cta: "Continue to export" },
          { value: "custom", title: "Customize it", text: "Change the header, fonts, grid style, colours, page numbers and more, with a live preview. You can save it for next time.", icon: <BsSliders />, testId: "design-customize", cta: "Customize" },
        ]}
      />
    ),
  };

  const customize: Question = {
    key: "customize",
    wide: true,
    title: "Customize your design",
    lead: "Open any section to change it. The preview updates as you go.",
    nextLabel: "Continue to export",
    hint: `Template: ${design.name}`,
    body: (
      <div className="row g-4" data-testid="customize">
        <div className="col-lg-7">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="small text-muted">Header, fonts, grid, colour, {listName ?? "labels"} and page numbers.</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDesign({ ...templateDesign(design.template) })} title="Undo your changes to this template">
                <BsArrowCounterclockwise /> Reset template
              </button>
            </div>

          <Section title="Header & title" open>
            <div className="row g-2">
              <div className="col-sm-6">
                <label className="form-label small" htmlFor="ds-title">
                  Header text
                </label>
                <input id="ds-title" className="form-control form-control-sm" maxLength={40} placeholder={TOOL_HEADER[tool]} value={design.header.text} onChange={(e) => set((d) => (d.header.text = e.target.value))} />
              </div>
              <div className="col-sm-6">
                <label className="form-label small" htmlFor="ds-icon">
                  Icon
                </label>
                <select id="ds-icon" className="form-select form-select-sm" value={design.header.icon} onChange={(e) => set((d) => (d.header.icon = e.target.value as Design["header"]["icon"]))}>
                  {DESIGN_OPTIONS.ICONS.map((o) => (
                    <option key={o} value={o}>
                      {LABELS[o]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12">
                <div className="form-label small mb-1">Header style</div>
                <Seg label="Header style" value={design.header.style} options={DESIGN_OPTIONS.HEADERS} onChange={(v) => set((d) => (d.header.style = v))} />
              </div>
              <div className="col-sm-6">
                <div className="form-check form-switch mt-2">
                  <input className="form-check-input" type="checkbox" id="ds-badge" checked={design.header.badge} onChange={(e) => set((d) => (d.header.badge = e.target.checked))} />
                  <label className="form-check-label" htmlFor="ds-badge">
                    Puzzle number badge
                  </label>
                </div>
              </div>
              <div className="col-sm-6">
                <div className="form-check form-switch mt-2">
                  <input className="form-check-input" type="checkbox" id="ds-ptitle" checked={design.header.showPuzzleTitle} onChange={(e) => set((d) => (d.header.showPuzzleTitle = e.target.checked))} />
                  <label className="form-check-label" htmlFor="ds-ptitle">
                    Show each puzzle&apos;s title/theme
                  </label>
                </div>
              </div>
              {design.header.badge && (
                <div className="col-12">
                  <div className="form-label small mb-1">Badge shape</div>
                  <Seg label="Badge shape" value={design.header.badgeShape} options={DESIGN_OPTIONS.BADGES} onChange={(v) => set((d) => (d.header.badgeShape = v))} />
                </div>
              )}
            </div>
          </Section>

          <Section title="Fonts">
            <div className="row g-2">
              {fontSelect("ds-fh", "Headings", design.fonts.heading, (k) => set((d) => (d.fonts.heading = k)))}
              {fontSelect("ds-fg", tool === "sudoku" ? "Numbers" : "Grid letters", design.fonts.grid, (k) => set((d) => (d.fonts.grid = k)))}
              {fontSelect("ds-fl", tool === "sudoku" ? "Labels" : "Lists", design.fonts.list, (k) => set((d) => (d.fonts.list = k)))}
              <div className="col-sm-6">
                <label className="form-label small" htmlFor="ds-gs">
                  {tool === "sudoku" ? "Number" : "Grid letter"} size: {Math.round(design.fonts.gridScale * 100)}%
                </label>
                <input id="ds-gs" type="range" className="form-range" min={0.8} max={1.3} step={0.05} value={design.fonts.gridScale} onChange={(e) => set((d) => (d.fonts.gridScale = Number(e.target.value)))} />
              </div>
              <div className="col-sm-6">
                <label className="form-label small" htmlFor="ds-ls">
                  List text size: {Math.round(design.fonts.listScale * 100)}%
                </label>
                <input id="ds-ls" type="range" className="form-range" min={0.8} max={1.3} step={0.05} value={design.fonts.listScale} onChange={(e) => set((d) => (d.fonts.listScale = Number(e.target.value)))} />
              </div>
            </div>
          </Section>

          <Section title={tool === "sudoku" ? "Frame shape" : "Shape"}>
            <div className="pg-seg mb-3" role="radiogroup" aria-label="Shape plan">
              {planOptions(tool).map((o) => (
                <button key={o.value} type="button" role="radio" aria-checked={mode === o.value} className={mode === o.value ? "active" : ""} onClick={() => set((d) => applyPlanMode(d, o.value, tool, planList))} data-testid={`plan-seg-${o.value}`}>
                  {o.value === "one" ? `One ${noun}` : o.value === "surprise" ? "Surprise me" : o.value === "pick" ? "From categories" : "Page by page"}
                </button>
              ))}
            </div>
            <ShapePlanPanel tool={tool} design={design} set={set} list={planList} themes={themes} focus={focus} setFocus={setFocus} compact />
            {shapeStatus && <div className="pg-shape-status small">{shapeStatus}</div>}
          </Section>

          <Section title="Grid style">
            <div className="d-grid gap-2">
              <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" id="ds-lines" checked={design.grid.lines} onChange={(e) => set((d) => (d.grid.lines = e.target.checked))} />
                <label className="form-check-label" htmlFor="ds-lines">
                  Cell lines
                </label>
              </div>
              <div>
                <div className="form-label small mb-1">Outer border</div>
                <Seg label="Outer border" value={design.grid.border} options={DESIGN_OPTIONS.BORDERS} onChange={(v) => set((d) => (d.grid.border = v))} />
              </div>
              <div>
                <div className="form-label small mb-1">Shading</div>
                <Seg label="Shading" value={design.grid.shade} options={DESIGN_OPTIONS.SHADES} onChange={(v) => set((d) => (d.grid.shade = v))} />
              </div>
              <div>
                <div className="form-label small mb-1">Outline line</div>
                <Seg label="Outline line" value={design.grid.line} options={DESIGN_OPTIONS.LINES} onChange={(v) => set((d) => (d.grid.line = v))} />
              </div>
              <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" id="ds-shadow" checked={design.grid.shadow} onChange={(e) => set((d) => (d.grid.shadow = e.target.checked))} />
                <label className="form-check-label" htmlFor="ds-shadow">
                  Shadow behind the outline
                </label>
              </div>
              {tool !== "crossword" && (
                <div>
                  <div className="form-label small mb-1">Cells</div>
                  <Seg label="Cells" value={design.grid.cells} options={tool === "sudoku" ? (["plain", "rounded", "circles"] as const) : DESIGN_OPTIONS.CELLS} labels={{ plain: tool === "sudoku" ? "Square" : "Plain", boxed: "Boxed", rounded: "Rounded boxes", circles: "Circles" }} onChange={(v) => set((d) => (d.grid.cells = v))} />
                </div>
              )}
              <div>
                <label className="form-label small" htmlFor="ds-frame">
                  Frame thickness: {design.grid.frame.toFixed(1)} pt
                </label>
                <input id="ds-frame" type="range" className="form-range" min={0.5} max={4} step={0.1} value={design.grid.frame} onChange={(e) => set((d) => (d.grid.frame = Number(e.target.value)))} />
              </div>
            </div>
          </Section>

          <Section title="Colour & background">
            <div className="row g-2 align-items-end">
              <div className="col-auto">
                <label className="form-label small" htmlFor="ds-accent">
                  Accent
                </label>
                <input id="ds-accent" type="color" className="form-control form-control-color pg-swatch" value={design.color.accent} onChange={(e) => set((d) => (d.color.accent = e.target.value))} />
              </div>
              <div className="col">
                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" id="ds-gray" checked={design.color.grayscale} onChange={(e) => set((d) => (d.color.grayscale = e.target.checked))} />
                  <label className="form-check-label" htmlFor="ds-gray">
                    Black &amp; white safe <InfoTip text="KDP's standard paperback interior is black & white. Keep this on unless you will choose a colour interior; colours are converted to matching grays." />
                  </label>
                </div>
              </div>
              <div className="col-sm-6">
                <label className="form-label small" htmlFor="ds-pattern">
                  Background pattern
                </label>
                <select id="ds-pattern" className="form-select form-select-sm" value={design.pattern.kind} onChange={(e) => set((d) => (d.pattern.kind = e.target.value as Design["pattern"]["kind"]))}>
                  {DESIGN_OPTIONS.PATTERNS.map((o) => (
                    <option key={o} value={o}>
                      {LABELS[o]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-sm-6">
                <label className="form-label small" htmlFor="ds-strength">
                  Pattern strength (low ink)
                </label>
                <input id="ds-strength" type="range" className="form-range" min={0} max={1} step={0.05} disabled={design.pattern.kind === "none"} value={design.pattern.strength} onChange={(e) => set((d) => (d.pattern.strength = Number(e.target.value)))} />
              </div>
            </div>
          </Section>

          {listName && (
            <Section title={`${listName[0].toUpperCase()}${listName.slice(1)}`}>
              <div className="d-grid gap-2">
                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" id="ds-check" checked={design.list.checkbox} onChange={(e) => set((d) => (d.list.checkbox = e.target.checked))} data-testid="checkbox-toggle" />
                  <label className="form-check-label" htmlFor="ds-check">
                    Checkbox ☐ before each {tool === "crossword" ? "clue" : "word"}
                  </label>
                </div>
                <div>
                  <div className="form-label small mb-1">Box around the list</div>
                  <Seg label="Box around the list" value={design.list.box} options={DESIGN_OPTIONS.LIST_BOXES} onChange={(v) => set((d) => (d.list.box = v))} />
                </div>
                {tool !== "crossword" && (
                  <div>
                    <div className="form-label small mb-1">Order</div>
                    <Seg label="Order" value={design.list.sort} options={DESIGN_OPTIONS.SORTS} onChange={(v) => set((d) => (d.list.sort = v))} />
                  </div>
                )}
                {tool !== "crossword" && (
                  <div>
                    <label className="form-label small" htmlFor="ds-cols">
                      Columns
                    </label>
                    <select id="ds-cols" className="form-select form-select-sm" style={{ maxWidth: 160 }} value={design.list.columns} onChange={(e) => set((d) => (d.list.columns = Number(e.target.value)))}>
                      <option value={0}>Automatic</option>
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </Section>
          )}

          <Section title="Page numbers">
            <Seg label="Page numbers" value={design.pageNumber} options={DESIGN_OPTIONS.NUMBERS} onChange={(v) => set((d) => (d.pageNumber = v))} />
          </Section>
          <Section title="Save & reuse this design">
            <div className="d-flex gap-2 mb-2">
              <input className="form-control form-control-sm" placeholder="Name this design, e.g. Winter large print" value={presetName} maxLength={60} onChange={(e) => setPresetName(e.target.value)} aria-label="Design name" />
              <button
                type="button"
                className="btn btn-primary btn-sm text-nowrap"
                onClick={() => {
                  const name = presetName.trim() || design.name;
                  savePreset(name);
                  setPresetName("");
                  toast.success(`Saved “${name}”.`);
                }}
              >
                <BsSave /> Save
              </button>
            </div>
            {presets.length > 0 ? (
              <ul className="list-unstyled d-grid gap-1 mb-2">
                {presets.map((p) => (
                  <li key={p.name} className="d-flex align-items-center gap-2 small">
                    <span className="flex-grow-1 fw-semibold">{p.name}</span>
                    <button type="button" className="btn btn-light btn-sm" onClick={() => setDesign(p)}>
                      Use
                    </button>
                    <button type="button" className="btn btn-ghost btn-icon" aria-label={`Delete ${p.name}`} onClick={() => deletePreset(p.name)}>
                      <BsTrash />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="form-text mb-2">Saved designs appear here and work in all three tools.</div>
            )}
            <div className="d-flex gap-2 flex-wrap">
              <button type="button" className="btn btn-light btn-sm" onClick={() => downloadText(`${(design.name || "design").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`, designToJson(design), "application/json")}>
                <BsDownload /> Export design file
              </button>
              <button type="button" className="btn btn-light btn-sm" onClick={() => fileRef.current?.click()}>
                <BsUpload /> Import design file
              </button>
              <input ref={fileRef} type="file" accept=".json,application/json" className="d-none" onChange={(e) => importFile(e.target.files?.[0])} data-testid="design-import" />
            </div>
          </Section>
        </div>
        <div className="col-lg-5">{preview}</div>
      </div>
    ),
  };

  return <QuestionFlow flow={flow} questions={customizing ? [pickTemplate, pickPlan, pickShape, pickFrame, tune, customize] : [pickTemplate, pickPlan, pickShape, pickFrame, tune]} />;
}
