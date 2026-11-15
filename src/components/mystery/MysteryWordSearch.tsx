"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { BsBuilding, BsCheck2Circle, BsChevronLeft, BsChevronRight, BsClipboardCheck, BsEye, BsEyeSlash, BsFileEarmarkText, BsFolder2Open, BsIncognito, BsMagic, BsPencilSquare, BsTrash3, BsStars, BsArrowRepeat } from "react-icons/bs";
import { toast } from "react-toastify";
import PageHeader from "@/components/ui/PageHeader";
import BookExport from "@/components/ui/BookExport";
import DesignStep from "@/components/ui/DesignStep";
import { useDesign } from "@/components/ui/useDesign";
import { Stepper } from "@/components/ui/Wizard";
import { useStages } from "@/components/ui/useStages";
import { ChoiceCards, FINISH, FlowCtl, Question, QuestionFlow } from "@/components/ui/Flow";
import { planSummary } from "@/components/ui/ShapePlan";
import { JobCancelled, startJob } from "@/lib/jobs/client";
import type { Progress } from "@/lib/jobs/types";
import { MYSTERY_SHAPES, shapeTargetsFor, type ShapeKey } from "@/lib/shapes/shapes";
import { planSignature } from "@/lib/shapes/plan";
import { DEFAULT_EXTRAS } from "@/lib/print/book";
import { DEFAULT_FRONT_MATTER } from "@/lib/print/frontMatter";
import { PASTE_FILE_TYPES, readPasteFile } from "@/lib/paste/files";
import type { Design } from "@/lib/design/types";
import type { FontData } from "@/lib/print/fonts";
import { plural } from "@/lib/plural";
import { SALTMERE, phraseFor, starterCases } from "@/lib/mystery/starter";
import { SETTINGS, scaffoldBook } from "@/lib/mystery/templates";
import { CASES_EXAMPLE, casesToText, parseCases, type ParsedCases } from "@/lib/mystery/parse";
import { findPerson, generateMystery, phraseLetters, uniqueTraits, type GeneratedMystery } from "@/lib/mystery/model";
import { buildMysteryBook } from "@/lib/mystery/pdf";
import { DEFAULT_MYSTERY_SETTINGS, type CaseBook, type CaseSpec, type MysteryCase, type MysterySettings } from "@/lib/mystery/types";
import CaseView from "./CaseView";
import { AiNotConfigured, aiStatus, generateBook, regenerateOne, type AiResult, type AiStatus } from "./aiClient";
import { AiCustomize, AiProgressPanel, MagicButton, describePrefs, type AiPrefs } from "./AiStart";
import { ThemeMenu } from "@/components/ui/SmartPaste";
import type { GenerateRequest } from "@/lib/ai/schema";
import type { AiProgress, AiStats } from "@/lib/ai/generate";

const AI_PREFS_KEY = "puzzle-generator.ai-prefs.v1";
const AI_RECENT_KEY = "puzzle-generator.ai-recent.v1";
const readJson = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? ({ ...d, ...JSON.parse(v) } as T) : d;
  } catch {
    return d;
  }
};

const STEPS = [{ label: "Cases" }, { label: "Mystery settings" }, { label: "Build & check" }, { label: "Design" }, { label: "Export book" }];

export const MYSTERY_NAME = "Murder Mystery Word Search";
type Source = "ai" | "starter" | "paste" | "theme";
const MAX_CASES = 200;

/** A build error in plain words (never a stack trace or an internal message). */
function friendlyBuildError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  const m = msg.match(/^Case (\d+) \((.*?)\):/);
  if (m) return `Case ${m[1]} (“${m[2]}”) has too many or too long words to fit a grid with its hidden message. Remove a word or two, or use a shorter message, then build again.`;
  return "The cases couldn't be built this time. Please try again; if it keeps happening, change a setting and rebuild.";
}

function genericBook(cases: CaseSpec[], cast: CaseBook["cast"], phrase: string, title = "The Case Files"): CaseBook {
  return {
    title,
    intro: "Every case hides one letter of the final answer. Solve a case, then write its key letter in the numbered box below. When the board is full, the letters reveal the truth.",
    cast,
    cases,
    finale: { phrase, question: "What do the boxes spell?", epilogue: `The boxes spell ${phrase}.` },
  };
}

/** Problems a pasted case would have when printed (plain words). */
function caseNotes(c: CaseSpec, cast: CaseBook["cast"], s: MysterySettings): string[] {
  const notes: string[] = [];
  if (c.words.length < 6) notes.push(`Only ${plural(c.words.length, "evidence word")}. Ten or more makes a better grid.`);
  if (s.hiddenMessage && !c.message) {
    const sus = c.suspects.map((n) => findPerson(cast, n)).filter((p): p is NonNullable<typeof p> => !!p);
    const cu = c.culprit ? findPerson(sus, c.culprit) : undefined;
    if (!cu) notes.push("No culprit, so there is no hidden message.");
    else if (!uniqueTraits(cu, sus).length) notes.push(`No trait sets ${cu.name} apart, so the message will name the culprit.`);
  }
  if (s.missingEvidence && !c.missing) notes.push("No missing evidence.");
  return notes;
}

export default function MysteryWordSearch({ onChangeType }: { onChangeType: () => void }) {
  const [source, setSource] = useState<Source | null>(null);
  const [starterCount, setStarterCount] = useState(24);
  const [pasteText, setPasteText] = useState("");
  const [pasted, setPasted] = useState<ParsedCases | null>(null);
  const [themeIds, setThemeIds] = useState<string[]>(["hotel", "train", "manor"]);
  const [themeCount, setThemeCount] = useState(24);
  const [themeSeed, setThemeSeed] = useState(1);
  const [settings, setSettings] = useState<MysterySettings>(DEFAULT_MYSTERY_SETTINGS);
  const [phrase, setPhrase] = useState("CASE CLOSED");
  const [result, setResult] = useState<(GeneratedMystery & { sig: string }) | null>(null);
  const [running, setRunning] = useState<{ progress: Progress | null; cancel: () => void } | null>(null);
  const [view, setView] = useState(0);
  const [solved, setSolved] = useState(false);
  const rawDesign = useDesign("mystery");
  const fileRef = useRef<HTMLInputElement>(null);
  // ---- AI cases (server-side Bedrock; this page only sees the results)
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [aiPrefs, setAiPrefsState] = useState<AiPrefs>({ setting: "surprise", tone: "family", count: 24 });
  const setAiPrefs = (p: AiPrefs) => {
    setAiPrefsState(p);
    try {
      localStorage.setItem(AI_PREFS_KEY, JSON.stringify(p));
    } catch {
      /* private mode */
    }
  };
  const [aiRun, setAiRun] = useState<{ progress: AiProgress | null; cancel: () => void } | null>(null);
  const [aiBook, setAiBook] = useState<(AiResult & { options: GenerateRequest; stats?: AiStats }) | null>(null);
  const [aiBusyCase, setAiBusyCase] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    void aiStatus().then((s) => {
      if (!live) return;
      setAiPrefsState((p) => readJson(AI_PREFS_KEY, p));
      setAi(s);
    });
    return () => {
      live = false;
    };
  }, []);
  const aiReady = !!ai?.configured;
  const { step, goTo, flow } = useStages(STEPS.length);

  const set = <K extends keyof MysterySettings>(k: K, v: MysterySettings[K]) => setSettings((s) => ({ ...s, [k]: v }));

  // ---- the book to build
  const plan = useMemo((): { book: CaseBook; cases: CaseSpec[]; phrase: string } | null => {
    if (source === "starter") {
      const cases = starterCases(starterCount);
      return { book: SALTMERE, cases, phrase: phraseFor(cases.length) };
    }
    if (source === "ai" && aiBook?.book.cases.length) {
      const ph = phrase.trim().toUpperCase();
      return { book: { ...aiBook.book, finale: { ...aiBook.book.finale, phrase: ph, epilogue: aiBook.book.finale.phrase === ph ? aiBook.book.finale.epilogue : `The boxes spell ${ph}. ${aiBook.book.finale.epilogue}` } }, cases: aiBook.book.cases, phrase: ph };
    }
    if (source === "paste" && pasted?.cases.length) return { book: genericBook(pasted.cases, pasted.cast, phrase.trim().toUpperCase()), cases: pasted.cases, phrase: phrase.trim().toUpperCase() };
    if (source === "theme" && themeIds.length) {
      const b = scaffoldBook({ settings: themeIds, count: themeCount, seed: themeSeed }, phrase.trim().toUpperCase());
      return { book: b, cases: b.cases, phrase: phrase.trim().toUpperCase() };
    }
    return null;
  }, [source, starterCount, pasted, themeIds, themeCount, themeSeed, phrase, aiBook]);

  const caseCount = plan?.cases.length ?? 0;
  const phraseLen = plan ? phraseLetters(plan.phrase).length : 0;
  const phraseProblem = settings.storyline && source !== "starter" && plan && (phraseLen === 0 ? "Type a final answer for the Case Board." : phraseLen > caseCount ? `The final answer has ${phraseLen} letters but the book has ${plural(caseCount, "case")}. Use a shorter answer or more cases.` : "");
  const shapes = (d: Design): (ShapeKey | undefined)[] => (plan ? shapeTargetsFor(d.shape, plan.cases.map(() => ({})), MYSTERY_SHAPES).map((k) => (k === "square" ? undefined : k)) : []);
  const sigFor = (d: Design) => JSON.stringify([plan?.cases, plan?.phrase, plan?.book.cast, settings, shapes(d)]);
  const sig = sigFor(rawDesign.design);
  const fresh = !!result && result.sig === sig;
  const cases = useMemo(() => (result ? result.items.filter((i) => i.kind === "case").map((i) => (i as { case: MysteryCase }).case) : []), [result]);

  const build = async (d: Design = rawDesign.design): Promise<"ok" | "failed" | "cancelled"> => {
    if (!plan) return "failed";
    running?.cancel();
    const job = startJob({ type: "my-generate", input: { book: plan.book, cases: plan.cases, phrase: plan.phrase, settings, shapes: shapes(d), seed: 20261115 } }, (p) => setRunning((r) => (r ? { ...r, progress: p } : r)));
    setRunning({ progress: null, cancel: job.cancel });
    const t0 = performance.now();
    try {
      const out = await job.promise;
      setResult({ ...out, sig: sigFor(d) });
      setView(0);
      if (out.problems.length) toast.error(`Some checks failed: ${out.problems[0]}`);
      else toast.success(`${plural(caseCount, "case file")} built and checked (${((performance.now() - t0) / 1000).toFixed(1)}s).`);
      return "ok";
    } catch (e) {
      if (e instanceof JobCancelled) return "cancelled";
      toast.error(friendlyBuildError(e));
      return "failed";
    } finally {
      setRunning((r) => (r && r.cancel === job.cancel ? null : r));
    }
  };

  const designApi = {
    ...rawDesign,
    setDesign: (d: Design) => {
      const prev = rawDesign.design;
      const before = planSignature(prev.shape);
      rawDesign.setDesign(d);
      if (result && planSignature(d.shape) !== before)
        void build(d).then((r) => {
          // Keep the book usable: go back to the shapes that worked.
          if (r === "failed") {
            rawDesign.setDesign(prev);
            toast.info("Kept the previous shapes, so every case still checks out.");
          }
        });
    },
  };

  const sampleBuilder = (design: Design, fonts: FontData, focus = 0) => {
    let list = cases;
    if (!list.length) {
      const sample = generateMystery({ book: SALTMERE, cases: SALTMERE.cases.slice(0, 2), phrase: "", settings: { ...settings, storyline: false }, seed: 5 });
      list = sample.items.map((i) => (i as { case: MysteryCase }).case);
    }
    const at = Math.max(0, Math.min(focus, list.length - 1));
    const pair = [list[at], list[Math.min(at + 1, list.length - 1)]];
    return buildMysteryBook(
      pair.map((c) => ({ kind: "case" as const, case: c })),
      { trim: "8.5x11", bleed: false, answersPerPage: 2, frontMatter: { ...DEFAULT_FRONT_MATTER, title: "Murder Mystery Word Search", subtitle: "Detective Cases to Solve" }, extras: { ...DEFAULT_EXTRAS, notesPages: 0, padWithNotes: false }, design, padForKdp: false, style: settings.style },
      fonts,
    );
  };

  const readPaste = () => {
    const res = parseCases(pasteText);
    if (!res.cases.length) {
      toast.error("No cases found yet. Start each case with a line like \"Case 1: Title\" and add a Words: line.");
      return false;
    }
    if (res.cases.length > MAX_CASES) res.cases = res.cases.slice(0, MAX_CASES);
    setPasted(res);
    return undefined;
  };

  const take = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await readPasteFile(file);
      setPasteText((v) => (v.trim() ? `${v.trimEnd()}\n\n${text}` : text));
      toast.success(`Read ${file.name}.`);
    } catch (e) {
      toast.error((e as Error).message);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const editAsText = () => {
    if (!plan) return;
    setPasteText(casesToText(plan.cases, plan.book.cast));
    setPasted(null);
    setSource("paste");
    flow(0).setSub("paste");
  };

  // Recent books (titles and openings) go to the prompt so the next one is clearly different.
  const recentAi = (): string[] => readJson<{ list: string[] }>(AI_RECENT_KEY, { list: [] }).list.slice(0, 8);
  const rememberAi = (r: AiResult) => {
    try {
      const line = `${r.book.title} (${r.book.intro.split(/(?<=\.)\s/)[0].slice(0, 70)})`;
      localStorage.setItem(AI_RECENT_KEY, JSON.stringify({ list: [line, ...recentAi()].slice(0, 8) }));
    } catch {
      /* private mode */
    }
  };
  const aiOptions = (): GenerateRequest => ({ caseCount: aiPrefs.count, setting: aiPrefs.setting, tone: aiPrefs.tone, difficulty: settings.difficulty, hiddenMessage: settings.hiddenMessage, missingEvidence: settings.missingEvidence, storyline: settings.storyline, maxWord: 11, seed: Math.floor(Math.random() * 1e9), avoid: recentAi() });
  /** The magic button: a whole new book with the current preferences, from any step. */
  const aiGenerate = async () => {
    aiRun?.cancel();
    setSource("ai");
    if (aiBook) {
      goTo(0);
      flow(0).setSub("ai-review");
    }
    const options = aiOptions();
    const job = generateBook(options, (p) => setAiRun((r) => (r && r.cancel === job.cancel ? { ...r, progress: p } : r)));
    setAiRun({ progress: { phase: "outline", done: 0, total: options.caseCount, message: "Writing the storyline…" }, cancel: job.cancel });
    try {
      const res = await job.promise;
      setAiBook({ ...res, options });
      rememberAi(res);
      setPhrase(res.book.finale.phrase || (res.book.cases.length >= 11 ? "CASE CLOSED" : "SOLVED".slice(0, Math.max(1, res.book.cases.length))));
      toast.success(`“${res.book.title}”: ${plural(res.book.cases.length, "case")} written and checked.`);
      flow(0).setSub("ai-review");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      if (e instanceof AiNotConfigured) {
        setAi((a) => (a ? { ...a, configured: false } : a));
        toast.info("AI cases need AWS setup on the server. Pick another source for now.");
      } else toast.info((e as Error).message);
    } finally {
      setAiRun((r) => (r && r.cancel === job.cancel ? null : r));
    }
  };
  const aiRegenerate = async (k: number) => {
    if (!aiBook) return;
    setAiBusyCase(k);
    try {
      const out = await regenerateOne(aiBook.options, aiBook.outline, aiBook.indexes[k], aiBook.book.cases[k]);
      setAiBook((b) => {
        if (!b) return b;
        const cases = b.book.cases.slice();
        cases[k] = out.spec;
        const caseNotes = b.caseNotes.slice();
        caseNotes[k] = out.notes;
        return { ...b, book: { ...b.book, cases }, caseNotes };
      });
      toast.success(`Case ${k + 1} rewritten: “${out.spec.title}”.`);
    } catch (e) {
      toast.info((e as Error).message);
    } finally {
      setAiBusyCase(null);
    }
  };

  // ---------------------------------------------------------------- stage 1: cases
  const caseQuestions: Question[] = [
    {
      key: "source",
      title: aiReady ? "Your next mystery" : "Where should the cases come from?",
      lead: aiReady ? "A brand-new case book written just for you: an original storyline, cast and clues. Every case is checked so it can be solved." : "Every case is a word search with a story, suspects and a hidden message. Pick a ready story or bring your own.",
      wide: true,
      hideNext: true,
      body: aiReady ? (
        <div className="pg-ai-start" data-testid="my-ai-start">
          {aiRun ? (
            <AiProgressPanel p={aiRun.progress} onCancel={() => aiRun.cancel()} />
          ) : (
            <div className="pg-ai-hero">
              <MagicButton onGo={() => void aiGenerate()} />
              <div className="pg-ai-hero-meta" data-testid="my-ai-defaults">
                {describePrefs(aiPrefs)}
                {ai?.mock ? " · test mode" : ""}
              </div>
              {aiBook && (
                <button type="button" className="pg-link-btn" data-testid="my-ai-continue" onClick={() => (setSource("ai"), flow(0).setSub("ai-review"))}>
                  Continue with “{aiBook.book.title}”
                </button>
              )}
            </div>
          )}
          <details className="pg-quiet-more" data-testid="my-ai-customize">
            <summary>Customize</summary>
            <AiCustomize prefs={aiPrefs} set={setAiPrefs} disabled={!!aiRun} max={MAX_CASES} />
          </details>
          <details className="pg-quiet-more" data-testid="my-other-sources">
            <summary>Other ways to get cases</summary>
            <div className="pg-ai-others">
              {(
                [
                  ["starter", <BsFolder2Open key="i" />, "The Saltmere Lantern", "A ready 24-case story by the seaside."],
                  ["paste", <BsPencilSquare key="i" />, "Paste my own cases", "Case 1: Title, Story, Words, Suspects…"],
                  ["theme", <BsBuilding key="i" />, "Build from a setting", "Template stories, up to 200 cases."],
                ] as const
              ).map(([v, icon, t, d]) => (
                <button key={v} type="button" className="pg-ai-other" data-testid={`my-source-${v}`} disabled={!!aiRun} onClick={() => (setSource(v), flow(0).setSub(v))}>
                  <span className="pg-ai-other-icon">{icon}</span>
                  <span>
                    <span className="pg-ai-other-title">{t}</span>
                    <span className="pg-ai-other-text">{d}</span>
                  </span>
                </button>
              ))}
            </div>
          </details>
        </div>
      ) : (
        <div className={`pg-my-sources ${aiReady ? "" : "ai-off"}`}>
        <ChoiceCards<Source>
          label="Case source"
          cols={2}
          value={source}
          onPick={(v) => {
            setSource(v);
            flow(0).setSub(v === "ai" ? (aiBook ? "ai-review" : "source") : v === "starter" ? "starter" : v === "paste" ? "paste" : "theme");
          }}
          options={[
            {
              value: "ai",
              title: "Generate a new mystery with AI",
              text: aiReady ? "A fresh, original storyline every time: cast, clues and a final twist. Up to 200 cases, checked before you print." : ai ? "Needs AWS setup. Once the server has its AWS keys, fresh stories are written here." : "Checking…",
              icon: <BsStars />,
              testId: "my-source-ai",
              badge: aiReady ? "Recommended" : ai ? "Needs AWS setup" : undefined,
              cta: "Write my mystery",
              disabled: !aiReady,
            },
            { value: "starter", title: "The Saltmere Lantern", text: "24 connected cases in a seaside town, written for you, with a twist at the end. Family friendly.", icon: <BsFolder2Open />, testId: "my-source-starter", badge: aiReady ? undefined : "Recommended", cta: "Use this story" },
            { value: "paste", title: "Paste my own cases", text: "Case 1: Title, Story, Words, Suspects… I'll read almost any format.", icon: <BsPencilSquare />, testId: "my-source-paste", cta: "Paste cases" },
            { value: "theme", title: "Build from a setting", text: "Hotels, night trains, circuses and more. Stories made from templates, up to 200 cases.", icon: <BsBuilding />, testId: "my-source-theme", cta: "Pick settings" },
          ]}
        />
        </div>
      ),
    },
  ];
  if (source === "ai") {
    const notes = aiBook ? [...aiBook.notes, ...aiBook.caseNotes.flatMap((n, k) => (n.length ? [`Case ${k + 1}: ${n.join("; ")}.`] : []))] : [];
    const st = aiBook?.stats;
    caseQuestions.push({
      key: "ai-review",
      title: aiRun ? "Writing a new mystery" : aiBook ? `“${aiBook.book.title}”` : "Your mystery",
      lead: aiRun ? "" : (aiBook?.book.intro ?? ""),
      wide: true,
      canNext: !!aiBook?.book.cases.length && aiBusyCase === null && !aiRun,
      blockedHint: aiRun ? undefined : aiBusyCase !== null ? "Rewriting a case…" : "Write a mystery first",
      nextTestId: "my-ai-apply",
      onNext: () => FINISH,
      body: aiRun ? (
        <AiProgressPanel p={aiRun.progress} onCancel={() => aiRun.cancel()} />
      ) : aiBook ? (
        <div className="pg-my-review" data-testid="my-ai-review">
          <div className="pg-ai-summary">
            <span>
              {plural(aiBook.book.cases.length, "case")} · {plural(aiBook.book.cast.length, "person", "people")} in the cast
              {aiBook.book.finale.phrase ? ` · the Case Board spells ${aiBook.book.finale.phrase}` : ""}
            </span>
            <span className="pg-ai-summary-actions">
              <MagicButton size="sm" replaces={aiBook.book.title} onGo={() => void aiGenerate()} />
              <ThemeMenu
                label="More actions for this mystery"
                testId="my-ai-menu"
                items={[
                  { key: "customize", label: "Customize the next one", icon: <BsMagic />, testId: "my-ai-menu-customize", onClick: () => flow(0).setSub("source") },
                  { key: "text", label: "Edit as text", icon: <BsPencilSquare />, testId: "my-edit-text", onClick: editAsText },
                ]}
              />
            </span>
          </div>
          {(notes.length > 0 || st) && (
            <details className="pg-my-checks-box pg-ai-notes" data-testid="my-ai-notes">
              <summary>{notes.length ? `${plural(notes.length, "note")} from the checks` : "About this book"}</summary>
              <ul>
                {notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
                {st && (
                  <li className="pg-ai-stats" data-testid="my-ai-stats">
                    Written in {Math.round(st.ms / 1000)} s with {plural(st.calls, "request")}: {st.inputTokens.toLocaleString()} tokens in, {st.outputTokens.toLocaleString()} out, about ${st.costUsd.toFixed(2)}.
                  </li>
                )}
              </ul>
            </details>
          )}
          {aiBook.book.cases.map((c, i) => {
            const cnotes = caseNotes(c, aiBook.book.cast, settings);
            const busy = aiBusyCase === i;
            return (
              <div key={i} className={`pg-my-row ${busy ? "busy" : ""}`} data-testid="my-review-case">
                <span className="pg-theme-num">{i + 1}</span>
                <div className="pg-my-row-main">
                  <div className="pg-my-row-title">{busy ? <span className="pg-ai-rewriting"><BsArrowRepeat className="pg-spin" /> Rewriting this case…</span> : c.title}</div>
                  <div className="pg-ai-story">{c.story}</div>
                  <div className="pg-theme-meta">
                    {plural(c.words.length, "word")} · {c.suspects.join(", ")}
                    {c.missing ? ` · missing ${c.missing.word}` : ""}
                  </div>
                  {cnotes.length > 0 && <div className="pg-my-row-note">{cnotes.join(" ")}</div>}
                </div>
                <ThemeMenu
                  label={`More actions for case ${i + 1}`}
                  testId="my-ai-case-menu"
                  items={[
                    { key: "regen", label: "Regenerate this case", icon: <BsArrowRepeat />, testId: "my-ai-regenerate", onClick: () => aiBusyCase === null && void aiRegenerate(i) },
                    ...(aiBook.book.cases.length > 1 ? [{ key: "remove", label: "Remove this case", icon: <BsTrash3 />, danger: true, testId: "my-ai-remove", onClick: () => aiBusyCase === null && setAiBook({ ...aiBook, book: { ...aiBook.book, cases: aiBook.book.cases.filter((_, j) => j !== i) }, caseNotes: aiBook.caseNotes.filter((_, j) => j !== i), indexes: aiBook.indexes.filter((_, j) => j !== i) }) }] : []),
                  ]}
                />
              </div>
            );
          })}
        </div>
      ) : null,
    });
  }
  if (source === "starter")
    caseQuestions.push({
      key: "starter",
      title: "The Saltmere Lantern",
      lead: "On the night of the great storm, the harbormaster fell on the harbor steps. Since then, every culprit says an unsigned lantern note told them what to do.",
      wide: true,
      nextTestId: "my-starter-next",
      onNext: () => FINISH,
      body: (
        <div className="pg-my-pack">
          <ol className="pg-my-titles" data-testid="my-starter-list">
            {SALTMERE.cases.map((c) => (
              <li key={c.title}>{c.title}</li>
            ))}
          </ol>
          <p className="pg-my-note">
            <BsCheck2Circle /> Original story and characters. Each case gives one letter of the final answer, revealed on the last page.
          </p>
        </div>
      ),
    });
  if (source === "paste") {
    caseQuestions.push({
      key: "paste",
      title: "Paste your cases",
      lead: "Start each case with “Case 1: Title”. Add Story:, Words:, Suspects: and Culprit:. Missing:, Message: and Lead: are optional.",
      wide: true,
      canNext: !!pasteText.trim(),
      blockedHint: "Paste at least one case",
      nextLabel: "Read my cases",
      nextTestId: "my-paste-next",
      enter: false,
      onNext: readPaste,
      body: (
        <div className="pg-paste">
          <label htmlFor="myPaste" className="visually-hidden">
            Your cases
          </label>
          <textarea id="myPaste" data-testid="my-paste-input" className="form-control pg-big-input pg-paste-input" rows={14} spellCheck={false} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={CASES_EXAMPLE} />
          <div className="pg-paste-bar">
            <span className="pg-paste-found" aria-live="polite">
              Suspects can be written as “Name (job) - trait, trait”.
            </span>
            <span className="d-flex gap-3 flex-wrap">
              <button type="button" className="pg-link-btn" data-testid="my-paste-example" onClick={() => setPasteText(CASES_EXAMPLE)}>
                <BsMagic /> Paste example
              </button>
              <button type="button" className="pg-link-btn" onClick={() => fileRef.current?.click()}>
                <BsFileEarmarkText /> Open a file
              </button>
            </span>
            <input ref={fileRef} type="file" accept={PASTE_FILE_TYPES} className="d-none" onChange={(e) => void take(e.target.files?.[0])} />
          </div>
        </div>
      ),
    });
    caseQuestions.push({
      key: "paste-review",
      title: pasted ? `I found ${plural(pasted.cases.length, "case")}` : "Your cases",
      lead: "Check each case. Remove any you don't want.",
      wide: true,
      canNext: !!pasted?.cases.length,
      blockedHint: "Keep at least one case",
      nextTestId: "my-paste-apply",
      onNext: () => FINISH,
      body: pasted ? (
        <div className="pg-my-review" data-testid="my-paste-review">
          {pasted.notes.length > 0 && <p className="pg-my-note warn">{pasted.notes.join(" ")}</p>}
          {pasted.cases.map((c, i) => {
            const notes = caseNotes(c, pasted.cast, settings);
            return (
              <div key={i} className="pg-my-row" data-testid="my-review-case">
                <span className="pg-theme-num">{i + 1}</span>
                <div className="pg-my-row-main">
                  <div className="pg-my-row-title">{c.title}</div>
                  <div className="pg-theme-meta">
                    {plural(c.words.length, "word")}
                    {c.suspects.length ? ` · ${plural(c.suspects.length, "suspect")}` : ""}
                    {c.culprit ? ` · culprit ${c.culprit}` : ""}
                    {c.missing ? ` · missing ${c.missing.word}` : ""}
                  </div>
                  {notes.length > 0 && <div className="pg-my-row-note">{notes.join(" ")}</div>}
                </div>
                <button type="button" className="pg-quiet-btn" aria-label={`Remove ${c.title}`} onClick={() => setPasted({ ...pasted, cases: pasted.cases.filter((_, j) => j !== i) })}>
                  <BsTrash3 />
                </button>
              </div>
            );
          })}
        </div>
      ) : null,
    });
  }
  if (source === "theme")
    caseQuestions.push({
      key: "theme",
      title: "Pick the settings for your cases",
      lead: "Cases rotate through the settings you pick. Stories, suspects and clues are assembled from templates, so they read short and similar. You can edit them as text afterwards.",
      wide: true,
      canNext: themeIds.length > 0 && themeCount >= 1,
      blockedHint: "Pick at least one setting",
      nextTestId: "my-theme-next",
      onNext: () => FINISH,
      body: (
        <div>
          <div className="pg-my-settings" role="group" aria-label="Settings">
            {SETTINGS.map((st) => {
              const on = themeIds.includes(st.id);
              return (
                <button key={st.id} type="button" aria-pressed={on} className={`pg-my-setting ${on ? "on" : ""}`} data-testid={`my-setting-${st.id}`} onClick={() => setThemeIds((ids) => (on ? ids.filter((x) => x !== st.id) : [...ids, st.id]))}>
                  <span className="pg-my-setting-name">{st.name}</span>
                  <span className="pg-my-setting-text">{st.blurb}</span>
                </button>
              );
            })}
          </div>
          <div className="pg-my-count mt-4">
            <label htmlFor="myThemeCount" className="form-label mb-0">
              Number of cases
            </label>
            <input id="myThemeCount" type="number" min={1} max={MAX_CASES} className="form-control" style={{ width: "7rem" }} value={themeCount} data-testid="my-theme-count" onChange={(e) => setThemeCount(Math.max(1, Math.min(MAX_CASES, Math.round(Number(e.target.value) || 1))))} />
            <button type="button" className="pg-quiet-btn" onClick={() => setThemeSeed((s) => s + 1)}>
              <BsMagic /> New stories
            </button>
            {plan && (
              <button type="button" className="pg-quiet-btn" data-testid="my-edit-text" onClick={editAsText}>
                <BsPencilSquare /> Edit as text
              </button>
            )}
          </div>
        </div>
      ),
    });

  // ---------------------------------------------------------------- stage 2: settings
  const settingsQuestions: Question[] = [];
  if (source === "starter")
    settingsQuestions.push({
      key: "count",
      title: "How many cases?",
      lead: "All 24 tell the full story. Fewer cases keep the twist, with a shorter final answer.",
      body: (
        <ChoiceCards<string>
          label="Number of cases"
          cols={4}
          value={String(starterCount)}
          onPick={(v) => setStarterCount(Number(v))}
          options={[6, 12, 18, 24].map((n) => ({ value: String(n), title: `${n} cases`, text: n === 24 ? "The full story" : `Answer: ${phraseLetters(phraseFor(n)).length} letters`, icon: <BsFolder2Open />, testId: `my-count-${n}`, badge: n === 24 ? "Full story" : undefined, cta: "Choose" }))}
        />
      ),
    });
  settingsQuestions.push(
    {
      key: "difficulty",
      title: "How hard should the grids be?",
      lead: "This sets the directions words can run in.",
      wide: true,
      body: (
        <ChoiceCards<MysterySettings["difficulty"]>
          label="Difficulty"
          cols={3}
          value={settings.difficulty}
          onPick={(v) => set("difficulty", v)}
          options={[
            { value: "easy", title: "Easy", text: "Across and down only.", icon: <span className="pg-diff-dots">●</span>, testId: "my-diff-easy" },
            { value: "medium", title: "Medium", text: "Across, down and diagonals.", icon: <span className="pg-diff-dots">●●</span>, testId: "my-diff-medium", badge: "Recommended" },
            { value: "hard", title: "Hard", text: "All eight directions, backwards too.", icon: <span className="pg-diff-dots">●●●</span>, testId: "my-diff-hard" },
          ]}
        />
      ),
    },
    {
      key: "features",
      title: "Which mystery layers do you want?",
      lead: "Each layer adds one more thing to work out. Turn off any you don't need.",
      canNext: !phraseProblem && (!settings.storyline || settings.hiddenMessage || settings.missingEvidence),
      blockedHint: phraseProblem || "The Case Board needs a hidden message or missing evidence.",
      body: (
        <div className="pg-my-toggles">
          {(
            [
              ["hiddenMessage", "Hidden message", "The leftover letters spell a clue about the culprit."],
              ["missingEvidence", "Missing evidence", "One extra word is hidden but not listed. A clue points to it."],
              ["storyline", "Connected storyline", "Each case gives one letter for the Case Board, and a final page reveals the answer."],
            ] as const
          ).map(([k, t, d]) => (
            <label key={k} className="pg-my-toggle">
              <span className="form-check form-switch m-0">
                <input className="form-check-input" type="checkbox" role="switch" checked={settings[k]} data-testid={`my-${k}`} onChange={(e) => set(k, e.target.checked)} />
              </span>
              <span>
                <span className="pg-my-toggle-title">{t}</span>
                <span className="pg-my-toggle-text">{d}</span>
              </span>
            </label>
          ))}
          {settings.storyline && source !== "starter" && (
            <div className="pg-my-phrase">
              <label htmlFor="myPhrase" className="form-label">
                Final answer the Case Board spells
              </label>
              <input id="myPhrase" className="form-control" value={phrase} maxLength={60} data-testid="my-phrase" onChange={(e) => setPhrase(e.target.value.toUpperCase())} />
              <div className="form-text">
                {phraseLen} letters, one per case ({plural(caseCount, "case")}).
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "style",
      title: "Which case-file style?",
      lead: "Both keep the same layout: brief, suspects, grid, evidence and report.",
      wide: true,
      nextLabel: "Next: build the cases",
      nextTestId: "my-settings-done",
      onNext: () => FINISH,
      body: (
        <ChoiceCards<MysterySettings["style"]>
          label="Case-file style"
          cols={2}
          value={settings.style}
          onPick={(v) => set("style", v)}
          options={[
            { value: "dossier", title: "Dossier", text: "A folder tab, a CONFIDENTIAL stamp and a tinted brief.", icon: <BsFolder2Open />, testId: "my-style-dossier", badge: "Recommended" },
            { value: "clean", title: "Clean", text: "The same page without the folder details. Lighter and quieter.", icon: <BsFileEarmarkText />, testId: "my-style-clean" },
          ]}
        />
      ),
    },
  );

  // ---------------------------------------------------------------- stage 3: build & check
  const viewCase = cases[Math.min(view, cases.length - 1)];
  const checks = result
    ? [
        `Every evidence word is hidden exactly once in ${plural(cases.length, "grid")}`,
        settings.missingEvidence && cases.some((c) => c.missing) ? "Each missing-evidence word is hidden once and not listed" : null,
        settings.hiddenMessage && cases.some((c) => c.message) ? "The leftover letters spell each hidden message exactly" : null,
        settings.hiddenMessage && cases.some((c) => c.trait) ? "Each message points to exactly one suspect" : null,
        result.items.some((i) => i.kind === "board") ? `The Case Board spells the final answer (${phraseLetters(plan?.phrase ?? "").length} letters)` : null,
      ].filter((x): x is string => !!x)
    : [];
  const buildQuestions: Question[] = [
    {
      key: "build",
      title: fresh ? `${plural(cases.length, "case file")} ready` : "Build your case files",
      lead: fresh ? "Every case was checked from the finished grid. Have a look, then pick a design." : `${plan ? plural(caseCount, "case") : "No cases yet"} · ${settings.difficulty} · ${[settings.hiddenMessage && "hidden message", settings.missingEvidence && "missing evidence", settings.storyline && "Case Board"].filter(Boolean).join(" · ") || "plain cases"}`,
      wide: true,
      canNext: fresh && !result?.problems.length && !running,
      blockedHint: running ? "Building…" : "Build the cases first",
      nextLabel: "Next: design",
      nextTestId: "my-build-next",
      onNext: () => FINISH,
      body: (
        <div className="pg-my-build">
          {!fresh && (
            <div className="pg-my-build-cta">
              <button type="button" className="btn btn-primary btn-lg" disabled={!plan || !!running} onClick={() => void build()} data-testid="my-build">
                <BsIncognito /> {running ? "Building…" : result ? "Rebuild with the new settings" : "Build my case files"}
              </button>
              {running && (
                <div className="pg-my-progress" data-testid="my-build-progress">
                  <div className="progress" style={{ height: 6 }}>
                    <div className="progress-bar" style={{ width: `${running.progress ? (100 * running.progress.done) / running.progress.total : 4}%` }} />
                  </div>
                  <span>{running.progress ? `${running.progress.done} of ${running.progress.total} cases` : "Starting…"}</span>
                  <button type="button" className="pg-quiet-btn" onClick={() => running.cancel()}>
                    Stop
                  </button>
                </div>
              )}
            </div>
          )}
          {source === "ai" && aiReady && result && !running && (
            <div className="pg-ai-build-magic">
              <span>Want a different story?</span>
              <MagicButton size="sm" replaces={aiBook?.book.title} onGo={() => void aiGenerate()} testId="my-ai-magic-build" />
            </div>
          )}
          {fresh && result && (
            <>
              <details className="pg-my-checks-box">
                <summary>
                  <BsCheck2Circle /> {result.problems.length ? "Some checks need attention" : `All ${checks.length} checks passed`}
                  <span className="pg-my-checks-more">What was checked</span>
                </summary>
                <ul className="pg-my-checks" data-testid="my-checks">
                  {checks.map((c) => (
                    <li key={c}>
                      <BsCheck2Circle /> {c}
                    </li>
                  ))}
                </ul>
              </details>
              {result.problems.length > 0 && (
                <p className="pg-my-note warn" data-testid="my-problems">
                  {result.problems.join(" ")}
                </p>
              )}
              {result.warnings.length > 0 && (
                <details className="pg-my-warn">
                  <summary>{plural(result.warnings.length, "note")}</summary>
                  <ul>
                    {result.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </details>
              )}
              {viewCase && (
                <div className="pg-my-viewer">
                  <div className="pg-my-viewer-bar">
                    <button type="button" className="btn btn-light btn-sm" aria-label="Previous case" disabled={view === 0} onClick={() => setView((v) => Math.max(0, v - 1))}>
                      <BsChevronLeft />
                    </button>
                    <span className="pg-my-viewer-pos" data-testid="my-view-pos">
                      Case {viewCase.number} of {cases.length}
                    </span>
                    <button type="button" className="btn btn-light btn-sm" aria-label="Next case" disabled={view >= cases.length - 1} onClick={() => setView((v) => Math.min(cases.length - 1, v + 1))}>
                      <BsChevronRight />
                    </button>
                    <button type="button" className="pg-quiet-btn ms-auto" data-testid="my-solution-toggle" onClick={() => setSolved((x) => !x)}>
                      {solved ? <BsEyeSlash /> : <BsEye />} {solved ? "Hide solution" : "Show solution"}
                    </button>
                  </div>
                  <CaseView c={viewCase} solved={solved} />
                </div>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  const squared = result && fresh ? result.warnings.filter((w) => w.includes("uses a square grid")).length : 0;
  const shapeStatus = running && step === 3 ? <span data-testid="reshape-progress">Fitting your cases into the new shape{running.progress ? `: ${running.progress.done} of ${running.progress.total}` : "…"}</span> : cases.length ? <span data-testid="reshape-done">Cases use: {planSummary(rawDesign.design, "mystery", cases.length)}. Every message still fits exactly.{squared ? ` ${plural(squared, "case")} kept a square grid: ${squared === 1 ? "its" : "their"} evidence doesn't fit the shape.` : ""}</span> : null;
  const planList = useMemo(() => (plan?.cases ?? []).map((c) => ({ title: c.title })), [plan]);
  const maxReachable = !plan ? 0 : !fresh ? 2 : 4;
  // Book preview names: the Case Board and Case Closed pages aren't case files.
  const items = result?.items;
  const naming = useMemo(
    () => ({
      labels: { howto: "How to solve" },
      itemName: (i: number) => {
        const it = items?.[i];
        return !it ? undefined : it.kind === "board" ? "Case Board" : it.kind === "finale" ? "Case closed" : `Case ${it.case.number}`;
      },
    }),
    [items],
  );
  const itemsText = useMemo(() => {
    const extra = items ? items.filter((i) => i.kind !== "case").length : 0;
    return (n: number) => {
      const files = n - extra;
      const parts = [plural(files, "case file")];
      if (items?.some((i) => i.kind === "board")) parts.push("the Case Board");
      if (items?.some((i) => i.kind === "finale")) parts.push("Case Closed");
      return `${parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0]}, each with its answer`;
    };
  }, [items]);
  const flow0 = (i: number): FlowCtl => (i === 0 ? { ...flow(0), onBackOut: onChangeType } : flow(i));
  const sections = result ? (result.items.some((i) => i.kind === "board") ? 3 : 1) : 1;

  return (
    <div className="container pb-4">
      <PageHeader
        icon={<BsIncognito />}
        title={MYSTERY_NAME}
        lead="Detective case files: find the evidence, read the hidden message, name the culprit and crack the final case."
        actions={
          <button type="button" className="pg-quiet-btn" onClick={onChangeType} data-testid="ws-change-type">
            <BsClipboardCheck /> Change type
          </button>
        }
      />
      <Stepper steps={STEPS} current={step} maxReachable={maxReachable} onSelect={goTo} />
      <div className="pg-card pg-wizard-card">
        {step === 0 && <QuestionFlow questions={caseQuestions} flow={flow0(0)} />}
        {step === 1 && <QuestionFlow questions={settingsQuestions} flow={flow0(1)} />}
        {step === 2 && <QuestionFlow questions={buildQuestions} flow={flow0(2)} />}
        {step === 3 && (
          <DesignStep tool="mystery" api={designApi} buildSample={sampleBuilder} listName="evidence list" shapeStatus={shapeStatus} busy={!!running} flow={flow0(3)} themes={[]} previewKey={`${planSignature(rawDesign.design.shape)}:${result?.sig.length ?? 0}:${cases.map((c) => `${c.shape ?? "square"}:${c.size}`).join("|")}`} planList={planList} />
        )}
        {step === 4 && (
          <BookExport
            tool="mystery"
            toolDefaults={{ title: "Murder Mystery Word Search", subtitle: `${caseCount} Detective Cases to Solve` }}
            itemNoun="case page"
            naming={naming}
            itemsText={itemsText}
            itemCount={fresh ? result!.items.length : 0}
            sectionCount={sections}
            design={designApi.design}
            items={() => ({ tool: "mystery", items: result!.items, style: settings.style })}
            fileBase="murder-mystery-word-search"
            defaultAnswersPerPage={4}
            disabledReason={running ? "Fitting the cases into the new shape. One moment…" : fresh ? undefined : "Build the cases first (step 3)."}
            flow={flow0(4)}
          />
        )}
      </div>
    </div>
  );
}
