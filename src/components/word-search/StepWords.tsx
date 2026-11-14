"use client";
import React, { useMemo, useState } from "react";
import { BsArrowLeft, BsArrowUp, BsCheckCircleFill, BsDownload, BsKeyboard, BsListUl, BsMagic, BsPencilSquare, BsPlusLg, BsSearch, BsTrash, BsUpload } from "react-icons/bs";
import { ChoiceSwitch, Panel, SubStep } from "@/components/ui/Panel";
import { toast } from "react-toastify";
import CsvDrop, { downloadText } from "@/components/ui/CsvDrop";
import { tidyHandlers } from "@/components/ui/tidyText";
import { tidyLines, tidySpaces } from "@/lib/text";
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
  const [mode, setMode] = useState<"type" | "upload">("type");

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

  const typeMode = (
    <>
      <SubStep n={1} title="Type your words" hint="One word or phrase per line. Phrases like ICE CREAM are hidden without the space.">
        <label htmlFor="wordInput" className="visually-hidden">
          Words and phrases
        </label>
        <textarea
          id="wordInput"
          className="form-control pg-big-input"
          rows={7}
          placeholder={"For example:\nICE CREAM\nSUNSHINE\nBEACH BALL"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          {...tidyHandlers(setInput)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleAdd();
            }
          }}
          autoFocus
        />
        <div className="form-text">
          Letters, numbers, Ñ, spaces and hyphens. Up to {LIMITS.maxGridSize} letters each.
        </div>
      </SubStep>
      <SubStep n={2} optional title="Give them a theme" hint="Words with the same theme get their own titled puzzles (for example “Ocean 1”, “Ocean 2”).">
        <label htmlFor="themeInput" className="visually-hidden">
          Theme or puzzle title
        </label>
        <input id="themeInput" className="form-control" maxLength={60} placeholder="e.g. Ocean Animals" value={theme} onChange={(e) => setTheme(e.target.value)} style={{ maxWidth: 360 }} />
      </SubStep>
      <SubStep n={3} title="Add them to your list">
        <div className="d-flex flex-wrap align-items-center gap-3">
          <button type="button" className={`btn btn-lg ${entries.length ? "btn-outline-primary" : "btn-primary"}`} onClick={handleAdd} data-testid="add-words">
            <BsPlusLg /> Add to list
          </button>
          <span className="form-text m-0 d-none d-sm-inline">
            or press <span className="pg-kbd">Ctrl</span> + <span className="pg-kbd">Enter</span>
          </span>
        </div>
      </SubStep>
      {entries.length === 0 && (
        <div className="pg-secondary-row">
          <span>Just exploring?</span>
          <button type="button" className="pg-link-btn" onClick={() => addEntries(SAMPLE_WORDS.map((w) => ({ word: w, theme: "Summer Fun" })), "typed")}>
            <BsMagic /> Use a sample list
          </button>
        </div>
      )}
    </>
  );

  const uploadMode = (
    <>
      <SubStep n={1} title="Choose your file" hint="A .csv or .txt file. Column 1: the word or phrase. Column 2 (optional): a theme / puzzle title. A header row is optional.">
        <CsvDrop onRows={handleCsv} label="Click to choose a file, or drop it here" hint={`Up to ${LIMITS.maxWords.toLocaleString()} words. Imports in about a second.`} />
      </SubStep>
      <SubStep n={2} optional title="Need an example file?">
        <button type="button" className="btn btn-light btn-sm" onClick={() => downloadText("word-search-template.csv", entriesToCsv([{ word: "ICE CREAM", theme: "Summer" }, { word: "WHALE", theme: "Ocean" }]))}>
          <BsDownload /> Download a CSV template
        </button>
      </SubStep>
    </>
  );

  return (
    <div>
      <StepIntro icon={<BsListUl />} title="Add your words">
        Start by typing the words for your puzzles. You can also upload a file if you already have a list.
      </StepIntro>
      <div className="row g-4">
        <div className="col-lg-7">
          <Panel tone="action" title="Add words" icon={<BsPencilSquare />} testId="add-panel">
            <ChoiceSwitch
              label="How do you want to add words?"
              value={mode}
              onChange={setMode}
              options={[
                { value: "type", title: "Type my words", text: "Recommended for most books", icon: <BsKeyboard />, testId: "choose-type" },
                { value: "upload", title: "Upload a file", text: "CSV or TXT with many words", icon: <BsUpload />, testId: "choose-upload" },
              ]}
            />
            {mode === "type" ? typeMode : uploadMode}
          </Panel>
        </div>
        <div className="col-lg-5">
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
              entries.length > 0 && (
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
              )
            }
          >
            {entries.length === 0 ? (
              <div className="pg-empty-pointer" data-testid="empty-list">
                <span className="pg-icon-badge">
                  <BsArrowLeft className="d-none d-lg-inline" />
                  <BsArrowUp className="d-lg-none" />
                </span>
                <h4>Your list is empty</h4>
                <p>
                  Type your words, then press <b>Add to list</b>. They will appear here, and you can remove any of them.
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
                <div className="pg-list" data-testid="word-list">
                  {filtered.slice(0, SHOW).map((e) => (
                    <div className="pg-list-row" key={e.word}>
                      <span className="pg-num">{e.i + 1}</span>
                      <span className="flex-grow-1 fw-semibold">
                        {e.word}
                        {e.word.includes(" ") || e.word.includes("-") ? <span className="text-muted small fw-normal ms-2">grid: {gridForm(e.word)}</span> : null}
                      </span>
                      {e.theme && (
                        <span className="pg-badge neutral text-truncate" style={{ maxWidth: 140 }}>
                          {e.theme}
                        </span>
                      )}
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
                <div className="pg-next-tip">
                  <BsCheckCircleFill /> <span>Looks good? Press <b>Next</b> at the bottom to choose the puzzle settings.</span>
                </div>
              </>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
