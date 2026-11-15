"use client";
import React, { useMemo, useRef, useState } from "react";
import { BsArrowsCollapse, BsCheckCircleFill, BsExclamationTriangleFill, BsFileEarmarkText, BsInfoCircleFill, BsMagic, BsPlusLg, BsScissors, BsTrash, BsUnion, BsXLg } from "react-icons/bs";
import { toast } from "react-toastify";
import { PasteResult, PastedItem, PastedTheme, chunkSizes, lettersOf, parsePasted, reviewThemes } from "@/lib/paste/parse";
import { PASTE_FILE_TYPES, readPasteFile } from "@/lib/paste/files";
import { plural } from "@/lib/plural";

/** A theme on the review screen (editable copy of a parsed theme). */
export interface DraftTheme {
  id: number;
  name: string;
  items: PastedItem[];
  duplicates: string[];
  rejected: { text: string; reason: string }[];
  /** Name was suggested by us, not found in the text. */
  guessed?: boolean;
  /** "Merge with previous" was dismissed for this theme. */
  keepSmall?: boolean;
}

let nextId = 1;
export function draftsFrom(res: PasteResult): DraftTheme[] {
  return res.themes.map((t: PastedTheme) => ({ id: nextId++, name: t.name, items: t.items, duplicates: t.duplicates, rejected: t.rejected, guessed: !t.fromHeading || res.needsName }));
}

export interface PasteTotals {
  themes: number;
  words: number;
  puzzles: number;
}
export function pasteTotals(themes: DraftTheme[], per: number): PasteTotals {
  const live = themes.filter((t) => t.items.length);
  return { themes: live.length, words: live.reduce((n, t) => n + t.items.length, 0), puzzles: live.reduce((n, t) => n + chunkSizes(t.items.length, per).length, 0) };
}
export const totalsLine = (t: PasteTotals, puzzleNoun = "puzzle", wordNoun = "word") => `${plural(t.themes, "theme")} · ${plural(t.words, wordNoun)} · ${plural(t.puzzles, puzzleNoun)}`;

// ------------------------------------------------------------------ paste box

export function PasteBox({ value, onChange, clues, example, maxLetters }: { value: string; onChange: (v: string) => void; clues?: boolean; example: string; maxLetters?: number }) {
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (value.trim() ? parsePasted(value, { clues, maxLetters }) : null), [value, clues, maxLetters]);
  const found = preview ? preview.themes.reduce((n, t) => n + t.items.length, 0) : 0;

  const take = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await readPasteFile(file);
      onChange(value.trim() ? `${value.trimEnd()}\n\n${text}` : text);
      toast.success(`Read ${file.name}.`);
    } catch (e) {
      toast.error((e as Error).message);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div
      className={`pg-paste ${drag ? "drag" : ""}`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files?.length) return;
        e.preventDefault();
        setDrag(false);
        void take(e.dataTransfer.files[0]);
      }}
    >
      <label htmlFor="pasteInput" className="visually-hidden">
        Your word list
      </label>
      <textarea
        id="pasteInput"
        data-testid="paste-input"
        className="form-control pg-big-input pg-paste-input"
        rows={13}
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus
        placeholder={
          clues
            ? "Paste your words and clues, with theme names above them. For example:\n\nOcean Animals\nWHALE - The largest animal\nSHARK - Fish with many teeth\n\nFarm: \nCOW - Gives us milk"
            : "Paste your list in any format, with theme names above the words. For example:\n\nOcean Animals\n1. WHALE\n2. SHARK\n\n🐄 Farm Animals\n- COW\n- PIG\n\nFruits: apple, pear, mango"
        }
      />
      {drag && (
        <div className="pg-paste-drop">
          <BsFileEarmarkText size={28} /> Drop your .txt, .csv or .docx file
        </div>
      )}
      <div className="pg-paste-bar">
        <span className="pg-paste-found" data-testid="paste-found" aria-live="polite">
          {preview && found ? (
            <>
              <BsCheckCircleFill className="text-success" /> We found {plural(preview.themes.filter((t) => t.items.length).length, "theme")} and {plural(found, clues ? "clue" : "word")}
            </>
          ) : value.trim() ? (
            <>No {clues ? "words with clues" : "words"} found yet</>
          ) : (
            <>Numbers, bullets, commas, tabs, CSV and spreadsheets all work.</>
          )}
        </span>
        <span className="d-flex gap-3 flex-wrap">
          <button type="button" className="pg-link-btn" data-testid="paste-example" onClick={() => onChange(example)}>
            <BsMagic /> Paste example
          </button>
          <button type="button" className="pg-link-btn" onClick={() => fileRef.current?.click()}>
            <BsFileEarmarkText /> Open a file
          </button>
          {value && (
            <button type="button" className="pg-link-btn text-muted" onClick={() => onChange("")}>
              Clear
            </button>
          )}
        </span>
        <input ref={fileRef} type="file" accept={PASTE_FILE_TYPES} className="d-none" data-testid="paste-file" onChange={(e) => void take(e.target.files?.[0])} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ review

interface ReviewProps {
  themes: DraftTheme[];
  setThemes: React.Dispatch<React.SetStateAction<DraftTheme[]>>;
  clues?: boolean;
  wordsPerPuzzle: number;
  /** Words with more letters than this are flagged. */
  longAt: number;
  longNote: (longest: number, count: number) => string;
  maxLetters: number;
  puzzleNoun?: string;
}

const Note = ({ tone, children, testId }: { tone: "ok" | "info" | "warn"; children: React.ReactNode; testId?: string }) => (
  <div className={`pg-paste-note ${tone}`} data-testid={testId}>
    {tone === "ok" ? <BsCheckCircleFill /> : tone === "warn" ? <BsExclamationTriangleFill /> : <BsInfoCircleFill />}
    <span>{children}</span>
  </div>
);

const list = (ws: string[], max = 4) => (ws.length > max ? `${ws.slice(0, max).join(", ")} and ${ws.length - max} more` : ws.join(", "));

export function PasteReview({ themes, setThemes, clues, wordsPerPuzzle, longAt, longNote, maxLetters, puzzleNoun = "puzzle" }: ReviewProps) {
  const reviews = useMemo(() => reviewThemes(themes, { wordsPerPuzzle, longAt }), [themes, wordsPerPuzzle, longAt]);
  const totals = pasteTotals(themes, wordsPerPuzzle);
  const update = (id: number, fn: (t: DraftTheme) => DraftTheme) => setThemes((prev) => prev.map((t) => (t.id === id ? fn(t) : t)));
  const mergeUp = (i: number) =>
    setThemes((prev) => {
      if (i < 1) return prev;
      const a = prev[i - 1];
      const b = prev[i];
      const seen = new Set(a.items.map((x) => lettersOf(x.word)));
      const moved = b.items.filter((x) => !seen.has(lettersOf(x.word)));
      const dups = b.items.filter((x) => seen.has(lettersOf(x.word))).map((x) => x.word);
      const merged = { ...a, items: [...a.items, ...moved], duplicates: [...a.duplicates, ...b.duplicates, ...dups], rejected: [...a.rejected, ...b.rejected] };
      return [...prev.slice(0, i - 1), merged, ...prev.slice(i + 1)];
    });
  const split = (i: number) =>
    setThemes((prev) => {
      const t = prev[i];
      const sizes = t.items.length > wordsPerPuzzle ? chunkSizes(t.items.length, wordsPerPuzzle) : chunkSizes(t.items.length, Math.ceil(t.items.length / 2));
      let at = 0;
      const parts = sizes.map((n, k) => {
        const p: DraftTheme = { ...t, id: nextId++, name: `${t.name} ${k + 1}`, items: t.items.slice(at, at + n), duplicates: k ? [] : t.duplicates, rejected: k ? [] : t.rejected };
        at += n;
        return p;
      });
      return [...prev.slice(0, i), ...parts, ...prev.slice(i + 1)];
    });
  const oneTheme = () =>
    setThemes((prev) => {
      if (prev.length < 2) return prev;
      const seen = new Set<string>();
      const items: PastedItem[] = [];
      const dups: string[] = [];
      for (const t of prev)
        for (const x of t.items) {
          const k = lettersOf(x.word);
          if (seen.has(k)) dups.push(x.word);
          else {
            seen.add(k);
            items.push(x);
          }
        }
      return [{ ...prev[0], items, duplicates: [...prev.flatMap((t) => t.duplicates), ...dups], rejected: prev.flatMap((t) => t.rejected) }];
    });

  return (
    <div className="pg-paste-review">
      <div className="pg-paste-summary" data-testid="paste-summary">
        <span className="pg-paste-total">{totalsLine(totals, puzzleNoun, clues ? "clue" : "word")}</span>
        <span className="text-muted small">
          {plural(wordsPerPuzzle, clues ? "clue" : "word")} per {puzzleNoun}: long themes become numbered {puzzleNoun}s automatically.
        </span>
        {themes.length > 1 && (
          <button type="button" className="btn btn-light btn-sm ms-auto" onClick={oneTheme} data-testid="paste-one-theme" title="Put every word under the first theme's name">
            <BsArrowsCollapse /> One theme for everything
          </button>
        )}
      </div>
      {themes.map((t, i) => (
        <ThemeCard
          key={t.id}
          t={t}
          index={i}
          count={themes.length}
          review={reviews[i]}
          clues={clues}
          prevName={i > 0 ? themes[i - 1].name : ""}
          longNote={longNote}
          maxLetters={maxLetters}
          wordsPerPuzzle={wordsPerPuzzle}
          puzzleNoun={puzzleNoun}
          update={(fn) => update(t.id, fn)}
          mergeUp={() => mergeUp(i)}
          split={() => split(i)}
          remove={() => setThemes((prev) => prev.filter((x) => x.id !== t.id))}
        />
      ))}
      {themes.length === 0 && <div className="pg-empty-pointer">Nothing left. Go back to paste your list again.</div>}
      <button type="button" className="btn btn-outline-primary btn-sm align-self-start" data-testid="paste-add-theme" onClick={() => setThemes((prev) => [...prev, { id: nextId++, name: `Theme ${prev.length + 1}`, items: [], duplicates: [], rejected: [] }])}>
        <BsPlusLg /> Add a theme
      </button>
    </div>
  );
}

function ThemeCard({
  t,
  index,
  count,
  review,
  clues,
  prevName,
  longNote,
  maxLetters,
  wordsPerPuzzle,
  puzzleNoun,
  update,
  mergeUp,
  split,
  remove,
}: {
  t: DraftTheme;
  index: number;
  count: number;
  review: ReturnType<typeof reviewThemes>[number] | undefined;
  clues?: boolean;
  prevName: string;
  longNote: (n: number, count: number) => string;
  maxLetters: number;
  wordsPerPuzzle: number;
  puzzleNoun: string;
  update: (fn: (t: DraftTheme) => DraftTheme) => void;
  mergeUp: () => void;
  split: () => void;
  remove: () => void;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState("");
  const asText = (x: PastedItem) => (clues ? `${x.word} - ${x.clue ?? ""}` : x.word);
  const parseOne = (s: string) => parsePasted(s, { clues, maxLetters }).themes.flatMap((x) => x.items);

  const saveEdit = () => {
    if (editing === null) return;
    const got = parseOne(draft)[0];
    update((th) => ({ ...th, items: got ? th.items.map((x, k) => (k === editing ? got : x)) : th.items.filter((_, k) => k !== editing) }));
    setEditing(null);
  };
  const addWords = () => {
    const got = parseOne(adding);
    if (!got.length) return toast.error(clues ? "Write each one as WORD - clue." : "No words found there.");
    let dup = 0;
    update((th) => {
      const seen = new Set(th.items.map((x) => lettersOf(x.word)));
      const fresh = got.filter((x) => {
        const k = lettersOf(x.word);
        if (seen.has(k)) {
          dup++;
          return false;
        }
        seen.add(k);
        return true;
      });
      return { ...th, items: [...th.items, ...fresh] };
    });
    if (dup) toast.info(`${plural(dup, "word")} already in this theme.`);
    setAdding("");
  };

  const n = t.items.length;
  const chunks = review?.chunks ?? [];
  const longest = Math.max(0, ...(review?.long ?? []).map((w) => lettersOf(w).length));
  return (
    <section className={`pg-theme-card ${t.guessed && !t.name.trim() ? "needs" : ""}`} data-testid="paste-theme" data-name={t.name} data-count={n}>
      <header className="pg-theme-head">
        <span className="pg-theme-num">{index + 1}</span>
        <div className="pg-theme-name">
          <label className="visually-hidden" htmlFor={`theme-${t.id}`}>
            Theme name
          </label>
          <input id={`theme-${t.id}`} className="form-control" value={t.name} maxLength={60} placeholder="Name this theme" onChange={(e) => update((th) => ({ ...th, name: e.target.value, guessed: false }))} data-testid="paste-theme-name" />
        </div>
        <span className="pg-badge neutral" data-testid="paste-theme-count">
          {plural(n, clues ? "clue" : "word")}
        </span>
        {chunks.length > 1 && <span className="pg-badge info">{plural(chunks.length, puzzleNoun)}</span>}
        <span className="pg-theme-actions">
          {index > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={mergeUp} title={`Move these words into “${prevName}”`} data-testid="paste-merge">
              <BsUnion /> Merge with previous
            </button>
          )}
          {n > 1 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={split} title={n > wordsPerPuzzle ? `Split into ${chunks.length} themes` : "Split into two themes"} data-testid="paste-split">
              <BsScissors /> Split
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={remove} aria-label={`Delete theme ${t.name}`} data-testid="paste-delete">
            <BsTrash /> Delete
          </button>
        </span>
      </header>

      <div className="pg-theme-notes">
        {t.guessed && index === 0 && count === 1 && (
          <Note tone="info" testId="paste-note-name">
            We didn&apos;t find a theme name in your text, so we suggested one. Change it if you like.
          </Note>
        )}
        {t.duplicates.length > 0 && (
          <Note tone="ok" testId="paste-note-dups">
            {plural(t.duplicates.length, "duplicate")} removed ({list(Array.from(new Set(t.duplicates)))}).
          </Note>
        )}
        {chunks.length > 1 && (
          <Note tone="info" testId="paste-note-split">
            {n} {clues ? "clues" : "words"} at {wordsPerPuzzle} per {puzzleNoun} → {chunks.length} {puzzleNoun}s: {chunks.map((c, k) => `“${t.name || "Theme"} ${k + 1}” (${c})`).join(", ")}.
          </Note>
        )}
        {review && review.long.length > 0 && (
          <Note tone="info" testId="paste-note-long">
            Long {review.long.length === 1 ? "word" : "words"}: {list(review.long.map((w) => `${w} (${lettersOf(w).length})`), 3)}. {longNote(longest, review.long.length)}
          </Note>
        )}
        {review && review.shared.length > 0 && (
          <Note tone="info" testId="paste-note-shared">
            {list(review.shared.map(([w]) => w))} {review.shared.length === 1 ? "is" : "are"} also in “{review.shared[0][1]}”. That&apos;s fine: {review.shared.length === 1 ? "it" : "they"} will be in both {puzzleNoun}s.{" "}
            <button type="button" className="pg-link-btn" onClick={() => update((th) => ({ ...th, items: th.items.filter((x) => !review.shared.some(([w]) => w === x.word)) }))}>
              Remove from this theme
            </button>
          </Note>
        )}
        {review?.small && !t.keepSmall && (
          <Note tone="warn" testId="paste-note-small">
            Only {plural(n, clues ? "clue" : "word")}, a small {puzzleNoun}. Merge with “{prevName || "the theme before"}”?{" "}
            {index > 0 && (
              <button type="button" className="pg-link-btn" onClick={mergeUp} data-testid="paste-merge-suggest">
                Merge
              </button>
            )}
            <button type="button" className="pg-link-btn text-muted ms-2" onClick={() => update((th) => ({ ...th, keepSmall: true }))}>
              Keep it
            </button>
          </Note>
        )}
        {t.rejected.length > 0 && (
          <Note tone="warn" testId="paste-note-rejected">
            Left out: {list(t.rejected.map((r) => `“${r.text}” ${r.reason}`), 3)}.
          </Note>
        )}
      </div>

      <div className={`pg-theme-chips ${clues ? "clues" : ""}`} data-testid="paste-chips">
        {t.items.map((x, k) =>
          editing === k ? (
            <input
              key={k}
              className="form-control form-control-sm pg-chip-edit"
              value={draft}
              autoFocus
              aria-label="Edit word"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  saveEdit();
                } else if (e.key === "Escape") setEditing(null);
              }}
              style={{ width: `${Math.max(8, draft.length + 2)}ch` }}
            />
          ) : (
            <span key={`${x.word}-${k}`} className={`pg-chip pg-word-chip ${review?.long.includes(x.word) ? "long" : ""} ${review?.shared.some(([w]) => w === x.word) ? "shared" : ""}`} data-testid="paste-chip">
              <button
                type="button"
                className="pg-chip-text"
                title={clues ? `${x.clue}\n(click to edit)` : "Click to edit"}
                onClick={() => {
                  setEditing(k);
                  setDraft(asText(x));
                }}
              >
                {x.word}
                {clues && <span className="pg-chip-clue">{x.clue}</span>}
              </button>
              <button type="button" className="pg-chip-x" aria-label={`Remove ${x.word}`} onClick={() => update((th) => ({ ...th, items: th.items.filter((_, j) => j !== k) }))}>
                <BsXLg />
              </button>
            </span>
          )
        )}
        <span className="pg-chip-add">
          <input
            className="form-control form-control-sm"
            placeholder={clues ? "Add WORD - clue" : "Add words…"}
            value={adding}
            aria-label={`Add words to ${t.name}`}
            data-testid="paste-add-words"
            onChange={(e) => setAdding(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                addWords();
              }
            }}
          />
          {adding.trim() && (
            <button type="button" className="btn btn-primary btn-sm" onClick={addWords}>
              Add
            </button>
          )}
        </span>
      </div>
    </section>
  );
}
