"use client";
import { plural } from "@/lib/plural";
import React, { useState } from "react";
import { BsArrowRepeat, BsDownload, BsGrid1X2, BsLightningCharge, BsListUl, BsMagic, BsPlusLg, BsPuzzle, BsTrash } from "react-icons/bs";
import { toast } from "react-toastify";
import PageHeader from "@/components/ui/PageHeader";
import BookExport from "@/components/ui/BookExport";
import Callout from "@/components/ui/Callout";
import CsvDrop, { downloadText } from "@/components/ui/CsvDrop";
import EmptyState from "@/components/ui/EmptyState";
import InfoTip from "@/components/ui/InfoTip";
import { StepIntro, Stepper, WizardFooter } from "@/components/ui/Wizard";
import { CROSSWORD_MAX_LETTERS, CROSSWORD_MAX_WORDS, ClueEntry, Crossword, chunkEntries, generateCrossword, parseClueLine, validateEntries } from "@/lib/crossword/engine";
import { buildCrosswordBook } from "@/lib/crossword/pdf";
import { mulberry32, randomSeed } from "@/lib/wordsearch/engine";
import CrosswordGrid, { ClueList } from "./CrosswordGrid";

const STEPS = [{ label: "Words & clues" }, { label: "Build & review" }, { label: "Export book" }];

const SAMPLE = [
  "LION - King of the jungle",
  "ORANGE - Citrus fruit and a color",
  "PIANO - Instrument with 88 keys",
  "EAGLE - Bird with sharp eyes",
  "ICE CREAM - Frozen summer treat",
  "RAINBOW - Arc of colors after rain",
  "CANDLE - Wax light",
  "APPLE - Keeps the doctor away",
  "NORTH - Opposite of south",
  "GARDEN - Where flowers grow",
];

interface CwPuzzle {
  id: number;
  title: string;
  cw: Crossword;
}

const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export default function CrossWordGenerator() {
  const [step, setStep] = useState(0);
  const [input, setInput] = useState("");
  const [entries, setEntries] = useState<ClueEntry[]>([]);
  const [perPuzzle, setPerPuzzle] = useState(10);
  const [puzzles, setPuzzles] = useState<CwPuzzle[]>([]);
  const [active, setActive] = useState(0);
  const [showAnswers, setShowAnswers] = useState(false);

  const add = (cands: { answer: string; clue: string }[], source: string) => {
    const res = validateEntries(cands, entries);
    res.errors.slice(0, 4).forEach((m) => toast.error(m));
    res.skipped.slice(0, 3).forEach((m) => toast.warning(m));
    if (res.limitReached) toast.error(`You've reached the limit of ${CROSSWORD_MAX_WORDS} words.`);
    if (res.added.length) {
      setEntries((prev) => [...prev, ...res.added]);
      toast.success(`Added ${res.added.length} clue${res.added.length === 1 ? "" : "s"}${source}.`);
    }
    return res;
  };

  const handleAdd = () => {
    const lines = input.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return toast.error("Please type at least one word and clue first.");
    const cands: { answer: string; clue: string }[] = [];
    const bad: string[] = [];
    lines.forEach((l) => {
      const r = parseClueLine(l);
      if ("error" in r) {
        bad.push(l);
        toast.error(r.error);
      } else cands.push(r);
    });
    const res = add(cands, "");
    const rejected = cands.filter((c) => !res.added.some((a) => a.answer === c.answer) && res.errors.some((e) => e.includes(c.answer))).map((c) => `${c.answer} - ${c.clue}`);
    setInput([...bad, ...rejected].join("\n"));
  };

  const handleCsv = (rows: string[][]) => {
    const cands: { answer: string; clue: string }[] = [];
    rows.forEach((row, i) => {
      const cells = row.map((c) => String(c ?? "").trim());
      if (!cells[0]) return;
      if (i === 0 && /^(word|answer)s?$/i.test(cells[0])) return;
      const clue = cells.slice(1).filter(Boolean).join(", ");
      if (!clue) return;
      cands.push({ answer: cells[0].replace(/\s+/g, " ").toUpperCase(), clue });
    });
    if (!cands.length) return toast.error("No words with clues found. The CSV needs two columns: word, clue.");
    add(cands, " from your CSV");
  };

  const build = () => {
    if (entries.length < 2) return toast.error("Add at least 2 words to build a crossword.");
    const list = chunkEntries(entries, perPuzzle).map((group, i) => ({ id: Date.now() + i, title: `Crossword ${i + 1}`, cw: generateCrossword(group, mulberry32(randomSeed())) }));
    setPuzzles(list);
    setActive(0);
    const left = list.flatMap((p) => p.cw.leftOut);
    if (left.length) toast.warning(`These words didn't connect to the others and were left out: ${left.join(", ")}. Try words that share more letters.`, { autoClose: 8000 });
    else toast.success(`${list.length} crossword${list.length === 1 ? " is" : "s are"} ready.`);
  };

  const regenerate = () => {
    const p = puzzles[active];
    if (!p) return;
    const group = chunkEntries(entries, perPuzzle)[active] ?? p.cw.placements.map((x) => ({ answer: x.answer, clue: x.clue }));
    setPuzzles((prev) => prev.map((x, i) => (i === active ? { ...x, cw: generateCrossword(group, mulberry32(randomSeed())) } : x)));
  };

  const puzzle = puzzles[active];
  const maxReachable = entries.length < 2 ? 0 : puzzles.length ? 2 : 1;
  const usable = puzzles.filter((p) => p.cw.placements.length > 1);

  return (
    <div className="container pb-4">
      <PageHeader icon={<BsPuzzle />} title="Crossword" lead="Turn your words and clues into numbered crosswords, then export a print-ready book." />
      <Stepper steps={STEPS} current={step} maxReachable={maxReachable} onSelect={setStep} />
      <div className="pg-card no-print">
        <div className="pg-card-body">
          {step === 0 && (
            <div>
              <StepIntro icon={<BsListUl />} title="Add words and clues">
                Write one per line as <b>WORD - clue</b>. Phrases are fine: they go in the grid without spaces.
              </StepIntro>
              <div className="row g-4">
                <div className="col-lg-6">
                  <label htmlFor="clueInput" className="form-label">
                    Words and clues
                    <InfoTip text={`Separate the word and clue with " - ", ":" or a tab. Up to ${CROSSWORD_MAX_LETTERS} letters per word and ${CROSSWORD_MAX_WORDS} words in total.`} />
                  </label>
                  <textarea id="clueInput" className="form-control" rows={7} placeholder={"LION - King of the jungle\nICE CREAM - Frozen summer treat\nPIANO - Instrument with 88 keys"} value={input} onChange={(e) => setInput(e.target.value)} />
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    <button type="button" className="btn btn-primary" onClick={handleAdd}>
                      <BsPlusLg /> Add to list
                    </button>
                    {!entries.length && (
                      <button type="button" className="btn btn-light" onClick={() => add(SAMPLE.map((l) => parseClueLine(l) as { answer: string; clue: string }), "")}>
                        <BsMagic /> Try a sample list
                      </button>
                    )}
                  </div>
                  <div className="mt-3">
                    <CsvDrop onRows={handleCsv} label="Upload a CSV file" hint="Two columns: word, clue. A header row is optional." />
                  </div>
                </div>
                <div className="col-lg-6">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="form-label m-0">
                      Your list <span className="pg-badge neutral ms-1">{entries.length} / {CROSSWORD_MAX_WORDS}</span>
                    </span>
                    <div className="d-flex gap-1">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadText(entries.length ? "crossword-clues.csv" : "crossword-template.csv", ["Word,Clue", ...(entries.length ? entries : SAMPLE.slice(0, 3).map((l) => parseClueLine(l) as ClueEntry)).map((e) => `${esc(e.answer)},${esc(e.clue)}`)].join("\n") + "\n")}>
                        <BsDownload /> {entries.length ? "Download CSV" : "CSV template"}
                      </button>
                      {entries.length > 0 && (
                        <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => {
                            if (window.confirm("Remove all words and clues?")) {
                              setEntries([]);
                              setPuzzles([]);
                            }
                          }}>
                          <BsTrash /> Clear
                        </button>
                      )}
                    </div>
                  </div>
                  {entries.length === 0 ? (
                    <EmptyState icon={<BsListUl />} title="No clues yet">
                      Words and clues you add will appear here. You can edit clues right in the list.
                    </EmptyState>
                  ) : (
                    <div className="pg-list">
                      {entries.map((e, i) => (
                        <div className="pg-list-row" key={e.answer}>
                          <span className="pg-num">{i + 1}</span>
                          <span className="fw-semibold text-nowrap" style={{ minWidth: "6rem" }}>
                            {e.answer}
                          </span>
                          <input
                            className="form-control form-control-sm"
                            aria-label={`Clue for ${e.answer}`}
                            value={e.clue}
                            onChange={(ev) => setEntries((prev) => prev.map((x) => (x.answer === e.answer ? { ...x, clue: ev.target.value } : x)))}
                          />
                          <button type="button" className="btn btn-ghost btn-icon" aria-label={`Remove ${e.answer}`} onClick={() => setEntries((prev) => prev.filter((x) => x.answer !== e.answer))}>
                            <BsTrash />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <StepIntro icon={<BsGrid1X2 />} title="Build and review">
                Your list is split into puzzles. Words that can&apos;t connect to the others are left out and listed below.
              </StepIntro>
              <div className="pg-subtle p-3 mb-3 d-flex flex-wrap align-items-end gap-3">
                <div>
                  <label className="form-label" htmlFor="perPuzzle">
                    Words per crossword <InfoTip text="8–12 words make a nicely connected crossword." />
                  </label>
                  <input id="perPuzzle" type="number" min={2} max={25} className="form-control" style={{ width: 120 }} value={perPuzzle} onChange={(e) => setPerPuzzle(Math.max(2, Math.min(25, Number(e.target.value) || 2)))} />
                </div>
                <span className="pg-badge info mb-2">
                  {plural(entries.length, "word")} → {plural(Math.ceil(entries.length / perPuzzle), "crossword")}
                </span>
                <button type="button" className="btn btn-primary ms-auto" onClick={build} data-testid="build-crosswords">
                  <BsLightningCharge /> {puzzles.length ? "Rebuild all" : "Build crosswords"}
                </button>
              </div>
              {!puzzle ? (
                <EmptyState icon={<BsPuzzle />} title="Ready when you are" action={<button type="button" className="btn btn-primary" onClick={build}><BsLightningCharge /> Build crosswords</button>}>
                  Click Build to create your crosswords.
                </EmptyState>
              ) : (
                <>
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                    <div className="pg-tabs" role="tablist">
                      {puzzles.map((p, i) => (
                        <button key={p.id} type="button" role="tab" aria-selected={i === active} className={`pg-tab ${i === active ? "active" : ""}`} onClick={() => setActive(i)}>
                          {p.title}
                        </button>
                      ))}
                    </div>
                    <div className="ms-auto d-flex gap-2 align-items-center">
                      <div className="form-check form-switch m-0">
                        <input className="form-check-input" type="checkbox" role="switch" id="cwAnswers" checked={showAnswers} onChange={(e) => setShowAnswers(e.target.checked)} />
                        <label className="form-check-label fw-semibold" htmlFor="cwAnswers">
                          Show answers
                        </label>
                      </div>
                      <button type="button" className="btn btn-light btn-sm" onClick={regenerate}>
                        <BsArrowRepeat /> New layout
                      </button>
                    </div>
                  </div>
                  <div className="row g-4">
                    <div className="col-lg-7">
                      <div className="pg-grid-wrap p-2">
                        <CrosswordGrid id="cw-grid" cw={puzzle.cw} showAnswers={showAnswers} />
                      </div>
                    </div>
                    <div className="col-lg-5">
                      <label className="form-label" htmlFor="cwTitle">
                        Title
                      </label>
                      <input id="cwTitle" className="form-control mb-3" value={puzzle.title} onChange={(e) => setPuzzles((prev) => prev.map((x, i) => (i === active ? { ...x, title: e.target.value } : x)))} />
                      <ClueList cw={puzzle.cw} />
                      {puzzle.cw.leftOut.length > 0 && (
                        <Callout tone="warn" className="mt-3">
                          Left out (no shared letters): <b>{puzzle.cw.leftOut.join(", ")}</b>
                        </Callout>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 2 && (
            <BookExport
              tool="crossword"
              toolDefaults={{ title: "Crossword Puzzle Book", subtitle: "Easy Crosswords for Every Day" }}
              detail={`${usable.length} Crossword Puzzle${usable.length === 1 ? "" : "s"}`}
              contentPages={usable.length + Math.ceil(usable.length / 2)}
              itemsLabel={`${plural(usable.length, "crossword")} + ${plural(Math.ceil(usable.length / 2), "answer page")}`}
              fileBase="crossword-book"
              disabledReason={usable.length ? undefined : "Build at least one crossword first."}
              onPrint={() => window.print()}
              build={(s, fonts) => buildCrosswordBook(usable.map((p) => ({ cw: p.cw, title: p.title })), { trim: s.trim, bleed: s.bleed, frontMatter: s.frontMatter, padForKdp: s.padForKdp }, fonts)}
            />
          )}
        </div>
        <WizardFooter
          onBack={step > 0 ? () => setStep(step - 1) : undefined}
          onNext={step < 2 ? () => setStep(step + 1) : undefined}
          nextDisabled={step === 0 ? entries.length < 2 : !usable.length}
          hint={step === 0 ? (entries.length < 2 ? "Add at least 2 words with clues" : `${entries.length} words ready`) : step === 1 ? (puzzles.length ? `${plural(usable.length, "crossword")} ready` : "Build your crosswords to continue") : ""}
        />
      </div>

      <div className="print-only">
        {usable.map((p) => (
          <div className="print-page" key={`p-${p.id}`}>
            <h2>{p.title}</h2>
            <CrosswordGrid cw={p.cw} showAnswers={false} maxWidth={560} />
            <div className="print-clues">
              <ClueList cw={p.cw} />
            </div>
          </div>
        ))}
        {usable.map((p) => (
          <div className="print-page" key={`a-${p.id}`}>
            <h2>{p.title}: Answers</h2>
            <CrosswordGrid cw={p.cw} showAnswers maxWidth={520} />
          </div>
        ))}
      </div>
    </div>
  );
}

