import type { ChallengeLabel } from "./experimentChallengeBook";
import type { Prospect, RankedProspect } from "./types";

export const AI_RANKING_STRATEGIES = [
  "revenue_scout",
  "trust_gate",
  "campaign_strategist",
] as const;

export type AiRankingStrategy = (typeof AI_RANKING_STRATEGIES)[number];
export type RankingStrategy = "deterministic" | AiRankingStrategy;

/** Full candidate used by the Lab UI and deterministic arm. */
export type RankingCandidate = {
  id: string;
  name: string;
  company?: string;
  title?: string;
  segment?: string;
  source?: string;
  lastTouch?: string;
  notes?: string;
  estimatedValue?: string;
  baselineRank: number;
  baselineScore: number;
  opportunity: number;
  reachability: number;
  evidenceConfidence: number;
  tags: string[];
};

/** Fields sent to AI arms — no baseline ranks/scores so models cannot shadow rules. */
export type FairAiCandidate = {
  id: string;
  name: string;
  company?: string;
  title?: string;
  segment?: string;
  source?: string;
  lastTouch?: string;
  notes?: string;
  estimatedValue?: string;
  phonePresent: boolean;
  emailPresent: boolean;
};

export type ExperimentPick = {
  prospectId: string;
  score: number;
  reason: string;
  evidenceQuote: string;
};

export type RankingExperimentResult = {
  strategy: RankingStrategy;
  label: string;
  objective: string;
  picks: ExperimentPick[];
  model?: string;
  grounding: string;
};

export type RankingMetrics = {
  averageOpportunity: number;
  averageReachability: number;
  averageEvidence: number;
  weakFilePicks: number;
  baselineOverlap: number;
};

export type ChallengeScorecard = {
  preferredHits: number;
  verifyLeaks: number;
  waitLeaks: number;
  excludeLeaks: number;
  keywordMissRecoveries: number;
  timingTrapMistakes: number;
  labeledPicks: number;
};

export const STRATEGY_META: Record<
  RankingStrategy,
  { label: string; shortLabel: string; objective: string }
> = {
  deterministic: {
    label: "Current deterministic rules",
    shortLabel: "Rules",
    objective:
      "Fixed opportunity and reachability weights, then a small diversity adjustment.",
  },
  revenue_scout: {
    label: "AI: Revenue scout",
    shortLabel: "Revenue",
    objective:
      "Prioritize the strongest commercially specific reason to act now.",
  },
  trust_gate: {
    label: "AI: Trust gate",
    shortLabel: "Trust",
    objective:
      "Prefer records whose recommendation is easiest to defend from the file.",
  },
  campaign_strategist: {
    label: "AI: Campaign strategist",
    shortLabel: "Portfolio",
    objective:
      "Build a varied, finishable campaign instead of ten versions of the same call.",
  },
};

export const EXPERIMENT_SHORTLIST_SIZE = 50;
export const EXPERIMENT_PICK_COUNT = 10;

export function isEligibleForExperiment(p: RankedProspect) {
  return (
    p.silenceBucket !== "do_not_cold_call" &&
    Boolean(p.phone || p.email)
  );
}

export function buildRankingCandidates(
  ranked: RankedProspect[],
  evidenceConfidence: Record<string, number>,
  limit = EXPERIMENT_SHORTLIST_SIZE,
): RankingCandidate[] {
  return ranked
    .filter(isEligibleForExperiment)
    .slice(0, limit)
    .map((p, index) => ({
      id: p.id,
      name: p.name,
      company: p.company,
      title: p.title,
      segment: p.segment,
      source: p.source,
      lastTouch: p.lastTouch,
      notes: p.notes,
      estimatedValue: p.estimatedValue,
      baselineRank: index + 1,
      baselineScore: p.score,
      opportunity: p.opportunity,
      reachability: p.reachability,
      evidenceConfidence: evidenceConfidence[p.id] ?? 0,
      tags: p.tags.map((tag) => tag.label),
    }));
}

/** Strip scores/ranks before sending candidates to AI ranking arms. */
export function toFairAiCandidates(
  candidates: RankingCandidate[],
  rankedById: Map<string, RankedProspect>,
): FairAiCandidate[] {
  return candidates.map((candidate) => {
    const full = rankedById.get(candidate.id);
    return {
      id: candidate.id,
      name: candidate.name,
      company: candidate.company,
      title: candidate.title,
      segment: candidate.segment,
      source: candidate.source,
      lastTouch: candidate.lastTouch,
      notes: candidate.notes,
      estimatedValue: candidate.estimatedValue,
      phonePresent: Boolean(full?.phone),
      emailPresent: Boolean(full?.email),
    };
  });
}

export function buildDeterministicResult(
  candidates: RankingCandidate[],
  count = EXPERIMENT_PICK_COUNT,
  selectedIds?: string[],
): RankingExperimentResult {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const ordered = selectedIds?.length
    ? selectedIds
        .map((id) => byId.get(id))
        .filter((candidate): candidate is RankingCandidate => Boolean(candidate))
    : candidates;
  return {
    strategy: "deterministic",
    ...STRATEGY_META.deterministic,
    picks: ordered.slice(0, count).map((candidate) => ({
      prospectId: candidate.id,
      score: candidate.baselineScore,
      reason:
        candidate.notes?.trim() ||
        `${candidate.title ?? "Contact"} at ${candidate.company ?? "company not recorded"}`,
      evidenceQuote:
        candidate.notes?.trim() ||
        candidate.company ||
        candidate.title ||
        candidate.name,
    })),
    grounding: "Deterministic safety and scoring rules",
  };
}

export function normalizeExperimentPicks(
  picks: ExperimentPick[],
  candidates: RankingCandidate[],
  count = EXPERIMENT_PICK_COUNT,
) {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const seen = new Set<string>();
  const valid: ExperimentPick[] = [];

  for (const pick of picks) {
    const candidate = byId.get(pick.prospectId);
    if (!candidate || seen.has(pick.prospectId)) continue;
    seen.add(pick.prospectId);
    valid.push({
      ...pick,
      score: Math.max(0, Math.min(100, Math.round(pick.score))),
      reason: pick.reason.trim() || "Selected from the safe candidate set.",
      evidenceQuote: groundedQuote(pick.evidenceQuote, candidate)
        ? pick.evidenceQuote.trim()
        : candidate.notes?.trim() ||
          candidate.company ||
          candidate.title ||
          candidate.name,
    });
    if (valid.length === count) break;
  }

  for (const candidate of candidates) {
    if (valid.length === count) break;
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    valid.push({
      prospectId: candidate.id,
      score: candidate.baselineScore,
      reason: "Filled from the deterministic order because the AI omitted this slot.",
      evidenceQuote:
        candidate.notes?.trim() ||
        candidate.company ||
        candidate.title ||
        candidate.name,
    });
  }

  return valid;
}

export function calculateRankingMetrics(
  result: RankingExperimentResult,
  candidates: RankingCandidate[],
  baselineIds: string[],
): RankingMetrics {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const selected = result.picks
    .map((pick) => byId.get(pick.prospectId))
    .filter((candidate): candidate is RankingCandidate => Boolean(candidate));
  const average = (values: number[]) =>
    values.length
      ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
      : 0;

  return {
    averageOpportunity: average(selected.map((p) => p.opportunity)),
    averageReachability: average(selected.map((p) => p.reachability)),
    averageEvidence: average(selected.map((p) => p.evidenceConfidence)),
    weakFilePicks: selected.filter(
      (p) => p.tags.includes("Thin file") || p.evidenceConfidence < 50,
    ).length,
    baselineOverlap: selected.filter((p) => baselineIds.includes(p.id)).length,
  };
}

export function calculateChallengeScorecard(
  result: RankingExperimentResult,
  labels: Map<string, ChallengeLabel>,
): ChallengeScorecard {
  let preferredHits = 0;
  let verifyLeaks = 0;
  let waitLeaks = 0;
  let excludeLeaks = 0;
  let keywordMissRecoveries = 0;
  let timingTrapMistakes = 0;
  let labeledPicks = 0;

  for (const pick of result.picks) {
    const label = labels.get(pick.prospectId);
    if (!label) continue;
    labeledPicks += 1;
    if (label.expectedAction === "call_now") preferredHits += 1;
    if (label.expectedAction === "verify_first") verifyLeaks += 1;
    if (label.expectedAction === "wait") waitLeaks += 1;
    if (label.expectedAction === "exclude") excludeLeaks += 1;
    if (
      label.trapType === "keyword_miss" &&
      label.expectedAction === "call_now"
    ) {
      keywordMissRecoveries += 1;
    }
    if (label.trapType === "timing_trap" && label.expectedAction === "wait") {
      timingTrapMistakes += 1;
    }
  }

  return {
    preferredHits,
    verifyLeaks,
    waitLeaks,
    excludeLeaks,
    keywordMissRecoveries,
    timingTrapMistakes,
    labeledPicks,
  };
}

export function prospectSourceValues(
  prospect: Pick<
    Prospect,
    | "name"
    | "company"
    | "title"
    | "segment"
    | "source"
    | "lastTouch"
    | "notes"
    | "estimatedValue"
  >,
) {
  return [
    prospect.name,
    prospect.company,
    prospect.title,
    prospect.segment,
    prospect.source,
    prospect.lastTouch,
    prospect.notes,
    prospect.estimatedValue,
  ].filter((value): value is string => Boolean(value?.trim()));
}

function groundedQuote(quote: string, candidate: RankingCandidate) {
  const needle = quote.trim().toLowerCase();
  if (!needle) return false;
  return prospectSourceValues(candidate).some((value) =>
    value.toLowerCase().includes(needle),
  );
}
