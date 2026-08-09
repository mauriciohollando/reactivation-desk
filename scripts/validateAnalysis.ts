import { performance } from "node:perf_hooks";
import {
  analyzeBookLocally,
  balancedCallable,
  buildBookPatterns,
} from "../src/lib/analysisEngine";
import { rankProspects } from "../src/lib/rank";
import { buildSyntheticBook } from "../src/lib/syntheticBook";

const started = performance.now();
const ranked = rankProspects(buildSyntheticBook(1050), {});
const analyses = analyzeBookLocally(ranked);
const patterns = buildBookPatterns(ranked, analyses);
const week = balancedCallable(ranked, analyses, 20);
const elapsed = Math.round(performance.now() - started);

if (ranked.length !== 1050) throw new Error(`Expected 1050 ranked rows, got ${ranked.length}`);
if (Object.keys(analyses).length !== 1050) {
  throw new Error(`Expected 1050 analyses, got ${Object.keys(analyses).length}`);
}
if (week.length !== 20) throw new Error(`Expected a 20-person week, got ${week.length}`);
if (!week.every((p) => p.silenceBucket !== "do_not_cold_call")) {
  throw new Error("A do-not-cold-call record entered the weekly list");
}
if (!week.every((p) => analyses[p.id]?.nextAction !== "do_not_contact")) {
  throw new Error("A do-not-contact action entered the weekly list");
}
if (!patterns.length) throw new Error("Expected portfolio patterns");

console.log(
  JSON.stringify(
    {
      rows: ranked.length,
      analyses: Object.keys(analyses).length,
      week: week.length,
      patterns: patterns.map((p) => `${p.label}: ${p.count}`),
      elapsedMs: elapsed,
    },
    null,
    2,
  ),
);
