"use client";
import { tidyHandlers } from "@/components/ui/tidyText";
import { tidyLines, tidySpaces } from "@/lib/text";
import { plural } from "@/lib/plural";
import React, { useMemo, useRef, useState } from "react";
import { BsArrowRepeat, BsDownload, BsKeyboard, BsLightningCharge, BsListUl, BsMagic, BsPlusLg, BsPuzzle, BsSearch, BsTrash, BsUpload } from "react-icons/bs";
import { Panel } from "@/components/ui/Panel";
import { ChoiceCards, Question, QuestionFlow } from "@/components/ui/Flow";
import { useStages } from "@/components/ui/useStages";
import { toast } from "react-toastify";
import PageHeader from "@/components/ui/PageHeader";
import BookExport from "@/components/ui/BookExport";
import DesignStep from "@/components/ui/DesignStep";
import ItemPager from "@/components/ui/ItemPager";
import JobProgress from "@/components/ui/JobProgress";
import { useDesign } from "@/components/ui/useDesign";
import Callout from "@/components/ui/Callout";
import CsvDrop, { downloadText } from "@/components/ui/CsvDrop";
import { Stepper } from "@/components/ui/Wizard";
import { CROSSWORD_MAX_LETTERS, CROSSWORD_MAX_WORDS, ClueEntry, Crossword, generateCrossword, parseClueLine, validateEntries } from "@/lib/crossword/engine";
import { buildCrosswordBook, CrosswordItem } from "@/lib/crossword/pdf";
import { balancedChunks } from "@/lib/wordsearch/bulk";
import { mulberry32, randomSeed } from "@/lib/wordsearch/engine";
import { JobCancelled, startJob } from "@/lib/jobs/client";
import type { Progress } from "@/lib/jobs/types";
import { LIMITS } from "@/lib/limits";
import { CROSSWORD_SHAPES, ShapeKey, shapeTargetsFor } from "@/lib/shapes/shapes";
import { planSignature } from "@/lib/shapes/plan";
import { planSummary } from "@/components/ui/ShapePlan";
import { DEFAULT_EXTRAS } from "@/lib/print/book";
import { DEFAULT_FRONT_MATTER } from "@/lib/print/frontMatter";
import type { Design } from "@/lib/design/types";
import type { FontData } from "@/lib/print/fonts";
import CrosswordGrid, { ClueList } from "./CrosswordGrid";

const STEPS = [{ label: "Words & clues" }, { label: "Build & review" }, { label: "Design" }, { label: "Export book" }];

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
  theme?: string;
  entries: ClueEntry[];
  cw: Crossword;
}

const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const SHOW = 200;

const sampleCache = new Map<string, CrosswordItem>();
function sampleItem(i: number, shape: ShapeKey): CrosswordItem {
  const key = `${i}:${shape}`;
  let hit = sampleCache.get(key);
  if (!hit) {
    const entries = SAMPLE.map((l) => parseClueLine(l) as ClueEntry);
    hit = { cw: generateCrossword(entries, mulberry32(7 + i), 40, shape), title: i ? "More Everyday Things" : "Everyday Things" };
    sampleCache.set(key, hit);
  }
  return hit;
}

/** Design preview: a quick re-layout of one of the user's crosswords in another shape. */
const previewCache = new Map<string, CrosswordItem>();
function previewFit(p: CwPuzzle, shape: ShapeKey): CrosswordItem {
  if ((p.cw.shape ?? "square") === shape) return { cw: p.cw, title: p.title, theme: p.theme };
  const key = `${p.id}:${shape}`;
  let hit = previewCache.get(key);
  if (!hit) {
    hit = { cw: generateCrossword(p.entries, mulberry32(3), 20, shape), title: p.title, theme: p.theme };
    previewCache.set(key, hit);
  }
  return hit;
}

/** Group entries by theme (keeping order), then split each group into balanced crosswords. */
function groupsFor(entries: ClueEntry[], per: number) {
  const byTheme = new Map<string, ClueEntry[]>();
  for (const e of entries) {
    const k = (e.theme ?? "").trim();
    if (!byTheme.has(k)) byTheme.set(k, []);
    byTheme.get(k)!.push(e);
  }
  const out: { title: string; theme?: string; entries: ClueEntry[] }[] = [];
  for (const [theme, list] of Array.from(byTheme.entries())) {
    const chunks = balancedChunks(list, per);
    chunks.forEach((c, i) => out.push({ title: theme ? (chunks.length > 1 ? `${theme} ${i + 1}` : theme) : "", theme: theme || undefined, entries: c }));
  }
  return out.map((g, i) => ({ ...g, title: g.title || `Crossword ${i + 1}` }));
}

export default function CrossWordGenerator() {
  const { step, goTo, flow: stage } = useStages(STEPS.length);
  const [builtSig, setBuiltSig] = useState("");
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"type" | "upload">("type");
  const [picked, setPicked] = useState<"type" | "upload" | null>(null);
  const [entries, setEntries] = useState<ClueEntry[]>([]);
  const [perPuzzle, setPerPuzzle] = useState(12);
  const [puzzles, setPuzzles] = useState<CwPuzzle[]>([]);
  const [active, setActive] = useState(0);
  const [showAnswers, setShowAnswers] = useState(false);
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState<{ progress: Progress | null; cancel: () => void } | null>(null);
  const rawDesignApi = useDesign("crossword");
  const [refit, setRefit] = useState<{ progress: Progress | null; cancel: () => void } | null>(null);
  const idRef = useRef(1);

  const add = (cands: { answer: string; clue: string; theme?: string }[], source: string) => {
    const res = validateEntries(cands, entries);
    res.errors.slice(0, 4).forEach((m) => toast.error(m));
    if (res.errors.length > 4) toast.error(`…and ${res.errors.length - 4} more entries couldn't be added.`);
    res.skipped.slice(0, 3).forEach((m) => toast.warning(m));
    if (res.skipped.length > 3) toast.warning(`…and ${res.skipped.length - 3} more were skipped.`);
    if (res.limitReached) toast.error(`You've reached the limit of ${CROSSWORD_MAX_WORDS.toLocaleString()} words.`);
    if (res.added.length) {
      setEntries((prev) => [...prev, ...res.added]);
      toast.success(`Added ${res.added.length.toLocaleString()} clue${res.added.length === 1 ? "" : "s"}${source}.`);
    }
    return res;
  };

  /** Adds the typed lines; returns how many were added. */
  const handleAdd = (): number => {
    const lines = tidyLines(input, { keepTabs: true }).split("\n").filter(Boolean);
    if (!lines.length) {
      toast.error("Please type at least one word and clue first.");
      return 0;
    }
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
    return res.added.length;
  };

  const handleCsv = (rows: string[][]) => {
    const cands: { answer: string; clue: string; theme?: string }[] = [];
    rows.forEach((row, i) => {
      const cells = row.map((c) => tidySpaces(String(c ?? "")));
      if (!cells[0]) return;
      if (i === 0 && /^(word|answer)s?$/i.test(cells[0])) return;
      const clue = cells[1] ?? "";
      if (!clue) return;
      const theme = cells.slice(2).filter(Boolean).join(" ");
      cands.push(theme ? { answer: cells[0].toUpperCase(), clue, theme } : { answer: cells[0].toUpperCase(), clue });
    });
    if (!cands.length) return toast.error("No words with clues found. The CSV needs columns: word, clue (and an optional theme).");
    if (add(cands, " from your file").added.length) stage(0).setSub("list");
  };

  const downloadTemplate = () =>
    downloadText(
      entries.length ? "crossword-clues.csv" : "crossword-template.csv",
      ["Word,Clue,Theme", ...(entries.length ? entries : SAMPLE.slice(0, 3).map((l) => ({ ...(parseClueLine(l) as ClueEntry), theme: "Everyday" }))).map((e) => `${esc(e.answer)},${esc(e.clue)},${esc(e.theme ?? "")}`)].join("\n") + "\n"
    );

  const groups = useMemo(() => groupsFor(entries, perPuzzle), [entries, perPuzzle]);
  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    const list = entries.map((e, i) => ({ ...e, i }));
    return q ? list.filter((e) => e.answer.includes(q) || e.clue.toUpperCase().includes(q) || (e.theme ?? "").toUpperCase().includes(q)) : list;
  }, [entries, query]);

  const build = async () => {
    if (entries.length < 2) return toast.error("Add at least 2 words to build a crossword.");
    const targets = shapeTargetsFor(rawDesignApi.design.shape, groups, CROSSWORD_SHAPES);
    const job = startJob({ type: "cw-generate", groups: groups.map((g, i) => ({ ...g, shape: targets[i] })) }, (p) => setRunning((r) => (r ? { ...r, progress: p } : r)));
    setRunning({ progress: null, cancel: job.cancel });
    try {
      const out = await job.promise;
      const list = out.map((r, i) => ({ id: idRef.current++, title: r.title, theme: r.theme, entries: groups[i].entries, cw: r.cw }));
      setPuzzles(list);
      setActive(0);
      const left = list.flatMap((p) => p.cw.leftOut);
      if (left.length) toast.warning(`These words didn't connect to the others and were left out: ${left.slice(0, 15).join(", ")}${left.length > 15 ? ` and ${left.length - 15} more` : ""}. Try words that share more letters.`, { autoClose: 9000 });
      else toast.success(`${plural(list.length, "crossword")} ${list.length === 1 ? "is" : "are"} ready.`);
    } catch (e) {
      if (e instanceof JobCancelled) toast.info("Stopped. Your previous crosswords were kept.");
      else toast.error(`Sorry, the crosswords couldn't be built: ${(e as Error).message}`);
    } finally {
      setRunning(null);
    }
  };

  const regenerate = () => {
    const p = puzzles[active];
    if (!p) return;
    setPuzzles((prev) => prev.map((x, i) => (i === active ? { ...x, cw: generateCrossword(p.entries, mulberry32(randomSeed()), 40, p.cw.shape) } : x)));
  };

  const puzzle = puzzles[active];
  const usable = useMemo(() => puzzles.filter((p) => p.cw.placements.length > 1), [puzzles]);
  const planList = useMemo(() => puzzles.map((p) => ({ title: p.title, theme: p.theme })), [puzzles]);
  const maxReachable = entries.length < 2 ? 0 : usable.length ? 3 : 1;
  const themes = useMemo(() => new Set(usable.map((p) => p.theme).filter(Boolean)).size, [usable]);
  const toItem = (p: CwPuzzle): CrosswordItem => ({ cw: p.cw, title: p.title, theme: p.theme });

  /** Re-lay out every crossword inside the design's new shape (background worker). */
  const reshape = async (d: Design) => {
    const targets = shapeTargetsFor(d.shape, puzzles, CROSSWORD_SHAPES);
    const todo = puzzles.map((p, i) => ({ p, shape: targets[i] })).filter(({ p, shape }) => (p.cw.shape ?? "square") !== shape);
    if (!todo.length) return;
    refit?.cancel();
    const job = startJob({ type: "cw-generate", groups: todo.map(({ p, shape }) => ({ title: p.title, theme: p.theme, entries: p.entries, shape })) }, (pr) => setRefit((r) => (r ? { ...r, progress: pr } : r)));
    setRefit({ progress: null, cancel: job.cancel });
    try {
      const out = await job.promise;
      const byId = new Map(todo.map(({ p }, k) => [p.id, out[k].cw]));
      setPuzzles((prev) => prev.map((p) => (byId.has(p.id) ? { ...p, cw: byId.get(p.id)! } : p)));
      const left = out.reduce((a, r) => a + r.cw.leftOut.length, 0);
      if (left) toast.warning(`${plural(left, "word")} couldn't connect inside the shape and ${left === 1 ? "was" : "were"} left out. Try a roomier shape or fewer words per crossword.`, { autoClose: 9000 });
    } catch (e) {
      if (!(e instanceof JobCancelled)) toast.error(`Sorry, the crosswords couldn't be re-shaped: ${(e as Error).message}`);
    } finally {
      setRefit((r) => (r && r.cancel === job.cancel ? null : r));
    }
  };
  const designApi = {
    ...rawDesignApi,
    setDesign: (d: Design) => {
      rawDesignApi.setDesign(d);
      if (planSignature(d.shape) !== planSignature(rawDesignApi.design.shape)) void reshape(d);
    },
  };
  const shapeStatus = refit ? (
    <span data-testid="reshape-progress">Building your crosswords inside the new shape{refit.progress ? `: ${refit.progress.done} of ${refit.progress.total}` : "…"}</span>
  ) : usable.length ? (
    <span data-testid="reshape-done">
      {rawDesignApi.design.shape.mix === "one" ? `${usable.length === 1 ? "Your crossword uses" : `All ${usable.length} crosswords use`} the ${planSummary(rawDesignApi.design, "crossword", puzzles.length).toLowerCase()} shape.` : `${plural(usable.length, "crossword")} built to your plan: ${planSummary(rawDesignApi.design, "crossword", puzzles.length)}.`}
    </span>
  ) : null;

  const sampleBuilder = (design: Design, fonts: FontData, focus = 0) => {
    const targets = shapeTargetsFor(design.shape, puzzles.length ? puzzles : [{}, {}], CROSSWORD_SHAPES);
    const at = Math.max(0, Math.min(focus, puzzles.length - 1));
    const pair = [at, at + 1 < puzzles.length ? at + 1 : at];
    const own = puzzles.length ? pair.map((i) => ({ p: puzzles[i], i })).filter(({ p }) => p.cw.placements.length > 1).map(({ p, i }) => previewFit(p, targets[i])) : [];
    const items = own.length ? (own.length === 1 ? [own[0], own[0]] : own) : [sampleItem(0, targets[0]), sampleItem(1, targets[1] ?? targets[0])];
    return buildCrosswordBook(items, { firstNumber: own.length ? at + 1 : 1, trim: "8.5x11", bleed: false, frontMatter: { ...DEFAULT_FRONT_MATTER, title: "Crossword Puzzle Book", subtitle: "Easy Crosswords for Every Day" }, extras: { ...DEFAULT_EXTRAS, notesPages: 0, padWithNotes: false }, design, answersPerPage: 2, padForKdp: false }, fonts);
  };

  const typedCount = tidyLines(input, { keepTabs: true }).split("\n").filter(Boolean).length;
  const buildSig = `${perPuzzle}|${entries.map((e) => `${e.answer}:${e.clue}:${e.theme ?? ""}`).join("\u0001")}`;

  const wordsQs: Question[] = [
    {
      key: "how",
      title: "How would you like to add your words and clues?",
      lead: "Pick one. You can always add more later.",
      hideNext: true,
      body: (
        <>
          <ChoiceCards
            label="How do you want to add clues?"
            value={picked}
            onPick={(v) => {
              setPicked(v);
              setMode(v);
              stage(0).setSub(v);
            }}
            options={[
              { value: "type", title: "Type my clues", text: "Type each word with its clue, one per line. Best for most books.", icon: <BsKeyboard />, testId: "choose-type", badge: "Recommended", cta: "Type my clues" },
              { value: "upload", title: "Upload a file", text: "Already have a list? Import a CSV with words, clues and optional themes.", icon: <BsUpload />, testId: "choose-upload", cta: "Upload a file" },
            ]}
          />
          <div className="pg-q-note">
            {entries.length > 0 ? (
              <>
                <span>You already have {entries.length.toLocaleString()} clues.</span>
                <button type="button" className="pg-link-btn" onClick={() => stage(0).setSub("list")} data-testid="see-list">
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
                    add(SAMPLE.map((l) => parseClueLine(l) as { answer: string; clue: string }), "");
                    stage(0).setSub("list");
                  }}
                >
                  <BsMagic /> Use a sample list
                </button>
              </>
            )}
          </div>
        </>
      ),
    },
    ...(mode === "type"
      ? [
          {
            key: "type",
            title: "Type each word and its clue",
            lead: (
              <>
                One per line, like <b>LION - King of the jungle</b>. Phrases are fine: they go in the grid without spaces.
              </>
            ),
            canNext: typedCount > 0 || entries.length > 0,
            blockedHint: "Type at least one word and clue to continue",
            hint: typedCount ? `${typedCount.toLocaleString()} ${typedCount === 1 ? "line" : "lines"} typed` : undefined,
            nextLabel: typedCount ? "Add to my list" : "Next",
            nextTestId: "add-clues",
            onNext: () => {
              if (!typedCount) return "list";
              const before = entries.length;
              const added = handleAdd();
              return added > 0 || before > 0 ? "list" : false;
            },
            body: (
              <>
                <label htmlFor="clueInput" className="visually-hidden">
                  Words and clues
                </label>
                <textarea id="clueInput" className="form-control pg-big-input" rows={9} autoFocus placeholder={"LION - King of the jungle\nICE CREAM - Frozen summer treat\nPIANO - Instrument with 88 keys"} value={input} onChange={(e) => setInput(e.target.value)} {...tidyHandlers(setInput, { keepTabs: true })} />
                <div className="form-text">
                  Separate word and clue with &quot; - &quot;, &quot;:&quot; or a tab. Up to {CROSSWORD_MAX_LETTERS} letters per word, {CROSSWORD_MAX_WORDS.toLocaleString()} words in total. Tip: <span className="pg-kbd">Ctrl</span> + <span className="pg-kbd">Enter</span> goes on.
                </div>
              </>
            ),
          } as Question,
        ]
      : [
          {
            key: "upload",
            title: "Choose your file",
            lead: "A CSV with columns: word, clue, and an optional theme that groups clues into titled crosswords. A header row is optional.",
            canNext: entries.length > 0,
            blockedHint: "Choose a file to continue",
            onNext: () => "list",
            body: (
              <>
                <CsvDrop onRows={handleCsv} label="Click to choose a file, or drop it here" hint={`Up to ${CROSSWORD_MAX_WORDS.toLocaleString()} words and clues.`} />
                <div className="pg-q-note">
                  <span>Not sure about the format?</span>
                  <button type="button" className="pg-link-btn" onClick={downloadTemplate}>
                    <BsDownload /> Download an example file
                  </button>
                </div>
              </>
            ),
          } as Question,
        ]),
    {
      key: "list",
      wide: true,
      title: "Check your words and clues",
      lead: "Fix any clue right in the list, remove what you don't want, or add more. You need at least 2.",
      canNext: entries.length >= 2,
      blockedHint: "Add at least 2 words with clues",
      hint: `${entries.length.toLocaleString()} ${entries.length === 1 ? "clue" : "clues"} in your list`,
      nextLabel: "Build crosswords",
      body: (
        <Panel
          tone="result"
          title={
            <>
              Your list <span className="pg-badge neutral" data-testid="clue-count">{entries.length.toLocaleString()} / {CROSSWORD_MAX_WORDS.toLocaleString()}</span>
            </>
          }
          icon={<BsListUl />}
          aside={
            <>
              <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => stage(0).setSub("how")} data-testid="add-more">
                <BsPlusLg /> Add more
              </button>
              {entries.length > 0 && (
                <>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={downloadTemplate}>
                    <BsDownload /> CSV
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm text-danger"
                    onClick={() => {
                      if (window.confirm("Remove all words and clues?")) {
                        setEntries([]);
                        setPuzzles([]);
                      }
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
                Press <b>Add more</b> to type or upload your words and clues.
              </p>
            </div>
          ) : (
            <>
                      {entries.length > 12 && (
                        <div className="input-group input-group-sm mb-2">
                          <span className="input-group-text">
                            <BsSearch />
                          </span>
                          <input className="form-control" placeholder="Search words, clues or themes" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search your clues" />
                        </div>
                      )}
                      <div className="pg-list pg-list-tall">
                        {filtered.slice(0, SHOW).map((e) => (
                          <div className="pg-list-row" key={e.answer}>
                            <span className="pg-num">{e.i + 1}</span>
                            <span className="fw-semibold text-nowrap" style={{ minWidth: "6rem" }}>
                              {e.answer}
                            </span>
                            <input className="form-control form-control-sm" aria-label={`Clue for ${e.answer}`} value={e.clue} onChange={(ev) => setEntries((prev) => prev.map((x) => (x.answer === e.answer ? { ...x, clue: ev.target.value } : x)))} />
                            {e.theme && <span className="pg-badge neutral text-truncate" style={{ maxWidth: 110 }}>{e.theme}</span>}
                            <button type="button" className="btn btn-ghost btn-icon" aria-label={`Remove ${e.answer}`} onClick={() => setEntries((prev) => prev.filter((x) => x.answer !== e.answer))}>
                              <BsTrash />
                            </button>
                          </div>
                        ))}
                      </div>
                      {filtered.length > SHOW && <div className="form-text">Showing {SHOW} of {filtered.length.toLocaleString()}. Use search to find a clue.</div>}
            </>
          )}
        </Panel>
      ),
    },
  ];

  const startBuild = () => {
    setBuiltSig(buildSig);
    build();
  };

  const buildQs: Question[] = [
    {
      key: "size",
      title: "How many words in each crossword?",
      lead: `8–15 words connect nicely. Your list is split into crosswords of up to this many words (max ${LIMITS.maxCluesPerCrossword}).`,
      nextLabel: puzzles.length && builtSig === buildSig ? "See my crosswords" : "Build crosswords",
      nextIcon: <BsLightningCharge />,
      nextTestId: "build-crosswords",
      onNext: () => {
        if (!puzzles.length || builtSig !== buildSig) startBuild();
        return "results";
      },
      body: (
        <>
          <label className="visually-hidden" htmlFor="perPuzzle">
            Words per crossword
          </label>
          <input id="perPuzzle" type="number" min={2} max={LIMITS.maxCluesPerCrossword} className="form-control pg-q-big-number" autoFocus value={perPuzzle} onChange={(e) => setPerPuzzle(Math.max(2, Math.min(LIMITS.maxCluesPerCrossword, Number(e.target.value) || 2)))} />
          <div className="pg-q-recap">
            <span className="pg-badge info">
              {plural(entries.length, "word")} → {plural(groups.length, "crossword")}
            </span>
          </div>
        </>
      ),
    },
    {
      key: "results",
      wide: true,
      title: running ? "Building your crosswords…" : "Your crosswords are ready",
      lead: running ? "This only takes a moment." : "Look through them, rename them, or try a new layout. Words that can't connect to the others are listed under each puzzle.",
      canNext: usable.length > 0 && !running,
      blockedHint: running ? "Building…" : "Build your crosswords to continue",
      hint: running ? undefined : `${plural(usable.length, "crossword")} ready`,
      nextLabel: "Choose a design",
      body: running ? (
        <JobProgress title="Building crosswords" progress={running.progress} onCancel={running.cancel} />
      ) : !puzzle ? (
        <div className="pg-empty-pointer" data-testid="empty-crosswords">
          <span className="pg-icon-badge">
            <BsPuzzle />
          </span>
          <h4>No crosswords yet</h4>
          <p>
            <button type="button" className="btn btn-primary" onClick={startBuild}>
              <BsLightningCharge /> Build crosswords
            </button>
          </p>
        </div>
      ) : (
        <Panel
          tone="result"
          title="Your crosswords"
          icon={<BsPuzzle />}
          aside={
            <button type="button" className="btn btn-ghost btn-sm" onClick={startBuild}>
              <BsArrowRepeat /> Rebuild all
            </button>
          }
        >
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                    <ItemPager titles={puzzles.map((p) => p.title)} active={active} onSelect={setActive} label="Crosswords" />
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
        </Panel>
      ),
    },
  ];

  return (
    <div className="container pb-4">
      <PageHeader icon={<BsPuzzle />} title="Crossword" lead="Turn your words and clues into numbered crosswords, from one puzzle to hundreds, then export a print-ready book." />
      <Stepper steps={STEPS} current={step} maxReachable={maxReachable} onSelect={goTo} />
      <div className="pg-card pg-wizard-card">
        {step === 0 && <QuestionFlow flow={stage(0)} questions={wordsQs} />}
        {step === 1 && <QuestionFlow flow={stage(1)} questions={buildQs} />}
        {step === 2 && <DesignStep tool="crossword" api={designApi} buildSample={sampleBuilder} listName="clue list" shapeStatus={shapeStatus} busy={!!refit} flow={stage(2)} themes={[...new Set(usable.map((p) => p.theme).filter((x): x is string => !!x))]} previewKey={`${planSignature(rawDesignApi.design.shape)}:${usable.map((p) => p.cw.shape ?? "square").join("|")}`} planList={planList} />}
        {step === 3 && (
          <BookExport
            tool="crossword"
            toolDefaults={{ title: "Crossword Puzzle Book", subtitle: "Easy Crosswords for Every Day" }}
            itemNoun="crossword"
            itemCount={usable.length}
            sectionCount={themes}
            design={designApi.design}
            items={() => ({ tool: "crossword", items: usable.map(toItem) })}
            fileBase="crossword-book"
            disabledReason={refit ? "Building crosswords inside the new shape. One moment…" : usable.length ? undefined : "Build at least one crossword first."}
            defaultAnswersPerPage={2}
            flow={stage(3)}
          />
        )}
      </div>
    </div>
  );
}
