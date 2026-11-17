/** Murder-mystery word search: data model. */

export interface Trait {
  id: string;
  /** Short label for the suspect file, e.g. "wears glasses". */
  label: string;
}

export interface Person {
  name: string;
  role: string;
  /** Trait labels ("wears glasses"). */
  traits: string[];
}

export interface CaseSpec {
  title: string;
  story: string;
  /** Evidence list (hidden in the grid, shown on the page). */
  words: string[];
  /** Missing evidence: hidden in the grid but not listed. */
  missing?: { word: string; clue: string };
  /** Suspect names (looked up in the cast) — usually three. */
  suspects: string[];
  culprit?: string;
  /** Explicit hidden message (otherwise built from the culprit's unique trait). */
  message?: string;
  /** One line pointing to the next case. */
  lead?: string;
  /** True for cases assembled from templates. */
  templated?: boolean;
}

export interface Finale {
  /** The book-wide answer the Case Board spells. */
  phrase: string;
  question: string;
  /** Short solution text for the answers section. */
  epilogue: string;
}

export interface CaseBook {
  title: string;
  /** Short intro for the Case Board page. */
  intro: string;
  cast: Person[];
  cases: CaseSpec[];
  finale: Finale;
}

export type CaseStyle = "dossier" | "clean";

export interface MysterySettings {
  difficulty: "easy" | "medium" | "hard";
  hiddenMessage: boolean;
  missingEvidence: boolean;
  storyline: boolean;
  style: CaseStyle;
}

export const DEFAULT_MYSTERY_SETTINGS: MysterySettings = {
  difficulty: "medium",
  hiddenMessage: true,
  missingEvidence: true,
  storyline: true,
  style: "dossier",
};

/** Where a case's key letter comes from. */
export type KeySource = "first" | "last" | "missing" | "role" | "title";

export interface CaseKey {
  /** 1-based box on the Case Board. */
  box: number;
  letter: string;
  source: KeySource;
  /** 1-based letter position in the source (spaces skipped). */
  position: number;
  /** The position is past the source's first word, so the instruction says "skipping spaces". */
  spaced?: boolean;
}

/** A case ready to print (after the grid is built and checked). */
export interface MysteryCase {
  number: number;
  title: string;
  story: string;
  lead?: string;
  words: string[];
  missing?: { word: string; clue: string };
  suspects: Person[];
  culprit?: Person;
  /** The trait the message points to. */
  trait?: string;
  /** Printed message (with spaces), "" when there is none. */
  message: string;
  key?: CaseKey;
  templated?: boolean;
  /** Grid */
  size: number;
  mask: boolean[][] | null;
  grid: string[][];
  placements: { word: string; letters: string; row: number; col: number; dir: string }[];
  extra: { word: string; letters: string; row: number; col: number; dir: string } | null;
  messageCells: [number, number][];
  blanks: [number, number][];
  shape?: string;
}

export type MysteryItem =
  | { kind: "board"; title: string; intro: string; cast: Person[]; boxes: number; phrase: string; keys: { box: number; case: number; letter: string }[]; cases?: number }
  | { kind: "case"; case: MysteryCase }
  | { kind: "finale"; phrase: string; question: string; epilogue: string; boxes: number };
