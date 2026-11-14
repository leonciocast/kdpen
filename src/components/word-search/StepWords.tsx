"use client";
import React, { useMemo, useState } from "react";
import { BsDownload, BsKeyboard, BsListUl, BsMagic, BsPlusLg, BsSearch, BsTrash, BsUpload } from "react-icons/bs";
import { Panel } from "@/components/ui/Panel";
import { ChoiceCards, FINISH, FlowCtl, Question, QuestionFlow } from "@/components/ui/Flow";
import { toast } from "react-toastify";
import CsvDrop, { downloadText } from "@/components/ui/CsvDrop";
import { tidyHandlers } from "@/components/ui/tidyText";
import { tidyLines, tidySpaces } from "@/lib/text";
import { gridForm } from "@/lib/wordsearch/engine";
import { LIMITS } from "@/lib/limits";
import { CsvEntry, csvRowsToEntries, entriesToCsv, normalizeEntry, parseWords, tokenize } from "@/lib/wordsearch/words";
import { SAMPLE_WORDS, WordEntry } from "./model";

interface Props {
  entries: WordEntry[];
  setEntries: React.Dispatch<React.SetStateAction<WordEntry[]>>;
  flow: FlowCtl;
}

const SHOW = 200;

export default function StepWords({ entries, setEntries, flow }: Props) {
  const [input, setInput] = useState("");
  const [theme, setTheme] = useState("");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"type" | "upload">(flow.sub === "upload" ? "upload" : "type");
  const [picked, setPicked] = useState<"type" | "upload" | null>(null);

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

  /** Adds what was typed (with the theme, if any). Returns where to go next. */
  const addTyped = (withTheme: boolean): string => {
    const tokens = tokenize(input);
    if (!tokens.length) return "list";
    const th = withTheme ? tidySpaces(theme) : "";
    const res = addEntries(
      tokens.map((w) => (th ? { word: w, theme: th } : { word: w })),
      "typed"
    );
    setInput(tidyLines(res.rejected.join("\n")));
    if (!res.added.length && res.rejected.length) return "type";
    setTheme("");
    return "list";
  };

  const handleCsv = (rows: string[][]) => {
    const { entries: list, error } = csvRowsToEntries(rows);
    if (error) return toast.error(error);
    if (!list.length) return toast.error("No valid words found in the file.");
    const res = addEntries(list, "csv");
    if (res.added.length) flow.setSub("list");
  };

  const themes = useMemo(() => new Set(entries.map((e) => e.theme).filter(Boolean)).size, [entries]);
  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    const list = entries.map((e, i) => ({ ...e, i }));
    return q ? list.filter((e) => e.word.includes(q) || (e.theme ?? "").toUpperCase().includes(q)) : list;
  }, [entries, query]);
  const typedCount = useMemo(() => tokenize(input).length, [input]);

  const how: Question = {
    key: "how",
    title: "How would you like to add your words?",
    lead: "Pick one. You can always add more words later.",
    hideNext: true,
    body: (
      <>
        <ChoiceCards
          label="How do you want to add words?"
          value={picked}
          onPick={(v) => {
            setPicked(v);
            setMode(v);
            flow.setSub(v);
          }}
          options={[
            { value: "type", title: "Type my words", text: "Type or paste your words and phrases, one per line. Best for most books.", icon: <BsKeyboard />, testId: "choose-type", badge: "Recommended", cta: "Type my words" },
            { value: "upload", title: "Upload a file", text: "Already have a list? Import a CSV or TXT file with up to 20,000 words.", icon: <BsUpload />, testId: "choose-upload", cta: "Upload a file" },
          ]}
        />
        <div className="pg-q-note">
          {entries.length > 0 ? (
            <>
              <span>You already have {entries.length.toLocaleString()} words.</span>
              <button type="button" className="pg-link-btn" onClick={() => flow.setSub("list")} data-testid="see-list">
                <BsListUl /> See my list
              </button>
            </>
          ) : (
            <>
              <span>Just exploring?</span>
              <button
                type="button"
                className="pg-link-btn"
                onClick={() => {
                  addEntries(SAMPLE_WORDS.map((w) => ({ word: w, theme: "Summer Fun" })), "typed");
                  flow.setSub("list");
                }}
              >
                <BsMagic /> Use a sample list
              </button>
            </>
          )}
        </div>
      </>
    ),
  };

  const type: Question = {
    key: "type",
    title: "Type your words",
    lead: "One word or phrase per line. Phrases like ICE CREAM are hidden in the grid without the space.",
    canNext: typedCount > 0 || entries.length > 0,
    blockedHint: "Type at least one word to continue",
    hint: typedCount ? `${typedCount.toLocaleString()} ${typedCount === 1 ? "word" : "words"} typed` : undefined,
    onNext: () => (typedCount ? undefined : "list"),
    body: (
      <>
        <label htmlFor="wordInput" className="visually-hidden">
          Words and phrases
        </label>
        <textarea id="wordInput" className="form-control pg-big-input" rows={9} placeholder={"For example:\nICE CREAM\nSUNSHINE\nBEACH BALL"} value={input} onChange={(e) => setInput(e.target.value)} {...tidyHandlers(setInput)} autoFocus />
        <div className="form-text">
          Letters, numbers, Ñ, spaces and hyphens. Up to {LIMITS.maxGridSize} letters each. Tip: <span className="pg-kbd">Ctrl</span> + <span className="pg-kbd">Enter</span> goes to the next question.
        </div>
      </>
    ),
  };

  const themeQ: Question = {
    key: "theme",
    title: "Give these words a theme",
    optional: true,
    lead: "Words with the same theme get their own titled puzzles, like “Ocean 1” and “Ocean 2”. No theme? Just skip.",
    nextLabel: "Add to my list",
    skipLabel: "Skip, no theme",
    onNext: () => addTyped(true),
    onSkip: () => addTyped(false),
    body: (
      <>
        <label htmlFor="themeInput" className="visually-hidden">
          Theme or puzzle title
        </label>
        <input id="themeInput" className="form-control form-control-lg pg-big-input" maxLength={60} placeholder="e.g. Ocean Animals" value={theme} onChange={(e) => setTheme(e.target.value)} autoFocus style={{ maxWidth: 480 }} />
      </>
    ),
  };

  const upload: Question = {
    key: "upload",
    title: "Choose your file",
    lead: "A .csv or .txt file. Column 1: the word or phrase. Column 2 (optional): a theme or puzzle title.",
    canNext: entries.length > 0,
    blockedHint: "Choose a file to continue",
    onNext: () => "list",
    body: (
      <>
        <CsvDrop onRows={handleCsv} label="Click to choose a file, or drop it here" hint={`Up to ${LIMITS.maxWords.toLocaleString()} words. Imports in about a second.`} />
        <div className="pg-q-note">
          <span>Not sure about the format?</span>
          <button type="button" className="pg-link-btn" onClick={() => downloadText("word-search-template.csv", entriesToCsv([{ word: "ICE CREAM", theme: "Summer" }, { word: "WHALE", theme: "Ocean" }]))}>
            <BsDownload /> Download an example file
          </button>
        </div>
      </>
    ),
  };

  const list: Question = {
    key: "list",
    wide: true,
    title: "Check your list",
    lead: "Remove any word you don't want, or add more. When it looks good, press Next.",
    canNext: entries.length > 0,
    blockedHint: "Your list is empty. Press Add more words.",
    hint: `${entries.length.toLocaleString()} ${entries.length === 1 ? "word" : "words"} in your list`,
    nextLabel: "Puzzle settings",
    onNext: () => FINISH,
    body: (
      <Panel
        tone="result"
        title={
          <>
            Your list{" "}
            <span className="pg-badge neutral" data-testid="word-count">
              {entries.length.toLocaleString()} / {LIMITS.maxWords.toLocaleString()}
            </span>
            {themes > 0 && <span className="pg-badge info">{themes} {themes === 1 ? "theme" : "themes"}</span>}
          </>
        }
        icon={<BsListUl />}
        aside={
          <>
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => flow.setSub("how")} data-testid="add-more">
              <BsPlusLg /> Add more words
            </button>
            {entries.length > 0 && (
              <>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadText("word-search-words.csv", entriesToCsv(entries))} title="Download your list as a CSV file">
                  <BsDownload /> CSV
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-danger"
                  onClick={() => {
                    if (window.confirm(`Remove all ${entries.length.toLocaleString()} words from the list?`)) setEntries([]);
                  }}
                >
                  <BsTrash /> Clear
                </button>
              </>
            )}
          </>
        }
      >
        {entries.length === 0 ? (
          <div className="pg-empty-pointer" data-testid="empty-list">
            <span className="pg-icon-badge">
              <BsPlusLg />
            </span>
            <h4>Your list is empty</h4>
            <p>
              Press <b>Add more words</b> to type or upload your words.
            </p>
          </div>
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
            <div className="pg-list pg-list-tall" data-testid="word-list">
              {filtered.slice(0, SHOW).map((e) => (
                <div className="pg-list-row" key={e.word}>
                  <span className="pg-num">{e.i + 1}</span>
                  <span className="flex-grow-1 fw-semibold">
                    {e.word}
                    {e.word.includes(" ") || e.word.includes("-") ? <span className="text-muted small fw-normal ms-2">grid: {gridForm(e.word)}</span> : null}
                  </span>
                  {e.theme && (
                    <span className="pg-badge neutral text-truncate" style={{ maxWidth: 160 }}>
                      {e.theme}
                    </span>
                  )}
                  <span className="small text-muted" title="Letters in the grid">
                    {gridForm(e.word).length}
                  </span>
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
      </Panel>
    ),
  };

  const questions = [how, ...(mode === "type" ? [type, themeQ] : [upload]), list];
  return <QuestionFlow questions={questions} flow={flow} />;
}
