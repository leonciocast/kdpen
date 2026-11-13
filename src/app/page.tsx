import Link from "next/link";

const tools = [
  {
    href: "/word-search",
    title: "Word Search",
    text: "Enter or upload your words, place them by hand or automatically, and export a KDP print-ready book with answer keys.",
  },
  { href: "/cross-word", title: "Crossword", text: "Build crossword puzzles from your own word list." },
  { href: "/sudoku", title: "Sudoku", text: "Generate sudoku puzzles at different difficulty levels." },
];

export default function Home() {
  return (
    <div className="container py-5">
      <div className="text-center mb-5">
        <h1 className="fw-bold">Puzzle Generator</h1>
        <p className="lead text-muted">Create puzzles for print books and activity pages.</p>
      </div>
      <div className="row g-4">
        {tools.map((t) => (
          <div className="col-md-4" key={t.href}>
            <div className="card h-100 shadow-sm">
              <div className="card-body d-flex flex-column">
                <h4 className="card-title">{t.title}</h4>
                <p className="card-text flex-grow-1">{t.text}</p>
                <Link href={t.href} className="btn btn-primary">
                  Open {t.title}
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
