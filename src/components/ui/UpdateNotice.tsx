"use client";

import { useEffect, useState } from "react";
import { BsArrowClockwise } from "react-icons/bs";

const MINE = process.env.NEXT_PUBLIC_BUILD_ID ?? "";
const EVERY_MS = 3 * 60 * 1000;

/**
 * A quiet note when the server has been updated since this tab loaded, so an old tab
 * doesn't keep running old code. Checks when the tab comes back into view and every few minutes.
 */
export default function UpdateNotice() {
  const [stale, setStale] = useState(false);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!MINE) return;
    let busy = false;
    const check = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        if (r.ok) {
          const { build } = (await r.json()) as { build?: string };
          if (build && build !== MINE) setStale(true);
        }
      } catch {
        // Offline or the server is restarting: try again later.
      } finally {
        busy = false;
      }
    };
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(check, EVERY_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, []);
  if (!stale || hidden) return null;
  return (
    <div className="pg-update-note no-print" role="status" data-testid="update-note">
      <span>A new version is ready.</span>
      <button type="button" className="btn btn-sm btn-primary" onClick={() => window.location.reload()} data-testid="update-reload">
        <BsArrowClockwise aria-hidden="true" /> Reload
      </button>
      <button type="button" className="pg-link-btn" onClick={() => setHidden(true)}>
        Later
      </button>
    </div>
  );
}
