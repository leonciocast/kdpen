"use client";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_FRONT_MATTER, FRONT_MATTER_STORAGE_KEY, FrontMatter, parseStoredFrontMatter } from "@/lib/print/frontMatter";

const SHARED: (keyof FrontMatter)[] = ["author", "imprint", "year", "edition", "website", "notice"];

function load(sharedKey: string, toolKey: string, defaults: FrontMatter): FrontMatter {
  if (typeof window === "undefined") return defaults;
  try {
    const shared = parseStoredFrontMatter(localStorage.getItem(sharedKey), defaults);
    const own = parseStoredFrontMatter(localStorage.getItem(toolKey), defaults);
    const merged = { ...own };
    SHARED.forEach((k) => (merged[k] = shared[k]));
    return merged;
  } catch {
    return defaults;
  }
}

/**
 * Front matter persisted in localStorage. Author/imprint/notice are shared by
 * all tools; title, subtitle, ISBN and dedication are remembered per tool.
 * Only used in client-only wizard steps, so reading storage on init is safe.
 */
export function useFrontMatter(tool: string, toolDefaults: Partial<FrontMatter>) {
  const sharedKey = `${FRONT_MATTER_STORAGE_KEY}.shared`;
  const toolKey = `${FRONT_MATTER_STORAGE_KEY}.${tool}`;
  const [fm, setFm] = useState<FrontMatter>(() => load(sharedKey, toolKey, { ...DEFAULT_FRONT_MATTER, ...toolDefaults }));

  useEffect(() => {
    try {
      const shared: Partial<FrontMatter> = {};
      const own: Partial<FrontMatter> = {};
      (Object.keys(fm) as (keyof FrontMatter)[]).forEach((k) => ((SHARED.includes(k) ? shared : own)[k] = fm[k]));
      localStorage.setItem(sharedKey, JSON.stringify(shared));
      localStorage.setItem(toolKey, JSON.stringify(own));
    } catch {
      /* storage unavailable */
    }
  }, [fm, sharedKey, toolKey]);

  const update = useCallback((patch: Partial<FrontMatter>) => setFm((f) => ({ ...f, ...patch })), []);
  const reset = useCallback(() => setFm({ ...DEFAULT_FRONT_MATTER, ...toolDefaults }), [toolDefaults]);
  return { fm, update, reset };
}
