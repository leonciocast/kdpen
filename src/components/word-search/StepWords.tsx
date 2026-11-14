"use client";
import React, { useMemo, useState } from "react";
import { BsDownload, BsListUl, BsMagic, BsPlusLg, BsTrash, BsSearch } from "react-icons/bs";
import { toast } from "react-toastify";
import CsvDrop, { downloadText } from "@/components/ui/CsvDrop";
import { tidyHandlers } from "@/components/ui/tidyText";
import { tidyLines, tidySpaces } from "@/lib/text";
import EmptyState from "@/components/ui/EmptyState";
import InfoTip from "@/components/ui/InfoTip";
import { StepIntro } from "@/components/ui/Wizard";
import { gridForm } from "@/lib/wordsearch/engine";
import { LIMITS } from "@/lib/limits";
import { CsvEntry, csvRowsToEntries, entriesToCsv, normalizeEntry, parseWords, tokenize } from "@/lib/wordsearch/words";
import { SAMPLE_WORDS, WordEntry } from "./model";

interface Props {
  entries: WordEntry[];
  setEntries: React.Dispatch<React.SetStateAction<WordEntry[]>>;
}

const SHOW = 200;

export default function StepWords({ entries, setEntries }: Props) {
  const [input, setInput] = useState("");
  const [theme, setTheme] = useState("");
  const [query, setQuery] = useState("");

  const addEntries = (list: CsvEntry[], source: "typed" | "csv") => {
    const t0 = performance.now();
    const existing = entries.map((e) => e.word);
    const res = parseWords(
      list.map((e) => e.word),
      existing,
      LIMITS.maxGridSize,
      LIMITS.maxWords
    );
    const themeOf = new Map<string, string | undefined>();
    for (const e of list) {
      const key = normalizeEntry(e.word);
      if (!themeOf.has(key)) themeOf.set(key, e.theme ? tidySpaces(e.theme) : undefined);
    }
    res.errors.slice(0, 4).forEach((m) => toast.error(m));
    if (res.errors.length > 4) toast.error(`…and ${res.errors.length - 4} more entries couldn't be added.`);
    res.skipped.slice(0, 3).forEach((m) => toast.warning(m));
    if (res.skipped.length > 3) toast.warning(`…and ${res.skipped.length - 3} more were skipped.`);
    if (res.limitReached) toast.error(`You've reached the limit of ${LIMITS.maxWords.toLocaleString()} words.`);
    if (res.added.length) {
      const added = res.added.map((w) => {
        const th = themeOf.get(w);
        return th ? { word: w, theme: th } : { word: w };
      });
      setEntries((prev) => [...prev, ...added]);
      const ms = Math.round(performance.now() - t0);
      toast.success(`Added ${res.added.length.toLocaleString()} ${res.added.length === 1 ? "entry" : "entries"}${source === "csv" ? ` from your file (${ms} ms)` : ""}.`);
    }
    return res;
  };

  const handleAdd = () => {
    const tokens = tokenize(input);
    if (!tokens.length) {
      toast.error("Please type at least one word or phrase first.");
      return;
    }
    const th = tidySpaces(theme);
    const res = addEntries(
      tokens.map((w) => (th ? { word: w, theme: th } : { word: w })),
      "typed"
    );
    setInput(tidyLines(res.rejected.join("\n")));
  };

  const handleCsv = (rows: string[][]) => {
    const { entries: list, error } = csvRowsToEntries(rows);
    if (error) return toast.error(error);
    if (!list.length) return toast.error("No valid words found in the file.");
    addEntries(list, "csv");
  };

  const themes = useMemo(() => new Set(entries.map((e) => e.theme).filter(Boolean)).size, [entries]);
  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    const list = entries.map((e, i) => ({ ...e, i }));
    return q ? list.filter((e) => e.word.includes(q) || (e.theme ?? "").toUpperCase().includes(q)) : list;
  }, [entries, query]);

  return (
    <div>
      <StepIntro icon={<BsListUl />} title="Add your words">
        Type one word or phrase per line, or upload a CSV/TXT file with thousands of words. Phrases like <b>ICE CREAM</b> are hidden without spaces. Add a theme to group words into titled puzzles.
      </StepIntro>
      <div className="row g-4">
        <div className="col-lg-6">
          <label htmlFor="wordInput" className="form-label">
            Words and phrases
            <InfoTip text={`Letters A–Z, numbers, Ñ, spaces and hyphens. Up to ${LIMITS.maxGridSize} letters each and ${LIMITS.maxWords.toLocaleString()} entries in total. Duplicates are skipped.`} />
          </label>
          <textarea
            id="wordInput"
            className="form-control"
            rows={6}
            placeholder={"One per line, for example:\nICE CREAM\nSUNSHINE\nBEACH BALL"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            {...tidyHandlers(setInput)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <div className="mt-2">
            <label htmlFor="themeInput" className="form-label small">
              Theme / puzzle title for these words <span className="text-muted fw-normal">(optional)</span>
              <InfoTip text="Words with the same theme are kept together in their own puzzles, titled with the theme (e.g. “Ocean 1”, “Ocean 2”)." />
            </label>
            <input id="themeInput" className="form-control form-control-sm" maxLength={60} placeholder="e.g. Ocean Animals" value={theme} onChange={(e) => setTheme(e.target.value)} />
          </div>
          <div className="d-flex flex-wrap gap-2 mt-2 align-items-center">
            <button type="button" className="btn btn-primary" onClick={handleAdd}>
              <BsPlusLg /> Add to list
            </button>
            {entries.length === 0 && (
              <button type="button" className="btn btn-light" onClick={() => addEntries(SAMPLE_WORDS.map((w) => ({ word: w, theme: "Summer Fun" })), "typed")}>
                <BsMagic /> Try a sample list
              </button>
            )}
            <span className="form-text ms-auto d-none d-sm-inline">
              Tip: <span className="pg-kbd">Ctrl</span> + <span className="pg-kbd">Enter</span> adds
            </span>
          </div>
          <div className="mt-3">
            <CsvDrop onRows={handleCsv} label="Upload a CSV or TXT file" hint="Column 1: word or phrase. Optional column 2: theme/title. A header row is optional." />
          </div>
        </div>
        <div className="col-lg-6">
          <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-1">
            <span className="form-label m-0">
              Your list{" "}
              <span className="pg-badge neutral ms-1" data-testid="word-count">
                {entries.length.toLocaleString()} / {LIMITS.maxWords.toLocaleString()}
              </span>
              {themes > 0 && <span className="pg-badge info ms-1">{themes} themes</span>}
            </span>
            <div className="d-flex gap-1">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => downloadText(entries.length ? "word-search-words.csv" : "word-search-template.csv", entriesToCsv(entries.length ? entries : [{ word: "ICE CREAM", theme: "Summer" }, { word: "WHALE", theme: "Ocean" }]))}
                title={entries.length ? "Download your list as a CSV file" : "Download a CSV template"}
              >
                <BsDownload /> {entries.length ? "Download CSV" : "CSV template"}
              </button>
              {entries.length > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-danger"
                  onClick={() => {
                    if (window.confirm(`Remove all ${entries.length.toLocaleString()} words from the list?`)) setEntries([]);
                  }}
                >
                  <BsTrash /> Clear
                </button>
              )}
            </div>
          </div>
          {entries.length === 0 ? (
            <EmptyState icon={<BsListUl />} title="No words yet">
              Words you add will appear here.
            </EmptyState>
          ) : (
            <>
              {entries.length > 12 && (
                <div className="input-group input-group-sm mb-2">
                  <span className="input-group-text">
                    <BsSearch />
                  </span>
                  <input className="form-control" placeholder="Search words or themes" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search your list" />
                </div>
              )}
              <div className="pg-list" data-testid="word-list">
                {filtered.slice(0, SHOW).map((e) => (
                  <div className="pg-list-row" key={e.word}>
                    <span className="pg-num">{e.i + 1}</span>
                    <span className="flex-grow-1 fw-semibold">
                      {e.word}
                      {e.word.includes(" ") || e.word.includes("-") ? <span className="text-muted small fw-normal ms-2">grid: {gridForm(e.word)}</span> : null}
                    </span>
                    {e.theme && <span className="pg-badge neutral text-truncate" style={{ maxWidth: 140 }}>{e.theme}</span>}
                    <span className="small text-muted">{gridForm(e.word).length}</span>
                    <button type="button" className="btn btn-ghost btn-icon" aria-label={`Remove ${e.word}`} onClick={() => setEntries((prev) => prev.filter((x) => x.word !== e.word))}>
                      <BsTrash />
                    </button>
                  </div>
                ))}
              </div>
              {filtered.length > SHOW && (
                <div className="form-text">
                  Showing {SHOW} of {filtered.length.toLocaleString()}. Use search to find a word.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
