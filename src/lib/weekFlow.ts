import type { Outcome, RankedProspect } from "./types";

export type NextWeekMode = "leftovers" | "same_theme" | "fresh";

export const WEEK_BUDGET_MIN = 1;
export const WEEK_BUDGET_MAX = 40;
export const WEEK_BUDGET_CHIPS = [5, 10, 15, 20] as const;

export function clampWeekBudget(n: number): number {
  if (!Number.isFinite(n)) return 10;
  return Math.max(WEEK_BUDGET_MIN, Math.min(WEEK_BUDGET_MAX, Math.round(n)));
}

/** Done for reactivation purposes — leave out of next week. */
export function isTerminalOutcome(outcome: Outcome): boolean {
  return outcome === "do_not_contact" || outcome === "sale";
}

/** Worth putting back near the top of next week. */
export function isFollowUpOutcome(outcome: Outcome): boolean {
  return outcome === "not_now" || outcome === "called" || outcome === "skip";
}

export function outcomeOf(
  id: string,
  outcomes: Record<string, Outcome>,
  fallback: Outcome = "queued",
): Outcome {
  return outcomes[id] ?? fallback;
}

export function partitionWeekOutcomes(
  rows: RankedProspect[],
  outcomes: Record<string, Outcome>,
) {
  const won: RankedProspect[] = [];
  const park: RankedProspect[] = [];
  const remove: RankedProspect[] = [];
  const open: RankedProspect[] = [];

  for (const p of rows) {
    const o = outcomeOf(p.id, outcomes, p.outcome);
    if (o === "meeting" || o === "sale") won.push(p);
    else if (o === "do_not_contact" || o === "wrong_number") remove.push(p);
    else if (o === "queued") open.push(p);
    else park.push(p);
  }

  return { won, park, remove, open };
}

export function countOutcomes(
  rows: RankedProspect[],
  outcomes: Record<string, Outcome>,
): Partial<Record<Outcome, number>> {
  const counts: Partial<Record<Outcome, number>> = {};
  for (const p of rows) {
    const o = outcomeOf(p.id, outcomes, p.outcome);
    counts[o] = (counts[o] ?? 0) + 1;
  }
  return counts;
}

/** Order candidates for a leftovers-first next week. */
export function orderForNextWeek(
  ranked: RankedProspect[],
  outcomes: Record<string, Outcome>,
  previousWeekIds: string[],
): RankedProspect[] {
  const prev = new Set(previousWeekIds);
  const eligible = ranked.filter((p) => {
    const o = outcomeOf(p.id, outcomes, p.outcome);
    if (isTerminalOutcome(o)) return false;
    if (p.silenceBucket === "do_not_cold_call") return false;
    if (!p.phone && !p.email) return false;
    return true;
  });

  const scoreBucket = (p: RankedProspect) => {
    const o = outcomeOf(p.id, outcomes, p.outcome);
    if (isFollowUpOutcome(o)) return 0;
    if (prev.has(p.id) && o === "queued") return 1;
    if (prev.has(p.id)) return 2;
    return 3;
  };

  return [...eligible].sort((a, b) => {
    const bucket = scoreBucket(a) - scoreBucket(b);
    if (bucket) return bucket;
    return b.score - a.score;
  });
}

export function rankedExportRows(
  ranked: RankedProspect[],
  outcomes: Record<string, Outcome>,
) {
  return ranked.map((p, index) => ({
    rank: index + 1,
    name: p.name,
    company: p.company ?? "",
    title: p.title ?? "",
    phone: p.phone ?? "",
    email: p.email ?? "",
    silence: p.silenceBucket,
    score: p.score,
    opportunity: p.opportunity,
    reachability: p.reachability,
    why_call: p.whyCall,
    tags: p.tags.map((t) => t.label).join(" | "),
    outcome: outcomeOf(p.id, outcomes, p.outcome),
    last_touch: p.lastTouch ?? "",
    notes: p.notes ?? "",
  }));
}

export function weekExportRows(
  rows: RankedProspect[],
  outcomes: Record<string, Outcome>,
  talkEdits: Record<string, string>,
) {
  return rows.map((p) => ({
    name: p.name,
    company: p.company ?? "",
    phone: p.phone ?? "",
    email: p.email ?? "",
    outcome: outcomeOf(p.id, outcomes, p.outcome),
    why_call: p.whyCall,
    tags: p.tags.map((t) => t.label).join(" | "),
    notes: p.notes ?? "",
    talk_track: talkEdits[p.id] ?? p.talkTrack,
  }));
}

export function leftoversExportRows(
  ranked: RankedProspect[],
  outcomes: Record<string, Outcome>,
  previousWeekIds: string[],
) {
  const ordered = orderForNextWeek(ranked, outcomes, previousWeekIds);
  return ordered.map((p, index) => ({
    priority: index + 1,
    name: p.name,
    company: p.company ?? "",
    phone: p.phone ?? "",
    email: p.email ?? "",
    prior_outcome: outcomeOf(p.id, outcomes, p.outcome),
    why_call: p.whyCall,
    tags: p.tags.map((t) => t.label).join(" | "),
    silence: p.silenceBucket,
    score: p.score,
    notes: p.notes ?? "",
  }));
}
