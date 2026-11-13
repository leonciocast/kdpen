"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import CSVReader from "react-csv-reader";
import { MdDelete } from "react-icons/md";
import { BsArrowDownCircle, BsPrinter } from "react-icons/bs";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import PuzzleGrid, { SolutionStyle } from "./PuzzleGrid";
import {
  ALL_DIRECTIONS,
  Cell,
  DIRECTIONS,
  DirectionKey,
  DirectionOptions,
  LetterGrid,
  MAX_GRID_SIZE,
  MIN_GRID_SIZE,
  Placement,
  allowedDirections,
  autoPlace,
  buildLetterGrid,
  cellsOf,
  checkPlacement,
  chunk,
  containedWordWarnings,
  fillGrid,
  generatePuzzle,
  gridForm,
  lineBetween,
  makePlacement,
  mulberry32,
  placementCells,
  randomSeed,
} from "@/lib/wordsearch/engine";
import { MAX_WORDS, csvRowsToTokens, parseWords, tokenize, wordsToCsv } from "@/lib/wordsearch/words";
import { TRIM_SIZES, TrimKey } from "@/lib/wordsearch/kdp";
import { BookOptions, buildBookPdf, fetchFontBase64, FontData } from "@/lib/wordsearch/pdf";

interface PuzzleModel {
  id: number;
  title: string;
  size: number;
  words: string[];
  placements: Placement[];
  /** Filled grid (placed words + random letters), or null while editing. */
  grid: string[][] | null;
  unplaced: string[];
  warnings: string[];
}

type DirMode = "click-end" | DirectionKey;

const PALETTE = [
  "#ffd6a5", "#caffbf", "#9bf6ff", "#bdb2ff", "#ffc6ff", "#fdffb6",
  "#a0c4ff", "#ffadad", "#b5e48c", "#f1c0e8", "#cfbaf0", "#90dbf4",
];

let fontCache: FontData | null = null;
async function loadFonts(): Promise<FontData> {
  if (!fontCache) {
    const [regular, bold] = await Promise.all([
      fetchFontBase64("/fonts/DejaVuSans.ttf"),
      fetchFontBase64("/fonts/DejaVuSans-Bold.ttf"),
    ]);
    fontCache = { regular, bold };
  }
  return fontCache;
}

const clampInt = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v || lo)));

const WordSearch: React.FC = () => {
  // ---- words
  const [inputWords, setInputWords] = useState("");
  const [wordArray, setWordArray] = useState<string[]>([]);
  const [show, setShow] = useState(false);

  // ---- settings
  const [gridSize, setGridSize] = useState(15);
  const [wordsPerPuzzle, setWordsPerPuzzle] = useState(10);
  const [dirOpts, setDirOpts] = useState<DirectionOptions>({
    horizontal: true,
    vertical: true,
    diagonalDown: true,
    diagonalUp: true,
    reversed: true,
  });

  // ---- puzzles + editor
  const [puzzles, setPuzzles] = useState<PuzzleModel[]>([]);
  const [active, setActive] = useState(0);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [dirMode, setDirMode] = useState<DirMode>("click-end");
  const [pendingStart, setPendingStart] = useState<Cell | null>(null);
  const [hover, setHover] = useState<Cell | null>(null);
  const [solution, setSolution] = useState<SolutionStyle>("hidden");
  const [solutionStyle, setSolutionStyle] = useState<"color" | "bw">("color");

  // ---- export
  const [trim, setTrim] = useState<TrimKey>("8.5x11");
  const [bleed, setBleed] = useState(false);
  const [bookTitle, setBookTitle] = useState("Word Search Puzzle Book");
  const [author, setAuthor] = useState("");
  const [answersPerPage, setAnswersPerPage] = useState<BookOptions["answersPerPage"]>(4);
  const [frontMatter, setFrontMatter] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  const dirs = useMemo(() => allowedDirections(dirOpts), [dirOpts]);
  const puzzle = puzzles[active] as PuzzleModel | undefined;
  const tooLongForGrid = wordArray.filter((w) => gridForm(w).length > gridSize);

  /** Placed words, in the order the user listed them. */
  const listedWords = (pz: PuzzleModel) => {
    const placed = new Set(pz.placements.map((p) => p.word));
    return pz.words.filter((w) => placed.has(w));
  };

  const colorsFor = (pz: PuzzleModel) => {
    const map: Record<string, string> = {};
    pz.words.forEach((w, i) => (map[w] = PALETTE[i % PALETTE.length]));
    return map;
  };

  const resetSelection = () => {
    setSelectedWord(null);
    setPendingStart(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") resetSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ================================================================ words

  const addTokens = (tokens: string[], source: "typed" | "csv") => {
    const res = parseWords(tokens, wordArray, gridSize, MAX_WORDS);
    res.errors.forEach((m) => toast.error(m));
    res.skipped.forEach((m) => toast.warning(m));
    if (res.limitReached) toast.error(`Word limit reached. Maximum ${MAX_WORDS} words allowed.`);
    if (res.added.length) {
      setWordArray((prev) => [...prev, ...res.added]);
      toast.success(`${res.added.length} word${res.added.length === 1 ? "" : "s"} added${source === "csv" ? " from CSV" : ""}.`);
    } else if (source === "csv" && !res.errors.length && !res.skipped.length && !res.limitReached) {
      toast.error("No valid words found in the CSV file.");
    }
  };

  const handleAddWord = () => {
    const tokens = tokenize(inputWords);
    if (tokens.length === 0) {
      toast.error("Please enter words before adding.");
      return;
    }
    addTokens(tokens, "typed");
    setInputWords("");
  };

  const handleFileUpload = (data: unknown[][]) => {
    if (!Array.isArray(data) || !Array.isArray(data[0])) {
      toast.error("Invalid file format. Please upload a CSV file.");
      return;
    }
    const { tokens, error } = csvRowsToTokens(data);
    if (error) {
      toast.error(error);
      return;
    }
    if (tokens.length === 0) {
      toast.error("No valid words found in the CSV file.");
      return;
    }
    addTokens(tokens, "csv");
  };

  const handleDownloadCsv = () => {
    const source = wordArray.length ? wordArray : ["HELLO", "WORLD", "PUZZLE"];
    const blob = new Blob([wordsToCsv(source)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = wordArray.length ? "wordsearch-words.csv" : "wordsearch-template.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDelete = (index: number) => setWordArray((prev) => prev.filter((_, i) => i !== index));

  // ================================================================ puzzles

  const groups = () => chunk(wordArray, clampInt(wordsPerPuzzle, 1, 60));

  const reportUnplaced = (list: PuzzleModel[]) => {
    const misfits = list.flatMap((p, i) => p.unplaced.map((w) => `${w} (puzzle ${i + 1})`));
    if (misfits.length) toast.warning(`These words could not fit and were left out: ${misfits.join(", ")}`, { autoClose: 8000 });
  };

  const generateAll = () => {
    if (!wordArray.length) return toast.error("Please enter words before generating.");
    if (!dirs.length) return toast.error("Select at least one direction.");
    const list = groups().map((words, i) => {
      const g = generatePuzzle(words, gridSize, dirs, mulberry32(randomSeed()));
      return {
        id: Date.now() + i,
        title: `Puzzle ${i + 1}`,
        size: gridSize,
        words,
        placements: g.placements,
        grid: g.grid,
        unplaced: g.unplaced,
        warnings: g.warnings,
      };
    });
    setPuzzles(list);
    setActive(0);
    setSolution("hidden");
    resetSelection();
    reportUnplaced(list);
    toast.success(`${list.length} puzzle${list.length === 1 ? "" : "s"} generated.`);
  };

  const setupManual = () => {
    if (!wordArray.length) return toast.error("Please enter words before creating puzzles.");
    const list = groups().map((words, i) => ({
      id: Date.now() + i,
      title: `Puzzle ${i + 1}`,
      size: gridSize,
      words,
      placements: [],
      grid: null,
      unplaced: [],
      warnings: containedWordWarnings(words),
    }));
    setPuzzles(list);
    setActive(0);
    setSolution("hidden");
    setSelectedWord(list[0]?.words[0] ?? null);
    setPendingStart(null);
  };

  const updatePuzzle = useCallback(
    (fn: (p: PuzzleModel) => PuzzleModel) => setPuzzles((prev) => prev.map((p, i) => (i === active ? fn(p) : p))),
    [active]
  );

  // ================================================================ editor

  const placedWords = new Set(puzzle?.placements.map((p) => p.word) ?? []);
  const remaining = puzzle ? puzzle.words.filter((w) => !placedWords.has(w)) : [];
  const isPlaced = (w: string) => placedWords.has(w);

  const candidateFor = (start: Cell, target: Cell | null): Placement | null => {
    if (!selectedWord || isPlaced(selectedWord)) return null;
    let dir: DirectionKey | null = null;
    if (dirMode !== "click-end") dir = dirMode;
    else if (target) dir = lineBetween(start, target)?.dir ?? null;
    if (!dir) return null;
    return makePlacement(selectedWord, start[0], start[1], dir);
  };

  const preview = useMemo(() => {
    if (!puzzle || !hover || !selectedWord || isPlaced(selectedWord)) return null;
    let cand: Placement | null = null;
    if (dirMode !== "click-end") cand = candidateFor(hover, null);
    else if (pendingStart) cand = candidateFor(pendingStart, hover);
    else return { cells: [hover], valid: true, letters: null as Placement | null };
    if (!cand) return pendingStart ? { cells: [hover], valid: false, letters: null } : null;
    const ok = checkPlacement(puzzle.size, puzzle.placements, cand).ok;
    return { cells: cellsOf(cand.row, cand.col, cand.dir, cand.letters.length), valid: ok, letters: cand };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle, hover, selectedWord, dirMode, pendingStart]);

  const tryPlace = (cand: Placement) => {
    if (!puzzle) return;
    const check = checkPlacement(puzzle.size, puzzle.placements, cand);
    if (!check.ok) {
      toast.error(check.message);
      return;
    }
    const wasFilled = puzzle.grid !== null;
    updatePuzzle((p) => ({ ...p, placements: [...p.placements, cand], grid: null, unplaced: p.unplaced.filter((w) => w !== cand.word) }));
    if (wasFilled) toast.info("Random letters were cleared because the layout changed. Fill again when you are done.");
    const next = puzzle.words.find((w) => w !== cand.word && !isPlaced(w)) ?? null;
    setSelectedWord(next);
    setPendingStart(null);
  };

  const onCellClick = (r: number, c: number) => {
    if (!puzzle) return;
    if (!selectedWord || isPlaced(selectedWord)) {
      // Pick the placed word under the cursor (cycle if several overlap).
      const hits = puzzle.placements.filter((p) => placementCells(p).some(([pr, pc]) => pr === r && pc === c));
      if (hits.length) {
        const idx = hits.findIndex((h) => h.word === selectedWord);
        setSelectedWord(hits[(idx + 1) % hits.length].word);
      } else setSelectedWord(null);
      return;
    }
    if (dirMode !== "click-end") {
      const cand = candidateFor([r, c], null);
      if (cand) tryPlace(cand);
      return;
    }
    if (!pendingStart) {
      setPendingStart([r, c]);
      return;
    }
    if (pendingStart[0] === r && pendingStart[1] === c) {
      setPendingStart(null);
      return;
    }
    const cand = candidateFor(pendingStart, [r, c]);
    if (!cand) {
      toast.error("Pick a cell in a straight line from the start: across, down, or diagonal.");
      return;
    }
    tryPlace(cand);
  };

  const removeWord = (word: string, reselect: boolean) => {
    updatePuzzle((p) => ({ ...p, placements: p.placements.filter((x) => x.word !== word), grid: null }));
    setSelectedWord(reselect ? word : null);
    setPendingStart(null);
  };

  const autoPlaceRemaining = () => {
    if (!puzzle) return;
    if (!dirs.length) return toast.error("Select at least one direction.");
    if (!remaining.length) return toast.info("All words are already placed.");
    const res = autoPlace(puzzle.size, puzzle.placements, remaining, dirs, mulberry32(randomSeed()));
    updatePuzzle((p) => ({ ...p, placements: [...p.placements, ...res.placements], unplaced: res.unplaced, grid: null }));
    resetSelection();
    if (res.unplaced.length) toast.warning(`Could not fit: ${res.unplaced.join(", ")}. Try a bigger grid, more directions, or move some words.`, { autoClose: 8000 });
    else toast.success(`Placed ${res.placements.length} word${res.placements.length === 1 ? "" : "s"}.`);
  };

  const fillLetters = () => {
    if (!puzzle) return;
    if (!puzzle.placements.length) return toast.error("Place at least one word first.");
    if (remaining.length) toast.warning(`Not placed (left out of this puzzle's word list): ${remaining.join(", ")}`, { autoClose: 6000 });
    const res = fillGrid(puzzle.size, puzzle.placements, mulberry32(randomSeed()));
    updatePuzzle((p) => ({
      ...p,
      grid: res.grid,
      unplaced: remaining,
      warnings: [...containedWordWarnings(p.placements.map((x) => x.word)), ...res.warnings],
    }));
    resetSelection();
  };

  const regenerateActive = () => {
    if (!puzzle) return;
    if (!dirs.length) return toast.error("Select at least one direction.");
    const g = generatePuzzle(puzzle.words, gridSize, dirs, mulberry32(randomSeed()));
    updatePuzzle((p) => ({ ...p, size: gridSize, placements: g.placements, grid: g.grid, unplaced: g.unplaced, warnings: g.warnings }));
    resetSelection();
    if (g.unplaced.length) toast.warning(`Could not fit: ${g.unplaced.join(", ")}`);
  };

  const clearPlacements = () => {
    updatePuzzle((p) => ({ ...p, size: gridSize, placements: [], grid: null, unplaced: [] }));
    setSelectedWord(puzzle?.words[0] ?? null);
    setPendingStart(null);
  };

  // ================================================================ export

  const filledPuzzles = puzzles.filter((p) => p.grid !== null);

  const downloadPdf = async () => {
    if (!filledPuzzles.length) return toast.error("Fill at least one puzzle before exporting.");
    const skipped = puzzles.length - filledPuzzles.length;
    setIsDownloading(true);
    try {
      const fonts = await loadFonts();
      const { pdf, plan } = buildBookPdf(
        filledPuzzles.map((p) => ({
          title: p.title,
          size: p.size,
          grid: p.grid!,
          words: listedWords(p),
          placements: p.placements,
        })),
        { trim, bleed, title: bookTitle, author, answersPerPage, includeFrontMatter: frontMatter },
        fonts
      );
      pdf.save(`${(bookTitle || "word-search").replace(/[^\w-]+/g, "_")}_${trim}${bleed ? "_bleed" : ""}.pdf`);
      toast.success(`PDF ready: ${plan.pageCount} pages (${plan.contentPages} with content), ${plan.spec.inside}" gutter.`);
      if (skipped) toast.warning(`${skipped} unfilled puzzle${skipped === 1 ? " was" : "s were"} left out. Fill them to include them.`);
    } catch (e) {
      toast.error(`PDF export failed: ${(e as Error).message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const printPuzzles = () => {
    if (!filledPuzzles.length) return toast.error("Fill at least one puzzle before printing.");
    window.print();
  };

  // ================================================================ render

  let displayLetters: LetterGrid | null = null;
  if (puzzle) {
    displayLetters = puzzle.grid ? puzzle.grid.map((r) => r.slice()) : buildLetterGrid(puzzle.size, puzzle.placements);
    if (!puzzle.grid && preview?.letters) {
      cellsOf(preview.letters.row, preview.letters.col, preview.letters.dir, preview.letters.letters.length).forEach(([r, c], i) => {
        if (r >= 0 && c >= 0 && r < puzzle.size && c < puzzle.size && displayLetters![r][c] === null) displayLetters![r][c] = preview.letters!.letters[i];
      });
    }
  }
  const editing = puzzle && puzzle.grid === null;
  const solutionView: SolutionStyle = editing ? solutionStyle : solution;

  const dirToggle = (key: keyof DirectionOptions, label: string) => (
    <div className="form-check" key={key}>
      <input
        className="form-check-input"
        type="checkbox"
        id={`dir-${key}`}
        checked={dirOpts[key]}
        onChange={() => setDirOpts((d) => ({ ...d, [key]: !d[key] }))}
      />
      <label className="form-check-label" htmlFor={`dir-${key}`}>
        {label}
      </label>
    </div>
  );

  return (
    <div className="container-fluid py-3">
      <ToastContainer position="bottom-right" autoClose={3000} />
      <div className="row g-4 no-print">
        {/* ------------------------------------------------ left column */}
        <div className="col-lg-4">
          <div className="card mb-3">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="card-title mb-0">1. Words</h5>
                <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => setShow(true)}>
                  How to Play
                </button>
              </div>
              <textarea
                placeholder={`Enter words [a-z, 0-9, Ñ, -] separated by new lines or spaces (max ${gridSize} letters for a ${gridSize}×${gridSize} grid)`}
                className="form-control"
                id="wordInput"
                value={inputWords}
                onChange={(e) => setInputWords(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAddWord();
                }}
                rows={3}
              />
              <div className="d-flex flex-wrap gap-2 mt-2 align-items-center">
                <button className="btn btn-primary" onClick={handleAddWord}>
                  Add Words
                </button>
                <button className="btn btn-success" onClick={handleDownloadCsv} title="Download the current word list as CSV">
                  Download CSV
                </button>
                {wordArray.length > 0 && (
                  <button className="btn btn-outline-danger" onClick={() => setWordArray([])}>
                    Clear list
                  </button>
                )}
              </div>
              <div className="mt-2 p-2 d-flex align-items-center gap-2" style={{ border: "2px dotted #888" }}>
                <label className="fw-bold text-nowrap">Upload CSV</label>
                <CSVReader
                  onFileLoaded={handleFileUpload}
                  disabled={isDownloading}
                  inputStyle={{ maxWidth: "100%" }}
                  parserOptions={{ header: false, dynamicTyping: false, skipEmptyLines: true }}
                />
              </div>

              {wordArray.length > 0 && (
                <div className="mt-3">
                  <div className="d-flex justify-content-between">
                    <h6 className="mb-1">Word List</h6>
                    <small>
                      Total: {wordArray.length} / {MAX_WORDS}
                    </small>
                  </div>
                  <div className="overflow-y-auto border rounded" style={{ maxHeight: 240 }}>
                    <table className="table table-sm mb-0">
                      <tbody>
                        {wordArray.map((word, index) => (
                          <tr key={word}>
                            <td className={gridForm(word).length > gridSize ? "text-danger" : ""}>
                              {index + 1}. {word}
                            </td>
                            <td className="text-end">
                              <button className="bg-white border-0" onClick={() => handleDelete(index)} aria-label={`Delete ${word}`}>
                                <MdDelete className="text-danger fs-5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-body">
              <h5 className="card-title">2. Puzzle settings</h5>
              <div className="row g-2">
                <div className="col-6">
                  <label className="form-label small mb-0" htmlFor="gridSize">
                    Grid size ({MIN_GRID_SIZE}–{MAX_GRID_SIZE})
                  </label>
                  <input
                    id="gridSize"
                    type="number"
                    className="form-control"
                    min={MIN_GRID_SIZE}
                    max={MAX_GRID_SIZE}
                    value={gridSize}
                    onChange={(e) => setGridSize(clampInt(Number(e.target.value), MIN_GRID_SIZE, MAX_GRID_SIZE))}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label small mb-0" htmlFor="wordsPerPuzzle">
                    Words per puzzle
                  </label>
                  <input
                    id="wordsPerPuzzle"
                    type="number"
                    className="form-control"
                    min={1}
                    max={60}
                    value={wordsPerPuzzle}
                    onChange={(e) => setWordsPerPuzzle(clampInt(Number(e.target.value), 1, 60))}
                  />
                </div>
              </div>
              {tooLongForGrid.length > 0 && (
                <div className="alert alert-warning py-1 px-2 mt-2 small mb-0">
                  Longer than {gridSize} letters, will not fit: {tooLongForGrid.join(", ")}
                </div>
              )}
              <div className="mt-3">
                <div className="small fw-semibold mb-1">Directions (for automatic placement)</div>
                {dirToggle("horizontal", "Horizontal")}
                {dirToggle("vertical", "Vertical")}
                {dirToggle("diagonalDown", "Diagonal (Top-Left to Bottom-Right)")}
                {dirToggle("diagonalUp", "Diagonal (Bottom-Left to Top-Right)")}
                {dirToggle("reversed", "Reversed (backwards) words")}
              </div>
              <div className="d-flex flex-wrap gap-2 mt-3">
                <button className="btn btn-success" onClick={generateAll} disabled={!wordArray.length}>
                  Generate automatically
                </button>
                <button className="btn btn-outline-primary" onClick={setupManual} disabled={!wordArray.length}>
                  Place words manually
                </button>
              </div>
              <div className="form-text">
                {wordArray.length
                  ? `${Math.ceil(wordArray.length / wordsPerPuzzle)} puzzle(s) of up to ${wordsPerPuzzle} words, ${gridSize}×${gridSize}.`
                  : "Add words to begin."}
              </div>
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-body">
              <h5 className="card-title">3. KDP book export</h5>
              <div className="row g-2">
                <div className="col-12">
                  <label className="form-label small mb-0" htmlFor="bookTitle">
                    Book title
                  </label>
                  <input id="bookTitle" className="form-control" value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} />
                </div>
                <div className="col-12">
                  <label className="form-label small mb-0" htmlFor="author">
                    Author (title & copyright page)
                  </label>
                  <input id="author" className="form-control" value={author} onChange={(e) => setAuthor(e.target.value)} />
                </div>
                <div className="col-7">
                  <label className="form-label small mb-0" htmlFor="trim">
                    Trim size
                  </label>
                  <select id="trim" className="form-select" value={trim} onChange={(e) => setTrim(e.target.value as TrimKey)}>
                    {(Object.keys(TRIM_SIZES) as TrimKey[]).map((k) => (
                      <option key={k} value={k}>
                        {TRIM_SIZES[k].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-5">
                  <label className="form-label small mb-0" htmlFor="answersPerPage">
                    Answers / page
                  </label>
                  <select
                    id="answersPerPage"
                    className="form-select"
                    value={answersPerPage}
                    onChange={(e) => setAnswersPerPage(Number(e.target.value) as BookOptions["answersPerPage"])}
                  >
                    {[1, 2, 4, 6].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-check mt-2">
                <input className="form-check-input" type="checkbox" id="bleed" checked={bleed} onChange={() => setBleed(!bleed)} />
                <label className="form-check-label" htmlFor="bleed">
                  Bleed (+0.125&quot; width, +0.25&quot; height)
                </label>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="checkbox" id="front" checked={frontMatter} onChange={() => setFrontMatter(!frontMatter)} />
                <label className="form-check-label" htmlFor="front">
                  Title page + how-to-play/copyright page
                </label>
              </div>
              <div className="d-flex flex-wrap gap-2 mt-3">
                <button className="btn btn-primary d-flex align-items-center gap-2" onClick={downloadPdf} disabled={isDownloading || !filledPuzzles.length}>
                  {isDownloading ? <span className="spinner-border spinner-border-sm" role="status" /> : <BsArrowDownCircle />}
                  Download KDP PDF
                </button>
                <button className="btn btn-outline-dark d-flex align-items-center gap-2" onClick={printPuzzles} disabled={!filledPuzzles.length}>
                  <BsPrinter /> Print
                </button>
              </div>
              <div className="form-text">
                {filledPuzzles.length} of {puzzles.length} puzzle(s) ready. The PDF has puzzle pages, then answer keys, padded to an even
                count of at least 24 pages, with embedded fonts and mirrored margins.
              </div>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------ right column */}
        <div className="col-lg-8">
          {!puzzle ? (
            <div className="text-center text-muted border rounded p-5">
              <h4>No puzzles yet</h4>
              <p className="mb-0">Add words, then choose <b>Generate automatically</b> or <b>Place words manually</b>.</p>
            </div>
          ) : (
            <>
              <div className="d-flex flex-wrap gap-1 mb-2" role="tablist">
                {puzzles.map((p, i) => (
                  <button
                    key={p.id}
                    className={`btn btn-sm ${i === active ? "btn-dark" : "btn-outline-dark"}`}
                    onClick={() => {
                      setActive(i);
                      resetSelection();
                    }}
                  >
                    {p.title} {p.grid ? "✓" : "✎"}
                  </button>
                ))}
              </div>

              <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                <input
                  className="form-control form-control-sm"
                  style={{ maxWidth: 260 }}
                  value={puzzle.title}
                  aria-label="Puzzle title"
                  onChange={(e) => updatePuzzle((p) => ({ ...p, title: e.target.value }))}
                />
                <span className={`badge ${puzzle.grid ? "bg-success" : "bg-warning text-dark"}`}>
                  {puzzle.grid ? "Filled, ready to export" : `Editing: ${puzzle.placements.length}/${puzzle.words.length} placed`}
                </span>
                <span className="badge bg-secondary">
                  {puzzle.size}×{puzzle.size}
                </span>
                {puzzle.grid && (
                  <button className="btn btn-dark btn-sm ms-auto" onClick={() => setSolution(solution === "hidden" ? solutionStyle : "hidden")}>
                    {solution === "hidden" ? "Show" : "Hide"} Solution
                  </button>
                )}
                <select
                  className={`form-select form-select-sm ${puzzle.grid ? "" : "ms-auto"}`}
                  style={{ width: "auto" }}
                  value={solutionStyle}
                  aria-label="Solution style"
                  onChange={(e) => {
                    const v = e.target.value as "color" | "bw";
                    setSolutionStyle(v);
                    if (solution !== "hidden") setSolution(v);
                  }}
                >
                  <option value="color">Colored highlights</option>
                  <option value="bw">Black & white (print)</option>
                </select>
              </div>

              <div className="row g-3">
                <div className="col-xl-8">
                  <PuzzleGrid
                    id="active-grid"
                    size={puzzle.size}
                    letters={displayLetters!}
                    placements={puzzle.placements}
                    colors={colorsFor(puzzle)}
                    solution={solutionView}
                    emphasizePlaced={!puzzle.grid}
                    preview={editing ? preview : null}
                    pendingStart={editing ? pendingStart : null}
                    selectedWord={selectedWord}
                    onCellClick={editing ? onCellClick : undefined}
                    onCellHover={editing ? setHover : undefined}
                  />
                  {!puzzle.grid && (
                    <div className="small text-muted mt-1">
                      {selectedWord && !isPlaced(selectedWord)
                        ? dirMode === "click-end"
                          ? pendingStart
                            ? `Now click any cell in the direction "${selectedWord}" should run (Esc to cancel).`
                            : `Click the first letter's cell for "${selectedWord}".`
                          : `Click the start cell for "${selectedWord}" (${DIRECTIONS[dirMode].label}).`
                        : "Select a word on the right, or click a placed word to move/remove it."}
                    </div>
                  )}
                  <div className="mt-3">
                    <h6 className="mb-1">Find these words:</h6>
                    <div className="d-flex flex-wrap gap-3">
                      {(puzzle.grid ? listedWords(puzzle) : puzzle.words).map((w) => (
                        <span key={w} className={!puzzle.grid && !isPlaced(w) ? "text-muted" : ""}>
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="col-xl-4">
                  <div className="card">
                    <div className="card-body">
                      <h6 className="card-title">Editor</h6>
                      {puzzle.grid ? (
                        <>
                          <p className="small mb-2">This puzzle is filled with random letters. To change where words go, clear the random letters first.</p>
                          <div className="d-grid gap-2">
                            <button className="btn btn-outline-primary btn-sm" onClick={() => updatePuzzle((p) => ({ ...p, grid: null }))}>
                              Clear random letters (edit layout)
                            </button>
                            <button className="btn btn-outline-secondary btn-sm" onClick={fillLetters}>
                              Re-roll random letters
                            </button>
                            <button className="btn btn-outline-secondary btn-sm" onClick={regenerateActive}>
                              Regenerate this puzzle
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <label className="form-label small mb-0" htmlFor="dirMode">
                            Direction
                          </label>
                          <select
                            id="dirMode"
                            className="form-select form-select-sm mb-2"
                            value={dirMode}
                            onChange={(e) => {
                              setDirMode(e.target.value as DirMode);
                              setPendingStart(null);
                            }}
                          >
                            <option value="click-end">Click start, then a cell toward the end</option>
                            {ALL_DIRECTIONS.map((k) => (
                              <option key={k} value={k}>
                                {DIRECTIONS[k].label}
                              </option>
                            ))}
                          </select>
                          <div className="small fw-semibold">Words ({remaining.length} to place)</div>
                          <div className="d-flex flex-wrap gap-1 my-1" style={{ maxHeight: 220, overflowY: "auto" }}>
                            {puzzle.words.map((w) => {
                              const placed = isPlaced(w);
                              const sel = selectedWord === w;
                              return (
                                <button
                                  key={w}
                                  className={`btn btn-sm ${sel ? "btn-primary" : placed ? "btn-outline-success" : "btn-outline-secondary"}`}
                                  onClick={() => {
                                    setSelectedWord(w);
                                    setPendingStart(null);
                                  }}
                                  data-word={w}
                                >
                                  {placed ? "✓ " : ""}
                                  {w}
                                </button>
                              );
                            })}
                          </div>
                          {selectedWord && isPlaced(selectedWord) && (
                            <div className="d-flex gap-2 my-2">
                              <button className="btn btn-sm btn-outline-primary" onClick={() => removeWord(selectedWord, true)}>
                                Move “{selectedWord}”
                              </button>
                              <button className="btn btn-sm btn-outline-danger" onClick={() => removeWord(selectedWord, false)}>
                                Remove
                              </button>
                            </div>
                          )}
                          <div className="d-grid gap-2 mt-2">
                            <button className="btn btn-outline-primary btn-sm" onClick={autoPlaceRemaining} disabled={!remaining.length}>
                              Auto-place remaining
                            </button>
                            <button className="btn btn-success btn-sm" onClick={fillLetters} disabled={!puzzle.placements.length}>
                              Fill random letters
                            </button>
                            <button className="btn btn-outline-secondary btn-sm" onClick={clearPlacements}>
                              Clear all placements
                            </button>
                          </div>
                          <div className="form-text">Auto-place uses the directions chosen in settings. Manual placement can use any direction.</div>
                        </>
                      )}
                      {puzzle.unplaced.length > 0 && (
                        <div className="alert alert-warning small py-1 px-2 mt-2 mb-0">Could not fit: {puzzle.unplaced.join(", ")}</div>
                      )}
                      {puzzle.warnings.map((w) => (
                        <div key={w} className="alert alert-info small py-1 px-2 mt-2 mb-0">
                          {w}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ------------------------------------------------ print-only output */}
      <div className="print-only">
        {filledPuzzles.map((p) => (
          <div className="print-page" key={`print-${p.id}`}>
            <h2>{p.title}</h2>
            <PuzzleGrid size={p.size} letters={p.grid!} placements={p.placements} solution="hidden" maxWidth={680} />
            <div className="print-words">
              {listedWords(p).map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>
          </div>
        ))}
        {solution !== "hidden" &&
          filledPuzzles.map((p) => (
            <div className="print-page" key={`print-sol-${p.id}`}>
              <h2>{p.title}: Solution</h2>
              <PuzzleGrid size={p.size} letters={p.grid!} placements={p.placements} colors={colorsFor(p)} solution={solution} maxWidth={680} />
            </div>
          ))}
      </div>

      {/* ------------------------------------------------ how to play */}
      {show && <div className="modal-backdrop fade show" onClick={() => setShow(false)} />}
      <div className={`modal fade ${show ? "show" : ""}`} tabIndex={-1} style={{ display: show ? "block" : "none" }} onClick={() => setShow(false)}>
        <div className="modal-dialog modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">How To Play Word Search</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={() => setShow(false)} />
            </div>
            <div className="modal-body">
              <ul>
                <li>Type words in the box (one per line, or separated by spaces) and press Add Words, or upload a one-column CSV.</li>
                <li>Words accept only [a-z, A-Z, 0-9, -, Ñ/ñ]. Other characters show an &quot;invalid characters&quot; error.</li>
                <li>If no words are entered, you will see: Please enter words before adding.</li>
                <li>CSV files must have exactly one column. A &quot;Word&quot; header row is optional.</li>
                <li>Words that already exist, or that repeat one character 4+ times, are skipped.</li>
                <li>Maximum {MAX_WORDS} words. A word can be at most as long as the grid size.</li>
                <li>Generate automatically, or place words manually: pick a word, click its start cell, then click toward its end (or choose a direction first). Click a placed word to move or remove it.</li>
                <li>Auto-place remaining fills in the rest; Fill random letters completes the grid without creating extra copies of your words.</li>
                <li>Download KDP PDF builds a print-ready interior with puzzle pages and answer keys.</li>
              </ul>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-danger" onClick={() => setShow(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WordSearch;
