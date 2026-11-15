/**
 * BEDROCK_MOCK=1: a stand-in model that answers from our own templates, so the whole
 * AI flow (outline, batches, repair, review, PDF) can be tested without AWS.
 * On the first pass it returns one broken case, to exercise the repair round.
 */
import { SETTINGS, scaffoldBook, TEMPLATE_CAST } from "../mystery/templates";
import type { Llm } from "./bedrock";
import type { GenerateRequest } from "./schema";

export function mockLlm(req: GenerateRequest, opts: { breakCase?: number; delayMs?: number } = {}): Llm {
  const seed = req.seed ?? 7;
  const ids = SETTINGS.find((s) => s.id === req.setting) ? [req.setting] : [SETTINGS[seed % SETTINGS.length].id, SETTINGS[(seed + 3) % SETTINGS.length].id];
  const book = scaffoldBook({ settings: ids, count: req.caseCount, seed });
  const broken = new Set<number>([opts.breakCase ?? 2]);
  let regen = 0;
  const usage = (p: string) => ({ inputTokens: Math.round(p.length / 4), outputTokens: 0 });
  return async (r) => {
    if (opts.delayMs) await new Promise((res) => setTimeout(res, opts.delayMs));
    if (r.tool.name === "write_outline") {
      const input = {
        title: book.title === "The Case Files" ? "The Lantern Ledger" : book.title,
        intro: "A string of small crimes across town all lead back to one ledger. Solve each case and keep its key letter.",
        cast: TEMPLATE_CAST.map((p) => ({ name: p.name, role: p.role, traits: p.traits.slice(0, 4) })),
        mastermind: TEMPLATE_CAST[0].name,
        finalAnswer: req.storyline ? (req.caseCount >= 11 ? "CASE CLOSED" : "SOLVED".slice(0, Math.max(0, req.caseCount))) : "",
        finaleQuestion: "Who kept the ledger?",
        epilogue: `It was ${TEMPLATE_CAST[0].name} all along, writing every move in the ledger.`,
        cases: book.cases.map((c) => ({ title: c.title, culprit: c.culprit ?? TEMPLATE_CAST[0].name, premise: c.story })),
      };
      return { input, usage: { ...usage(r.prompt), outputTokens: 60 * req.caseCount + 400 }, ms: 5 };
    }
    const m = r.prompt.match(/Write cases (\d+) to (\d+)/);
    const from = Number(m?.[1] ?? 1);
    const to = Number(m?.[2] ?? from);
    const fresh = /fresh version/.test(r.prompt);
    if (fresh) regen++;
    const cases = [];
    for (let i = from; i <= to; i++) {
      const c = book.cases[(i - 1 + (fresh ? regen * 5 : 0)) % book.cases.length];
      const bad = broken.has(i) && !/previous version/.test(r.prompt);
      cases.push({
        index: i,
        title: fresh ? `${c.title} Revisited` : c.title,
        story: c.story,
        // The broken one: too few usable words (forces a rewrite).
        words: bad ? ["A", "BB", "EXTRAORDINARILY", "CLUE", "CLUES", "KEY", "MAP", "INK"] : c.words.slice(0, 12),
        missing: c.missing ?? { word: "LEDGER", clue: "Where every move was written down" },
        suspects: c.suspects,
        culprit: c.culprit ?? c.suspects[0],
        lead: c.lead ?? "",
      });
    }
    return { input: { cases }, usage: { ...usage(r.prompt), outputTokens: 300 * cases.length }, ms: 5 };
  };
}
