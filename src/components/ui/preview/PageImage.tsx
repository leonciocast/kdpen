"use client";
import React, { useEffect, useRef } from "react";
import { LoadedDoc, cached, lastImage, paint, renderPage } from "./pageCache";

/**
 * One PDF page drawn on a canvas. While the exact image isn't ready it shows
 * the last picture of the same page (e.g. after a move), then swaps in the new one.
 */
export default function PageImage({ doc, page, pageKey, px, label, testId, delay = 30 }: { doc: LoadedDoc | null; page: number; pageKey: string; px: number; label: string; testId?: string; delay?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const hit = cached(doc, page, px);
    if (hit) {
      paint(c, hit);
      c.dataset.state = "fresh";
      return;
    }
    const old = lastImage(pageKey);
    if (old) {
      paint(c, old);
      c.dataset.state = "stale";
    } else c.dataset.state = "empty";
    if (!doc || page < 1) return;
    let alive = true;
    const t = window.setTimeout(() => {
      renderPage(doc, page, px, pageKey, () => alive).then((img) => {
        if (!alive || !img || !ref.current) return;
        paint(ref.current, img);
        ref.current.dataset.state = "fresh";
      });
    }, delay);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [doc, page, px, pageKey, delay]);
  return <canvas ref={ref} className="pg-bp-canvas" role="img" aria-label={label} data-testid={testId} data-state="empty" />;
}
