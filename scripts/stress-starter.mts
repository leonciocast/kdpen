// Stress the Saltmere starter story: every case, every setting combo, many seeds.
// Usage: SHARD=i SHARDS=n SEEDS=200 SLOW=1 SHAPES=0 npx tsx scripts/stress-starter.mts
// SLOW=k makes the clock run k times faster (simulates a k-times slower device).
import { SALTMERE, starterCases, phraseFor } from "../src/lib/mystery/starter";
import { buildCase, planBook } from "../src/lib/mystery/model";
import { MYSTERY_SHAPES, SHAPE_KEYS } from "../src/lib/shapes/shapes";
import type { MysterySettings } from "../src/lib/mystery/types";

const SHARD = Number(process.env.SHARD ?? 0), SHARDS = Number(process.env.SHARDS ?? 1);
const SEEDS = Number(process.env.SEEDS ?? 200), SLOW = Number(process.env.SLOW ?? 1);
const SHAPES = process.env.SHAPES === "1" || process.env.SHAPES === "all";
const SHAPE_LIST: readonly string[] = process.env.SHAPES === "all" ? SHAPE_KEYS : MYSTERY_SHAPES;
if (SLOW > 1) {
  const real = Date.now.bind(Date), t0 = real();
  Date.now = () => t0 + (real() - t0) * SLOW;
}
const UI_SEED = 20261115;
type Job = { label: string; spec: (typeof SALTMERE.cases)[number]; num: number; target: { letter: string; box: number } | null; st: MysterySettings; seed: number; shape?: string };
const jobs: Job[] = [];
const diffs = ["easy", "medium", "hard"] as const;
for (const count of [6, 12, 18, 24]) for (const difficulty of diffs) for (const hiddenMessage of [true, false]) for (const missingEvidence of [true, false]) for (const storyline of [true, false]) {
  const st: MysterySettings = { difficulty, hiddenMessage, missingEvidence, storyline, style: "dossier" };
  const cases = starterCases(count);
  const plan = planBook(SALTMERE, cases, phraseFor(cases.length), st);
  plan.cases.forEach((spec, i) => {
    const base = `n${count} ${difficulty} hm${+hiddenMessage} me${+missingEvidence} sl${+storyline} case${i + 1}`;
    // The exact seed the app uses, then many others (fewer for repeated specs: storyline doesn't touch the grid).
    const seeds = [UI_SEED + i * 101, ...(storyline && count === 24 ? Array.from({ length: SEEDS }, (_, s) => 1000 + s * 7919) : [])];
    for (const seed of seeds) {
      if (!SHAPES) jobs.push({ label: base, spec, num: i + 1, target: plan.targets[i], st, seed });
    }
    if (SHAPES && storyline && count === 24) for (const shape of SHAPE_LIST) for (const seed of [UI_SEED + i * 101, 77 + i]) jobs.push({ label: base + " " + shape, spec, num: i + 1, target: plan.targets[i], st, seed, shape });
  });
}
const CASE = process.env.CASE ? Number(process.env.CASE) : 0;
const mine = jobs.filter((j) => !CASE || j.num === CASE).filter((_, k) => k % SHARDS === SHARD);
let fails = 0, squareFallback = 0, blanks = 0, slowest = 0;
const t0 = performance.now();
for (const j of mine) {
  const t = performance.now();
  try {
    const b = buildCase(j.spec, j.num, SALTMERE.cast, j.target, { settings: j.st, seed: j.seed, shape: j.shape as never });
    if (b.warnings.some((w) => /square grid/.test(w))) squareFallback++;
    if (b.warnings.some((w) => /empty square/.test(w))) blanks++;
  } catch (e) {
    fails++;
    console.log(`FAIL ${j.label} seed=${j.seed}: ${(e as Error).message}`);
  }
  slowest = Math.max(slowest, performance.now() - t);
}
console.log(`RESULT shard=${SHARD} runs=${mine.length} fails=${fails} squareFallback=${squareFallback} blanks=${blanks} slowestMs=${slowest.toFixed(0)} totalS=${((performance.now() - t0) / 1000).toFixed(0)}`);
