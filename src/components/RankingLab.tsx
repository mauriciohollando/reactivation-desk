"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { balancedCallable } from "@/lib/analysisEngine";
import {
  buildExperimentChallengeBook,
  challengeLabelMap,
  type ChallengeLabel,
} from "@/lib/experimentChallengeBook";
import {
  AI_RANKING_STRATEGIES,
  EXPERIMENT_PICK_COUNT,
  EXPERIMENT_SHORTLIST_SIZE,
  buildDeterministicResult,
  buildRankingCandidates,
  calculateChallengeScorecard,
  calculateRankingMetrics,
  STRATEGY_META,
  toFairAiCandidates,
  type RankingExperimentResult,
  type RankingStrategy,
} from "@/lib/rankingExperiment";
import { useDesk } from "@/lib/store";

type ArmState = {
  status: "idle" | "running" | "complete" | "error";
  result?: RankingExperimentResult;
  error?: string;
};

type BookMode = "current" | "challenge";

const ALL_STRATEGIES: RankingStrategy[] = [
  "deterministic",
  ...AI_RANKING_STRATEGIES,
];

export function RankingLab() {
  const prospects = useDesk((state) => state.prospects);
  const sourceLabel = useDesk((state) => state.sourceLabel);
  const analyses = useDesk((state) => state.analyses);
  const rankedFn = useDesk((state) => state.ranked);
  const loadDemoBook = useDesk((state) => state.loadDemoBook);
  const loadProspects = useDesk((state) => state.loadProspects);
  const applyExperimentWeek = useDesk((state) => state.applyExperimentWeek);

  const [arms, setArms] = useState<Partial<Record<RankingStrategy, ArmState>>>({});
  const [armOrder, setArmOrder] = useState<RankingStrategy[]>(ALL_STRATEGIES);
  const [blind, setBlind] = useState(true);
  const [winner, setWinner] = useState<RankingStrategy | null>(null);
  const [trial, setTrial] = useState(0);
  const [bookMode, setBookMode] = useState<BookMode>("current");
  const [challengeLabels, setChallengeLabels] = useState<ChallengeLabel[]>([]);
  const [applied, setApplied] = useState(false);

  const ranked = useMemo(
    () => rankedFn(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prospects, rankedFn],
  );
  const rankedById = useMemo(
    () => new Map(ranked.map((prospect) => [prospect.id, prospect])),
    [ranked],
  );
  const labelMap = useMemo(
    () => challengeLabelMap(challengeLabels),
    [challengeLabels],
  );
  const candidates = useMemo(
    () =>
      buildRankingCandidates(
        ranked,
        Object.fromEntries(
          Object.entries(analyses).map(([id, analysis]) => [
            id,
            analysis.evidenceConfidence,
          ]),
        ),
        EXPERIMENT_SHORTLIST_SIZE,
      ),
    [ranked, analyses],
  );
  const currentSelection = useMemo(
    () =>
      balancedCallable(ranked, analyses, EXPERIMENT_PICK_COUNT).map(
        (prospect) => prospect.id,
      ),
    [ranked, analyses],
  );
  const baseline = useMemo(
    () =>
      buildDeterministicResult(candidates, EXPERIMENT_PICK_COUNT, currentSelection),
    [candidates, currentSelection],
  );

  const loadChallengeSet = () => {
    const { prospects: book, labels } = buildExperimentChallengeBook();
    loadProspects(
      book,
      "Experiment challenge set (disclosed synthetic · adversarial traps + controls)",
    );
    setChallengeLabels(labels);
    setBookMode("challenge");
    setArms({});
    setWinner(null);
    setTrial(0);
    setApplied(false);
  };

  const loadSampleForLab = () => {
    loadDemoBook();
    setChallengeLabels([]);
    setBookMode("current");
    setArms({});
    setWinner(null);
    setTrial(0);
    setApplied(false);
  };

  const runComparison = async () => {
    if (candidates.length < 5) return;
    setWinner(null);
    setBlind(true);
    setApplied(false);
    setTrial((value) => value + 1);
    setArmOrder(shuffle(ALL_STRATEGIES));
    setArms({
      deterministic: { status: "complete", result: baseline },
      revenue_scout: { status: "running" },
      trust_gate: { status: "running" },
      campaign_strategist: { status: "running" },
    });

    const fairCandidates = toFairAiCandidates(candidates, rankedById);

    await Promise.all(
      AI_RANKING_STRATEGIES.map(async (strategy) => {
        try {
          const response = await fetch("/api/ranking-experiment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              strategy,
              count: EXPERIMENT_PICK_COUNT,
              candidates: fairCandidates,
            }),
          });
          const body = (await response.json()) as {
            result?: RankingExperimentResult;
            error?: string;
          };
          if (!response.ok || !body.result) {
            throw new Error(body.error ?? `Ranking failed (${response.status})`);
          }
          setArms((current) => ({
            ...current,
            [strategy]: { status: "complete", result: body.result },
          }));
        } catch (error) {
          setArms((current) => ({
            ...current,
            [strategy]: {
              status: "error",
              error:
                error instanceof Error
                  ? error.message
                  : "This ranking arm failed.",
            },
          }));
        }
      }),
    );
  };

  const chooseWinner = (strategy: RankingStrategy) => {
    setWinner(strategy);
    setBlind(false);
  };

  const applyWinner = () => {
    if (!winner) return;
    const result = arms[winner]?.result;
    if (!result) return;
    applyExperimentWeek(
      result.picks.map((pick) => pick.prospectId),
      STRATEGY_META[winner].shortLabel,
    );
    setApplied(true);
  };

  const completed = Object.values(arms).filter(
    (arm) => arm?.status === "complete",
  ).length;
  const running = Object.values(arms).some((arm) => arm?.status === "running");
  const usingChallenge = bookMode === "challenge" && challengeLabels.length > 0;

  if (!prospects.length) {
    return (
      <main className="desk ranking-lab">
        <LabHeader />
        <section className="hero-empty">
          <p className="eyebrow">Ranking experiment</p>
          <h2>Load one book, test four decision policies</h2>
          <p>
            Use the adversarial challenge set for a fair AI-vs-rules test, or
            import any CSV in the product first and return here.
          </p>
          <div className="toolbar">
            <button className="btn primary lg" type="button" onClick={loadChallengeSet}>
              Load challenge set
            </button>
            <button className="btn" type="button" onClick={loadSampleForLab}>
              Use sample advisor book
            </button>
            <Link className="btn ghost" href="/">
              Import a CSV in the product
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="desk ranking-lab">
      <LabHeader />

      <section className="funnel-card lab-intro">
        <div>
          <p className="eyebrow">Decision-policy experiment</p>
          <h1>Which ranking would an advisor trust?</h1>
          <p className="sub">
            Same shortlist of up to {EXPERIMENT_SHORTLIST_SIZE} eligible records,
            same pick size ({EXPERIMENT_PICK_COUNT}), same model. AI arms do not
            receive baseline ranks or opportunity scores.
          </p>
          <p className="muted source-line">
            {sourceLabel} · {prospects.length} records · {candidates.length} eligible
            shortlist
            {usingChallenge ? " · challenge labels active" : ""}
          </p>
        </div>
        <div className="lab-run">
          <button
            className="btn ai-btn lg"
            type="button"
            onClick={() => void runComparison()}
            disabled={running || candidates.length < 5}
          >
            {running
              ? `Running ${completed}/4…`
              : trial
                ? "Run another blind trial"
                : "Run 4-way comparison"}
          </button>
          <small>Three AI calls + local rules arm. Safety gate is shared.</small>
        </div>
      </section>

      <section className="lab-protocol">
        <span className="block-label">Protocol</span>
        <ol>
          <li>Load the challenge set, or keep the current imported book.</li>
          <li>Run a blind trial and choose the list you would call this week.</li>
          <li>Reveal the strategy names, then review the scorecard.</li>
          <li>Optionally apply the winner as This week, then demo the product funnel.</li>
        </ol>
        <div className="toolbar">
          <button className="btn" type="button" onClick={loadChallengeSet}>
            Load challenge set
          </button>
          <button className="btn ghost" type="button" onClick={loadSampleForLab}>
            Load sample book
          </button>
          <Link className="btn ghost" href="/">
            Open product with current book
          </Link>
        </div>
      </section>

      <section className="lab-guardrail">
        <strong>Safety is not part of the contest.</strong>
        <span>
          Every arm receives the same reachable, non-blocked candidate set. AI can
          reorder records; it cannot override a hard stop.
        </span>
      </section>

      <section className="lab-rubric">
        <span className="block-label">Judge the lists before revealing the policy</span>
        <ol>
          <li>Would I actually call these people this week?</li>
          <li>Can I defend every recommendation from the file?</li>
          <li>Does the list avoid weak, premature, or repetitive picks?</li>
          <li>Is the campaign small and varied enough to finish?</li>
        </ol>
        <label className="check-inline">
          <input
            type="checkbox"
            checked={blind}
            onChange={(event) => setBlind(event.target.checked)}
          />
          Hide strategy names and objectives
        </label>
      </section>

      {!trial ? (
        <section className="lab-empty">
          <strong>No result has been manufactured in advance.</strong>
          <p>
            Run the trial, compare the four lists, and choose based on the
            rubric—not on which one says “AI.”
          </p>
        </section>
      ) : (
        <section className="lab-grid" aria-label="Ranking experiment results">
          {armOrder.map((strategy, index) => {
            const arm = arms[strategy];
            return (
              <RankingArm
                key={strategy}
                optionLabel={`Option ${String.fromCharCode(65 + index)}`}
                strategy={strategy}
                arm={arm}
                blind={blind}
                candidates={candidates}
                baselineIds={baseline.picks.map((pick) => pick.prospectId)}
                labels={usingChallenge ? labelMap : undefined}
                winner={winner === strategy}
                onChoose={() => chooseWinner(strategy)}
              />
            );
          })}
        </section>
      )}

      {winner && (
        <section className="lab-winner">
          <span className="block-label">Selected for the next test</span>
          <h2>{STRATEGY_META[winner].label}</h2>
          <p>{STRATEGY_META[winner].objective}</p>
          <p className="muted">
            This is a human preference from one trial—not proof of better meeting
            conversion. Use the challenge scorecard as trap evidence, then assign
            real outcomes on a live book.
          </p>
          <div className="toolbar">
            <button className="btn primary" type="button" onClick={applyWinner}>
              {applied ? "Applied to This week" : "Apply winner as This week"}
            </button>
            {applied && (
              <Link className="btn" href="/">
                Continue in product Call mode
              </Link>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function LabHeader() {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark" aria-hidden>
          RD
        </div>
        <div className="brand-text">
          <strong>Ranking Lab</strong>
          <span>Four policies · one safety gate · fair shortlist</span>
        </div>
      </div>
      <div className="topbar-actions">
        <Link className="btn ghost" href="/">
          Back to product
        </Link>
        <Link className="btn ghost" href="/memo">
          Decision memo
        </Link>
      </div>
    </header>
  );
}

function RankingArm({
  optionLabel,
  strategy,
  arm,
  blind,
  candidates,
  baselineIds,
  labels,
  winner,
  onChoose,
}: {
  optionLabel: string;
  strategy: RankingStrategy;
  arm?: ArmState;
  blind: boolean;
  candidates: ReturnType<typeof buildRankingCandidates>;
  baselineIds: string[];
  labels?: Map<string, ChallengeLabel>;
  winner: boolean;
  onChoose: () => void;
}) {
  const result = arm?.result;
  const candidateById = new Map(
    candidates.map((candidate) => [candidate.id, candidate]),
  );
  const metrics = result
    ? calculateRankingMetrics(result, candidates, baselineIds)
    : null;
  const scorecard =
    result && labels ? calculateChallengeScorecard(result, labels) : null;

  return (
    <article className={winner ? "lab-arm winner" : "lab-arm"}>
      <div className="lab-arm-head">
        <div>
          <span className="lab-option">{optionLabel}</span>
          <h2>{blind ? "Policy hidden" : STRATEGY_META[strategy].label}</h2>
        </div>
        {arm?.status === "complete" && <span className="lab-ready">Ready</span>}
      </div>
      {!blind && <p className="lab-objective">{STRATEGY_META[strategy].objective}</p>}

      {arm?.status === "running" && (
        <div className="lab-loading">Ranking the same eligible records…</div>
      )}
      {arm?.status === "error" && <p className="error">{arm.error}</p>}
      {result && metrics && (
        <>
          <div className="lab-metrics">
            <Metric value={metrics.averageOpportunity} label="Avg opportunity*" />
            <Metric value={metrics.averageEvidence} label="Avg evidence*" />
            <Metric value={metrics.weakFilePicks} label="Weak picks*" />
            <Metric value={`${metrics.baselineOverlap}/10`} label="Rules overlap" />
          </div>
          {scorecard && !blind && (
            <div className="lab-scorecard">
              <span className="block-label">Challenge scorecard</span>
              <div className="lab-metrics">
                <Metric value={scorecard.preferredHits} label="Call-now hits" />
                <Metric value={scorecard.keywordMissRecoveries} label="Keyword-miss recoveries" />
                <Metric value={scorecard.timingTrapMistakes} label="Timing-trap mistakes" />
                <Metric value={scorecard.verifyLeaks + scorecard.waitLeaks} label="Verify/wait leaks" />
                <Metric value={scorecard.excludeLeaks} label="Exclude leaks" />
              </div>
              <small>
                Labels are independent of the production ranker. Starred metrics
                still use rule-derived fields and are descriptive only.
              </small>
            </div>
          )}
          <ol className="lab-picks">
            {result.picks.map((pick, index) => {
              const candidate = candidateById.get(pick.prospectId);
              if (!candidate) return null;
              const label = labels?.get(pick.prospectId);
              return (
                <li key={pick.prospectId}>
                  <span className="lab-rank">{index + 1}</span>
                  <div>
                    <strong>{candidate.name}</strong>
                    <small>
                      {candidate.company ?? "No company"} · score {pick.score}
                      {!blind && label
                        ? ` · expected ${label.expectedAction.replaceAll("_", " ")}`
                        : ""}
                    </small>
                    <p>{pick.reason}</p>
                    <q>{pick.evidenceQuote}</q>
                  </div>
                </li>
              );
            })}
          </ol>
          <button
            type="button"
            className={winner ? "btn primary lab-vote" : "btn lab-vote"}
            onClick={onChoose}
          >
            {winner ? "Selected" : "Choose this list"}
          </button>
          {!blind && (
            <small className="lab-grounding">
              {result.grounding}
              {result.model ? ` · ${result.model}` : ""}
            </small>
          )}
        </>
      )}
    </article>
  );
}

function Metric({ value, label }: { value: number | string; label: string }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[next]] = [copy[next]!, copy[index]!];
  }
  return copy;
}
