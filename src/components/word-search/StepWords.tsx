"use client";
import React, { useState } from "react";
import { BsDownload, BsListUl, BsMagic, BsPlusLg, BsTrash } from "react-icons/bs";
import { toast } from "react-toastify";
import CsvDrop, { downloadText } from "@/components/ui/CsvDrop";
import { tidyHandlers } from "@/components/ui/tidyText";
import { tidyLines } from "@/lib/text";
import EmptyState from "@/components/ui/EmptyState";
import InfoTip from "@/components/ui/InfoTip";
import { StepIntro } from "@/components/ui/Wizard";
import { gridForm } from "@/lib/wordsearch/engine";
import { MAX_WORDS, csvRowsToTokens, parseWords, tokenize, wordsToCsv } from "@/lib/wordsearch/words";
import { SAMPLE_WORDS } from "./model";

interface Props {
  words: string[];
  setWords: React.Dispatch<React.SetStateAction<string[]>>;
  gridSize: number;
}

export default function StepWords({ words, setWords, gridSize }: Props) {
  const [input, setInput] = useState("");

  const addTokens = (tokens: string[], source: "typed" | "csv") => {
    const res = parseWords(tokens, words, gridSize, MAX_WORDS);
    res.errors.slice(0, 4).forEach((m) => toast.error(m));
    if (res.errors.length > 4) toast.error(`…and ${res.errors.length - 4} more entries couldn't be added.`);
    res.skipped.slice(0, 3).forEach((m) => toast.warning(m));
    if (res.skipped.length > 3) toast.warning(`…and ${res.skipped.length - 3} more were skipped.`);
    if (res.limitReached) toast.error(`You've reached the limit of ${MAX_WORDS} words.`);
    if (res.added.length) {
      setWords((prev) => [...prev, ...res.added]);
      toast.success(`Added ${res.added.length} ${res.added.length === 1 ? "entry" : "entries"}${source === "csv" ? " from your CSV" : ""}.`);
    }
    return res;
  };

  const handleAdd = () => {
    const tokens = tokenize(input);
    if (!tokens.length) {
      toast.error("Please type at least one word or phrase first.");
      return;
    }
    const res = addTokens(tokens, "typed");
    // Keep only the entries that need fixing.
    setInput(tidyLines(res.rejected.join("\n")));
  };

  const handleCsv = (rows: string[][]) => {
    const { tokens, error } = csvRowsToTokens(rows);
    if (error) return toast.error(error);
    if (!tokens.length) return toast.error("No valid words found in the CSV file.");
    addTokens(tokens, "csv");
  };

  const tooLong = words.filter((w) => gridForm(w).length > gridSize);

  return (
    <div>
      <StepIntro icon={<BsListUl />} title="Add your words">
        Type one word or phrase per line, or upload a CSV file. Phrases like <b>ICE CREAM</b> are hidden in the grid without spaces.
      </StepIntro>
      <div className="row g-4">
        <div className="col-lg-6">
          <label htmlFor="wordInput" className="form-label">
            Words and phrases
            <InfoTip text={`Letters A–Z, numbers, Ñ, spaces and hyphens. Up to ${gridSize} letters each (the grid size), ${MAX_WORDS} entries in total. Duplicates are skipped.`} />
          </label>
          <textarea
            id="wordInput"
            className="form-control"
            rows={7}
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
          <div className="d-flex flex-wrap gap-2 mt-2 align-items-center">
            <button type="button" className="btn btn-primary" onClick={handleAdd}>
              <BsPlusLg /> Add to list
            </button>
            {words.length === 0 && (
              <button type="button" className="btn btn-light" onClick={() => addTokens(SAMPLE_WORDS, "typed")}>
                <BsMagic /> Try a sample list
              </button>
            )}
            <span className="form-text ms-auto d-none d-sm-inline">
              Tip: <span className="pg-kbd">Ctrl</span> + <span className="pg-kbd">Enter</span> adds
            </span>
          </div>
          <div className="mt-3">
            <CsvDrop onRows={handleCsv} label="Upload a CSV file" hint="One word or phrase per row. A “Word” header row is optional." />
          </div>
        </div>
        <div className="col-lg-6">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="form-label m-0">
              Your list <span className="pg-badge neutral ms-1">{words.length} / {MAX_WORDS}</span>
            </span>
            <div className="d-flex gap-1">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => downloadText(words.length ? "word-search-words.csv" : "word-search-template.csv", wordsToCsv(words.length ? words : SAMPLE_WORDS.slice(0, 3)))}
                title={words.length ? "Download your list as a CSV file" : "Download a CSV template"}
              >
                <BsDownload /> {words.length ? "Download CSV" : "CSV template"}
              </button>
              {words.length > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-danger"
                  onClick={() => {
                    if (window.confirm("Remove all words from the list?")) setWords([]);
                  }}
                >
                  <BsTrash /> Clear
                </button>
              )}
            </div>
          </div>
          {words.length === 0 ? (
            <EmptyState icon={<BsListUl />} title="No words yet">
              Words you add will appear here.
            </EmptyState>
          ) : (
            <div className="pg-list" data-testid="word-list">
              {words.map((w, i) => {
                const long = gridForm(w).length > gridSize;
                return (
                  <div className="pg-list-row" key={w}>
                    <span className="pg-num">{i + 1}</span>
                    <span className={`flex-grow-1 fw-semibold ${long ? "text-danger" : ""}`}>
                      {w}
                      {w.includes(" ") || w.includes("-") ? <span className="text-muted small fw-normal ms-2">grid: {gridForm(w)}</span> : null}
                    </span>
                    <span className="small text-muted">{gridForm(w).length}</span>
                    <button type="button" className="btn btn-ghost btn-icon" aria-label={`Remove ${w}`} onClick={() => setWords((prev) => prev.filter((x) => x !== w))}>
                      <BsTrash />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {tooLong.length > 0 && <div className="form-text text-danger mt-2">Red entries are longer than the {gridSize}×{gridSize} grid. Make the grid bigger in step 2 or remove them.</div>}
        </div>
      </div>
    </div>
  );
}
