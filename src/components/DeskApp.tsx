"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { runDemoEval } from "@/lib/eval";
import {
  prospectsFromMappedRows,
  suggestColumnMapping,
} from "@/lib/rank";
import { useDesk } from "@/lib/store";
import type {
  ColumnMapping,
  FieldKey,
  Outcome,
  RankedProspect,
  SilenceBucket,
  WizardStep,
} from "@/lib/types";

const OUTCOMES: Outcome[] = [
  "queued",
  "called",
  "meeting",
  "sale",
  "skip",
  "do_not_contact",
];

const STEPS: { id: WizardStep; label: string }[] = [
  { id: "import", label: "1. Import" },
  { id: "rank", label: "2. Rankings" },
  { id: "campaign", label: "3. This week" },
  { id: "call", label: "4. Call mode" },
  { id: "done", label: "5. Export" },
];

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
  const importSummary = useDesk((s) => s.importSummary);
  const step = useDesk((s) => s.step);
  const callIndex = useDesk((s) => s.callIndex);
  const outcomes = useDesk((s) => s.outcomes);
  const loadSynthetic = useDesk((s) => s.loadSynthetic);
  const runDemoAutopilot = useDesk((s) => s.runDemoAutopilot);
  const loadProspects = useDesk((s) => s.loadProspects);
  const toggleSelect = useDesk((s) => s.toggleSelect);
  const selectTopCallable = useDesk((s) => s.selectTopCallable);
  const clearSelection = useDesk((s) => s.clearSelection);
  const setOutcome = useDesk((s) => s.setOutcome);
  const setTalkEdit = useDesk((s) => s.setTalkEdit);
  const createCampaignFromSelection = useDesk((s) => s.createCampaignFromSelection);
  const setStep = useDesk((s) => s.setStep);
  const setCallIndex = useDesk((s) => s.setCallIndex);
  const mergeDuplicatePair = useDesk((s) => s.mergeDuplicatePair);
  const rankedFn = useDesk((s) => s.ranked);
  const resetAll = useDesk((s) => s.resetAll);

  const [filter, setFilter] = useState<"top20" | "all" | "hot" | "warm" | "thin" | "risk" | SilenceBucket>("top20");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
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

  const visible = useMemo(() => {
    let list = rankedLive;
    if (filter === "top20") list = rankedLive.slice(0, 20);
    else if (filter === "all") list = rankedLive;
    else if (
      filter === "safe_reopen" ||
      filter === "handle_with_care" ||
      filter === "do_not_cold_call"
    ) {
      list = rankedLive.filter((p) => p.silenceBucket === filter);
    } else {
      list = rankedLive.filter((p) => p.tier === filter);
    }
    return list;
  }, [rankedLive, filter]);

  const active =
    rankedLive.find((p) => p.id === activeId) ?? visible[0] ?? null;

  const campaignRows = campaign
    ? campaign.prospectIds
        .map((id) => rankedLive.find((p) => p.id === id))
        .filter(Boolean) as RankedProspect[]
    : [];

  const contacted = campaignRows.filter((p) => {
    const o = outcomes[p.id] ?? p.outcome;
    return o !== "queued";
  }).length;

  useEffect(() => {
    if (campaign && step === "rank") setStep("campaign");
  }, [campaign, step, setStep]);

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
    if (!headers.length) {
      setCsvError("Need a Name column (or map one in the next step).");
      return;
    }
    const suggested = suggestColumnMapping(headers);
    if (!suggested.name) {
      setPendingRows(rows);
      setPendingHeaders(headers);
      setMapping(suggested);
      setCsvError("Could not detect a Name column. Map columns below, then continue.");
      return;
    }
    // If mapping looks complete enough, load directly; still allow remap
    setPendingRows(rows);
    setPendingHeaders(headers);
    setMapping(suggested);
    loadProspects(prospectsFromMappedRows(rows, suggested), label);
  };

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      parseCsvText(String(reader.result ?? ""), `CSV upload: ${file.name}`);
    };
    reader.readAsText(file);
  };

  const applyMapping = () => {
    if (!pendingRows) return;
    if (!mapping.name) {
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
      tier: p.tier,
      silence_bucket: p.silenceBucket,
      company: p.company ?? "",
      phone: p.phone ?? "",
      email: p.email ?? "",
      outcome: outcomes[p.id] ?? p.outcome,
      talk_track: talkEdits[p.id] ?? p.talkTrack,
      brief: p.brief,
      top_reason: p.reasons[0]?.snippet ?? "",
      top_risk: p.risks[0]?.snippet ?? "",
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${campaign.name.replace(/\s+/g, "-")}-outcomes.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setStep("done");
  };

  const callCard = campaignRows[callIndex] ?? null;
  const blockCampaign =
    importSummary != null &&
    importSummary.missingContact === importSummary.total &&
    importSummary.total > 0;

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
      <div className="persist-banner">
        Saved in this browser only (localStorage). Not synced across devices.
      </div>

      <header className="desk-header">
        <div>
          <p className="eyebrow">Reactivation Desk</p>
          <h1>Who should you call this week?</h1>
          <p className="sub">
            Upload a messy prospect book. Get a ranked list with evidence, safer scripts,
            and a durable outcome log. You stay in control of every outreach.
          </p>
        </div>
        <div className="header-links">
          <Link href="/memo">Decision memo</Link>
          <button type="button" className="linkish" onClick={() => setShowDetails((v) => !v)}>
            {showDetails ? "Hide details" : "Pricing & hard nos"}
          </button>
        </div>
      </header>

      {showDetails && (
        <section className="details-panel">
          <div>
            <strong>$299/mo</strong> independent advisor · or $1,500 cleanup sprint + $99/mo
          </div>
          <ul>
            <li>No continuous CRM / email access</li>
            <li>No auto-send</li>
            <li>Scores cite row evidence or ask for review</li>
          </ul>
        </section>
      )}

      <nav className="steps" aria-label="Workflow steps">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={step === s.id ? "step on" : "step"}
            onClick={() => {
              if (s.id === "import" || prospects.length) setStep(s.id);
            }}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {step === "import" && prospects.length === 0 && (
        <section className="hero-empty">
          <h2>Start in under two minutes</h2>
          <p>Best for the panel: run the guided demo, then walk evidence and call mode.</p>
          <div className="toolbar">
            <button type="button" className="btn primary lg" onClick={runDemoAutopilot}>
              Start demo (2 min)
            </button>
            <button type="button" className="btn" onClick={loadSynthetic}>
              Load synthetic book only
            </button>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              Upload my CSV
            </button>
            <a className="btn ghost" href="/sample-prospects.csv" download>
              Download CSV template
            </a>
          </div>
          {csvError && <p className="error">{csvError}</p>}
        </section>
      )}

      {pendingRows && (
        <section className="mapper">
          <h2>Map CSV columns</h2>
          <p className="muted">We guessed what we could. Fix anything wrong, then apply.</p>
          <div className="mapper-grid">
            {(Object.keys(FIELD_LABELS) as FieldKey[]).map((field) => (
              <label key={field}>
                <span>{FIELD_LABELS[field]}</span>
                <select
                  value={mapping[field] ?? ""}
                  onChange={(e) =>
                    setMapping((m) => ({
                      ...m,
                      [field]: e.target.value || undefined,
                    }))
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
            Apply mapping &amp; rank
          </button>
        </section>
      )}

      {prospects.length > 0 && (
        <>
          <div className="source-row">
            <p className="source">{sourceLabel}</p>
            <div className="toolbar">
              <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
                Replace CSV
              </button>
              <button type="button" className="btn ghost" onClick={resetAll}>
                Reset
              </button>
            </div>
          </div>

          {importSummary && (
            <section className="import-summary">
              <h2>Import summary</h2>
              <div className="stat-row">
                <Stat label="Contacts" value={importSummary.total} />
                <Stat label="Missing phone+email" value={importSummary.missingContact} warn />
                <Stat label="Thin files" value={importSummary.thinFiles} />
                <Stat label="Duplicate names" value={importSummary.duplicateGroups} warn />
                <Stat label="Long silence" value={importSummary.longSilence} />
              </div>
              {importSummary.parseWarnings.map((w) => (
                <p key={w} className="error">
                  {w}
                </p>
              ))}
              {blockCampaign && (
                <p className="error">
                  Campaign calling is blocked until at least some rows have phone or email.
                </p>
              )}
            </section>
          )}

          {campaign && (
            <section className="campaign-hero">
              <div className="campaign-hero-top">
                <div>
                  <h2>{campaign.name}</h2>
                  <p className="muted">
                    Progress {contacted}/{campaignRows.length} logged · this is the product
                  </p>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${campaignRows.length ? (contacted / campaignRows.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="actions">
                  <button type="button" className="btn primary" onClick={() => setStep("call")}>
                    Open call mode
                  </button>
                  <button type="button" className="btn" onClick={exportCampaign}>
                    Export campaign CSV
                  </button>
                </div>
              </div>
            </section>
          )}

          {step === "call" && callCard && (
            <CallMode
              p={callCard}
              index={callIndex}
              total={campaignRows.length}
              talk={talkEdits[callCard.id] ?? callCard.talkTrack}
              outcome={outcomes[callCard.id] ?? callCard.outcome}
              onTalk={(t) => setTalkEdit(callCard.id, t)}
              onOutcome={(o) => setOutcome(callCard.id, o)}
              onPrev={() => setCallIndex(Math.max(0, callIndex - 1))}
              onNext={() => {
                if (callIndex < campaignRows.length - 1) setCallIndex(callIndex + 1);
                else setStep("done");
              }}
            />
          )}

          {step === "call" && !callCard && (
            <p className="muted">Create a campaign first (select people, then build this week).</p>
          )}

          {(step === "rank" || step === "campaign" || step === "done") && (
            <>
              <section className="campaign-bar">
                <div className="filters">
                  {(
                    [
                      "top20",
                      "all",
                      "hot",
                      "warm",
                      "thin",
                      "risk",
                      "safe_reopen",
                      "handle_with_care",
                      "do_not_cold_call",
                    ] as const
                  ).map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={filter === f ? "chip on" : "chip"}
                      onClick={() => setFilter(f)}
                    >
                      {f === "top20"
                        ? "Top 20"
                        : f === "safe_reopen"
                          ? "Safe reopen"
                          : f === "handle_with_care"
                            ? "Handle with care"
                            : f === "do_not_cold_call"
                              ? "Do not cold-call"
                              : f}
                    </button>
                  ))}
                </div>
                <div className="actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => selectTopCallable(10)}
                    disabled={blockCampaign}
                  >
                    Select top 10 callable
                  </button>
                  <button type="button" className="btn" onClick={() => selectTopCallable(20)}>
                    20-person batch
                  </button>
                  <button type="button" className="btn" onClick={clearSelection}>
                    Clear ({selectedIds.length})
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => {
                      createCampaignFromSelection();
                    }}
                    disabled={!selectedIds.length || blockCampaign}
                  >
                    Build this week&apos;s list
                  </button>
                </div>
              </section>

              <div className="main-grid">
                <div className="queue">
                  <h2>Ranked queue ({visible.length})</h2>
                  <p className="muted tiny">
                    Sorted by opportunity × reachability. Default shows top 20.
                  </p>
                  <ul>
                    {visible.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className={
                            active?.id === p.id
                              ? "row on"
                              : selectedIds.includes(p.id)
                                ? "row selected"
                                : "row"
                          }
                          onClick={() => setActiveId(p.id)}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(p.id)}
                            onChange={() => toggleSelect(p.id)}
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
                          {p.needsReview && <span className="flag">review</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <aside className="detail">
                  {active ? (
                    <Detail
                      p={active}
                      talk={talkEdits[active.id] ?? active.talkTrack}
                      outcome={outcomes[active.id] ?? active.outcome}
                      selected={selectedIds.includes(active.id)}
                      onToggle={() => toggleSelect(active.id)}
                      onTalk={(t) => setTalkEdit(active.id, t)}
                      onOutcome={(o) => setOutcome(active.id, o)}
                      onMerge={(dropId) => mergeDuplicatePair(active.id, dropId)}
                    />
                  ) : (
                    <p>Select a contact.</p>
                  )}
                </aside>
              </div>
            </>
          )}

          {step === "done" && (
            <section className="done-panel">
              <h2>Campaign ready to export</h2>
              <p>
                Logged {contacted} of {campaignRows.length}. Export keeps the durable artifact
                for next week&apos;s learning.
              </p>
              <button type="button" className="btn primary" onClick={exportCampaign}>
                Download outcomes CSV
              </button>
            </section>
          )}

          <section className="eval-strip">
            <h2>Demo eval (precision@10 on synthetic labels)</h2>
            <p className="muted">
              Model {Math.round(evalScores.model * 100)}% · Recency-only{" "}
              {Math.round(evalScores.recency * 100)}% · Random{" "}
              {Math.round(evalScores.random * 100)}% · labeled pool {evalScores.relevantCount}
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div className={warn && value > 0 ? "stat warn" : "stat"}>
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
  onTalk,
  onOutcome,
  onPrev,
  onNext,
}: {
  p: RankedProspect;
  index: number;
  total: number;
  talk: string;
  outcome: Outcome;
  onTalk: (t: string) => void;
  onOutcome: (o: Outcome) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <section className="call-mode">
      <div className="call-progress">
        Call mode {index + 1} / {total}
      </div>
      <h2>{p.name}</h2>
      <p className="brief">{p.brief}</p>
      <p className="meta-line">
        {p.title ? `${p.title} · ` : ""}
        {p.company ?? "No company"} · {silenceLabel(p.silenceBucket)}
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
      <label className="block-label">Script</label>
      <textarea value={talk} onChange={(e) => onTalk(e.target.value)} rows={5} />
      <div className="call-actions">
        {(
          [
            ["called", "Called"],
            ["meeting", "Meeting"],
            ["skip", "Skip"],
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
      <div className="actions">
        <button type="button" className="btn" onClick={onPrev} disabled={index === 0}>
          Previous
        </button>
        <button type="button" className="btn" onClick={onNext}>
          Next without changing
        </button>
      </div>
      <select
        className="mt"
        value={outcome}
        onChange={(e) => onOutcome(e.target.value as Outcome)}
      >
        {OUTCOMES.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </section>
  );
}

function Detail({
  p,
  talk,
  outcome,
  selected,
  onToggle,
  onTalk,
  onOutcome,
  onMerge,
}: {
  p: RankedProspect;
  talk: string;
  outcome: Outcome;
  selected: boolean;
  onToggle: () => void;
  onTalk: (t: string) => void;
  onOutcome: (o: Outcome) => void;
  onMerge: (dropId: string) => void;
}) {
  return (
    <div>
      <div className="detail-head">
        <h2>{p.name}</h2>
        <button type="button" className="btn" onClick={onToggle}>
          {selected ? "On this week’s list" : "Add to this week"}
        </button>
      </div>
      <p className="brief">{p.brief}</p>
      <div className="score-pills">
        <span>Opportunity {p.opportunity}</span>
        <span>Reachability {p.reachability}</span>
        <span>Combined {p.score}</span>
        <span>{silenceLabel(p.silenceBucket)}</span>
      </div>
      <p className="meta-line">
        {p.title ? `${p.title} · ` : ""}
        {p.company ?? "No company"} · {p.segment ?? "No segment"}
      </p>
      <p className="meta-line">
        {p.phone ? <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`}>{p.phone}</a> : "No phone"}
        {" · "}
        {p.email ?? "No email"} · Last touch: {p.lastTouch ?? "?"}
      </p>

      {p.duplicateOf.length > 0 && (
        <div className="merge-box">
          <p>Possible duplicates found.</p>
          {p.duplicateOf.map((id) => (
            <button
              key={id}
              type="button"
              className="btn"
              onClick={() => onMerge(id)}
            >
              Merge {id} into this record
            </button>
          ))}
        </div>
      )}

      <h3>Why this person</h3>
      <ul className="evidence">
        {p.reasons.map((e, i) => (
          <li key={`r-${i}`}>
            <strong>{e.field}</strong> [{e.weight}]: {e.snippet}
          </li>
        ))}
      </ul>

      <h3>Review before calling</h3>
      <ul className="evidence risk">
        {p.risks.length ? (
          p.risks.map((e, i) => (
            <li key={`k-${i}`}>
              <strong>{e.field}</strong> [{e.weight}]: {e.snippet}
            </li>
          ))
        ) : (
          <li>No high risks flagged</li>
        )}
      </ul>

      <h3>Script (editable, grounded in file)</h3>
      <textarea value={talk} onChange={(e) => onTalk(e.target.value)} rows={5} />

      <h3>Outcome</h3>
      <select value={outcome} onChange={(e) => onOutcome(e.target.value as Outcome)}>
        {OUTCOMES.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
