"use client";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  BsArrowCounterclockwise,
  BsArrowClockwise,
  BsArrowsAngleContract,
  BsArrowsAngleExpand,
  BsBookHalf,
  BsCheckCircleFill,
  BsChevronBarDown,
  BsChevronBarUp,
  BsChevronDown,
  BsChevronLeft,
  BsChevronRight,
  BsChevronUp,
  BsExclamationTriangleFill,
  BsFileEarmark,
  BsFiles,
  BsGrid3X3Gap,
  BsInfoCircleFill,
  BsLayoutSplit,
  BsPlusLg,
  BsShuffle,
  BsSortDown,
  BsThreeDots,
  BsTrash,
  BsXCircleFill,
  BsXLg,
  BsZoomIn,
  BsZoomOut,
  BsBoundingBox,
  BsArrowRepeat,
  BsListOl,
} from "react-icons/bs";
import { TRIM_SIZES, TrimKey, makePageSpec, marginsForPage, PT, BLEED_PER_EDGE_IN } from "@/lib/print/kdp";
import { CheckFix, DELETABLE, DUPLICABLE, PageInfo, ReadinessCheck, SectionKey, Slot, SlotKind, moveSlots, newSlotId, nudgeSlots } from "@/lib/print/arrange";
import type { Progress } from "@/lib/jobs/types";
import { loadPdfJs } from "../PdfPreview";
import PageImage from "./PageImage";
import type { LoadedDoc } from "./pageCache";

export interface PreviewPdf {
  bytes: ArrayBuffer;
  /** Page keys of the built PDF, in order (to map thumbnails while a new build runs). */
  keys: string[];
  version: number;
}

export interface Sorter {
  key: string;
  label: string;
  apply: () => void;
}

type View = "grid" | "page" | "spread";
type Zoom = "fit-width" | "fit-page" | number;

interface Props {
  pages: PageInfo[];
  slots: Slot[];
  onChange: (next: Slot[]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onReset: () => void;
  isDefault: boolean;
  pdf: PreviewPdf | null;
  building: boolean;
  progress: Progress | null;
  error: string | null;
  checks: ReadinessCheck[];
  onFix: (f: CheckFix) => void;
  trim: TrimKey;
  bleed: boolean;
  unit: string;
  sorters: Sorter[];
  onShuffle: () => void;
  notify?: (msg: string) => void;
}

const SECTION_LABEL: Record<SectionKey, string> = { front: "Front pages", puzzles: "Puzzles", solutions: "Answers", back: "Back pages" };
const GAP = 18;
const PAD = 16;
const LABEL_H = 44;
const THUMB_MIN = 90;
const THUMB_MAX = 300;

function useElementSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** Margin / trim / bleed guides for one page, drawn over the page image. */
function SafeZones({ trim, bleed, page, total }: { trim: TrimKey; bleed: boolean; page: number; total: number }) {
  const spec = makePageSpec(trim, Math.min(828, Math.max(24, total)), bleed);
  const W = spec.pageWidth * PT;
  const H = spec.pageHeight * PT;
  const m = marginsForPage(spec, page);
  const b = bleed ? BLEED_PER_EDGE_IN * PT : 0;
  const odd = page % 2 === 1;
  const tx = bleed && !odd ? b : 0;
  const tw = W - (bleed ? b : 0);
  const gutterX = odd ? 0 : W - m.right * PT;
  return (
    <svg className="pg-bp-zones" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <rect x={gutterX} y={0} width={(odd ? m.left : m.right) * PT} height={H} className="gutter" />
      {bleed && <path d={`M0 0H${W}V${H}H0Z M${tx} ${b}V${H - b}H${tx + tw}V${b}Z`} className="bleed" fillRule="evenodd" />}
      {bleed && <rect x={tx} y={b} width={tw} height={H - 2 * b} className="trim" />}
      <rect x={m.left * PT} y={m.top * PT} width={W - (m.left + m.right) * PT} height={H - (m.top + m.bottom) * PT} className="safe" />
    </svg>
  );
}

export default function BookPreview(props: Props) {
  const { pages, slots, onChange, pdf, trim, bleed, unit } = props;
  const t = TRIM_SIZES[trim];
  const pageWIn = t.width + (bleed ? 0.125 : 0);
  const pageHIn = t.height + (bleed ? 0.25 : 0);
  const aspect = pageWIn / pageHIn;
  const n = pages.length;

  const [view, setView] = useState<View>("grid");
  const [thumbW, setThumbW] = useState(150);
  const [zoom, setZoom] = useState<Zoom>("fit-page");
  const [current, setCurrentRaw] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const anchor = useRef(0);
  const [full, setFull] = useState(false);
  const [zones, setZones] = useState(false);
  const [menu, setMenu] = useState(false);
  const [pageText, setPageText] = useState<string | null>(null);
  const [doc, setDoc] = useState<LoadedDoc | null>(null);
  const [drag, setDrag] = useState<{ ids: string[]; x: number; y: number; insert: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(scrollRef);
  const [scrollTop, setScrollTop] = useState(0);
  const cur = Math.min(current, Math.max(0, n - 1));
  const setCurrent = useCallback((i: number) => setCurrentRaw(Math.max(0, Math.min(n - 1, i))), [n]);

  // ---- load the built PDF (the real output) with pdf.js
  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    let loaded: LoadedDoc | null = null;
    (async () => {
      const pdfjs = await loadPdfJs();
      const d = await pdfjs.getDocument({ data: new Uint8Array(pdf.bytes.slice(0)) }).promise;
      if (cancelled) return void d.destroy();
      loaded = { doc: d, version: pdf.version };
      setDoc(loaded);
    })().catch(() => {});
    return () => {
      cancelled = true;
      // Keep the old document alive briefly so in-flight renders can finish.
      const old = loaded;
      if (old) window.setTimeout(() => void old.doc.destroy(), 4000);
    };
  }, [pdf]);
  const pdfIndex = useMemo(() => {
    const m = new Map<string, number>();
    pdf?.keys.forEach((k, i) => m.set(k, i + 1));
    return m;
  }, [pdf]);
  const fresh = !!pdf && !props.building && pdf.keys.length === n && pdf.keys.every((k, i) => k === pages[i].key);

  // ---- grid geometry (virtualized)
  const cardH = Math.round(thumbW / aspect) + LABEL_H;
  const cols = Math.max(1, Math.floor((size.w - 2 * PAD + GAP) / (thumbW + GAP)));
  const rows = Math.ceil(n / cols);
  const rowH = cardH + GAP;
  const gridW = cols * (thumbW + GAP) - GAP;
  const offsetX = Math.max(PAD, (size.w - gridW) / 2);
  const totalH = rows * rowH - GAP + 2 * PAD;
  const firstRow = Math.max(0, Math.floor((scrollTop - PAD) / rowH) - 2);
  const lastRow = Math.min(rows - 1, Math.ceil((scrollTop + size.h) / rowH) + 2);
  const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;
  const thumbPx = Math.ceil((thumbW * dpr) / 60) * 60;

  const scrollToIndex = useCallback(
    (i: number) => {
      const el = scrollRef.current;
      if (!el || view !== "grid") return;
      const top = PAD + Math.floor(i / cols) * rowH;
      if (top < el.scrollTop + 8) el.scrollTop = top - 8;
      else if (top + cardH > el.scrollTop + el.clientHeight - 8) el.scrollTop = top + cardH - el.clientHeight + 8;
    },
    [cols, rowH, cardH, view],
  );
  const go = useCallback(
    (i: number) => {
      const c = Math.max(0, Math.min(n - 1, i));
      setCurrent(c);
      scrollToIndex(c);
    },
    [n, setCurrent, scrollToIndex],
  );

  // ---- editing
  const selSet = useMemo(() => new Set(selected), [selected]);
  const selPages = pages.filter((p) => p.slot && selSet.has(p.key));
  const selIds = selPages.map((p) => p.key);
  const commit = (next: Slot[], keep: string[] = selIds) => {
    onChange(next);
    setSelected(keep);
  };
  const moveTo = (ids: string[], beforePage: number) => {
    let before = 0;
    for (let i = 0; i < Math.min(beforePage, n); i++) if (pages[i].slot) before++;
    const next = moveSlots(slots, ids, before);
    commit(next, ids);
    // Follow the moved pages.
    const firstIdx = next.findIndex((s) => s.id === ids[0]);
    if (firstIdx >= 0) window.setTimeout(() => go(firstIdx), 0);
  };
  const del = () => {
    const ids = selPages.filter((p) => DELETABLE(p.kind)).map((p) => p.key);
    if (!ids.length) return;
    const left = slots.filter((s) => !ids.includes(s.id));
    if (!left.some((s) => s.kind === "puzzle")) {
      props.notify?.(`A book needs at least one ${unit.toLowerCase()}.`);
      return;
    }
    const puzzles = selPages.filter((p) => p.kind === "puzzle").length;
    commit(left, []);
    props.notify?.(`${ids.length} page${ids.length === 1 ? "" : "s"} removed${puzzles ? ` (with ${puzzles === 1 ? "its answer" : "their answers"})` : ""}. Press Undo to bring ${ids.length === 1 ? "it" : "them"} back.`);
  };
  const duplicate = () => {
    const src = selPages.filter((p) => DUPLICABLE.has(p.kind));
    if (!src.length) return;
    const next = slots.slice();
    const added: string[] = [];
    for (const p of src.reverse()) {
      const i = next.findIndex((s) => s.id === p.key);
      const copy: Slot = { id: newSlotId(p.kind), kind: p.kind };
      next.splice(i + 1, 0, copy);
      added.push(copy.id);
    }
    commit(next, added);
  };
  const insert = (kind: SlotKind) => {
    const at = selPages.length ? selPages[selPages.length - 1] : pages[cur];
    let idx = at?.slot ? slots.findIndex((s) => s.id === at.key) + 1 : slots.length;
    if (idx <= 0) idx = slots.length;
    const s: Slot = { id: newSlotId(kind), kind };
    const next = slots.slice();
    next.splice(idx, 0, s);
    commit(next, [s.id]);
    setMenu(false);
    window.setTimeout(() => go(idx), 0);
  };
  const nudge = (dir: -1 | 1) => {
    if (!selIds.length) return;
    commit(nudgeSlots(slots, selIds, dir));
    window.setTimeout(() => go(cur + dir), 0);
  };
  const movable = selPages.length > 0;
  const canDelete = selPages.some((p) => DELETABLE(p.kind));
  const canDup = selPages.some((p) => DUPLICABLE.has(p.kind));

  // ---- selection by click
  const clickPage = (i: number, e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => {
    const p = pages[i];
    setCurrent(i);
    if (!p.slot) {
      setSelected([]);
      return;
    }
    if (e.shiftKey) {
      const [a, b] = [Math.min(anchor.current, i), Math.max(anchor.current, i)];
      setSelected(pages.slice(a, b + 1).filter((x) => x.slot).map((x) => x.key));
    } else if (e.metaKey || e.ctrlKey) {
      setSelected(selSet.has(p.key) ? selected.filter((k) => k !== p.key) : [...selected, p.key]);
      anchor.current = i;
    } else {
      setSelected([p.key]);
      anchor.current = i;
    }
  };

  // ---- drag & drop (pointer events: mouse, pen and touch)
  const dragRef = useRef<{ i: number; x: number; y: number; started: boolean; mods: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }; ids: string[] } | null>(null);
  const insertAt = (clientX: number, clientY: number) => {
    const el = scrollRef.current!;
    const r = el.getBoundingClientRect();
    const x = clientX - r.left - offsetX;
    const y = clientY - r.top + el.scrollTop - PAD;
    const row = Math.max(0, Math.min(rows - 1, Math.floor((y + GAP / 2) / rowH)));
    const col = Math.max(0, Math.min(cols, Math.floor((x + GAP / 2) / (thumbW + GAP) + 0.5)));
    return Math.min(n, row * cols + col);
  };
  const autoScroll = useRef<number | null>(null);
  const lastPointer = useRef({ x: 0, y: 0 });
  const stopAuto = () => {
    if (autoScroll.current) cancelAnimationFrame(autoScroll.current);
    autoScroll.current = null;
  };
  const onCardPointerDown = (i: number, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    scrollRef.current?.focus({ preventScroll: true });
    const p = pages[i];
    const ids = p.slot ? (selSet.has(p.key) ? selIds : [p.key]) : [];
    dragRef.current = { i, x: e.clientX, y: e.clientY, started: false, mods: { shiftKey: e.shiftKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey }, ids };
    const move = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      lastPointer.current = { x: ev.clientX, y: ev.clientY };
      if (!d.started) {
        if (Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < 6 || !d.ids.length) return;
        d.started = true;
        if (!selSet.has(pages[d.i].key) || d.mods.shiftKey || d.mods.metaKey || d.mods.ctrlKey) {
          if (!selSet.has(pages[d.i].key)) setSelected(d.ids);
        }
        const tick = () => {
          const el = scrollRef.current;
          if (el && dragRef.current?.started) {
            const r = el.getBoundingClientRect();
            const { x, y } = lastPointer.current;
            const edge = 56;
            let dy = 0;
            if (y < r.top + edge) dy = -Math.ceil(((r.top + edge - y) / edge) * 18);
            else if (y > r.bottom - edge) dy = Math.ceil(((y - (r.bottom - edge)) / edge) * 18);
            if (dy) {
              el.scrollTop += dy;
              setDrag((g) => (g ? { ...g, insert: insertAt(x, y) } : g));
            }
          }
          autoScroll.current = requestAnimationFrame(tick);
        };
        autoScroll.current = requestAnimationFrame(tick);
      }
      ev.preventDefault();
      setDrag({ ids: d.ids, x: ev.clientX, y: ev.clientY, insert: insertAt(ev.clientX, ev.clientY) });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      stopAuto();
      const d = dragRef.current;
      dragRef.current = null;
      if (!d) return;
      if (d.started) {
        const ins = insertAt(ev.clientX, ev.clientY);
        setDrag(null);
        if (ev.type !== "pointercancel") moveTo(d.ids, ins);
      } else clickPage(d.i, d.mods);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  useEffect(() => stopAuto, []);

  // ---- zoom
  const zoomBy = (dir: 1 | -1) => {
    if (view === "grid") setThumbW((w) => Math.max(THUMB_MIN, Math.min(THUMB_MAX, w + dir * 30)));
    else {
      setZoom((z) => {
        const base = typeof z === "number" ? z : bigW / actualW;
        return Math.max(0.25, Math.min(4, Math.round(base * (dir > 0 ? 1.25 : 0.8) * 100) / 100));
      });
    }
  };

  // ---- page / spread view geometry
  const availW = Math.max(200, size.w - 48);
  const availH = Math.max(200, size.h - 48);
  const perRow = view === "spread" ? 2 : 1;
  const fitPageW = Math.min(availW / perRow, availH * aspect);
  const fitWidthW = availW / perRow;
  const actualW = pageWIn * 96;
  const bigW = Math.round(zoom === "fit-width" ? fitWidthW : zoom === "fit-page" ? fitPageW : actualW * zoom);
  const bigPx = Math.min(2400, Math.ceil((bigW * dpr) / 120) * 120);
  const zoomPct = Math.round((bigW / actualW) * 100);
  // Spreads: page 1 alone on the right, then 2–3, 4–5… (left page even).
  const spreadOf = (i: number) => (i === 0 ? 0 : Math.floor((i + 1) / 2));
  const spreadPages = (s: number): (number | null)[] => (s === 0 ? [null, 0] : [2 * s - 1, 2 * s < n ? 2 * s : null]);
  const step = (dir: 1 | -1) => {
    if (view === "spread") {
      const s = Math.max(0, Math.min(spreadOf(n - 1), spreadOf(cur) + dir));
      const ps = spreadPages(s).filter((x): x is number => x !== null);
      go(ps[0]);
    } else go(cur + dir);
  };

  // ---- keyboard
  const onKeyDown = (e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") {
      if (e.key === "Enter") e.stopPropagation();
      return;
    }
    const mod = e.metaKey || e.ctrlKey;
    let handled = true;
    if (mod && (e.key === "z" || e.key === "Z")) e.shiftKey ? props.redo() : props.undo();
    else if (mod && (e.key === "y" || e.key === "Y")) props.redo();
    else if (mod && (e.key === "=" || e.key === "+")) zoomBy(1);
    else if (mod && e.key === "-") zoomBy(-1);
    else if (mod && e.key === "0") view === "grid" ? setThumbW(150) : setZoom("fit-page");
    else if (mod && (e.key === "a" || e.key === "A") && view === "grid") setSelected(pages.filter((p) => p.slot).map((p) => p.key));
    else if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowUp")) nudge(-1);
    else if (e.altKey && (e.key === "ArrowRight" || e.key === "ArrowDown")) nudge(1);
    else if (e.key === "ArrowLeft" || e.key === "PageUp") step(-1);
    else if (e.key === "ArrowRight" || e.key === "PageDown") step(1);
    else if (e.key === "ArrowUp" && view === "grid") go(cur - cols);
    else if (e.key === "ArrowDown" && view === "grid") go(cur + cols);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(n - 1);
    else if ((e.key === "Delete" || e.key === "Backspace") && view === "grid") del();
    else if (e.key === "Enter" && view === "grid") setView("page");
    else if (e.key === " " && view === "grid" && pages[cur]?.slot) clickPage(cur, { shiftKey: false, metaKey: true, ctrlKey: false });
    else if (e.key === "Escape") {
      if (menu) setMenu(false);
      else if (full) setFull(false);
      else if (view !== "grid") setView("grid");
      else setSelected([]);
    } else handled = e.key === "Enter";
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Full screen: lock the page behind and keep the keyboard working.
  useEffect(() => {
    if (!full) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    rootRef.current?.focus({ preventScroll: true });
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !rootRef.current?.contains(document.activeElement)) setFull(false);
    };
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", esc);
    };
  }, [full]);

  // Ctrl/Cmd + and - zoom the preview (not the browser) while the pointer is over it.
  const hover = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !(hover.current || full) || rootRef.current?.contains(document.activeElement)) return;
      if (e.key === "=" || e.key === "+" || e.key === "-") {
        e.preventDefault();
        (document.getElementById("pg-bp-zoom-" + (e.key === "-" ? "out" : "in")) as HTMLButtonElement | null)?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  // Ctrl/Cmd + wheel zooms too.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      (document.getElementById("pg-bp-zoom-" + (e.deltaY > 0 ? "out" : "in")) as HTMLButtonElement | null)?.click();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Smoothness probe for the e2e test (frames while scrolling).
  const scrollRaf = useRef<number | null>(null);
  const onScroll = () => {
    if (scrollRaf.current) return;
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = null;
      if (scrollRef.current) setScrollTop(scrollRef.current.scrollTop);
    });
  };

  // ---- section jumps
  const sections = useMemo(() => {
    const out: { key: SectionKey; first: number; count: number }[] = [];
    pages.forEach((p, i) => {
      const s = out.find((x) => x.key === p.section);
      if (s) s.count++;
      else out.push({ key: p.section, first: i, count: 1 });
    });
    return out;
  }, [pages]);

  const issues = props.checks.filter((c) => c.level === "warn" || c.level === "error").length;
  const status = props.error ? (
    <span className="pg-bp-status err" data-testid="bp-status">
      <BsXCircleFill /> Preview failed
    </span>
  ) : props.building || !fresh ? (
    <span className="pg-bp-status busy" data-testid="bp-status" data-state="busy">
      <BsArrowRepeat className="pg-spin" /> Updating preview{props.progress && props.progress.total > 1 ? ` ${Math.round((props.progress.done / props.progress.total) * 100)}%` : "…"}
    </span>
  ) : (
    <span className="pg-bp-status ok" data-testid="bp-status" data-state="ready">
      <BsCheckCircleFill /> Exactly as it will print
    </span>
  );

  const pageLabel = (p: PageInfo) => `Page ${p.page}: ${p.label}`;
  const imgFor = (p: PageInfo, px: number, testId?: string, delay?: number) => <PageImage doc={doc} page={pdfIndex.get(p.key) ?? 0} pageKey={p.key} px={px} label={pageLabel(p)} testId={testId} delay={delay} />;

  // ---- render pieces
  const grid = (
    <div className="pg-bp-gridspace" style={{ height: totalH }} data-testid="bp-grid" data-cols={cols}>
      {/* eslint-disable-next-line react-hooks/refs -- refs are only read inside the pointer/click handlers */}
      {Array.from({ length: Math.max(0, lastRow - firstRow + 1) }, (_, r) => firstRow + r).flatMap((row) =>
        Array.from({ length: cols }, (_, c) => row * cols + c)
          .filter((i) => i < n)
          .map((i) => {
            const p = pages[i];
            const isSel = selSet.has(p.key);
            const dragging = !!drag && drag.ids.includes(p.key);
            return (
              <div
                key={p.key}
                className={`pg-bp-card s-${p.section}${isSel ? " selected" : ""}${i === cur ? " current" : ""}${dragging ? " dragging" : ""}${p.filler ? " filler" : ""}`}
                style={{ left: offsetX + (i % cols) * (thumbW + GAP), top: PAD + row * rowH, width: thumbW }}
                onPointerDown={(e) => onCardPointerDown(i, e)}
                onDoubleClick={() => {
                  setCurrent(i);
                  setView("page");
                }}
                data-testid="bp-thumb"
                data-key={p.key}
                data-label={p.label}
                data-page={p.page}
                role="option"
                aria-selected={isSel}
                aria-label={`${pageLabel(p)}${p.filler ? ", added automatically" : ""}`}
                title={p.filler ? "Added automatically to reach the page count KDP needs" : p.slot ? "Drag to move · Double-click to open" : undefined}
              >
                <div className="pg-bp-sheet" style={{ height: Math.round(thumbW / aspect) }}>
                  {imgFor(p, thumbPx)}
                  <span className="pg-bp-skel">{p.label}</span>
                  {isSel && (
                    <span className="pg-bp-tick" aria-hidden="true">
                      <BsCheckCircleFill />
                    </span>
                  )}
                </div>
                <div className="pg-bp-cap">
                  <span className={`pg-bp-num${p.numbered ? "" : " quiet"}`} title={p.numbered ? `Printed page number ${p.page}` : "No page number is printed on this page"}>
                    {p.page}
                  </span>
                  <span className="pg-bp-name">{p.label}</span>
                </div>
              </div>
            );
          }),
      )}
      {drag &&
        (() => {
          const atEnd = drag.insert === n && n % cols === 0;
          const row = atEnd ? Math.floor((n - 1) / cols) : Math.floor(drag.insert / cols);
          const col = atEnd ? cols : drag.insert % cols;
          return <div className="pg-bp-drop" style={{ left: offsetX + col * (thumbW + GAP) - GAP / 2 - 2, top: PAD + row * rowH, height: cardH }} data-testid="bp-drop" />;
        })()}
    </div>
  );

  const bigPage = (i: number | null, key: string) =>
    i === null ? (
      <div key={key} className="pg-bp-big empty" style={{ width: bigW, height: Math.round(bigW / aspect) }} aria-hidden="true" />
    ) : (
      <figure key={key} className={`pg-bp-big s-${pages[i].section}`} style={{ width: bigW }}>
        <div className="pg-bp-sheet" style={{ height: Math.round(bigW / aspect) }}>
          {imgFor(pages[i], bigPx, "bp-page-canvas", 0)}
          <span className="pg-bp-skel">{pages[i].label}</span>
          {zones && <SafeZones trim={trim} bleed={bleed} page={i + 1} total={n} />}
        </div>
        <figcaption>
          <span className={`pg-bp-num${pages[i].numbered ? "" : " quiet"}`}>{pages[i].page}</span> {pages[i].label}
          {pages[i].filler && <span className="text-muted"> · added automatically</span>}
        </figcaption>
      </figure>
    );

  const single = (
    <div className={`pg-bp-pages${view === "spread" ? " spread" : ""}`} data-testid={view === "spread" ? "bp-spread" : "bp-single"}>
      {view === "spread" ? spreadPages(spreadOf(cur)).map((i, k) => bigPage(i, `s${k}`)) : bigPage(cur, "one")}
    </div>
  );

  const sel = selPages.length;
  return (
    <div
      ref={rootRef}
      className={`pg-bp${full ? " full" : ""}`}
      data-testid="book-preview"
      data-ready={fresh ? "1" : "0"}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onPointerEnter={() => (hover.current = true)}
      onPointerLeave={() => (hover.current = false)}
      aria-label="Book preview"
    >
      {/* Toolbar: views · zoom · pages · full screen */}
      <div className="pg-bp-bar" role="toolbar" aria-label="Preview tools">
        <div className="btn-group" role="group" aria-label="View">
          {(
            [
              ["grid", <BsGrid3X3Gap key="g" />, "All pages"],
              ["page", <BsFileEarmark key="p" />, "Page"],
              ["spread", <BsBookHalf key="s" />, "Spread"],
            ] as [View, React.ReactNode, string][]
          ).map(([v, icon, label]) => (
            <button key={v} type="button" className={`btn btn-sm ${view === v ? "btn-primary" : "btn-light"}`} onClick={() => setView(v)} aria-pressed={view === v} data-testid={`bp-view-${v}`} title={v === "spread" ? "Two facing pages, as in the printed book" : undefined}>
              {icon} <span className="d-none d-md-inline">{label}</span>
            </button>
          ))}
        </div>

        <div className="pg-bp-zoom" role="group" aria-label="Zoom">
          <button id="pg-bp-zoom-out" type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => zoomBy(-1)} aria-label="Zoom out" title="Zoom out (Ctrl/⌘ −)" data-testid="bp-zoom-out">
            <BsZoomOut />
          </button>
          {view === "grid" ? (
            <input type="range" className="form-range" min={THUMB_MIN} max={THUMB_MAX} step={10} value={thumbW} onChange={(e) => setThumbW(Number(e.target.value))} aria-label="Thumbnail size" data-testid="bp-zoom-range" />
          ) : (
            <span className="pg-bp-pct" data-testid="bp-zoom-pct">
              {zoomPct}%
            </span>
          )}
          <button id="pg-bp-zoom-in" type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => zoomBy(1)} aria-label="Zoom in" title="Zoom in (Ctrl/⌘ +)" data-testid="bp-zoom-in">
            <BsZoomIn />
          </button>
          {view !== "grid" && (
            <>
              <button type="button" className={`btn btn-sm ${zoom === "fit-page" ? "btn-outline-primary" : "btn-ghost"}`} onClick={() => setZoom("fit-page")} data-testid="bp-fit-page">
                Fit page
              </button>
              <button type="button" className={`btn btn-sm ${zoom === "fit-width" ? "btn-outline-primary" : "btn-ghost"}`} onClick={() => setZoom("fit-width")} data-testid="bp-fit-width">
                Fit width
              </button>
              <button type="button" className={`btn btn-sm ${zones ? "btn-outline-primary" : "btn-ghost"}`} onClick={() => setZones(!zones)} aria-pressed={zones} data-testid="bp-zones" aria-label="Safe zones" title="Safe zones: show the text-safe area, the gutter and (with bleed) the trim line">
                <BsBoundingBox /> <span className="d-none d-xxl-inline">Safe zones</span>
              </button>
            </>
          )}
        </div>

        <div className="pg-bp-pager" role="group" aria-label="Pages">
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => step(-1)} disabled={cur <= 0} aria-label="Previous page" data-testid="bp-prev">
            <BsChevronLeft />
          </button>
          <label className="visually-hidden" htmlFor="bp-page">
            Page
          </label>
          <input
            id="bp-page"
            className="form-control form-control-sm"
            inputMode="numeric"
            value={pageText ?? String(cur + 1)}
            onChange={(e) => setPageText(e.target.value.replace(/\D/g, ""))}
            onFocus={(e) => e.target.select()}
            onBlur={() => {
              if (pageText) go(Number(pageText) - 1);
              setPageText(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (pageText) go(Number(pageText) - 1);
                setPageText(null);
                (e.target as HTMLInputElement).blur();
              }
            }}
            aria-label="Go to page"
            data-testid="bp-page-input"
          />
          <span className="small text-muted text-nowrap" data-testid="bp-total">
            of {n}
          </span>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => step(1)} disabled={cur >= n - 1} aria-label="Next page" data-testid="bp-next">
            <BsChevronRight />
          </button>
        </div>

        <select
          className="form-select form-select-sm pg-bp-jump"
          value=""
          onChange={(e) => {
            const s = sections.find((x) => x.key === e.target.value);
            if (s) go(s.first);
          }}
          aria-label="Jump to a section"
          data-testid="bp-section-jump"
        >
          <option value="">Jump to…</option>
          {sections.map((s) => (
            <option key={s.key} value={s.key}>
              {SECTION_LABEL[s.key]} (p. {pages[s.first].page})
            </option>
          ))}
        </select>

        <div className="ms-auto d-flex align-items-center gap-1">
          <button type="button" className="btn btn-light btn-sm" onClick={() => setFull(!full)} data-testid="bp-fullscreen" aria-pressed={full} aria-label={full ? "Exit full screen" : "Full screen"} title={full ? "Exit full screen (Esc)" : "Full screen"}>
            {full ? <BsArrowsAngleContract /> : <BsArrowsAngleExpand />} <span className={view === "grid" || full ? "" : "d-none d-xxl-inline"}>{full ? "Exit" : "Full screen"}</span>
          </button>
        </div>
      </div>

      {/* Second bar: what you can do with the selection */}
      <div className={`pg-bp-actions${sel ? " has-sel" : ""}`} role="toolbar" aria-label="Page actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={props.undo} disabled={!props.canUndo} aria-label="Undo" title="Undo (Ctrl/⌘ Z)" data-testid="bp-undo">
          <BsArrowCounterclockwise /> <span className="d-none d-xl-inline">Undo</span>
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={props.redo} disabled={!props.canRedo} aria-label="Redo" title="Redo (Ctrl/⌘ Shift Z)" data-testid="bp-redo">
          <BsArrowClockwise /> <span className="d-none d-xl-inline">Redo</span>
        </button>
        <span className="pg-bp-sep" />
        {sel ? (
          <>
            <span className="pg-bp-selcount" data-testid="bp-selcount">
              {sel} selected
            </span>
            <button type="button" className="btn btn-light btn-sm" onClick={() => moveTo(selIds, 0)} disabled={!movable} data-testid="bp-move-start" title="Move to the start of the book" aria-label="Move to start">
              <BsChevronBarUp /> <span className="d-none d-xxl-inline">To start</span>
            </button>
            <button type="button" className="btn btn-light btn-icon btn-sm" onClick={() => nudge(-1)} disabled={!movable} aria-label="Move earlier" title="Move earlier (Alt ←)" data-testid="bp-move-up">
              <BsChevronUp />
            </button>
            <button type="button" className="btn btn-light btn-icon btn-sm" onClick={() => nudge(1)} disabled={!movable} aria-label="Move later" title="Move later (Alt →)" data-testid="bp-move-down">
              <BsChevronDown />
            </button>
            <button type="button" className="btn btn-light btn-sm" onClick={() => moveTo(selIds, n)} disabled={!movable} data-testid="bp-move-end" title="Move to the end of the book" aria-label="Move to end">
              <BsChevronBarDown /> <span className="d-none d-xxl-inline">To end</span>
            </button>
            <button type="button" className="btn btn-light btn-sm" onClick={duplicate} disabled={!canDup} data-testid="bp-duplicate" title={canDup ? "Duplicate" : `${unit}s and answers can't be duplicated`}>
              <BsFiles /> <span className="d-none d-xxl-inline">Duplicate</span>
            </button>
            <button type="button" className="btn btn-light btn-sm text-danger" onClick={del} disabled={!canDelete} data-testid="bp-delete" title={canDelete ? "Remove from the book (Delete)" : "Answer pages follow your puzzles automatically"}>
              <BsTrash /> <span className="d-none d-lg-inline">Remove</span>
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected([])} data-testid="bp-clear" aria-label="Clear selection">
              <BsXLg />
            </button>
          </>
        ) : (
          <span className="pg-bp-tip">Drag pages to reorder. Click to select, Shift- or Ctrl/⌘-click to select several.</span>
        )}
        <div className="ms-auto position-relative d-flex align-items-center gap-1">
          {!props.isDefault && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={props.onReset} data-testid="bp-reset" title="Go back to the original page order">
              <BsListOl /> Original order
            </button>
          )}
          <button type="button" className="btn btn-light btn-sm" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-haspopup="menu" data-testid="bp-more">
            <BsThreeDots /> More
          </button>
          {menu && (
            <div className="pg-bp-menu" role="menu" onKeyDown={(e) => e.key === "Escape" && setMenu(false)}>
              <div className="pg-bp-menu-h">Add a page {sel ? "after the selection" : `after page ${cur + 1}`}</div>
              <button type="button" role="menuitem" onClick={() => insert("notes")} data-testid="bp-insert-notes">
                <BsPlusLg /> Lined notes page
              </button>
              <button type="button" role="menuitem" onClick={() => insert("blank")} data-testid="bp-insert-blank">
                <BsPlusLg /> Blank page
              </button>
              <div className="pg-bp-menu-h">{unit} order</div>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  props.onShuffle();
                  setMenu(false);
                }}
                data-testid="bp-shuffle"
              >
                <BsShuffle /> Shuffle {unit.toLowerCase()}s
              </button>
              {props.sorters.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    s.apply();
                    setMenu(false);
                  }}
                  data-testid={`bp-sort-${s.key}`}
                >
                  <BsSortDown /> {s.label}
                </button>
              ))}
              <div className="pg-bp-menu-h">Keyboard</div>
              <div className="pg-bp-keys">
                <span>
                  <kbd>←</kbd> <kbd>→</kbd> pages
                </span>
                <span>
                  <kbd>Alt</kbd>+<kbd>←</kbd> move
                </span>
                <span>
                  <kbd>Ctrl/⌘</kbd>+<kbd>Z</kbd> undo
                </span>
                <span>
                  <kbd>Ctrl/⌘</kbd>+<kbd>+</kbd> zoom
                </span>
                <span>
                  <kbd>Del</kbd> remove
                </span>
                <span>
                  <kbd>Enter</kbd> open page
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pg-bp-main">
        <div
          ref={scrollRef}
          className={`pg-bp-scroll${view !== "grid" ? " paged" : ""}${drag ? " is-dragging" : ""}`}
          onScroll={onScroll}
          tabIndex={0}
          role={view === "grid" ? "listbox" : undefined}
          aria-multiselectable={view === "grid" ? true : undefined}
          aria-label={view === "grid" ? "Pages of your book" : `Page ${cur + 1} of ${n}`}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains("pg-bp-gridspace")) setSelected([]);
          }}
        >
          {view === "grid" ? grid : single}
        </div>
        <div className="pg-bp-float">{status}</div>

        <aside className="pg-bp-side" aria-label="KDP checks" data-testid="bp-checks">
          <div className="pg-bp-side-h">
            <span>KDP check</span>
            {issues ? <span className="pg-badge warn">{issues} to look at</span> : <span className="pg-badge ok">All good</span>}
          </div>
          <ul className="list-unstyled mb-0">
            {props.checks.map((c) => (
              <li key={c.id} className={`pg-bp-check ${c.level}`} data-testid={`bp-check-${c.id}`} data-level={c.level}>
                <span className="ic" aria-hidden="true">
                  {c.level === "ok" ? <BsCheckCircleFill /> : c.level === "info" ? <BsInfoCircleFill /> : c.level === "warn" ? <BsExclamationTriangleFill /> : <BsXCircleFill />}
                </span>
                <span className="tx">
                  {c.text}
                  {c.fix && c.fixLabel && (
                    <button type="button" className="btn btn-link btn-sm p-0 d-block" onClick={() => props.onFix(c.fix!)} data-testid={`bp-fix-${c.id}`}>
                      {c.fixLabel} →
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <div className="pg-bp-legend">
            {(["front", "puzzles", "solutions", "back"] as SectionKey[]).map((s) => (
              <span key={s} className={`s-${s}`}>
                <i /> {SECTION_LABEL[s]}
              </span>
            ))}
          </div>
          {view !== "grid" && zones && (
            <div className="pg-bp-legend zones">
              <span className="safe">
                <i /> Text-safe area
              </span>
              <span className="gutter">
                <i /> Gutter (binding side)
              </span>
              {bleed && (
                <span className="trim">
                  <i /> Trim line
                </span>
              )}
            </div>
          )}
          {props.error && <div className="small text-danger mt-2">{props.error}</div>}
        </aside>
      </div>

      {drag && (
        <div className="pg-bp-ghost" style={{ left: drag.x + 12, top: drag.y + 12 }} aria-hidden="true">
          <BsLayoutSplit /> Moving {drag.ids.length} page{drag.ids.length === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}

