import Link from "next/link";
import { BsArrowRight, BsCheckCircleFill, BsGrid3X3Gap, BsPuzzle, BsSearch, BsFilePdf, BsPencilSquare, BsListCheck } from "react-icons/bs";

const tools = [
  {
    href: "/word-search",
    title: "Word Search",
    icon: <BsSearch />,
    text: "Add your words or phrases, place them yourself or let us do it, and export a complete book with answer keys.",
    tag: "Most complete",
  },
  { href: "/cross-word", title: "Crossword", icon: <BsPuzzle />, text: "Turn a list of words and clues into numbered crosswords with Across and Down clues." },
  { href: "/sudoku", title: "Sudoku", icon: <BsGrid3X3Gap />, text: "Generate easy to expert sudoku puzzles, each with a single solution." },
];

const steps = [
  { icon: <BsListCheck />, title: "Add your content", text: "Type or upload a CSV of words, phrases or clues, or just pick a difficulty." },
  { icon: <BsPencilSquare />, title: "Make the puzzles", text: "Generate automatically, or fine-tune by hand with a live preview." },
  { icon: <BsFilePdf />, title: "Export your book", text: "Download a print-ready PDF interior with title and copyright pages." },
];

const features = [
  "KDP trim sizes: 6×9, 8.5×11 and A4, with optional bleed",
  "Gutter margins that follow KDP page-count rules",
  "Embedded fonts and crisp vector pages that stay sharp in print",
  "Answer keys at the back, page numbers, padded to 24+ pages",
];

export default function Home() {
  return (
    <div className="container">
      <section className="pg-hero text-center">
        <span className="pg-eyebrow">For puzzle book creators</span>
        <h1 className="mt-3 mx-auto" style={{ maxWidth: "48rem" }}>
          Create professional puzzle books, ready for print
        </h1>
        <p className="lead mx-auto mt-3">Make word searches, crosswords and sudoku in a few guided steps, then download a polished interior PDF for Amazon KDP.</p>
        <div className="d-flex gap-2 justify-content-center flex-wrap mt-4">
          <Link href="/word-search" className="btn btn-primary btn-lg">
            Start a word search <BsArrowRight />
          </Link>
          <a href="#tools" className="btn btn-light btn-lg">
            See all tools
          </a>
        </div>
      </section>

      <section id="tools" aria-labelledby="tools-title" className="mb-5">
        <h2 id="tools-title" className="visually-hidden">
          Tools
        </h2>
        <div className="row g-4">
          {tools.map((t) => (
            <div className="col-md-4" key={t.href}>
              <Link href={t.href} className="pg-card pg-card-body pg-tool-card">
                <div className="d-flex justify-content-between align-items-start">
                  <span className="pg-icon-badge">{t.icon}</span>
                  {t.tag && <span className="pg-badge info">{t.tag}</span>}
                </div>
                <h3 className="h5 fw-bold mt-3 mb-2">{t.title}</h3>
                <p className="text-muted mb-4">{t.text}</p>
                <span className="pg-cta">
                  Open {t.title} <BsArrowRight />
                </span>
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="pg-card pg-card-body mb-5" aria-labelledby="how-title">
        <h2 id="how-title" className="h4 fw-bold mb-4 text-center">
          How it works
        </h2>
        <div className="row g-4">
          {steps.map((s, i) => (
            <div className="col-md-4" key={s.title}>
              <div className="d-flex gap-3">
                <span className="pg-icon-badge">{s.icon}</span>
                <div>
                  <div className="small fw-bold text-primary">Step {i + 1}</div>
                  <h3 className="h6 fw-bold mb-1">{s.title}</h3>
                  <p className="text-muted mb-0 small">{s.text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="row g-4 align-items-center mb-4">
        <div className="col-lg-5">
          <h2 className="h4 fw-bold">Built for Amazon KDP paperbacks</h2>
          <p className="text-muted">Every export follows KDP&apos;s interior guidelines, so you can upload with confidence.</p>
        </div>
        <div className="col-lg-7">
          <div className="row g-3">
            {features.map((f) => (
              <div className="col-sm-6" key={f}>
                <div className="pg-feature">
                  <BsCheckCircleFill />
                  <span>{f}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
