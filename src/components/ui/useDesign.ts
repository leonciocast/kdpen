"use client";
import { useCallback, useEffect, useState } from "react";
import { CURRENT_DESIGN_KEY, PRESETS_STORAGE_KEY, PresetStore, parsePresetStore, removePreset, sanitizeDesign, upsertPreset } from "@/lib/design/presets";
import { DEFAULT_DESIGN, templateDesign } from "@/lib/design/templates";
import type { Design, ToolKind } from "@/lib/design/types";
import { mysteryDesign, upgradeMysteryDesign } from "@/lib/mystery/pdf";

const DEFAULT_FOR: Record<ToolKind, Design> = {
  "word-search": templateDesign("banner"),
  crossword: templateDesign("elegant"),
  sudoku: templateDesign("classic"),
  mystery: mysteryDesign(),
};

function read<T>(key: string, parse: (raw: string | null) => T, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return parse(localStorage.getItem(key));
  } catch {
    return fallback;
  }
}

/** The design for one tool (remembered) plus the saved presets (shared by all tools). */
export function useDesign(tool: ToolKind) {
  const key = `${CURRENT_DESIGN_KEY}.${tool}`;
  const [design, setDesignState] = useState<Design>(() => read(key, (raw) => (raw ? (tool === "mystery" ? upgradeMysteryDesign(sanitizeDesign(JSON.parse(raw))) : sanitizeDesign(JSON.parse(raw))) : DEFAULT_FOR[tool] ?? DEFAULT_DESIGN), DEFAULT_FOR[tool]));
  const [store, setStore] = useState<PresetStore>(() => read(PRESETS_STORAGE_KEY, parsePresetStore, { presets: [] }));

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(design));
    } catch {
      /* storage unavailable */
    }
  }, [design, key]);

  const persist = (s: PresetStore) => {
    setStore(s);
    try {
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(s));
    } catch {
      /* storage unavailable */
    }
  };

  const setDesign = useCallback((d: Design) => setDesignState(sanitizeDesign(d)), []);
  const savePreset = (name: string) => persist(upsertPreset(store, { ...design, name }));
  const deletePreset = (name: string) => persist(removePreset(store, name));
  return { design, setDesign, presets: store.presets, savePreset, deletePreset };
}

export type DesignApi = ReturnType<typeof useDesign>;
