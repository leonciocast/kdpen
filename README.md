# Puzzle Generator (kdpen)

Next.js 14 site with three tools: **Word Search**, **Crossword**, and **Sudoku**.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000 (development)
# or
npm run build && npm run start -- -p 3000
```

Other scripts:

| Script | What it does |
| --- | --- |
| `npm test` | Unit tests (vitest) for the word search engine, word rules, KDP layout and PDF |
| `npm run lint` | ESLint |
| `npm run sample-book` | Writes a 4-puzzle 8.5×11 sample book to `review/sample_book.pdf` |
| `npm run review:screens` | Headless screenshots of the running site into `review/` (needs `npx playwright install chromium`) |

## Word search

1. **Words**: type words (new line or space separated) or upload a one-column CSV (optional `Word` header).
   Allowed: `A–Z`, `0–9`, `Ñ/ñ`, `-`. Duplicates and words with 4+ repeated characters are skipped, max 200 words,
   and a word can be at most as long as the grid. **Download CSV** exports the current list.
2. **Settings**: grid size 8–25, words per puzzle, and the directions used for automatic placement
   (horizontal, vertical, both diagonals, reversed).
3. **Generate automatically**, or **Place words manually**:
   - select a word, click its start cell, then click any cell toward its end (or pick a fixed direction first);
   - the green/red preview shows whether it fits (bounds and letter conflicts; shared matching letters are fine);
   - click a placed word to **Move** or **Remove** it;
   - **Auto-place remaining** places the rest; **Fill random letters** fills empty cells without creating extra copies of any listed word.
4. **Show Solution** draws circled-word capsules (colored, or black & white for print).
5. **Download KDP PDF**: vector PDF with embedded DejaVu Sans, trim 6×9 / 8.5×11 / A4, optional bleed,
   KDP gutter by page count, mirrored margins, page numbers, puzzle pages then answer keys (1/2/4/6 per page),
   padded to an even page count of at least 24.

Code layout:

- `src/lib/wordsearch/engine.ts` – pure placement engine (bounded backtracking, validation, fill, search)
- `src/lib/wordsearch/words.ts` – input rules shared by the textarea and CSV upload
- `src/lib/wordsearch/kdp.ts` – trim/bleed/margin rules
- `src/lib/wordsearch/pdf.ts` – jsPDF book renderer
- `src/components/word-search/` – UI (`WordSearch.tsx`, SVG `PuzzleGrid.tsx`)

Fonts in `public/fonts` are DejaVu Sans (free license, see `public/fonts/DejaVu-LICENSE.txt`).
