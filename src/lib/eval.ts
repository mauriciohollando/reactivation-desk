import { rankProspects } from "./rank";
import { buildDemoAdvisorBook } from "./demoBook";
import type { Prospect } from "./types";

/** Labeled “should prioritize” ids inside the demo book for eval. */
export function labeledPriorityIds(book: Prospect[]): Set<string> {
  const ranked = rankProspects(book, {});
  const labels = ranked
    .filter(
      (p) =>
        p.opportunity >= 60 &&
        p.reachability >= 50 &&
        p.silenceBucket !== "do_not_cold_call" &&
        (Boolean(p.notes) || Boolean(p.segment)),
    )
    .slice(0, 18)
    .map((p) => p.id);
  return new Set(labels);
}

export function precisionAtK(
  orderedIds: string[],
  relevant: Set<string>,
  k: number,
): number {
  const top = orderedIds.slice(0, k);
  if (!top.length) return 0;
  const hits = top.filter((id) => relevant.has(id)).length;
  return hits / k;
}

export function runDemoEval(k = 10) {
  const book = buildDemoAdvisorBook();
  const relevant = labeledPriorityIds(book);

  const modelOrder = rankProspects(book, {}).map((p) => p.id);

  const randomOrder = [...book.map((p) => p.id)].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );

  const recencyOrder = [...book]
    .map((p) => ({
      id: p.id,
      days: p.lastTouch ? Date.parse(p.lastTouch) : 0,
    }))
    .sort((a, b) => b.days - a.days)
    .map((p) => p.id);

  return {
    k,
    relevantCount: relevant.size,
    model: precisionAtK(modelOrder, relevant, k),
    recency: precisionAtK(recencyOrder, relevant, k),
    random: precisionAtK(randomOrder, relevant, k),
  };
}
