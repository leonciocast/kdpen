"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState } from "react";
import { BsGrid3X3Gap, BsSearch, BsList, BsX, BsPuzzle } from "react-icons/bs";
import Logo from "./Logo";

const LINKS = [
  { href: "/word-search", label: "Word Search", icon: <BsSearch /> },
  { href: "/cross-word", label: "Crossword", icon: <BsPuzzle /> },
  { href: "/sudoku", label: "Sudoku", icon: <BsGrid3X3Gap /> },
];

export default function Navbar() {
  const pathname = usePathname();
  // The menu remembers the page it was opened on, so it closes after navigation.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn !== null && openOn === pathname;
  return (
    <header className="pg-nav no-print">
      <nav className="container" aria-label="Main">
        <Link href="/" className="pg-brand">
          <Logo /> Puzzle Generator
        </Link>
        <button
          className="btn btn-ghost btn-icon pg-nav-toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="pg-nav-links"
          onClick={() => setOpenOn(open ? null : pathname)}
        >
          {open ? <BsX size={22} /> : <BsList size={22} />}
        </button>
        <ul id="pg-nav-links" className={`pg-nav-links ${open ? "open" : ""}`}>
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className={`pg-nav-link ${pathname?.startsWith(l.href) ? "active" : ""}`} aria-current={pathname?.startsWith(l.href) ? "page" : undefined}>
                {l.icon} {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
