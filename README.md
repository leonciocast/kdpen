# Puzzle Generator (kdpen)

A Next.js site for making print-ready puzzle books for Amazon KDP. It has three guided tools:
**Word Search**, **Crossword** and **Sudoku**.

Stack: Next.js 16 (App Router, Turbopack), React 19, TypeScript 5.9, Bootstrap 5.3 (npm), jsPDF 4, vitest 5, ESLint 9.

## Run it

```bash
npm install
npm run dev                              # http://localhost:3000 (development)
npm run build && npm run start -- -p 3000   # production
```

| Script | What it does |
| --- | --- |
| `npm test` | Unit tests (vitest): engines, phrases, splitting, volumes, page estimates, design presets, front matter, KDP layout and PDFs |
| `npm run lint` | ESLint 9 (flat config, `eslint-config-next`) |
| `npm run sample-book` | Writes sample books plus one `template_<id>.pdf` per design template into `review/`. Add `-- --perf` for the 10,000-word benchmark (`WORDS=20000 PER=15` to test automatic volumes) |
| `npm run review:screens` | End-to-end Playwright run of every tool, including a 10,000-word word search book and a 100-sudoku book. Screenshots, PDFs and timings go to `review/`, and the run fails on any console error. The server must be running on :3000, and you need `npx playwright install chromium` first |

`npm run dev` and `npm run build` first copy the pdf.js worker into `public/vendor/` (it is gitignored), which the live design preview uses.

## Word search (6 steps)

1. **Add words**: put one word **or phrase** on each line, optionally with a theme, or upload a CSV/TXT file.
   Column 1 holds the word and an optional column 2 holds a theme/title. Phrases are hidden without spaces (`ICECREAM`).
   The list holds up to **20,000** entries (`src/lib/limits.ts`). A 10,000-word file imports in well under a second. Long lists show the first 200 rows with a search box.
2. **Puzzle settings**: choose an **Easy / Medium / Hard / Expert** preset for the whole book.
   The preset sets the directions, reversed words, grid density, overlaps and the filler letters (look-alike letters or decoy fragments).
   You can still change the exact directions by hand. You also set the words per puzzle (up to 60) and an automatic or fixed grid size (8–30).
   Grouping by theme is optional. The list is split into balanced puzzles and live stats are shown.
3. **Place words**: choose **Automatic**, which runs in a Web Worker with a progress bar and Cancel, or **Manual** to place words yourself with the snap-to-grid preview. A pager handles hundreds of puzzles.
4. **Review & solution**: rename puzzles, check the answers, shuffle the filler letters, or make a new layout.
5. **Design**: pick a template and customize it, with a live preview of the real PDF page (see below).
6. **Export book**: choose the trim, bleed, extra pages and title page, then see live page stats and the KDP limit. Books over 828 pages are split into volumes automatically.

## Crossword (4 steps)

Enter one `WORD - clue` per line, or upload a CSV with columns `word, clue, theme (optional)`. It accepts up to 10,000 clues.
Clues are grouped by theme and split into crosswords of up to 30 words, built in a Web Worker. Then come Design and Export, where clue lists can have checkboxes.

## Sudoku (4 steps)

Choose a mix of Easy, Medium, Hard and Expert puzzles (up to 1,000 in total, easiest first, one section per level), generated in a Web Worker.
After review come Design and Export, with 1, 2, 4 or 6 puzzles per page and 1, 2, 4 or 6 solutions per page.

## Design system (all tools)

There are seven original templates:
- Classic minimal
- Bold banner (numbered badge and icon)
- Elegant serif
- Kids playful
- Large print, high contrast
- Seasonal accent
- Modern typewriter

You can customize:
- the header style and text, the puzzle-number badge and its shape, and the icon
- the fonts for headings, the grid and the list (DejaVu Sans/Serif, Courier Prime, Balsamiq Sans, Poppins, Atkinson Hyperlegible, all embedded)
- the letter sizes
- cell lines, the border (square, rounded, double or none), shading and frame thickness
- the accent colour, with **black & white safe** on by default
- a low-ink vector background pattern
- the page number style
- the list columns, **checkboxes before each word** (on by default) and the sort order

Designs are remembered per tool. You can save them as named presets in the browser, and export or import them as JSON.

## Book export (all tools)

- **Extra pages** (optional):
  - This Book Belongs To
  - a how-to page with a diagram built from a real mini puzzle
  - a table of contents with page numbers
  - an introduction
  - a thank-you/review page
  - notes pages
  - KDP padding filled with lined notes pages instead of blank ones
- **Front matter**: editable title and copyright pages, plus a dedication. They are saved in the browser.
- **KDP layout**: trims 6×9, 8.5×11 and A4, optional bleed, a gutter by page count, mirrored margins, and an even count of at least 24 pages.
  Books over 828 pages are split into balanced volumes, each a separate PDF with "Volume N" on the title page.
- **Vector PDF** with embedded, subset fonts. The background pattern is a single shared PDF object, so a 358-page, 10,000-word book is about 5 MB.
  PDF building runs in a Web Worker with progress and Cancel. Each file has Download and Open (view or print) buttons.

## Code map

- `src/lib/limits.ts`: all configurable caps (words, words per puzzle, grid size, clues, sudoku count, KDP pages)
- `src/lib/design/`: templates, presets, fonts, and the vector paint primitives (headers, badges, icons, patterns, lists, grids)
- `src/lib/wordsearch/`: placement engine, difficulty presets, bulk splitting, word rules, PDF content
- `src/lib/crossword/`, `src/lib/sudoku/`: engines and PDF content
- `src/lib/print/`: KDP specs, front matter, shared book renderer (`book.ts`), page estimates and volumes (`estimate.ts`), and font loading
- `src/lib/jobs/` + `src/workers/book.worker.ts`: background jobs (generation and PDF), with progress and cancel
- `src/components/ui/`: wizard, Design step with the pdf.js preview, book export, extras, progress, pager
