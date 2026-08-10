import assert from "node:assert/strict";
import {
  analyzeBookLocally,
  balancedCallable,
} from "../src/lib/analysisEngine";
import { buildDemoAdvisorBook } from "../src/lib/demoBook";
import {
  buildExperimentChallengeBook,
  challengeLabelMap,
} from "../src/lib/experimentChallengeBook";
import { rankProspects } from "../src/lib/rank";
import {
  EXPERIMENT_PICK_COUNT,
  EXPERIMENT_SHORTLIST_SIZE,
  buildDeterministicResult,
  buildRankingCandidates,
  calculateChallengeScorecard,
  normalizeExperimentPicks,
  toFairAiCandidates,
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
  EXPERIMENT_SHORTLIST_SIZE,
);
const currentSelection = balancedCallable(
  ranked,
  analyses,
  EXPERIMENT_PICK_COUNT,
).map((prospect) => prospect.id);
const baseline = buildDeterministicResult(
  candidates,
  EXPERIMENT_PICK_COUNT,
  currentSelection,
);

assert.ok(candidates.length >= 5, "shortlist should have eligible candidates");
assert.ok(
  candidates.length <= EXPERIMENT_SHORTLIST_SIZE,
  "shortlist should not exceed experiment cap",
);
assert.equal(
  baseline.picks.length,
  EXPERIMENT_PICK_COUNT,
  "baseline should return ten picks",
);
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

const fair = toFairAiCandidates(
  candidates,
  new Map(ranked.map((prospect) => [prospect.id, prospect])),
);
assert.equal(fair.length, candidates.length);
assert.ok(
  fair.every(
    (candidate) =>
      !("baselineRank" in candidate) &&
      !("baselineScore" in candidate) &&
      !("opportunity" in candidate),
  ),
  "fair AI payload must omit baseline ranks and scores",
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
  EXPERIMENT_PICK_COUNT,
);

assert.equal(
  normalized.length,
  EXPERIMENT_PICK_COUNT,
  "normalization should fill omitted slots",
);
assert.equal(
  new Set(normalized.map((pick) => pick.prospectId)).size,
  EXPERIMENT_PICK_COUNT,
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

const challenge = buildExperimentChallengeBook();
const challengeRanked = rankProspects(challenge.prospects);
const challengeCandidates = buildRankingCandidates(
  challengeRanked,
  Object.fromEntries(
    Object.entries(analyzeBookLocally(challengeRanked)).map(([id, analysis]) => [
      id,
      analysis.evidenceConfidence,
    ]),
  ),
  EXPERIMENT_SHORTLIST_SIZE,
);
assert.ok(
  challengeCandidates.length >= 40,
  "challenge set should produce a large eligible shortlist",
);
assert.ok(
  challenge.labels.every((label) =>
    challenge.prospects.some((prospect) => prospect.id === label.prospectId),
  ),
  "every challenge label must map to a prospect",
);
const scorecard = calculateChallengeScorecard(
  buildDeterministicResult(challengeCandidates, EXPERIMENT_PICK_COUNT),
  challengeLabelMap(challenge.labels),
);
assert.ok(scorecard.labeledPicks >= 0);

console.log(
  `Ranking experiment checks passed: ${candidates.length} demo eligible, ${challengeCandidates.length} challenge eligible, ${baseline.picks.length} baseline picks.`,
);
