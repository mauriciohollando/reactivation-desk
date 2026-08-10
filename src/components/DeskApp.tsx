"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { runDemoEval } from "@/lib/eval";
import { buildBookPatterns } from "@/lib/analysisEngine";
import type {
  NextBestAction,
  ProspectAnalysis,
  WebEvidencePacket,
} from "@/lib/analysisTypes";
import {
  FILTERABLE_TAG_IDS,
  type InsightTag,
  type InsightTagId,
} from "@/lib/insightTags";
import {
  excludedFromPlan,
  prospectsFromMappedRows,
  suggestColumnMapping,
  topCallable,
} from "@/lib/rank";
import { useDesk } from "@/lib/store";
import type {
  ColumnMapping,
  FieldKey,
  Outcome,
  RankedProspect,
  SilenceBucket,
  WeekBudget,
  WizardStep,
} from "@/lib/types";

const FIELD_LABELS: Record<FieldKey, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  company: "Company",
  title: "Title",
  segment: "Segment",
  source: "Source",
  lastTouch: "Last touch",
  notes: "Notes",
  estimatedValue: "Value",
  linkedin: "LinkedIn",
};

const STEPS: { id: WizardStep; label: string }[] = [
  { id: "import", label: "Import" },
  { id: "diagnose", label: "Diagnosis" },
  { id: "plan", label: "This week" },
  { id: "call", label: "Call" },
  { id: "wrap", label: "Wrap" },
];

function silenceLabel(b: SilenceBucket) {
  if (b === "safe_reopen") return "Safe reopen";
  if (b === "handle_with_care") return "Handle with care";
  return "Do not cold-call";
}

export function DeskApp() {
  const prospects = useDesk((s) => s.prospects);
  const sourceLabel = useDesk((s) => s.sourceLabel);
  const selectedIds = useDesk((s) => s.selectedIds);
  const campaign = useDesk((s) => s.campaign);
  const talkEdits = useDesk((s) => s.talkEdits);
  const reasonHeld = useDesk((s) => s.reasonHeld);
  const importSummary = useDesk((s) => s.importSummary);
  const step = useDesk((s) => s.step);
  const callIndex = useDesk((s) => s.callIndex);
  const outcomes = useDesk((s) => s.outcomes);
  const weekBudget = useDesk((s) => s.weekBudget);
  const preferWarm = useDesk((s) => s.preferWarm);
  const tagFilters = useDesk((s) => s.tagFilters);
  const analyses = useDesk((s) => s.analyses);
  const webEvidence = useDesk((s) => s.webEvidence);
  const analysisStatus = useDesk((s) => s.analysisStatus);
  const analysisError = useDesk((s) => s.analysisError);
  const aiAnalyzedCount = useDesk((s) => s.aiAnalyzedCount);
  const loadDemoBook = useDesk((s) => s.loadDemoBook);
  const loadProspects = useDesk((s) => s.loadProspects);
  const toggleSelect = useDesk((s) => s.toggleSelect);
  const toggleTagFilter = useDesk((s) => s.toggleTagFilter);
  const clearTagFilters = useDesk((s) => s.clearTagFilters);
  const deepenTopProspects = useDesk((s) => s.deepenTopProspects);
  const refreshPublicEvidence = useDesk((s) => s.refreshPublicEvidence);
  const buildWeekPlan = useDesk((s) => s.buildWeekPlan);
  const setOutcome = useDesk((s) => s.setOutcome);
  const setTalkEdit = useDesk((s) => s.setTalkEdit);
  const setReasonHeld = useDesk((s) => s.setReasonHeld);
  const setStep = useDesk((s) => s.setStep);
  const setCallIndex = useDesk((s) => s.setCallIndex);
  const setWeekBudget = useDesk((s) => s.setWeekBudget);
  const setPreferWarm = useDesk((s) => s.setPreferWarm);
  const mergeDuplicatePair = useDesk((s) => s.mergeDuplicatePair);
  const rankedFn = useDesk((s) => s.ranked);
  const resetAll = useDesk((s) => s.resetAll);

  const [showPricing, setShowPricing] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);
  const [pendingRows, setPendingRows] = useState<Record<string, string>[] | null>(null);
  const [pendingHeaders, setPendingHeaders] = useState<string[]>([]);
  const [pendingSourceLabel, setPendingSourceLabel] = useState("CSV upload");
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [csvError, setCsvError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const aiResultsRef = useRef<HTMLDivElement>(null);

  const rankedLive = useMemo(
    () => rankedFn(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prospects, outcomes, rankedFn],
  );

  const evalScores = useMemo(() => runDemoEval(10), []);
  const excluded = useMemo(() => excludedFromPlan(rankedLive), [rankedLive]);
  const campaignRows = useMemo(() => {
    if (!campaign) return [] as RankedProspect[];
    return campaign.prospectIds
      .map((id) => rankedLive.find((p) => p.id === id))
      .filter(Boolean) as RankedProspect[];
  }, [campaign, rankedLive]);

  const filteredCampaignRows = useMemo(() => {
    if (!tagFilters.length) return campaignRows;
    return campaignRows.filter((p) =>
      tagFilters.some((f) => p.tags.some((t) => t.id === f)),
    );
  }, [campaignRows, tagFilters]);

  const filteredBook = useMemo(() => {
    if (!tagFilters.length) return rankedLive;
    return rankedLive.filter((p) =>
      tagFilters.some((f) => p.tags.some((t) => t.id === f)),
    );
  }, [rankedLive, tagFilters]);

  const planFilterOptions = useMemo(() => {
    const present = new Set(campaignRows.flatMap((p) => p.tags.map((t) => t.id)));
    return FILTERABLE_TAG_IDS.filter((id) => present.has(id));
  }, [campaignRows]);

  const bookFilterOptions = useMemo(() => {
    const present = new Set(rankedLive.flatMap((p) => p.tags.map((t) => t.id)));
    return FILTERABLE_TAG_IDS.filter((id) => present.has(id));
  }, [rankedLive]);

  const bookPatterns = useMemo(
    () => buildBookPatterns(rankedLive, analyses),
    [rankedLive, analyses],
  );
  const aiResults = useMemo(() => {
    const records = rankedLive
      .map((prospect) => ({ prospect, analysis: analyses[prospect.id] }))
      .filter(
        (
          item,
        ): item is { prospect: RankedProspect; analysis: ProspectAnalysis } =>
          item.analysis?.mode === "ai",
      );
    const actionCount = (actions: NextBestAction[]) =>
      records.filter(({ analysis }) => actions.includes(analysis.nextAction)).length;
    const highlights = [...records]
      .sort((a, b) => {
        const signal = (analysis: ProspectAnalysis) =>
          analysis.contradictions.length * 100 +
          analysis.timeline.filter((item) => item.status === "overdue").length * 50 +
          (["call_now", "ask_referrer", "verify_first"].includes(analysis.nextAction) ? 25 : 0) +
          analysis.evidenceConfidence;
        return signal(b.analysis) - signal(a.analysis);
      })
      .slice(0, 4);
    return {
      records,
      highlights,
      readyNow: actionCount(["call_now"]),
      warmRoute: actionCount(["ask_referrer", "email_first"]),
      verifyFirst: actionCount(["verify_first", "merge_records", "find_contact"]),
      waitOrStop: actionCount(["wait", "do_not_contact"]),
      contradictions: records.reduce(
        (sum, { analysis }) => sum + analysis.contradictions.length,
        0,
      ),
    };
  }, [rankedLive, analyses]);

  const contacted = campaignRows.filter((p) => (outcomes[p.id] ?? p.outcome) !== "queued").length;
  const blockCalling =
    !!importSummary &&
    importSummary.callableThisWeek === 0 &&
    importSummary.total > 0;

  const runDeepAnalysis = async () => {
    await deepenTopProspects(25);
    window.requestAnimationFrame(() => {
      aiResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const parseCsvText = (text: string, label: string) => {
    setCsvError(null);
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });
    const rows = (parsed.data ?? []).filter((r) =>
      Object.values(r).some((v) => String(v ?? "").trim()),
    );
    if (!rows.length) {
      setCsvError("No data rows found. Need a header row and at least one contact.");
      return;
    }
    const headers = Object.keys(rows[0] ?? {});
    const suggested = suggestColumnMapping(headers);
    setPendingRows(rows);
    setPendingHeaders(headers);
    setPendingSourceLabel(label);
    setMapping(suggested);
    if (!suggested.name) {
      setCsvError("Could not detect a Name column. Map columns, then continue.");
      return;
    }
    // Always let the user confirm the mapping. A real CRM export often contains
    // plausible-but-wrong columns, so silently accepting a guess is unsafe.
    setCsvError(null);
  };

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => parseCsvText(String(reader.result ?? ""), `CSV upload: ${file.name}`);
    reader.readAsText(file);
  };

  const applyMapping = () => {
    if (!pendingRows || !mapping.name) {
      setCsvError("Name column is required.");
      return;
    }
    loadProspects(
      prospectsFromMappedRows(pendingRows, mapping),
      `${pendingSourceLabel} · confirmed mapping · ${pendingRows.length} rows`,
    );
    setCsvError(null);
  };

  const exportCampaign = () => {
    if (!campaign) return;
    const rows = campaignRows.map((p) => ({
      name: p.name,
      opportunity: p.opportunity,
      reachability: p.reachability,
      score: p.score,
      silence_bucket: p.silenceBucket,
      company: p.company ?? "",
      phone: p.phone ?? "",
      email: p.email ?? "",
      outcome: outcomes[p.id] ?? p.outcome,
      reason_still_held: reasonHeld[p.id] ?? "",
      talk_track: talkEdits[p.id] ?? p.talkTrack,
      why_call: p.whyCall,
      why_support: p.whySupport,
      tags: p.tags.map((t) => t.label).join(" | "),
      evidence_confidence: analyses[p.id]?.evidenceConfidence ?? "",
      next_best_action: analyses[p.id]?.nextAction ?? "",
      next_action_reason: analyses[p.id]?.nextActionReason ?? "",
      public_evidence_status: webEvidence[p.id]?.identityStatus ?? "",
      brief: p.brief,
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${campaign.name.replace(/\s+/g, "-")}-outcomes.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const callCard = campaignRows[callIndex] ?? null;

  const learnedNote = useMemo(() => {
    const wins = Object.entries(outcomes).filter(([, o]) => o === "meeting" || o === "sale");
    if (!wins.length) return "Log meetings or sales to improve next week’s ranking.";
    return `${wins.length} positive outcome${wins.length > 1 ? "s" : ""} logged. Similar evidence patterns will rank higher next week.`;
  }, [outcomes]);

  return (
    <div className="desk">
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            RD
          </div>
          <div className="brand-text">
            <strong>Reactivation Desk</strong>
            <span>Export-native · Human-approved outreach</span>
          </div>
        </div>
        <div className="topbar-actions">
          <Link className="btn ghost" href="/compare">
            Ranking lab
          </Link>
          <button type="button" className="linkish" onClick={() => setShowPricing((v) => !v)}>
            {showPricing ? "Hide pricing" : "Pricing"}
          </button>
          <Link className="btn ghost" href="/memo">
            Decision memo
          </Link>
          {prospects.length > 0 && (
            <button type="button" className="btn ghost" onClick={resetAll}>
              New book
            </button>
          )}
        </div>
      </header>

      <div className="persist-banner">
        <span className="persist-dot" aria-hidden />
        Local analysis stays in this browser · AI deep analysis is opt-in · No CRM connection
      </div>

      {showPricing && (
        <section className="details-panel">
          <div>
            <strong>$299/mo</strong> for independent advisors · or $1,500 cleanup sprint + $99/mo
          </div>
          <ul>
            <li>Works from an export because serious buyers will not grant continuous access</li>
            <li>No auto-send · silence-aware · cites the file or asks for review</li>
          </ul>
        </section>
      )}

      {prospects.length > 0 && (
        <nav className="steps" aria-label="Workflow">
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={step === s.id ? "step on" : "step"}
              onClick={() => setStep(s.id)}
            >
              {s.label}
            </button>
          ))}
          <button
            type="button"
            className={step === "review" ? "step on" : "step"}
            onClick={() => setStep("review")}
          >
            Full book
          </button>
        </nav>
      )}

      {/* IMPORT */}
      {step === "import" && prospects.length === 0 && (
        <section className="hero-empty">
          <p className="eyebrow">Weekly reactivation</p>
          <h2>Who should you call this week?</h2>
          <p>
            Import a messy prospect book. We diagnose what is callable, careful, and off-limits,
            then walk you through a week you can finish.
          </p>
          <div className="trust-badges">
            <span>Export-native</span>
            <span>Human-approved outreach</span>
            <span>Silence-aware</span>
          </div>
          <div className="toolbar">
            <button type="button" className="btn primary lg" onClick={loadDemoBook}>
              Use sample advisor book
            </button>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              Upload CSV
            </button>
            <a className="btn ghost" href="/demo-advisor-book.csv" download>
              Download sample CSV
            </a>
          </div>
          {csvError && <p className="error">{csvError}</p>}
        </section>
      )}

      {pendingRows && step === "import" && (
        <section className="mapper">
          <h2>Map CSV columns</h2>
          <p className="muted">Fix anything we guessed wrong, then continue.</p>
          <div className="mapper-grid">
            {(Object.keys(FIELD_LABELS) as FieldKey[]).map((field) => (
              <label key={field}>
                <span>{FIELD_LABELS[field]}</span>
                <select
                  value={mapping[field] ?? ""}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, [field]: e.target.value || undefined }))
                  }
                >
                  <option value="">—</option>
                  {pendingHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <button type="button" className="btn primary" onClick={applyMapping}>
            Apply mapping &amp; diagnose
          </button>
        </section>
      )}

      {/* DIAGNOSE */}
      {prospects.length > 0 && step === "diagnose" && importSummary && (
        <section className="funnel-card diagnose-card">
          <p className="eyebrow">Book ready</p>
          <h2>Here is what is callable, careful, and off-limits</h2>
          <p className="muted source-line">{sourceLabel}</p>

          <div className="stat-row">
            <Stat label="In the book" value={importSummary.total} />
            <Stat label="Callable this week" value={importSummary.callableThisWeek} good />
            <Stat label="Handle with care" value={importSummary.handleWithCare} warn />
            <Stat label="Do not cold-call" value={importSummary.doNotColdCall} danger />
            <Stat label="Missing contact" value={importSummary.missingContact} warn />
            <Stat label="Duplicate names" value={importSummary.duplicateGroups} warn />
            <Stat label="Evidence coverage" value={`${importSummary.evidenceCoveragePct}%`} />
          </div>

          <div className="ai-analysis-card">
            <div className="ai-analysis-copy">
              <div className="ai-kicker">
                <span className="ai-spark" aria-hidden>✦</span>
                Hybrid analysis
              </div>
              <h3>
                {aiAnalyzedCount
                  ? `${aiAnalyzedCount} priority records deepened with AI`
                  : `${prospects.length.toLocaleString()} records analyzed locally`}
              </h3>
              <p>
                Hard stops stay deterministic. Opt-in AI extracts structured facts, timelines,
                contradictions, and discovery questions from the top 25 records. Every extracted
                fact must survive exact-quote validation against your file.
              </p>
              <div className="trust-mini">
                <span>Exact quotes required</span>
                <span>No autonomous outreach</span>
                <span>Local fallback always on</span>
              </div>
            </div>
            <div className="ai-analysis-action">
              <button
                type="button"
                className="btn ai-btn"
                disabled={analysisStatus === "running"}
                onClick={() => void runDeepAnalysis()}
              >
                {analysisStatus === "running"
                  ? "Deepening analysis…"
                  : aiAnalyzedCount
                    ? "Run deep analysis again"
                    : "Deepen top 25 with AI"}
              </button>
              <small>
                Sends only those 25 rows directly to the configured OpenAI model. No web search in this
                step.
              </small>
            </div>
            {aiResults.records.length > 0 && (
              <div className="ai-results" ref={aiResultsRef}>
                <div className="ai-results-heading">
                  <div>
                    <span className="block-label">What AI found</span>
                    <h4>Your highest-priority findings are ready</h4>
                    <p>
                      These recommendations are grounded in the imported fields and quotes. Review
                      each record before outreach.
                    </p>
                  </div>
                  <button type="button" className="btn ghost small" onClick={() => setStep("review")}>
                    Review all {aiResults.records.length} AI records
                  </button>
                </div>
                <div className="ai-result-stats">
                  <AiResultStat value={aiResults.readyNow} label="Call now" tone="good" />
                  <AiResultStat value={aiResults.warmRoute} label="Use a warm route" />
                  <AiResultStat value={aiResults.verifyFirst} label="Verify first" tone="warn" />
                  <AiResultStat value={aiResults.waitOrStop} label="Wait or do not contact" />
                  <AiResultStat
                    value={aiResults.contradictions}
                    label="Contradictions found"
                    tone={aiResults.contradictions ? "danger" : "good"}
                  />
                </div>
                <div className="ai-highlight-grid">
                  {aiResults.highlights.map(({ prospect, analysis }) => (
                    <article className="ai-highlight" key={prospect.id}>
                      <div className="ai-highlight-title">
                        <div>
                          <strong>{prospect.name}</strong>
                          <span>{prospect.company ?? "No company on file"}</span>
                        </div>
                        <span className={`next-action action-${analysis.nextAction}`}>
                          {ACTION_LABELS[analysis.nextAction]}
                        </span>
                      </div>
                      <p>{analysis.summary}</p>
                      <div className="ai-highlight-reason">
                        <span>Why this action</span>
                        <p>{analysis.nextActionReason}</p>
                      </div>
                      <div className="ai-highlight-evidence">
                        {analysis.facts.slice(0, 3).map((fact, index) => (
                          <span key={`${fact.label}-${index}`}>
                            {fact.label}: {fact.value}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>

          {analysisError && <p className="error">{analysisError}</p>}

          {bookPatterns.length > 0 && (
            <div className="pattern-section">
              <div className="section-heading">
                <div>
                  <span className="block-label">Campaigns hiding in the book</span>
                  <p className="muted">
                    Portfolio-level patterns found across notes, timing, relationships, and data
                    quality.
                  </p>
                </div>
              </div>
              <div className="pattern-grid">
                {bookPatterns.slice(0, 6).map((pattern) => (
                  <article key={pattern.id} className={`pattern-card ${pattern.kind}`}>
                    <strong>{pattern.count}</strong>
                    <div>
                      <h4>{pattern.label}</h4>
                      <p>{pattern.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          <div className="insight-grid">
            <div className="insight">
              <strong>We will not recommend cold outreach</strong>
              <p>
                {importSummary.doNotColdCall} people are excluded for silence / opt-out risk. That
                is the product, not a bug.
              </p>
            </div>
            <div className="insight">
              <strong>No continuous data access required</strong>
              <p>
                This workflow runs from your export. Serious buyers often will not grant CRM or
                inbox permissions.
              </p>
            </div>
            <div className="insight">
              <strong>Compared to memory cherry-picking</strong>
              <p>
                Your callable set includes cold-but-reachable people you may never open manually.
                That is where the lift lives.
              </p>
            </div>
          </div>

          {(importSummary.tagCensus?.length ?? 0) > 0 && (
            <div className="tag-census">
              <div className="tag-census-head">
                <span className="block-label">Signals found in this book</span>
                <p className="muted">
                  Select tags to focus this week&apos;s list on matching people (OR). Same book
                  always yields the same tags.
                </p>
              </div>
              <div className="tag-filter-row">
                {importSummary.tagCensus.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={
                      tagFilters.includes(t.id as InsightTagId)
                        ? `tag-chip on kind-${t.kind}`
                        : `tag-chip kind-${t.kind}`
                    }
                    onClick={() => toggleTagFilter(t.id as InsightTagId)}
                  >
                    {t.label}
                    <em>{t.count}</em>
                  </button>
                ))}
                {tagFilters.length > 0 && (
                  <button type="button" className="btn ghost sm" onClick={clearTagFilters}>
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          )}

          {importSummary.parseWarnings.map((w) => (
            <p key={w} className="error">
              {w}
            </p>
          ))}
          {blockCalling && (
            <p className="error">Calling is blocked until some rows have phone or email.</p>
          )}

          <div className="budget-row">
            <span className="block-label">How many calls this week?</span>
            <div className="filters">
              {([5, 10, 20] as WeekBudget[]).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={weekBudget === n ? "chip on" : "chip"}
                  onClick={() => setWeekBudget(n)}
                >
                  {n} calls
                </button>
              ))}
            </div>
            <label className="check-inline">
              <input
                type="checkbox"
                checked={preferWarm}
                onChange={(e) => setPreferWarm(e.target.checked)}
              />
              Prefer warm reopen first
            </label>
          </div>

          <div className="toolbar">
            <button
              type="button"
              className="btn primary lg"
              disabled={blockCalling}
              onClick={() => buildWeekPlan(weekBudget)}
            >
              Build this week&apos;s {weekBudget}-call list
            </button>
            <button type="button" className="btn ghost" onClick={() => setStep("review")}>
              Review full book
            </button>
          </div>
        </section>
      )}

      {/* PLAN */}
      {prospects.length > 0 && step === "plan" && campaign && (
        <section className="funnel-card plan-card">
          <div className="plan-header">
            <div>
              <p className="eyebrow">This week&apos;s reactivation list</p>
              <h2>
                {campaign.prospectIds.length} people · ~{Math.round(campaign.prospectIds.length * 0.35)} hours
              </h2>
              <p className="muted">
                Each person has a cited commercial reason and analysis tags from the file.
                Exclusions are intentional.
              </p>
            </div>
            <div className="toolbar">
              <button type="button" className="btn primary lg" onClick={() => setStep("call")}>
                Start calling
              </button>
              <button type="button" className="btn" onClick={() => setStep("diagnose")}>
                Change budget
              </button>
            </div>
          </div>

          {planFilterOptions.length > 0 && (
            <TagFilterBar
              options={planFilterOptions}
              active={tagFilters}
              onToggle={toggleTagFilter}
              onClear={clearTagFilters}
              showing={filteredCampaignRows.length}
              total={campaignRows.length}
            />
          )}

          <div className="plan-list">
            {filteredCampaignRows.map((p) => (
              <article key={p.id} className="plan-item">
                <div className="plan-index">{campaignRows.findIndex((x) => x.id === p.id) + 1}</div>
                <div className="plan-body">
                  <div className="plan-title-row">
                    <h3>{p.name}</h3>
                    <span className={`tier ${p.tier}`}>{p.tier}</span>
                    <span className="silence-pill">{silenceLabel(p.silenceBucket)}</span>
                  </div>
                  <p className="why-call">
                    <span className="why-label">Call because</span>
                    {p.whyCall}
                  </p>
                  {p.whySupport ? <p className="why-support">{p.whySupport}</p> : null}
                  <InsightTagRow tags={p.tags} />
                  {analyses[p.id] && (
                    <AnalysisStrip analysis={analyses[p.id]} compact />
                  )}
                  <p className="meta-line">
                    {p.company ?? "No company"}
                    {" · "}
                    {p.phone ? <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`}>{p.phone}</a> : "No phone"}
                  </p>
                </div>
                <button type="button" className="btn ghost" onClick={() => toggleSelect(p.id)}>
                  {selectedIds.includes(p.id) ? "On list" : "Add back"}
                </button>
              </article>
            ))}
          </div>

          <div className="excluded-panel">
            <button
              type="button"
              className="linkish"
              onClick={() => setShowExcluded((v) => !v)}
            >
              {showExcluded ? "Hide" : "Show"} who we excluded on purpose ({excluded.length})
            </button>
            {showExcluded && (
              <ul className="excluded-list">
                {excluded.map((p) => (
                  <li key={p.id}>
                    <strong>{p.name}</strong>
                    <span>
                      {p.silenceBucket === "do_not_cold_call"
                        ? "Do not cold-call"
                        : "Unreachable (no phone/email)"}
                    </span>
                    <span className="muted">{p.risks[0]?.snippet ?? p.brief}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* CALL */}
      {step === "call" && callCard && (
        <CallMode
          p={callCard}
          index={callIndex}
          total={campaignRows.length}
          talk={talkEdits[callCard.id] ?? callCard.talkTrack}
          outcome={outcomes[callCard.id] ?? callCard.outcome}
          reason={reasonHeld[callCard.id] ?? ""}
          analysis={analyses[callCard.id]}
          webEvidence={webEvidence[callCard.id]}
          analysisBusy={analysisStatus === "running"}
          onRefreshEvidence={() => void refreshPublicEvidence(callCard.id)}
          onTalk={(t) => setTalkEdit(callCard.id, t)}
          onOutcome={(o) => setOutcome(callCard.id, o)}
          onReason={(v) => setReasonHeld(callCard.id, v)}
          onPrev={() => setCallIndex(Math.max(0, callIndex - 1))}
          onNext={() => {
            if (callIndex < campaignRows.length - 1) setCallIndex(callIndex + 1);
            else setStep("wrap");
          }}
        />
      )}

      {step === "call" && !callCard && (
        <section className="funnel-card">
          <p>Build a weekly list first.</p>
          <button type="button" className="btn primary" onClick={() => setStep("diagnose")}>
            Go to diagnosis
          </button>
        </section>
      )}

      {/* WRAP */}
      {step === "wrap" && campaign && (
        <section className="funnel-card wrap-card">
          <p className="eyebrow">Week closed</p>
          <h2>
            {contacted} of {campaignRows.length} logged
          </h2>
          <p className="muted">{learnedNote}</p>
          <div className="progress-track lg">
            <div
              className="progress-fill"
              style={{
                width: `${campaignRows.length ? (contacted / campaignRows.length) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="insight-grid">
            <div className="insight">
              <strong>Durable artifact</strong>
              <p>Export outcomes so next week starts from reality, not memory.</p>
            </div>
            <div className="insight">
              <strong>What this replaces</strong>
              <p>Hours of cherry-picking plus weak appointment-setting spend.</p>
            </div>
          </div>
          <div className="toolbar">
            <button type="button" className="btn primary lg" onClick={exportCampaign}>
              Download week report (CSV)
            </button>
            <button type="button" className="btn" onClick={() => setStep("plan")}>
              Back to list
            </button>
            <button type="button" className="btn ghost" onClick={resetAll}>
              Start another book
            </button>
          </div>
          <p className="muted tiny eval-foot">
            Quality check · precision@{evalScores.k}: model {Math.round(evalScores.model * 100)}% ·
            recency {Math.round(evalScores.recency * 100)}% · baseline{" "}
            {Math.round(evalScores.random * 100)}%
          </p>
        </section>
      )}

      {/* REVIEW full book */}
      {step === "review" && prospects.length > 0 && (
        <ReviewBook
          ranked={filteredBook}
          analyses={analyses}
          allCount={rankedLive.length}
          filterOptions={bookFilterOptions}
          tagFilters={tagFilters}
          onToggleTag={toggleTagFilter}
          onClearTags={clearTagFilters}
          selectedIds={selectedIds}
          talkEdits={talkEdits}
          outcomes={outcomes}
          onToggle={toggleSelect}
          onTalk={setTalkEdit}
          onOutcome={setOutcome}
          onMerge={mergeDuplicatePair}
          onBuild={() => buildWeekPlan(weekBudget)}
          onBack={() => setStep(campaign ? "plan" : "diagnose")}
        />
      )}
    </div>
  );
}

function InsightTagRow({ tags }: { tags: InsightTag[] }) {
  const show = tags.filter((t) => t.id !== "phone_ready").slice(0, 6);
  if (!show.length) return null;
  return (
    <div className="insight-tags" title={show.map((t) => `${t.label}: ${t.cite}`).join("\n")}>
      {show.map((t) => (
        <span key={t.id} className={`tag-chip static kind-${t.kind}`} title={t.cite}>
          {t.label}
        </span>
      ))}
    </div>
  );
}

function TagFilterBar({
  options,
  active,
  onToggle,
  onClear,
  showing,
  total,
}: {
  options: InsightTagId[];
  active: InsightTagId[];
  onToggle: (id: InsightTagId) => void;
  onClear: () => void;
  showing: number;
  total: number;
}) {
  return (
    <div className="tag-filter-bar">
      <div className="tag-census-head">
        <span className="block-label">Filter by analysis tags</span>
        {active.length > 0 && (
          <span className="muted">
            Showing {showing} of {total}
          </span>
        )}
      </div>
      <div className="tag-filter-row">
        {options.map((id) => (
          <button
            key={id}
            type="button"
            className={active.includes(id) ? "tag-chip on" : "tag-chip"}
            onClick={() => onToggle(id)}
          >
            {prettyTag(id)}
          </button>
        ))}
        {active.length > 0 && (
          <button type="button" className="btn ghost sm" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

function prettyTag(id: InsightTagId): string {
  const map: Record<InsightTagId, string> = {
    buy_sell: "Buy-sell",
    key_person: "Key person",
    liquidity: "Liquidity event",
    succession: "Succession",
    policy_window: "Policy window",
    referral: "Warm referral",
    prior_inbound: "Prior inbound",
    high_value: "High value",
    decision_maker: "Decision maker",
    recent_reopen: "Recent reopen",
    recoverable: "Recoverable gap",
    careful_gap: "Careful gap",
    do_not_cold_call: "Do not cold-call",
    phone_ready: "Phone ready",
    thin_file: "Thin file",
    linkedin_only: "LinkedIn only",
    duplicate_suspect: "Possible duplicate",
    approach_caution: "Approach with care",
  };
  return map[id] ?? id;
}

function Stat({
  label,
  value,
  warn,
  danger,
  good,
}: {
  label: string;
  value: number | string;
  warn?: boolean;
  danger?: boolean;
  good?: boolean;
}) {
  const cls = danger
    ? "stat warn danger"
    : warn
      ? "stat warn"
      : good
        ? "stat good"
        : "stat";
  return (
    <div className={cls}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function AiResultStat({
  value,
  label,
  tone = "neutral",
}: {
  value: number;
  label: string;
  tone?: "neutral" | "good" | "warn" | "danger";
}) {
  return (
    <div className={`ai-result-stat ${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

const ACTION_LABELS: Record<NextBestAction, string> = {
  call_now: "Call now",
  verify_first: "Verify first",
  ask_referrer: "Ask referrer",
  email_first: "Email first",
  wait: "Wait for timing",
  merge_records: "Merge records",
  find_contact: "Find contact",
  do_not_contact: "Do not contact",
};

function AnalysisStrip({
  analysis,
  compact = false,
}: {
  analysis: ProspectAnalysis;
  compact?: boolean;
}) {
  const overdue = analysis.timeline.filter((item) => item.status === "overdue").length;
  return (
    <div className={compact ? "analysis-strip compact" : "analysis-strip"}>
      <span className={`confidence confidence-${confidenceBand(analysis.evidenceConfidence)}`}>
        {analysis.evidenceConfidence}% evidence
      </span>
      <span className={`next-action action-${analysis.nextAction}`}>
        {ACTION_LABELS[analysis.nextAction]}
      </span>
      {overdue > 0 && <span className="analysis-alert">{overdue} overdue trigger</span>}
      {analysis.contradictions.length > 0 && (
        <span className="analysis-alert">
          {analysis.contradictions.length} contradiction
          {analysis.contradictions.length > 1 ? "s" : ""}
        </span>
      )}
      <span className={analysis.mode === "ai" ? "mode-badge ai" : "mode-badge"}>
        {analysis.mode === "ai" ? "AI + rules" : "Rules"}
      </span>
    </div>
  );
}

function confidenceBand(value: number) {
  if (value >= 75) return "high";
  if (value >= 50) return "medium";
  return "low";
}

function AnalysisDetail({ analysis }: { analysis: ProspectAnalysis }) {
  return (
    <div className="analysis-detail">
      <AnalysisStrip analysis={analysis} />
      <div className="next-action-panel">
        <span className="block-label">Recommended next action</span>
        <strong>{ACTION_LABELS[analysis.nextAction]}</strong>
        <p>{analysis.nextActionReason}</p>
      </div>

      {(analysis.facts.length > 0 || analysis.timeline.length > 0) && (
        <div className="analysis-columns">
          {analysis.facts.length > 0 && (
            <div>
              <span className="block-label">Facts extracted from file</span>
              <ul className="fact-list">
                {analysis.facts.slice(0, 5).map((item, index) => (
                  <li key={`${item.label}-${index}`}>
                    <strong>{item.label}</strong>
                    <span>{item.value}</span>
                    <q>{item.quote}</q>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {analysis.timeline.length > 0 && (
            <div>
              <span className="block-label">Relationship timeline</span>
              <ul className="timeline-list">
                {analysis.timeline.map((item, index) => (
                  <li key={`${item.label}-${index}`} className={`timeline-${item.status}`}>
                    <span className="timeline-dot" />
                    <div>
                      <strong>{item.label}</strong>
                      <span>{item.date ?? "Date unresolved"} · {item.status}</span>
                      <q>{item.quote}</q>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {analysis.contradictions.length > 0 && (
        <div className="contradiction-panel">
          <span className="block-label">Resolve before outreach</span>
          {analysis.contradictions.map((item, index) => (
            <div key={`${item.label}-${index}`} className="contradiction-row">
              <strong>{item.label}</strong>
              <span>{item.left}</span>
              <span>↔ {item.right}</span>
              <q>{item.quote}</q>
            </div>
          ))}
        </div>
      )}

      {analysis.discoveryQuestions.length > 0 && (
        <div className="discovery-panel">
          <span className="block-label">Questions that test the thesis</span>
          <ol>
            {analysis.discoveryQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function WebEvidenceCard({ packet }: { packet: WebEvidencePacket }) {
  return (
    <div className="web-evidence-card">
      <div className="web-evidence-head">
        <div>
          <span className="block-label">Public business evidence · review only</span>
          <strong>{packet.identityStatus === "matched" ? "Identity matched" : packet.identityStatus === "possible" ? "Possible match" : "Identity unresolved"}</strong>
        </div>
        <span className={`identity-status ${packet.identityStatus}`}>{packet.identityStatus}</span>
      </div>
      <p>{packet.identityReason}</p>
      {packet.claims.map((claim, index) => (
        <article key={`${claim.url}-${index}`} className="web-claim">
          <div>
            <span className={`claim-status ${claim.status}`}>{claim.status}</span>
            <strong>{claim.claim}</strong>
          </div>
          <q>{claim.excerpt}</q>
          <a href={claim.url} target="_blank" rel="noreferrer">
            {claim.publisher} ↗
          </a>
        </article>
      ))}
      {packet.whyNow && (
        <p className="web-why-now">
          <strong>Possible why now:</strong> {packet.whyNow}
        </p>
      )}
      <small>Public evidence never changes hard stops or authorizes outreach automatically.</small>
    </div>
  );
}

function CallMode({
  p,
  index,
  total,
  talk,
  outcome,
  reason,
  analysis,
  webEvidence,
  analysisBusy,
  onRefreshEvidence,
  onTalk,
  onOutcome,
  onReason,
  onPrev,
  onNext,
}: {
  p: RankedProspect;
  index: number;
  total: number;
  talk: string;
  outcome: Outcome;
  reason: string;
  analysis?: ProspectAnalysis;
  webEvidence?: WebEvidencePacket;
  analysisBusy: boolean;
  onRefreshEvidence: () => void;
  onTalk: (t: string) => void;
  onOutcome: (o: Outcome) => void;
  onReason: (v: "yes" | "stale") => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const blocked = p.silenceBucket === "do_not_cold_call";

  return (
    <section className="call-mode funnel-card">
      <div className="call-progress">
        Call {index + 1} / {total}
      </div>
      <h2>{p.name}</h2>
      <p className="why-call call-why">
        <span className="why-label">Call because</span>
        {p.whyCall}
      </p>
      {p.whySupport ? <p className="why-support">{p.whySupport}</p> : null}
      <InsightTagRow tags={p.tags} />
      <div className="score-pills">
        <span>Opportunity {p.opportunity}</span>
        <span>Reachability {p.reachability}</span>
        <span>{silenceLabel(p.silenceBucket)}</span>
      </div>
      <p className="meta-line">
        {p.title ? `${p.title} · ` : ""}
        {p.company ?? "No company"}
      </p>
      <p className="meta-line">
        {p.phone ? (
          <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`}>{p.phone}</a>
        ) : (
          "No phone"
        )}
        {" · "}
        {p.email ?? "No email"}
      </p>

      {analysis && <AnalysisDetail analysis={analysis} />}

      <div className="evidence-refresh-row">
        <div>
          <span className="block-label">Optional public evidence refresh</span>
          <p>
            Search only public business sources for role/company confirmation and material changes.
          </p>
        </div>
        <button
          type="button"
          className="btn"
          disabled={analysisBusy || !p.company}
          onClick={onRefreshEvidence}
        >
          {analysisBusy ? "Researching…" : webEvidence ? "Refresh again" : "Check public evidence"}
        </button>
      </div>
      {webEvidence && <WebEvidenceCard packet={webEvidence} />}

      {blocked ? (
        <div className="blocked-call">
          <strong>Hard stop</strong>
          <p>This person is in do-not-cold-call. They should not be on an active call list.</p>
          <button type="button" className="btn" onClick={onNext}>
            Skip to next
          </button>
        </div>
      ) : (
        <>
          <label className="block-label">Script</label>
          <textarea value={talk} onChange={(e) => onTalk(e.target.value)} rows={5} />

          <label className="block-label">Did the file reason still hold?</label>
          <div className="filters">
            <button
              type="button"
              className={reason === "yes" ? "chip on" : "chip"}
              onClick={() => onReason("yes")}
            >
              Yes
            </button>
            <button
              type="button"
              className={reason === "stale" ? "chip on" : "chip"}
              onClick={() => onReason("stale")}
            >
              Stale
            </button>
          </div>

          <div className="call-actions">
            {(
              [
                ["called", "Called"],
                ["meeting", "Meeting"],
                ["not_now", "Not now"],
                ["wrong_number", "Wrong number"],
                ["do_not_contact", "Do not contact"],
                ["sale", "Sale"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={outcome === value ? "btn primary" : "btn"}
                onClick={() => {
                  onOutcome(value);
                  onNext();
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="actions">
        <button type="button" className="btn" onClick={onPrev} disabled={index === 0}>
          Previous
        </button>
        <button type="button" className="btn ghost" onClick={onNext}>
          Next without changing
        </button>
      </div>
    </section>
  );
}

function ReviewBook({
  ranked,
  analyses,
  allCount,
  filterOptions,
  tagFilters,
  onToggleTag,
  onClearTags,
  selectedIds,
  talkEdits,
  outcomes,
  onToggle,
  onTalk,
  onOutcome,
  onMerge,
  onBuild,
  onBack,
}: {
  ranked: RankedProspect[];
  analyses: Record<string, ProspectAnalysis>;
  allCount: number;
  filterOptions: InsightTagId[];
  tagFilters: InsightTagId[];
  onToggleTag: (id: InsightTagId) => void;
  onClearTags: () => void;
  selectedIds: string[];
  talkEdits: Record<string, string>;
  outcomes: Record<string, Outcome>;
  onToggle: (id: string) => void;
  onTalk: (id: string, t: string) => void;
  onOutcome: (id: string, o: Outcome) => void;
  onMerge: (keepId: string, dropId: string) => void;
  onBuild: () => void;
  onBack: () => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(ranked[0]?.id ?? null);
  const active = ranked.find((p) => p.id === activeId) ?? ranked[0] ?? null;
  const top = topCallable(ranked, 20);

  return (
    <section className="funnel-card">
      <div className="plan-header">
        <div>
          <p className="eyebrow">Optional deep dive</p>
          <h2>
            Full book ({ranked.length}
            {tagFilters.length ? ` of ${allCount}` : ""})
          </h2>
          <p className="muted">Filter by analysis tags. Default path does not need this screen.</p>
        </div>
        <div className="toolbar">
          <button type="button" className="btn primary" onClick={onBuild}>
            Build week from top callable
          </button>
          <button type="button" className="btn" onClick={onBack}>
            Back to funnel
          </button>
        </div>
      </div>
      {filterOptions.length > 0 && (
        <TagFilterBar
          options={filterOptions}
          active={tagFilters}
          onToggle={onToggleTag}
          onClear={onClearTags}
          showing={ranked.length}
          total={allCount}
        />
      )}
      <div className="main-grid">
        <div className="queue">
          <ul>
            {ranked.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={active?.id === p.id ? "row on" : "row"}
                  onClick={() => setActiveId(p.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(p.id)}
                    onChange={() => onToggle(p.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="score">{p.score}</span>
                  <span className="dual">
                    <abbr title="Opportunity">{p.opportunity}</abbr>
                    <abbr title="Reachability">{p.reachability}</abbr>
                  </span>
                  <span className={`tier ${p.tier}`}>{p.tier}</span>
                  <span className="name">{p.name}</span>
                  <span className="meta">
                    {p.tags
                      .filter((t) => t.kind === "opportunity")
                      .slice(0, 2)
                      .map((t) => t.label)
                      .join(" · ") || (p.company ?? "—")}
                  </span>
                  {analyses[p.id] && (
                    <span className="meta">{analyses[p.id].evidenceConfidence}% evidence</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <aside className="detail">
          {active && (
            <div>
              <h2>{active.name}</h2>
              <p className="why-call">
                <span className="why-label">Call because</span>
                {active.whyCall}
              </p>
              {active.whySupport ? <p className="why-support">{active.whySupport}</p> : null}
              <InsightTagRow tags={active.tags} />
              {analyses[active.id] && <AnalysisDetail analysis={analyses[active.id]} />}
              <p className="meta-line">{silenceLabel(active.silenceBucket)}</p>
              {active.duplicateOf.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="btn"
                  onClick={() => onMerge(active.id, id)}
                >
                  Merge {id} into this record
                </button>
              ))}
              <h3>Why</h3>
              <ul className="evidence">
                {active.reasons.map((e, i) => (
                  <li key={i}>
                    <strong>{e.field}</strong>: {e.snippet}
                  </li>
                ))}
              </ul>
              <h3>Risks</h3>
              <ul className="evidence risk">
                {active.risks.map((e, i) => (
                  <li key={i}>
                    <strong>{e.field}</strong>: {e.snippet}
                  </li>
                ))}
              </ul>
              <textarea
                value={talkEdits[active.id] ?? active.talkTrack}
                onChange={(e) => onTalk(active.id, e.target.value)}
                rows={4}
              />
              <select
                className="mt"
                value={outcomes[active.id] ?? active.outcome}
                onChange={(e) => onOutcome(active.id, e.target.value as Outcome)}
              >
                {(
                  [
                    "queued",
                    "called",
                    "meeting",
                    "sale",
                    "not_now",
                    "wrong_number",
                    "skip",
                    "do_not_contact",
                  ] as Outcome[]
                ).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <p className="muted tiny">Top callable preview: {top.length} people</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
