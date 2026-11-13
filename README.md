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
| `npm test` | Unit tests (vitest): word search engine, phrases, crossword and sudoku engines, front matter, KDP layout and PDFs |
| `npm run lint` | ESLint 9 (flat config, `eslint-config-next`) |
| `npm run sample-book` | Writes `review/sample_book.pdf`, `review/sample_crossword.pdf` and `review/sample_sudoku.pdf` |
| `npm run review:screens` | End-to-end Playwright walkthrough of every tool (desktop + mobile), with screenshots and downloaded PDFs in `review/`. The server must be running on :3000, and you need `npx playwright install chromium` first |

## Word search (5 steps)

1. **Add words**: put one word **or phrase** on each line (`ICE CREAM`, `T-REX`), or upload a one-column CSV.
   Phrases are hidden in the grid without spaces or hyphens (`ICECREAM`), but the word list shows them as typed.
   Allowed characters are A–Z, 0–9, Ñ, spaces and hyphens. An entry may have as many letters as the grid size (spaces don't count), and the list holds up to 200 entries. Duplicates are skipped.
2. **Puzzle settings**: grid size 8–25, words per puzzle, and Easy/Medium/Hard or exact directions.
   These directions apply **only to automatic placement**.
3. **Place words**: choose **Automatic**, or **Manual** to pick a word, pick any of the 8 directions on the arrow pad
   (or use "Start → end"), and click the grid, with a live green or red preview. You can move or remove words, auto-place the rest, and then fill the empty squares.
4. **Review & solution**: rename puzzles, show the solution (colored or black & white), shuffle the filler letters, or make a new layout.
5. **Export book**: choose the trim size and bleed, and edit the title and copyright pages.

## Crossword (3 steps)

Enter one `WORD - clue` per line (tab, `:`, `|`, `=` and `,` also work as separators) or upload a two-column CSV.
The tool builds numbered crosswords with Across and Down clues; any word that can't connect to the others is reported. Then you export the book.

## Sudoku (3 steps)

Choose Easy, Medium, Hard or Expert and 1–100 puzzles, review them with their solutions, then export 1, 2 or 4 puzzles per page with solutions at the back.

## Book export (all tools)

- **Front matter**: title page and copyright page, with title, subtitle, author or brand, imprint, year, edition, optional ISBN,
  copyright notice (a professional default with `{year}`/`{author}` placeholders), an optional dedication page and a website line.
  The tool shows a live preview and saves your entries in the browser. Author, imprint and notice are shared across tools.
- **KDP layout**: trims 6×9, 8.5×11 and A4, optional bleed, a gutter that follows KDP page-count rules, mirrored margins and page numbers.
  The book can be padded to an even page count of at least 24.
- **Vector PDF** with embedded DejaVu Sans/Serif fonts (see `public/fonts/DejaVu-LICENSE.txt`). Answer keys go at the back.
- **Print puzzles** uses the browser's print dialog with a clean print stylesheet.

## Code map

- `src/lib/wordsearch/`: placement engine (seeded, bounded backtracking), word rules, capsule geometry, PDF content
- `src/lib/crossword/`: clue parsing, layout engine, PDF content
- `src/lib/sudoku/`: generation, validation, PDF content
- `src/lib/print/`: KDP page specs (`kdp.ts`), front matter (`frontMatter.ts`), shared book renderer (`book.ts`)
- `src/components/ui/`: design-system pieces (navbar, wizard stepper, CSV drop zone, front matter form, book export step)
