import type React from "react";
import { tidyLines } from "@/lib/text";

/**
 * Props that keep a list textarea tidy as you go: pasted text and the box on
 * blur get trimmed lines, single spaces and no blank lines.
 */
export function tidyHandlers(setValue: (v: string) => void, opts: { keepTabs?: boolean } = {}) {
  return {
    onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const pasted = e.clipboardData.getData("text/plain");
      if (!pasted) return;
      e.preventDefault();
      const ta = e.currentTarget;
      const before = ta.value.slice(0, ta.selectionStart);
      const after = ta.value.slice(ta.selectionEnd);
      let next = tidyLines(before + pasted + after, opts);
      // Let the user keep typing on a fresh line after pasting a list.
      if (!after.trim() && /\n\s*$/.test(pasted) && next) next += "\n";
      setValue(next);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = ta.value.length;
        ta.scrollTop = ta.scrollHeight;
      });
    },
    onBlur: (e: React.FocusEvent<HTMLTextAreaElement>) => {
      const next = tidyLines(e.currentTarget.value, opts);
      if (next !== e.currentTarget.value) setValue(next);
    },
  };
}
