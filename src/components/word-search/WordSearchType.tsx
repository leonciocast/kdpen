"use client";
import React, { useEffect, useState } from "react";
import { BsGrid3X3Gap, BsImage, BsIncognito, BsKey, BsSearch } from "react-icons/bs";
import PageHeader from "@/components/ui/PageHeader";
import { ChoiceCards } from "@/components/ui/Flow";
import Link from "next/link";
import { BsArrowLeft } from "react-icons/bs";

export type WordSearchKind = "mystery" | "classic";
type Pick = WordSearchKind | "picture" | "cipher";

/** The chosen type, kept in the address (?type=…) so reloads and links keep it. undefined = not read yet. */
export function useWordSearchType(): [WordSearchKind | null | undefined, (k: WordSearchKind | null) => void] {
  const [kind, setKindState] = useState<WordSearchKind | null | undefined>(undefined);
  useEffect(() => {
    const read = () => {
      const t = new URLSearchParams(window.location.search).get("type");
      setKindState(t === "mystery" || t === "classic" ? t : null);
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  const setKind = (k: WordSearchKind | null) => {
    const url = new URL(window.location.href);
    if (k) url.searchParams.set("type", k);
    else url.searchParams.delete("type");
    window.history.pushState(null, "", url.toString());
    setKindState(k);
    window.scrollTo({ top: 0 });
  };
  return [kind, setKind];
}

export default function WordSearchType({ onPick, ready }: { onPick: (k: WordSearchKind) => void; ready: boolean }) {
  return (
    <div className="container pb-4">
      <PageHeader icon={<BsSearch />} title="Word Search" lead="Pick the kind of word search book you want to make." />
      <div className="pg-card pg-wizard-card" data-question="type">
        <div className="pg-card-body">
          <div className="pg-q wide">
            <h2 className="pg-q-title">What type of word search?</h2>
            <p className="pg-q-lead">You can switch type at any time from the top of the page.</p>
            <div className="pg-q-body pg-ws-types" aria-busy={!ready}>
              <ChoiceCards<Pick>
                label="Word search type"
                cols={2}
                onPick={(v) => (v === "mystery" || v === "classic") && onPick(v)}
                options={[
                  { value: "mystery", title: "Murder Mystery Word Search", text: "Every puzzle is a case file: find the evidence, read the hidden message, name the culprit and crack the final case.", icon: <BsIncognito />, testId: "ws-type-mystery", badge: "New", cta: "Open a case" },
                  { value: "classic", title: "Classic word search", text: "Themed word lists, any size, shapes and animals, 1 to 20,000 puzzles. Everything you know.", icon: <BsGrid3X3Gap />, testId: "ws-type-classic", cta: "Start" },
                  { value: "picture", title: "Hidden picture", text: "Shade the found words to reveal a picture.", icon: <BsImage />, testId: "ws-type-picture", badge: "Coming soon", cta: "Coming soon", disabled: true },
                  { value: "cipher", title: "Secret code", text: "Words hidden in a letter-swap code that solvers crack first.", icon: <BsKey />, testId: "ws-type-cipher", badge: "Coming soon", cta: "Coming soon", disabled: true },
                ]}
              />
            </div>
          </div>
        </div>
        <div className="pg-wizard-footer no-print">
          <Link href="/" className="btn btn-light" data-testid="wizard-back">
            <BsArrowLeft /> Back
          </Link>
        </div>
      </div>
    </div>
  );
}
