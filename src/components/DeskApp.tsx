"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { runDemoEval } from "@/lib/eval";
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
  const loadDemoBook = useDesk((s) => s.loadDemoBook);
  const runPanelDemo = useDesk((s) => s.runPanelDemo);
  const loadProspects = useDesk((s) => s.loadProspects);
  const toggleSelect = useDesk((s) => s.toggleSelect);
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
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [csvError, setCsvError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const contacted = campaignRows.filter((p) => (outcomes[p.id] ?? p.outcome) !== "queued").length;
  const blockCalling =
    !!importSummary &&
    importSummary.callableThisWeek === 0 &&
    importSummary.total > 0;

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
    setMapping(suggested);
    if (!suggested.name) {
      setCsvError("Could not detect a Name column. Map columns, then continue.");
      return;
    }
    loadProspects(prospectsFromMappedRows(rows, suggested), label);
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
      `CSV with column mapping (${pendingRows.length} rows)`,
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
        Saved in this browser only · No CRM or inbox connection required
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
            <button type="button" className="btn primary lg" onClick={runPanelDemo}>
              Run panel demo
            </button>
            <button type="button" className="btn" onClick={loadDemoBook}>
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
                Each person has a cited reason and a risk stance. Exclusions are intentional.
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

          <div className="plan-list">
            {campaignRows.map((p, i) => (
              <article key={p.id} className="plan-item">
                <div className="plan-index">{i + 1}</div>
                <div className="plan-body">
                  <div className="plan-title-row">
                    <h3>{p.name}</h3>
                    <span className={`tier ${p.tier}`}>{p.tier}</span>
                    <span className="silence-pill">{silenceLabel(p.silenceBucket)}</span>
                  </div>
                  <p className="brief">{p.brief}</p>
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
          ranked={rankedLive}
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

function CallMode({
  p,
  index,
  total,
  talk,
  outcome,
  reason,
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
      <p className="brief">{p.brief}</p>
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
          <h2>Full book ({ranked.length})</h2>
          <p className="muted">For defensibility. Default path does not need this screen.</p>
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
                  <span className="meta">{p.company ?? "—"}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <aside className="detail">
          {active && (
            <div>
              <h2>{active.name}</h2>
              <p className="brief">{active.brief}</p>
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
