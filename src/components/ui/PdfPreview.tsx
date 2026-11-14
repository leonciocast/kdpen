"use client";
import React, { useEffect, useRef, useState } from "react";

type PdfJs = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfJs> | null = null;
function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((m) => {
      m.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
      return m;
    });
  }
  return pdfjsPromise;
}

/** Draws one page of a PDF (exactly what will print) on a canvas. */
export default function PdfPreview({ bytes, page, label }: { bytes: ArrayBuffer | null; page: number; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bytes || !ref.current) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        const pdfjs = await loadPdfJs();
        const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
        cleanup = () => void doc.destroy();
        if (cancelled) return;
        const p = await doc.getPage(Math.min(Math.max(1, page), doc.numPages));
        const canvas = ref.current;
        if (!canvas || cancelled) return;
        const cssWidth = canvas.parentElement?.clientWidth || 420;
        const base = p.getViewport({ scale: 1 });
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        const viewport = p.getViewport({ scale: (cssWidth / base.width) * ratio });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = "100%";
        canvas.style.aspectRatio = `${base.width} / ${base.height}`;
        await p.render({ canvas, viewport }).promise;
        if (!cancelled) setError(null);
      } catch (e) {
        if (!cancelled) setError((e as Error).message || "Preview unavailable");
      }
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [bytes, page]);

  return (
    <div className="pg-pdf-preview">
      <canvas ref={ref} role="img" aria-label={label} data-testid="design-preview" />
      {!bytes && <div className="pg-pdf-loading">Preparing preview…</div>}
      {error && <div className="pg-pdf-loading text-danger small">{error}</div>}
    </div>
  );
}
