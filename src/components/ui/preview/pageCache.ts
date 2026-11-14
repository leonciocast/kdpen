/**
 * Renders PDF pages to canvases with pdf.js: a small LIFO queue (newest
 * request first, so the pages you scroll to appear first) and an LRU cache.
 * The last image of every page key is kept, so a page that moved keeps its
 * picture while the book is rebuilt in the background.
 */
import type { PDFDocumentProxy } from "pdfjs-dist";

export interface LoadedDoc {
  doc: PDFDocumentProxy;
  version: number;
}

const MAX = 420;
const cache = new Map<string, HTMLCanvasElement>();
const latest = new Map<string, string>();
const pending = new Map<string, Promise<HTMLCanvasElement | null>>();

interface Task {
  run: () => Promise<void>;
  alive: () => boolean;
}
const queue: Task[] = [];
let active = 0;
const CONCURRENCY = 3;

function pump() {
  while (active < CONCURRENCY && queue.length) {
    const t = queue.pop()!;
    if (!t.alive()) continue;
    active++;
    t.run().finally(() => {
      active--;
      pump();
    });
  }
}

function put(key: string, c: HTMLCanvasElement) {
  cache.delete(key);
  cache.set(key, c);
  while (cache.size > MAX) cache.delete(cache.keys().next().value as string);
}

export function cached(d: LoadedDoc | null, page: number, px: number): HTMLCanvasElement | null {
  if (!d || page < 1) return null;
  const key = `${d.version}:${page}:${px}`;
  const hit = cache.get(key);
  if (hit) put(key, hit);
  return hit ?? null;
}

/** The most recent image drawn for a page key (any version / size). */
export function lastImage(pageKey: string): HTMLCanvasElement | null {
  const k = latest.get(pageKey);
  return k ? (cache.get(k) ?? null) : null;
}

export function renderPage(d: LoadedDoc, page: number, px: number, pageKey: string, alive: () => boolean): Promise<HTMLCanvasElement | null> {
  const key = `${d.version}:${page}:${px}`;
  const hit = cache.get(key);
  if (hit) {
    latest.set(pageKey, key);
    return Promise.resolve(hit);
  }
  const inflight = pending.get(key);
  if (inflight) return inflight.then((c) => (c && latest.set(pageKey, key), c));
  const p = new Promise<HTMLCanvasElement | null>((resolve) => {
    queue.push({
      alive: () => {
        const ok = alive();
        if (!ok) {
          pending.delete(key);
          resolve(null);
        }
        return ok;
      },
      run: async () => {
        try {
          if (page > d.doc.numPages) return resolve(null);
          const pg = await d.doc.getPage(page);
          const base = pg.getViewport({ scale: 1 });
          const viewport = pg.getViewport({ scale: px / base.width });
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.floor(viewport.width));
          canvas.height = Math.max(1, Math.floor(viewport.height));
          await pg.render({ canvas, viewport }).promise;
          put(key, canvas);
          latest.set(pageKey, key);
          resolve(canvas);
        } catch {
          resolve(null); // the document was replaced while rendering
        } finally {
          pending.delete(key);
        }
      },
    });
    pump();
  });
  pending.set(key, p);
  return p;
}

export function paint(target: HTMLCanvasElement, src: HTMLCanvasElement) {
  if (target.width !== src.width) target.width = src.width;
  if (target.height !== src.height) target.height = src.height;
  const ctx = target.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(src, 0, 0);
}
