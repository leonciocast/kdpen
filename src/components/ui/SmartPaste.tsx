"use client";
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { BsCheckCircleFill, BsChevronDown, BsFileEarmarkText, BsMagic, BsPencil, BsPlusLg, BsScissors, BsThreeDots, BsTrash, BsUnion, BsXLg } from "react-icons/bs";
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

const list = (ws: string[], max = 4) => (ws.length > max ? `${ws.slice(0, max).join(", ")} and ${ws.length - max} more` : ws.join(", "));
const SHOW_CHIPS = 24;

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
  const wordNoun = clues ? "clue" : "word";

  return (
    <div className="pg-paste-review">
      <div className="pg-paste-summary" data-testid="paste-summary">
        <span className="pg-paste-total">
          <span>
            <b>{totals.themes}</b> {totals.themes === 1 ? "theme" : "themes"}
            <span className="pg-dot-sep"> · </span>
            <b>{totals.words}</b> {totals.words === 1 ? wordNoun : `${wordNoun}s`}
            <span className="pg-dot-sep"> · </span>
            <b>{totals.puzzles}</b> {totals.puzzles === 1 ? puzzleNoun : `${puzzleNoun}s`}
          </span>
        </span>
        {themes.length > 1 && (
          <button type="button" className="pg-quiet-btn" onClick={oneTheme} data-testid="paste-one-theme" title="Put every word under the first theme's name">
            Combine into one theme
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
      <button type="button" className="pg-quiet-btn align-self-start" data-testid="paste-add-theme" onClick={() => setThemes((prev) => [...prev, { id: nextId++, name: `Theme ${prev.length + 1}`, items: [], duplicates: [], rejected: [] }])}>
        <BsPlusLg /> Add a theme
      </button>
    </div>
  );
}

/** "⋯" menu: Merge with previous, Split, Delete. Keyboard: Enter/Space opens, arrows move, Esc closes. */
function ThemeMenu({ items, label }: { items: { key: string; label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean; testId: string }[]; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", off);
    ref.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => document.removeEventListener("mousedown", off);
  }, [open]);
  const onKey = (e: React.KeyboardEvent) => {
    const els = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    const at = els.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      setOpen(false);
      ref.current?.querySelector<HTMLButtonElement>(".pg-menu-btn")?.focus();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      els[(at + (e.key === "ArrowDown" ? 1 : els.length - 1)) % els.length]?.focus();
    } else if (e.key === "Enter") e.stopPropagation();
  };
  return (
    <div className="pg-menu" ref={ref} onKeyDown={onKey}>
      <button type="button" className="pg-menu-btn" aria-haspopup="menu" aria-expanded={open} aria-controls={id} aria-label={label} title="More actions" onClick={() => setOpen((o) => !o)} data-testid="paste-menu">
        <BsThreeDots />
      </button>
      {open && (
        <div className="pg-menu-list" role="menu" id={id}>
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              className={it.danger ? "danger" : ""}
              data-testid={it.testId}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
            >
              {it.icon} {it.label}
            </button>
          ))}
        </div>
      )}
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
  const [adding, setAdding] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [all, setAll] = useState(false);
  const notesId = useId();
  const asText = (x: PastedItem) => (clues ? `${x.word} - ${x.clue ?? ""}` : x.word);
  const parseOne = (s: string) => parsePasted(s, { clues, maxLetters }).themes.flatMap((x) => x.items);
  const wordNoun = clues ? "clue" : "word";

  const saveEdit = () => {
    if (editing === null) return;
    const got = parseOne(draft)[0];
    update((th) => ({ ...th, items: got ? th.items.map((x, k) => (k === editing ? got : x)) : th.items.filter((_, k) => k !== editing) }));
    setEditing(null);
  };
  const addWords = () => {
    const text = adding ?? "";
    if (!text.trim()) return setAdding(null);
    const got = parseOne(text);
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
  const long = new Set(review?.long ?? []);
  const shared = new Set((review?.shared ?? []).map(([w]) => w));
  const longest = Math.max(0, ...(review?.long ?? []).map((w) => lettersOf(w).length));
  const nameNeeded = !t.name.trim();

  // Notes: one quiet list behind a disclosure. `warn` ones tint the badge.
  const notes: { key: string; testId: string; warn?: boolean; body: React.ReactNode }[] = [];
  if (t.guessed && index === 0 && count === 1) notes.push({ key: "name", testId: "paste-note-name", warn: nameNeeded, body: <>No theme name in your text, so we suggested one. Rename it if you like.</> });
  if (review?.small && !t.keepSmall)
    notes.push({
      key: "small",
      testId: "paste-note-small",
      warn: true,
      body: (
        <>
          Only {plural(n, wordNoun)}, which makes a small {puzzleNoun}.{" "}
          {index > 0 && (
            <button type="button" className="pg-link-btn" onClick={mergeUp} data-testid="paste-merge-suggest">
              Merge with “{prevName}”
            </button>
          )}
          <button type="button" className="pg-link-btn pg-muted-link" onClick={() => update((th) => ({ ...th, keepSmall: true }))}>
            Keep it
          </button>
        </>
      ),
    });
  if (t.rejected.length) notes.push({ key: "rej", testId: "paste-note-rejected", warn: true, body: <>Left out: {list(t.rejected.map((r) => `“${r.text}” ${r.reason}`), 3)}.</> });
  if (review && review.shared.length)
    notes.push({
      key: "shared",
      testId: "paste-note-shared",
      body: (
        <>
          <span className="pg-mark shared">{list(review.shared.map(([w]) => w))}</span> {review.shared.length === 1 ? "is" : "are"} also in “{review.shared[0][1]}” and will be in both {puzzleNoun}s.{" "}
          <button type="button" className="pg-link-btn" onClick={() => update((th) => ({ ...th, items: th.items.filter((x) => !shared.has(x.word)) }))}>
            Remove from this theme
          </button>
        </>
      ),
    });
  if (review && review.long.length)
    notes.push({
      key: "long",
      testId: "paste-note-long",
      body: (
        <>
          Long {review.long.length === 1 ? "word" : "words"}: {list(review.long.map((w) => `${w} (${lettersOf(w).length})`), 3)}. {longNote(longest, review.long.length)}
        </>
      ),
    });
  if (chunks.length > 1)
    notes.push({
      key: "split",
      testId: "paste-note-split",
      body: (
        <>
          Becomes {chunks.length} {puzzleNoun}s at {wordsPerPuzzle} {wordNoun}s each: {chunks.map((c, k) => `“${t.name || "Theme"} ${k + 1}” (${c})`).join(", ")}.
        </>
      ),
    });
  if (t.duplicates.length) notes.push({ key: "dups", testId: "paste-note-dups", body: <>{plural(t.duplicates.length, "duplicate")} removed: {list(Array.from(new Set(t.duplicates)))}.</> });
  const warn = notes.some((x) => x.warn);

  const visible = all || n <= SHOW_CHIPS + 4 ? t.items : t.items.slice(0, SHOW_CHIPS);
  const menu = [
    ...(index > 0 ? [{ key: "merge", label: "Merge with previous", icon: <BsUnion />, onClick: mergeUp, testId: "paste-merge" }] : []),
    ...(n > 1 ? [{ key: "split", label: n > wordsPerPuzzle ? `Split into ${chunks.length} themes` : "Split in two", icon: <BsScissors />, onClick: split, testId: "paste-split" }] : []),
    { key: "delete", label: "Delete theme", icon: <BsTrash />, onClick: remove, danger: true, testId: "paste-delete" },
  ];

  return (
    <section className={`pg-theme-card ${nameNeeded ? "needs" : ""}`} data-testid="paste-theme" data-name={t.name} data-count={n} aria-label={`Theme ${index + 1}: ${t.name || "unnamed"}`}>
      <header className="pg-theme-head">
        <span className="pg-theme-num" aria-hidden="true">
          {index + 1}
        </span>
        <label className="pg-theme-name" data-value={t.name || "Name this theme"}>
          <span className="visually-hidden">Theme name</span>
          <input value={t.name} maxLength={60} placeholder="Name this theme" onChange={(e) => update((th) => ({ ...th, name: e.target.value, guessed: false }))} data-testid="paste-theme-name" size={1} />
          <BsPencil className="pg-theme-pencil" aria-hidden="true" />
        </label>
        <span className="pg-theme-meta" data-testid="paste-theme-count">
          {plural(n, wordNoun)}
          {chunks.length > 1 && <> · {plural(chunks.length, puzzleNoun)}</>}
        </span>
        {notes.length > 0 && (
            <button type="button" className={`pg-notes-btn ${warn ? "warn" : ""}`} aria-expanded={notesOpen} aria-controls={notesId} onClick={() => setNotesOpen((o) => !o)} data-testid="paste-notes-toggle">
              {warn && <span className="pg-notes-dot" aria-hidden="true" />}
              {plural(notes.length, "note")} <BsChevronDown className="pg-notes-chev" aria-hidden="true" />
            </button>
        )}
        <ThemeMenu items={menu} label={`Actions for ${t.name || "this theme"}`} />
      </header>

      <ul className="pg-theme-notes" id={notesId} hidden={!notesOpen}>
        {notes.map((x) => (
          <li key={x.key} className={`pg-paste-note ${x.warn ? "warn" : ""} ${x.key}`} data-testid={x.testId}>
            {x.body}
          </li>
        ))}
      </ul>

      <div className={`pg-theme-chips ${clues ? "clues" : ""}`} data-testid="paste-chips">
        {visible.map((x, k) =>
          editing === k ? (
            <input
              key={k}
              className="pg-chip-edit"
              value={draft}
              autoFocus
              aria-label={clues ? "Edit word and clue" : "Edit word"}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  saveEdit();
                } else if (e.key === "Escape") setEditing(null);
              }}
            />
          ) : (
            <span key={`${x.word}-${k}`} className={`pg-word-chip ${long.has(x.word) ? "long" : ""} ${shared.has(x.word) ? "shared" : ""}`} data-testid="paste-chip">
              <button
                type="button"
                className="pg-chip-text"
                title={clues ? `${x.word}: ${x.clue}` : long.has(x.word) ? `${x.word}: long word (${lettersOf(x.word).length} letters)` : shared.has(x.word) ? `${x.word}: also in another theme` : `Edit ${x.word}`}
                onClick={() => {
                  setEditing(k);
                  setDraft(asText(x));
                }}
              >
                <span className="pg-chip-word">{x.word}</span>
                {clues && <span className="pg-chip-clue">{x.clue}</span>}
              </button>
              <button type="button" className="pg-chip-x" aria-label={`Remove ${x.word}`} onClick={() => update((th) => ({ ...th, items: th.items.filter((_, j) => j !== k) }))}>
                <BsXLg />
              </button>
            </span>
          )
        )}
        {adding === null ? (
          <button type="button" className="pg-chip-add" onClick={() => setAdding("")} data-testid="paste-add-chip">
            <BsPlusLg /> {clues ? "Add clue" : "Add word"}
          </button>
        ) : (
          <input
            className="pg-chip-edit pg-chip-add-input"
            autoFocus
            placeholder={clues ? "WORD - clue" : "Type words, commas between"}
            value={adding}
            aria-label={`Add ${wordNoun}s to ${t.name}`}
            data-testid="paste-add-words"
            onChange={(e) => setAdding(e.target.value)}
            onBlur={() => !adding.trim() && setAdding(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                addWords();
              } else if (e.key === "Escape") setAdding(null);
            }}
          />
        )}
      </div>
      {n > SHOW_CHIPS + 4 && (
        <button type="button" className="pg-quiet-btn pg-show-all" onClick={() => setAll((a) => !a)} aria-expanded={all} data-testid="paste-show-all">
          {all ? "Show fewer" : `Show all ${n}`} <BsChevronDown className={all ? "flip" : ""} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
