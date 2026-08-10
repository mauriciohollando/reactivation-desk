import assert from "node:assert/strict";
import {
  analyzeBookLocally,
  balancedCallable,
} from "../src/lib/analysisEngine";
import { buildDemoAdvisorBook } from "../src/lib/demoBook";
import { rankProspects } from "../src/lib/rank";
import {
  buildDeterministicResult,
  buildRankingCandidates,
  normalizeExperimentPicks,
} from "../src/lib/rankingExperiment";

const ranked = rankProspects(buildDemoAdvisorBook());
const analyses = analyzeBookLocally(ranked);
const candidates = buildRankingCandidates(
  ranked,
  Object.fromEntries(
    Object.entries(analyses).map(([id, analysis]) => [
      id,
      analysis.evidenceConfidence,
    ]),
  ),
);
const currentSelection = balancedCallable(ranked, analyses, 10).map(
  (prospect) => prospect.id,
);
const baseline = buildDeterministicResult(candidates, 10, currentSelection);

assert.equal(baseline.picks.length, 10, "baseline should return ten picks");
assert.deepEqual(
  baseline.picks.map((pick) => pick.prospectId),
  currentSelection,
  "baseline arm should mirror the current product selection",
);
assert.ok(
  baseline.picks.every((pick) =>
    candidates.some((candidate) => candidate.id === pick.prospectId),
  ),
  "all baseline picks must come from the eligible candidate set",
);

const normalized = normalizeExperimentPicks(
  [
    {
      prospectId: candidates[1]!.id,
      score: 120,
      reason: "Preferred",
      evidenceQuote: "invented evidence",
    },
    {
      prospectId: candidates[1]!.id,
      score: 80,
      reason: "Duplicate should be removed",
      evidenceQuote: candidates[1]!.name,
    },
    {
      prospectId: "unsafe-or-invented-id",
      score: 99,
      reason: "Must be removed",
      evidenceQuote: "none",
    },
  ],
  candidates,
  10,
);

assert.equal(normalized.length, 10, "normalization should fill omitted slots");
assert.equal(
  new Set(normalized.map((pick) => pick.prospectId)).size,
  10,
  "normalized picks must be unique",
);
assert.ok(
  normalized.every((pick) =>
    candidates.some((candidate) => candidate.id === pick.prospectId),
  ),
  "AI output cannot introduce an ineligible ID",
);
assert.equal(normalized[0]!.score, 100, "scores should be clamped");
assert.notEqual(
  normalized[0]!.evidenceQuote,
  "invented evidence",
  "ungrounded evidence should be replaced with file evidence",
);

console.log(
  `Ranking experiment checks passed: ${candidates.length} eligible candidates, ${baseline.picks.length} baseline picks.`,
);
