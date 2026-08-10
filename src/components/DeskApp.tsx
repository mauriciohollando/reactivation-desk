"use client";

import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  SPRINT_PRICE,
  SUBSCRIPTION_PRICE,
  accessLabel,
  canUseDesk,
} from "@/lib/access";
import type { InsightTag } from "@/lib/insightTags";
import {
  excludedFromPlan,
  prospectsFromMappedRows,
  suggestColumnMapping,
} from "@/lib/rank";
import { useDesk } from "@/lib/store";
import { TAG_PRESETS } from "@/lib/tagPresets";
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
  { id: "diagnose", label: "Ready" },
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
  const allowedTags = useDesk((s) => s.allowedTags);
  const tagPresetId = useDesk((s) => s.tagPresetId);
  const access = useDesk((s) => s.access);
  const enrichStatus = useDesk((s) => s.enrichStatus);
  const enrichError = useDesk((s) => s.enrichError);
  const noteStatus = useDesk((s) => s.noteStatus);
  const noteError = useDesk((s) => s.noteError);
  const aiAnalyzedCount = useDesk((s) => s.aiAnalyzedCount);
  const analysisError = useDesk((s) => s.analysisError);
  const loadDemoBook = useDesk((s) => s.loadDemoBook);
  const loadProspects = useDesk((s) => s.loadProspects);
  const setTagPreset = useDesk((s) => s.setTagPreset);
  const toggleAllowedTag = useDesk((s) => s.toggleAllowedTag);
  const addCustomTag = useDesk((s) => s.addCustomTag);
  const unlockAccess = useDesk((s) => s.unlockAccess);
  const unlockWithPromo = useDesk((s) => s.unlockWithPromo);
  const toggleTagFilter = useDesk((s) => s.toggleTagFilter);
  const clearTagFilters = useDesk((s) => s.clearTagFilters);
  const enrichImportedBook = useDesk((s) => s.enrichImportedBook);
  const appendProspectNote = useDesk((s) => s.appendProspectNote);
  const buildWeekPlan = useDesk((s) => s.buildWeekPlan);
  const setOutcome = useDesk((s) => s.setOutcome);
  const setTalkEdit = useDesk((s) => s.setTalkEdit);
  const setReasonHeld = useDesk((s) => s.setReasonHeld);
  const setStep = useDesk((s) => s.setStep);
  const setCallIndex = useDesk((s) => s.setCallIndex);
  const setWeekBudget = useDesk((s) => s.setWeekBudget);
  const setPreferWarm = useDesk((s) => s.setPreferWarm);
  const rankedFn = useDesk((s) => s.ranked);
  const resetAll = useDesk((s) => s.resetAll);

  const [pendingRows, setPendingRows] = useState<Record<string, string>[] | null>(null);
  const [pendingHeaders, setPendingHeaders] = useState<string[]>([]);
  const [pendingSourceLabel, setPendingSourceLabel] = useState("CSV upload");
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [csvError, setCsvError] = useState<string | null>(null);
  const [customTag, setCustomTag] = useState("");
  const [promo, setPromo] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [showExcluded, setShowExcluded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const canImport = canUseDesk(access);
  const rankedLive = useMemo(
    () => rankedFn(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prospects, outcomes, rankedFn],
  );
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

  const contacted = campaignRows.filter(
    (p) => (outcomes[p.id] ?? p.outcome) !== "queued",
  ).length;
  const blockCalling =
    !!importSummary &&
    importSummary.callableThisWeek === 0 &&
    importSummary.total > 0;
  const callCard = campaignRows[callIndex] ?? null;

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
      setCsvError("No data rows found.");
      return;
    }
    const headers = Object.keys(rows[0] ?? {});
    setPendingRows(rows);
    setPendingHeaders(headers);
    setPendingSourceLabel(label);
    setMapping(suggestColumnMapping(headers));
  };

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => parseCsvText(String(reader.result ?? ""), `CSV: ${file.name}`);
    reader.readAsText(file);
  };

  const applyMapping = () => {
    if (!pendingRows || !mapping.name) {
      setCsvError("Name column is required.");
      return;
    }
    if (!canUseDesk(access)) {
      setCsvError("Unlock a sprint or subscription first.");
      return;
    }
    loadProspects(
      prospectsFromMappedRows(pendingRows, mapping),
      `${pendingSourceLabel} · ${pendingRows.length} rows`,
    );
    setPendingRows(null);
    setCsvError(null);
  };

  const startWithDemo = () => {
    if (!canUseDesk(access)) {
      setPromoError("Unlock below first — or enter a promo code.");
      return;
    }
    loadDemoBook();
  };

  const exportCampaign = () => {
    if (!campaign) return;
    const rows = campaignRows.map((p) => ({
      name: p.name,
      company: p.company ?? "",
      phone: p.phone ?? "",
      email: p.email ?? "",
      outcome: outcomes[p.id] ?? p.outcome,
      why_call: p.whyCall,
      tags: p.tags.map((t) => t.label).join(" | "),
      notes: p.notes ?? "",
      talk_track: talkEdits[p.id] ?? p.talkTrack,
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
            <span>Who to call this week</span>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="access-pill">{accessLabel(access)}</span>
          {prospects.length > 0 && (
            <button type="button" className="btn ghost" onClick={resetAll}>
              New book
            </button>
          )}
        </div>
      </header>

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
        </nav>
      )}

      {/* IMPORT */}
      {step === "import" && prospects.length === 0 && (
        <section className="hero-empty simple-import">
          <h2>Get a finishable call list from a messy export</h2>
          <p>
            Import your book, keep tags you care about, let AI write why each person is worth
            calling — then work a short week you can finish.
          </p>

          <div className="unlock-panel">
            <h3>Start</h3>
            <div className="pricing-grid">
              <button
                type="button"
                className={access.plan === "sprint" ? "price-card on" : "price-card"}
                onClick={() => unlockAccess("sprint")}
              >
                <strong>Sprint · ${SPRINT_PRICE}</strong>
                <span>One book. One focused reactivation week.</span>
              </button>
              <button
                type="button"
                className={access.plan === "subscription" ? "price-card on" : "price-card"}
                onClick={() => unlockAccess("subscription")}
              >
                <strong>Unlimited · ${SUBSCRIPTION_PRICE}/mo</strong>
                <span>Import as often as you want. Keep notes growing.</span>
              </button>
            </div>
            <div className="promo-row">
              <input
                value={promo}
                onChange={(e) => setPromo(e.target.value)}
                placeholder="Promo code"
                aria-label="Promo code"
              />
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const result = unlockWithPromo(promo);
                  setPromoError(result.ok ? null : result.error ?? "Invalid code");
                }}
              >
                Apply
              </button>
            </div>
            {promoError && <p className="error">{promoError}</p>}
            <p className="muted tiny">
              Prototype checkout — choosing a plan unlocks the desk. Codes: DEMO, ROWAN, UNLIMITED.
            </p>
          </div>

          <div className="tag-setup">
            <h3>Tags for this book</h3>
            <p className="muted">
              AI only uses tags you allow. Pick a pack, then remove or add your own.
            </p>
            <div className="filters">
              {TAG_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={tagPresetId === preset.id ? "chip on" : "chip"}
                  onClick={() => setTagPreset(preset.id)}
                >
                  {preset.name}
                </button>
              ))}
            </div>
            <div className="tag-filter-row">
              {allowedTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className={`tag-chip on kind-${tag.kind}`}
                  onClick={() => toggleAllowedTag(tag.id)}
                  title="Click to remove"
                >
                  {tag.label} ×
                </button>
              ))}
            </div>
            <div className="promo-row">
              <input
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                placeholder="Add your own tag"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    addCustomTag(customTag);
                    setCustomTag("");
                  }
                }}
              />
              <button
                type="button"
                className="btn"
                onClick={() => {
                  addCustomTag(customTag);
                  setCustomTag("");
                }}
              >
                Add tag
              </button>
            </div>
          </div>

          <div className="toolbar">
            <button
              type="button"
              className="btn primary lg"
              disabled={!canImport}
              onClick={startWithDemo}
            >
              Use sample book
            </button>
            <button
              type="button"
              className="btn lg"
              disabled={!canImport}
              onClick={() => fileRef.current?.click()}
            >
              Upload CSV
            </button>
          </div>
          {!canImport && access.plan !== "none" && (
            <p className="error">
              Sprint already used. Choose Unlimited above, or apply promo UNLIMITED.
            </p>
          )}
          {(csvError || analysisError) && (
            <p className="error">{csvError || analysisError}</p>
          )}
        </section>
      )}

      {pendingRows && step === "import" && (
        <section className="mapper">
          <h2>Map columns</h2>
          <p className="muted">Confirm Name and Notes, then continue.</p>
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
          <div className="toolbar">
            <button type="button" className="btn primary" onClick={applyMapping}>
              Import book
            </button>
            <button type="button" className="btn ghost" onClick={() => setPendingRows(null)}>
              Cancel
            </button>
          </div>
          {csvError && <p className="error">{csvError}</p>}
        </section>
      )}

      {/* READY / DIAGNOSE */}
      {prospects.length > 0 && step === "diagnose" && importSummary && (
        <section className="funnel-card diagnose-card">
          <h2>Your book is ready</h2>
          <p className="muted source-line">{sourceLabel}</p>

          <div className="stat-row compact">
            <Stat label="In book" value={importSummary.total} />
            <Stat label="Callable" value={importSummary.callableThisWeek} good />
            <Stat label="Careful" value={importSummary.handleWithCare} warn />
            <Stat label="Off-limits" value={importSummary.doNotColdCall} danger />
          </div>

          <div className="ai-simple-card">
            <div>
              <h3>
                {aiAnalyzedCount
                  ? `AI sharpened ${aiAnalyzedCount} call reasons`
                  : "Improve reasons & tags with AI"}
              </h3>
              <p>
                Uses only your allowed tags. Writes a clearer “call because” from notes — no
                invented facts.
              </p>
            </div>
            <button
              type="button"
              className="btn ai-btn"
              disabled={enrichStatus === "running" || !allowedTags.length}
              onClick={() => void enrichImportedBook(40)}
            >
              {enrichStatus === "running"
                ? "Working…"
                : aiAnalyzedCount
                  ? "Run AI again"
                  : "Improve with AI"}
            </button>
          </div>
          {(enrichError || analysisError) && (
            <p className="error">{enrichError || analysisError}</p>
          )}

          {(importSummary.tagCensus?.length ?? 0) > 0 && (
            <div className="tag-census">
              <span className="block-label">Focus this week (optional)</span>
              <div className="tag-filter-row">
                {importSummary.tagCensus.slice(0, 12).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={
                      tagFilters.includes(t.id)
                        ? `tag-chip on kind-${t.kind}`
                        : `tag-chip kind-${t.kind}`
                    }
                    onClick={() => toggleTagFilter(t.id)}
                  >
                    {t.label}
                    <em>{t.count}</em>
                  </button>
                ))}
                {tagFilters.length > 0 && (
                  <button type="button" className="btn ghost sm" onClick={clearTagFilters}>
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="budget-row">
            <span className="block-label">Calls this week</span>
            <div className="filters">
              {([5, 10, 20] as WeekBudget[]).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={weekBudget === n ? "chip on" : "chip"}
                  onClick={() => setWeekBudget(n)}
                >
                  {n}
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

          {blockCalling && (
            <p className="error">Need phone or email on some rows before calling.</p>
          )}

          <div className="toolbar">
            <button
              type="button"
              className="btn primary lg"
              disabled={blockCalling}
              onClick={() => buildWeekPlan(weekBudget)}
            >
              Build {weekBudget}-call week
            </button>
          </div>
        </section>
      )}

      {/* PLAN */}
      {prospects.length > 0 && step === "plan" && campaign && (
        <section className="funnel-card plan-card">
          <div className="plan-header">
            <div>
              <h2>{campaign.prospectIds.length} people this week</h2>
              <p className="muted">Cited reasons. Exclusions are intentional.</p>
            </div>
            <button type="button" className="btn primary lg" onClick={() => setStep("call")}>
              Start calling
            </button>
          </div>

          <div className="plan-list">
            {filteredCampaignRows.map((p) => (
              <article key={p.id} className="plan-item">
                <div className="plan-index">
                  {campaignRows.findIndex((x) => x.id === p.id) + 1}
                </div>
                <div className="plan-body">
                  <div className="plan-title-row">
                    <h3>{p.name}</h3>
                    <span className="silence-pill">{silenceLabel(p.silenceBucket)}</span>
                  </div>
                  <p className="why-call">
                    <span className="why-label">Call because</span>
                    {p.whyCall}
                  </p>
                  <InsightTagRow tags={p.tags} />
                  <p className="meta-line">
                    {p.company ?? "No company"}
                    {" · "}
                    {p.phone ? (
                      <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`}>{p.phone}</a>
                    ) : (
                      "No phone"
                    )}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <button
            type="button"
            className="linkish"
            onClick={() => setShowExcluded((v) => !v)}
          >
            {showExcluded ? "Hide" : "Show"} exclusions ({excluded.length})
          </button>
          {showExcluded && (
            <ul className="excluded-list">
              {excluded.slice(0, 30).map((p) => (
                <li key={p.id}>
                  <strong>{p.name}</strong>
                  <span>
                    {p.silenceBucket === "do_not_cold_call"
                      ? "Do not cold-call"
                      : "Unreachable"}
                  </span>
                </li>
              ))}
            </ul>
          )}
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
          noteBusy={noteStatus === "running"}
          noteError={noteError}
          onTalk={(t) => setTalkEdit(callCard.id, t)}
          onOutcome={(o) => setOutcome(callCard.id, o)}
          onReason={(v) => setReasonHeld(callCard.id, v)}
          onAppendNote={(text) => appendProspectNote(callCard.id, text)}
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
            Back
          </button>
        </section>
      )}

      {/* WRAP */}
      {step === "wrap" && campaign && (
        <section className="funnel-card wrap-card">
          <h2>
            {contacted} of {campaignRows.length} logged
          </h2>
          <p className="muted">
            Export outcomes and keep adding notes — next week starts smarter.
          </p>
          <div className="progress-track lg">
            <div
              className="progress-fill"
              style={{
                width: `${campaignRows.length ? (contacted / campaignRows.length) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="toolbar">
            <button type="button" className="btn primary lg" onClick={exportCampaign}>
              Download week CSV
            </button>
            <button type="button" className="btn" onClick={() => setStep("plan")}>
              Back to list
            </button>
            <button type="button" className="btn ghost" onClick={resetAll}>
              Another book
            </button>
          </div>
          {access.plan === "sprint" && (
            <p className="muted tiny">
              Sprint complete. Unlock unlimited (${SUBSCRIPTION_PRICE}/mo) for the next book —
              or use promo UNLIMITED.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function InsightTagRow({ tags }: { tags: InsightTag[] }) {
  const show = tags.filter((t) => t.id !== "phone_ready").slice(0, 6);
  if (!show.length) return null;
  return (
    <div className="insight-tags">
      {show.map((t) => (
        <span key={t.id} className={`tag-chip static kind-${t.kind}`} title={t.cite}>
          {t.label}
        </span>
      ))}
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
  noteBusy,
  noteError,
  onTalk,
  onOutcome,
  onReason,
  onAppendNote,
  onPrev,
  onNext,
}: {
  p: RankedProspect;
  index: number;
  total: number;
  talk: string;
  outcome: Outcome;
  reason: string;
  noteBusy: boolean;
  noteError: string | null;
  onTalk: (t: string) => void;
  onOutcome: (o: Outcome) => void;
  onReason: (v: "yes" | "stale") => void;
  onAppendNote: (text: string) => Promise<boolean>;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [noteDraft, setNoteDraft] = useState("");
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
          <p>Do not cold-call this person.</p>
          <button type="button" className="btn" onClick={onNext}>
            Skip
          </button>
        </div>
      ) : (
        <>
          <label className="block-label">Talk track</label>
          <textarea value={talk} onChange={(e) => onTalk(e.target.value)} rows={4} />

          <label className="block-label">Add notes (typed or paste from AI notetaker)</label>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            rows={5}
            placeholder="Paste call notes or a transcript summary…"
          />
          <button
            type="button"
            className="btn ai-btn"
            disabled={noteBusy || !noteDraft.trim()}
            onClick={async () => {
              const ok = await onAppendNote(noteDraft);
              if (ok) setNoteDraft("");
            }}
          >
            {noteBusy ? "Updating file…" : "Save & update with AI"}
          </button>
          {noteError && <p className="error">{noteError}</p>}
          {p.notes && (
            <details className="notes-history">
              <summary>Notes on file</summary>
              <pre>{p.notes}</pre>
            </details>
          )}

          <label className="block-label">Did the reason still hold?</label>
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
                ["wrong_number", "Wrong #"],
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
          Next
        </button>
      </div>
    </section>
  );
}
