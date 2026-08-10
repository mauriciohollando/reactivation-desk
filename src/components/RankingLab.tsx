"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { balancedCallable } from "@/lib/analysisEngine";
import {
  AI_RANKING_STRATEGIES,
  buildDeterministicResult,
  buildRankingCandidates,
  calculateRankingMetrics,
  STRATEGY_META,
  type RankingExperimentResult,
  type RankingStrategy,
} from "@/lib/rankingExperiment";
import { useDesk } from "@/lib/store";

type ArmState = {
  status: "idle" | "running" | "complete" | "error";
  result?: RankingExperimentResult;
  error?: string;
};

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

  const [arms, setArms] = useState<Partial<Record<RankingStrategy, ArmState>>>({});
  const [armOrder, setArmOrder] = useState<RankingStrategy[]>(ALL_STRATEGIES);
  const [blind, setBlind] = useState(true);
  const [winner, setWinner] = useState<RankingStrategy | null>(null);
  const [trial, setTrial] = useState(0);

  const ranked = useMemo(
    () => rankedFn(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prospects, rankedFn],
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
      ),
    [ranked, analyses],
  );
  const currentSelection = useMemo(
    () => balancedCallable(ranked, analyses, 10).map((prospect) => prospect.id),
    [ranked, analyses],
  );
  const baseline = useMemo(
    () => buildDeterministicResult(candidates, 10, currentSelection),
    [candidates, currentSelection],
  );

  const runComparison = async () => {
    if (candidates.length < 5) return;
    setWinner(null);
    setBlind(true);
    setTrial((value) => value + 1);
    setArmOrder(shuffle(ALL_STRATEGIES));
    setArms({
      deterministic: { status: "complete", result: baseline },
      revenue_scout: { status: "running" },
      trust_gate: { status: "running" },
      campaign_strategist: { status: "running" },
    });

    await Promise.all(
      AI_RANKING_STRATEGIES.map(async (strategy) => {
        try {
          const response = await fetch("/api/ranking-experiment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              strategy,
              count: 10,
              candidates,
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

  const completed = Object.values(arms).filter(
    (arm) => arm?.status === "complete",
  ).length;
  const running = Object.values(arms).some((arm) => arm?.status === "running");

  if (!prospects.length) {
    return (
      <main className="desk ranking-lab">
        <LabHeader />
        <section className="hero-empty">
          <p className="eyebrow">Ranking experiment</p>
          <h2>Load one book, test four decision policies</h2>
          <p>
            Start with the disclosed synthetic advisor book, or import a CSV in
            the product first.
          </p>
          <div className="toolbar">
            <button className="btn primary lg" type="button" onClick={loadDemoBook}>
              Use sample advisor book
            </button>
            <Link className="btn" href="/">
              Import a CSV
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
            Same book, safe candidate set, model, and output size. Only the
            ranking objective changes.
          </p>
          <p className="muted source-line">
            {sourceLabel} · {prospects.length} records · {candidates.length} eligible
            candidates
          </p>
        </div>
        <div className="lab-run">
          <button
            className="btn ai-btn lg"
            type="button"
            onClick={() => void runComparison()}
            disabled={running || candidates.length < 5}
          >
            {running ? `Running ${completed}/4…` : trial ? "Run another blind trial" : "Run 4-way comparison"}
          </button>
          <small>Runs three AI calls. The rules arm is computed locally.</small>
        </div>
      </section>

      <section className="lab-guardrail">
        <strong>Safety is not part of the contest.</strong>
        <span>
          Every arm receives the same reachable, non-blocked candidate set.
          AI can reorder records; it cannot override a hard stop.
        </span>
      </section>

      <section className="lab-rubric">
        <span className="block-label">Judge the lists before revealing the policy</span>
        <ol>
          <li>Would I actually call these people this week?</li>
          <li>Can I defend every recommendation from the file?</li>
          <li>Does the list avoid weak or repetitive picks?</li>
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
            This is a human preference from one trial—not proof of better
            meeting conversion. The next validation is to assign real outcomes
            and compare meetings per ten calls.
          </p>
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
          <span>Four policies · one safety gate</span>
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
  winner,
  onChoose,
}: {
  optionLabel: string;
  strategy: RankingStrategy;
  arm?: ArmState;
  blind: boolean;
  candidates: ReturnType<typeof buildRankingCandidates>;
  baselineIds: string[];
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
            <Metric value={metrics.averageOpportunity} label="Avg opportunity" />
            <Metric value={metrics.averageEvidence} label="Avg evidence" />
            <Metric value={metrics.weakFilePicks} label="Weak picks" />
            <Metric value={`${metrics.baselineOverlap}/10`} label="Rules overlap" />
          </div>
          <ol className="lab-picks">
            {result.picks.map((pick) => {
              const candidate = candidateById.get(pick.prospectId);
              if (!candidate) return null;
              return (
                <li key={pick.prospectId}>
                  <span className="lab-rank">{result.picks.indexOf(pick) + 1}</span>
                  <div>
                    <strong>{candidate.name}</strong>
                    <small>
                      {candidate.company ?? "No company"} · score {pick.score}
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
