import Link from "next/link";

export default function Footer() {
  return (
    <footer className="pg-footer no-print">
      <div className="container d-flex flex-wrap justify-content-between gap-2">
        <span>Puzzle Generator · Print-ready puzzle books for Amazon KDP</span>
        <span className="d-flex gap-3">
          <Link href="/word-search">Word Search</Link>
          <Link href="/cross-word">Crossword</Link>
          <Link href="/sudoku">Sudoku</Link>
        </span>
      </div>
    </footer>
  );
}
