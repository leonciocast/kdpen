/** Editable title page + copyright page content, shared by all puzzle tools. */

export interface FrontMatter {
  title: string;
  subtitle: string;
  author: string;
  imprint: string;
  year: string;
  edition: string;
  isbn: string;
  /** Copyright text. Tokens {year}, {author} and {imprint} are filled in. */
  notice: string;
  dedication: string;
  website: string;
}

export const DEFAULT_NOTICE = [
  "© {year} {author}. All rights reserved.",
  "No part of this publication may be reproduced, stored in a retrieval system, or transmitted in any form or by any means, electronic, mechanical, photocopying, recording, or otherwise, without the prior written permission of the publisher, except for brief quotations used in reviews.",
  "The puzzles in this book are intended for personal use. The purchaser may photocopy puzzle pages for their own personal, non-commercial use only.",
].join("\n\n");

export const DEFAULT_FRONT_MATTER: FrontMatter = {
  title: "Word Search Puzzle Book",
  subtitle: "Large Print Puzzles for Relaxing Fun",
  author: "Your Name",
  imprint: "Your Imprint",
  year: "2026",
  edition: "First Edition",
  isbn: "",
  notice: DEFAULT_NOTICE,
  dedication: "",
  website: "",
};

export const FRONT_MATTER_STORAGE_KEY = "puzzle-generator.front-matter.v1";

/** Copyright text with {year}, {author} and {imprint} filled in. */
export function resolveNotice(fm: FrontMatter): string {
  const author = fm.author.trim() || fm.imprint.trim() || "the author";
  return (fm.notice || DEFAULT_NOTICE)
    .replace(/\{year\}/g, fm.year.trim() || String(new Date().getFullYear()))
    .replace(/\{author\}/g, author)
    .replace(/\{imprint\}/g, fm.imprint.trim() || author);
}

/** Lines shown under the notice on the copyright page (empty fields are skipped). */
export function copyrightDetails(fm: FrontMatter): string[] {
  const out: string[] = [];
  if (fm.edition.trim()) out.push(fm.edition.trim());
  if (fm.isbn.trim()) out.push(`ISBN ${fm.isbn.trim()}`);
  // No imprint means you publish under your own name, so the author is the publisher (never a placeholder).
  const author = fm.author.trim();
  const publisher = fm.imprint.trim() || (author !== DEFAULT_FRONT_MATTER.author ? author : "");
  if (publisher) out.push(`Published by ${publisher}`);
  if (fm.website.trim()) out.push(fm.website.trim());
  return out;
}

/** Loose ISBN-10/13 shape check (digits, hyphens, spaces, optional X). Empty is fine. */
export function isbnLooksValid(isbn: string): boolean {
  const s = isbn.replace(/[\s-]/g, "");
  if (!s) return true;
  return /^(\d{9}[\dXx]|\d{13})$/.test(s);
}

/** Merge stored JSON over defaults, ignoring unknown or non-string fields. */
export function parseStoredFrontMatter(raw: string | null, defaults: FrontMatter = DEFAULT_FRONT_MATTER): FrontMatter {
  if (!raw) return { ...defaults };
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out = { ...defaults };
    (Object.keys(defaults) as (keyof FrontMatter)[]).forEach((k) => {
      if (typeof obj[k] === "string") out[k] = obj[k] as string;
    });
    return out;
  } catch {
    return { ...defaults };
  }
}
