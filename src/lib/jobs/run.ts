/** Heavy work (generation, PDF building). Runs in a Web Worker, or inline as a fallback. */
import { generatePuzzle, mulberry32, randomSeed } from "../wordsearch/engine";
import { LIMITS } from "../limits";
import { generateCrossword } from "../crossword/engine";
import { generateSudoku } from "../sudoku";
import { buildWordSearchBook } from "../wordsearch/pdf";
import { buildCrosswordBook } from "../crossword/pdf";
import { buildSudokuBook } from "../sudoku/pdf";
import { FontData, familiesFor, filesFor } from "../print/fonts";
import type { RenderedBook } from "../print/book";
import { resolveSlots } from "../print/arrange";
import type { BookPuzzle } from "../wordsearch/pdf";
import type { CrosswordItem } from "../crossword/pdf";
import type { SudokuPuzzle } from "../sudoku";
import type { BuiltFile, GeneratedWs, Job, JobResultMap, Progress } from "./types";

export interface JobEnv {
  progress: (p: Progress) => void;
  loadFonts: (files: string[]) => Promise<FontData>;
  /** Give the UI a chance to breathe (inline fallback only). */
  breathe?: () => Promise<void>;
  cancelled?: () => boolean;
}

class Cancelled extends Error {
  constructor() {
    super("Cancelled");
  }
}

export function generateOneWordSearch(spec: GeneratedWs | { title: string; theme: string; words: string[]; size: number }, settings: { dirs: import("../wordsearch/engine").DirectionKey[]; overlapWeight: number; decoys: import("../wordsearch/engine").DecoyLevel }, seed = randomSeed()): GeneratedWs {
  let size = spec.size;
  let best: GeneratedWs | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const g = generatePuzzle(spec.words, size, settings.dirs, mulberry32(seed + attempt), [], { timeLimitMs: 350, maxSteps: 6000, overlapWeight: settings.overlapWeight, decoys: settings.decoys });
    const res: GeneratedWs = { title: spec.title, theme: spec.theme, size, words: spec.words, placements: g.placements, grid: g.grid, unplaced: g.unplaced, warnings: g.warnings };
    if (!best || res.unplaced.length < best.unplaced.length) best = res;
    if (!res.unplaced.length || size >= LIMITS.maxGridSize) break;
    size++; // grow the grid a little rather than drop words
  }
  return best!;
}

export async function runJob<J extends Job>(job: J, env: JobEnv): Promise<JobResultMap[J["type"]]> {
  const check = async (i: number) => {
    if (env.cancelled?.()) throw new Cancelled();
    if (env.breathe && i % 5 === 4) await env.breathe();
  };
  switch (job.type) {
    case "ws-generate": {
      const out: GeneratedWs[] = [];
      for (let i = 0; i < job.specs.length; i++) {
        await check(i);
        out.push(generateOneWordSearch({ ...job.specs[i] }, job.settings));
        env.progress({ phase: "Building puzzles", done: i + 1, total: job.specs.length });
      }
      return out as JobResultMap[J["type"]];
    }
    case "cw-generate": {
      const out: JobResultMap["cw-generate"] = [];
      for (let i = 0; i < job.groups.length; i++) {
        await check(i);
        const g = job.groups[i];
        out.push({ title: g.title, theme: g.theme, cw: generateCrossword(g.entries, mulberry32(randomSeed())) });
        env.progress({ phase: "Building crosswords", done: i + 1, total: job.groups.length });
      }
      return out as JobResultMap[J["type"]];
    }
    case "sd-generate": {
      const out = [];
      for (let i = 0; i < job.plan.length; i++) {
        await check(i);
        out.push(generateSudoku(job.plan[i]));
        if (i % 3 === 0 || i === job.plan.length - 1) env.progress({ phase: "Generating sudoku", done: i + 1, total: job.plan.length });
      }
      return out as JobResultMap[J["type"]];
    }
    case "build": {
      const st = job.settings;
      env.progress({ phase: "Loading fonts", done: 0, total: 1 });
      const fonts = await env.loadFonts(filesFor(familiesFor(st.design)));
      const files: BuiltFile[] = [];
      const of = job.volumes.length;
      if (job.slots && of > 1) throw new Error("A custom page order works on single-volume books only.");
      // An arranged book: put the items in the arranged order (numbers and answers follow it).
      const shape = { items: job.items.length, perPage: job.tool === "sudoku" ? (st.perPage ?? 1) : 1, answersPerPage: st.answersPerPage };
      const arranged = job.slots ? resolveSlots(job.slots, shape) : null;
      const items = arranged ? (arranged.itemOrder.map((i) => job.items[i]) as typeof job.items) : job.items;
      const volumes = arranged ? ([[0, items.length]] as [number, number][]) : job.volumes;
      for (let v = 0; v < of; v++) {
        await check(v * 5 + 4);
        const [a, b] = volumes[v];
        const common = {
          trim: st.trim,
          bleed: st.bleed,
          padForKdp: st.padForKdp,
          frontMatter: st.frontMatter,
          extras: st.extras,
          design: st.design,
          slots: arranged?.slots,
          volume: of > 1 ? { n: v + 1, of } : undefined,
          onPage: (done: number, total: number) => {
            if (done % 4 === 0 || done === total) env.progress({ phase: of > 1 ? `Creating volume ${v + 1} of ${of}` : "Creating PDF pages", done: done, total });
          },
        };
        let book: RenderedBook;
        if (job.tool === "word-search") book = buildWordSearchBook((items as BookPuzzle[]).slice(a, b), { ...common, answersPerPage: st.answersPerPage }, fonts);
        else if (job.tool === "crossword") book = buildCrosswordBook((items as CrosswordItem[]).slice(a, b), { ...common, answersPerPage: st.answersPerPage }, fonts);
        else book = buildSudokuBook((items as SudokuPuzzle[]).slice(a, b), { ...common, puzzlesPerPage: st.perPage ?? 1, answersPerPage: st.answersPerPage, pageSizes: arranged?.puzzlePageSizes }, fonts);
        env.progress({ phase: "Saving PDF", done: 1, total: 1 });
        const bytes = book.pdf.output("arraybuffer");
        const suffix = of > 1 ? `_vol${v + 1}` : "";
        files.push({ name: `${job.fileBase}${suffix}_${st.trim}${st.bleed ? "_bleed" : ""}.pdf`, pages: book.pageCount, bytes });
      }
      return files as JobResultMap[J["type"]];
    }
  }
  throw new Error("Unknown job");
}

export const isCancelled = (e: unknown) => e instanceof Cancelled || (e as Error)?.message === "Cancelled";
