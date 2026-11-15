# Murder Mystery Word Search ("case files")

A word search type where every puzzle is a detective case. It is our own design.
It borrows only the genre mechanics: evidence words, a missing word, leftover
letters that spell a message, and a thread through the book. All story text,
names, cases and page designs are original. Nothing is taken from *Kill Grid*
or any other book.

## Research summary

- **Kill Grid Vol. 1** (Amazon listing description): 120 connected cases, one per page, plus a
  worked example and full solutions. Its four steps are: find the listed words, spot the
  one missing word (it names the crime scene), read the leftover letters in order (they name
  the killer and victim), and record one letter per case. The letters spell a book-wide confession.
- **Reviews:** readers love the leftover-letter twist and the cases that tie together. The one
  common complaint is that the missing word is easy to guess when only one word in the list
  could fit it (for example, only one place is listed).
- **Leoncio's ChatGPT share (readable):** a rules breakdown and a blueprint. Its key points:
  - keep three different discoveries apart (missing word, leftover message, master clue)
  - every deduction has to be fair, with no guessing
  - the generator works backwards from the answer
  - an independent validator checks every listed word, the missing word, the decoded message,
    every unused cell and the final confession

## Rules for solvers (printed on the How to Solve page)

1. **Read the brief.** Each case has a short story and three suspects with their traits.
2. **Find the evidence.** Every listed word is hidden once, in straight lines.
3. **Find the missing evidence.** One more word is hidden, but it isn't on the list. The clue
   and its letter count point to it. (This fixes the reviewers' complaint: you can't guess it
   from the list, you have to search the grid.)
4. **Read the hidden message.** Cross out every word, including the missing evidence. Then read
   the letters that are left from left to right, top to bottom. They spell a sentence such as
   THE CULPRIT WEARS GLASSES. Squares with a dot are empty.
5. **Name the culprit.** Only one suspect has the trait in the message.
6. **Record the case key.** The case tells you which letter of the culprit's name (or of the
   missing evidence) goes into a numbered box on the Case Board.
7. **Case closed.** When every box is filled, the letters spell the final confession. It
   names who was behind every case.

## Page layout (one case per page)

- Header in the book's design: `CASE FILE`, the case number, the case title.
- Brief panel: the story (2–3 sentences) and a suspects row (name, role, traits).
- The grid (any shape from the shape plan). Letters stay at 7 pt or more at 8.5×11.
- Two columns below the grid:
  - left: the evidence checklist
  - right: the detective report, with
    - the missing evidence clue and blanks
    - the message blanks, grouped by word
    - a culprit line
    - the key box ("Box 7 ← letter 2 of the culprit's first name")
- Style options: **Dossier** (folder tab, CONFIDENTIAL stamp, ruled report) or **Clean**.
- Extra pages:
  - **Case Board** (front): the suspect file (cast with roles and traits) and the numbered
    confession boxes
  - **Case Closed** (after the last case): copy the boxes in order, then answer
    "Who was behind it all?"
  - **How to Solve** (replaces How to Play)
- Solutions: each grid shows the evidence circled and the missing evidence dashed. The message
  letters are bold in the accent colour. Under each grid: message, culprit, missing evidence
  and key letter. The board and finale solutions show the confession and the epilogue.

## How the cases connect

- Starter storyline **The Saltmere Lantern**: 24 original cases in a seaside town and a
  recurring cast of 10 townspeople.
- Each case is self-contained. Its brief ends with a lead into the next case.
- Key cases: the final phrase has L letters. If the book has more cases than that, L cases
  spread evenly through the book carry a key; the others are standalone.
- The final phrase is THE KEEPER ODETTE MARSH LIED (24 letters), with shorter versions for
  smaller books.
- Pasted or templated books use a final answer the user types (default `CASE CLOSED`).

## Generator (src/lib/mystery)

1. **Resolve each case.**
   - The message comes from the culprit's trait that neither other suspect shares. If no such
     trait exists, the case is rejected.
   - The case key letter: the source and position are picked so that the letter equals the
     phrase letter for that box (culprit's first name, then surname, then missing evidence,
     then message).
2. **Place the grid.**
   - Words: evidence plus missing evidence. M = number of message letters.
   - For grid sizes n near √(letters + M), place all words but one "flex" word with
     backtracking.
   - Then choose the flex word's position so the empty cells equal M exactly.
   - If no exact fit turns up, keep the closest fit and mark the few extra cells as dotted
     blanks at the end of the reading order.
3. **Fill** the empty cells, in reading order, with the message letters.
4. **Validate independently** from the finished grid:
   - every word and the missing evidence are found exactly once
   - the leftover letters equal the message
   - the culprit is unique for the trait
   - the key letter is right
   - the boxes spell the final phrase
   - a failed case is regenerated with a new seed
5. **Speed:** generation runs in the PDF worker. 120 cases take a few seconds.

## Settings

- Case source:
  - the starter pack
  - pasted cases (`Case 3: Title`, `Story:`, `Words:`, `Missing:`/`Clue:`, `Suspects:`,
    `Culprit:`, `Message:`, `Lead:`)
  - templated cases built from a setting (hotel, manor, night train, museum, and more).
    The UI says plainly that these stories are assembled from templates.
- Number of cases (up to 200).
- Difficulty:
  - Easy: across and down
  - Medium: adds diagonals
  - Hard: adds backwards
- Each of these can be turned off: hidden message, missing evidence, connected storyline.
- Case-file style; final answer (for pasted or templated books).
- Everything after that is shared with the classic flow: design presets, shapes and shape plan,
  outlines, KDP trim, bleed and margins, front matter, preview and export.
