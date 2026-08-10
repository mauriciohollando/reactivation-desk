"use client";

import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  SPRINT_PRICE,
  SUBSCRIPTION_PRICE,
  accessLabel,
  canUseDesk,
} from "@/lib/access";
import type { CallBriefSection, CallPrepPacket } from "@/lib/callPrepTypes";
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
  const prepStatus = useDesk((s) => s.prepStatus);
  const prepError = useDesk((s) => s.prepError);
  const callPreps = useDesk((s) => s.callPreps);
  const aiAnalyzedCount = useDesk((s) => s.aiAnalyzedCount);
  const analysisError = useDesk((s) => s.analysisError);
  const loadProspects = useDesk((s) => s.loadProspects);
  const setTagPreset = useDesk((s) => s.setTagPreset);
  const toggleAllowedTag = useDesk((s) => s.toggleAllowedTag);
  const addCustomTag = useDesk((s) => s.addCustomTag);
  const unlockAccess = useDesk((s) => s.unlockAccess);
  const unlockWithPromo = useDesk((s) => s.unlockWithPromo);
  const toggleTagFilter = useDesk((s) => s.toggleTagFilter);
  const clearTagFilters = useDesk((s) => s.clearTagFilters);
  const campaignBrief = useDesk((s) => s.campaignBrief);
  const campaignInterpretedAs = useDesk((s) => s.campaignInterpretedAs);
  const setCampaignBrief = useDesk((s) => s.setCampaignBrief);
  const buildWeekWithAi = useDesk((s) => s.buildWeekWithAi);
  const openCall = useDesk((s) => s.openCall);
  const prepareCall = useDesk((s) => s.prepareCall);
  const logFreeformOutcome = useDesk((s) => s.logFreeformOutcome);
  const setOutcome = useDesk((s) => s.setOutcome);
  const setTalkEdit = useDesk((s) => s.setTalkEdit);
  const setStep = useDesk((s) => s.setStep);
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
    const seen = new Set<string>();
    const rows: RankedProspect[] = [];
    for (const id of campaign.prospectIds) {
      if (seen.has(id)) continue;
      const row = rankedLive.find((p) => p.id === id);
      if (!row) continue;
      seen.add(id);
      rows.push(row);
    }
    return rows;
  }, [campaign, rankedLive]);

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
              onClick={() => fileRef.current?.click()}
            >
              Upload CSV
            </button>
            <a className="btn ghost" href="/public-figures-test-book.csv" download>
              Download example CSV
            </a>
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
                  disabled={enrichStatus === "running"}
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
                disabled={enrichStatus === "running"}
              />
              Prefer warm reopen first
            </label>
          </div>

          {blockCalling && (
            <p className="error">Need phone or email on some rows before calling.</p>
          )}

          <div className="campaign-brief">
            <label className="block-label" htmlFor="campaign-brief">
              What kind of week do you want? (optional)
            </label>
            <textarea
              id="campaign-brief"
              value={campaignBrief}
              onChange={(e) => setCampaignBrief(e.target.value)}
              rows={3}
              disabled={enrichStatus === "running"}
              placeholder='e.g. “Find automotive / dealer companies” or “People with a warm connection or referral to me”'
            />
              <p className="muted tiny">
              Leave blank for the default ranking. With a prompt, AI curates who fits that week from
              your file (and well-known company identity). Focus chips above only influence the
              default ranking — they are cleared once the week is built.
            </p>
          </div>

          {enrichStatus === "running" ? (
            <div className="ai-building" role="status" aria-live="polite">
              <div className="ai-building-pulse" aria-hidden />
              <div>
                <strong>
                  {campaignBrief.trim()
                    ? "Curating your week from that brief…"
                    : "Building your week with AI…"}
                </strong>
                <p>
                  {campaignBrief.trim()
                    ? "Matching your instruction against the book, then writing call reasons."
                    : "Reading notes, applying your tags, and writing a concrete reason to call each person."}{" "}
                  This usually takes a few seconds.
                </p>
              </div>
            </div>
          ) : (
            <div className="build-cta">
              <button
                type="button"
                className="btn primary lg"
                disabled={blockCalling || !allowedTags.length}
                onClick={() => void buildWeekWithAi(weekBudget)}
              >
                {campaignBrief.trim()
                  ? `Build ${weekBudget}-call week from brief`
                  : `Build ${weekBudget}-call week with AI`}
              </button>
              <p className="muted tiny">
                Hard stops stay rule-based. AI only uses your file and allowed tags.
              </p>
            </div>
          )}
          {(enrichError || analysisError) && (
            <p className="error">{enrichError || analysisError}</p>
          )}
        </section>
      )}

      {/* PLAN */}
      {prospects.length > 0 && step === "plan" && campaign && (
        <section className="funnel-card plan-card">
          <div className="plan-header">
            <div>
              <h2>{campaignRows.length} people this week</h2>
              <p className="muted">
                {aiAnalyzedCount
                  ? `AI wrote call reasons · ${contacted} logged · call anyone in any order`
                  : `${contacted} logged · call anyone in any order`}
              </p>
            </div>
            {contacted >= campaignRows.length && campaignRows.length > 0 && (
              <button type="button" className="btn" onClick={() => setStep("wrap")}>
                Wrap week
              </button>
            )}
          </div>

          {campaignInterpretedAs && (
            <div className="ai-week-banner">
              Brief understood as: {campaignInterpretedAs}
            </div>
          )}

          <div className="plan-list">
            {campaignRows.length === 0 && (
              <p className="muted">No people in this week yet. Go back and rebuild.</p>
            )}
            {campaignRows.map((p, index) => {
              const aiReason = Boolean(p.whyCallOverride);
              const outcome = outcomes[p.id] ?? p.outcome;
              return (
              <article key={p.id} className="plan-item">
                <div className="plan-index">
                  {index + 1}
                </div>
                <div className="plan-body">
                  <div className="plan-title-row">
                    <h3>{p.name}</h3>
                    <span className="silence-pill">{silenceLabel(p.silenceBucket)}</span>
                    {aiReason && <span className="ai-pill">AI reason</span>}
                    {outcome !== "queued" && (
                      <span className="outcome-pill">{OUTCOME_LABELS[outcome]}</span>
                    )}
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
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => openCall(p.id)}
                >
                  Call
                </button>
              </article>
              );
            })}
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
          prep={callPreps[callCard.id]}
          prepBusy={prepStatus === "running"}
          prepError={prepError}
          talk={talkEdits[callCard.id] ?? callCard.talkTrack}
          outcome={outcomes[callCard.id] ?? callCard.outcome}
          noteBusy={noteStatus === "running"}
          noteError={noteError}
          onTalk={(t) => setTalkEdit(callCard.id, t)}
          onOutcome={(o) => {
            setOutcome(callCard.id, o);
            setStep("plan");
          }}
          onLogFreeform={async (text) => {
            const ok = await logFreeformOutcome(callCard.id, text);
            if (ok) setStep("plan");
            return ok;
          }}
          onRefreshPrep={() => void prepareCall(callCard.id, true)}
          onBack={() => setStep("plan")}
        />
      )}

      {step === "call" && !callCard && (
        <section className="funnel-card">
          <p>Pick someone from this week&apos;s list.</p>
          <button type="button" className="btn primary" onClick={() => setStep("plan")}>
            Back to list
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

const OUTCOME_LABELS: Record<Outcome, string> = {
  queued: "Not called",
  called: "Reached / voicemail",
  meeting: "Meeting booked",
  sale: "Sale",
  skip: "Skipped",
  not_now: "Follow up later",
  wrong_number: "Wrong number",
  do_not_contact: "Do not contact",
};

const OUTCOME_CHOICES: { value: Outcome; label: string; hint: string }[] = [
  { value: "meeting", label: "Meeting booked", hint: "They agreed to a next conversation" },
  { value: "called", label: "Reached / voicemail", hint: "You dialed or spoke, no meeting yet" },
  { value: "not_now", label: "Follow up later", hint: "Timing is wrong — try again later" },
  { value: "wrong_number", label: "Wrong number", hint: "Contact info is bad" },
  { value: "do_not_contact", label: "Do not contact", hint: "They asked you not to call again" },
  { value: "sale", label: "Sale", hint: "Business closed" },
];

function CallMode({
  p,
  prep,
  prepBusy,
  prepError,
  talk,
  outcome,
  noteBusy,
  noteError,
  onTalk,
  onOutcome,
  onLogFreeform,
  onRefreshPrep,
  onBack,
}: {
  p: RankedProspect;
  prep?: CallPrepPacket;
  prepBusy: boolean;
  prepError: string | null;
  talk: string;
  outcome: Outcome;
  noteBusy: boolean;
  noteError: string | null;
  onTalk: (t: string) => void;
  onOutcome: (o: Outcome) => void;
  onLogFreeform: (text: string) => Promise<boolean>;
  onRefreshPrep: () => void;
  onBack: () => void;
}) {
  const [freeform, setFreeform] = useState("");
  const blocked = p.silenceBucket === "do_not_cold_call";
  const bullets = talk
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);

  return (
    <section className="call-mode funnel-card">
      <div className="call-topbar">
        <button type="button" className="linkish" onClick={onBack}>
          ← Back to list
        </button>
        {outcome !== "queued" && (
          <span className="outcome-pill">{OUTCOME_LABELS[outcome]}</span>
        )}
      </div>

      <h2>{p.name}</h2>
      <p className="meta-line call-contact">
        {p.title ? `${p.title} · ` : ""}
        {p.company ?? "No company"}
      </p>
      <p className="meta-line call-contact">
        {p.phone ? (
          <a className="phone-link" href={`tel:${p.phone.replace(/[^\d+]/g, "")}`}>
            {p.phone}
          </a>
        ) : (
          "No phone"
        )}
        {" · "}
        {p.email ?? "No email"}
      </p>

      <p className="why-call call-why">
        <span className="why-label">Call because</span>
        {p.whyCall}
      </p>
      <InsightTagRow tags={p.tags} />

      {blocked ? (
        <div className="blocked-call">
          <strong>Hard stop</strong>
          <p>Do not cold-call this person.</p>
          <button type="button" className="btn" onClick={onBack}>
            Back to list
          </button>
        </div>
      ) : (
        <>
          <div className="prep-toolbar">
            <span className="block-label" style={{ margin: 0 }}>
              Person & company brief
            </span>
            <button
              type="button"
              className="btn ghost sm"
              disabled={prepBusy}
              onClick={onRefreshPrep}
            >
              {prepBusy ? "Verifying…" : prep ? "Re-verify with AI" : "Verify with AI"}
            </button>
          </div>

          {prepBusy && !prep && (
            <div className="ai-building" role="status">
              <div className="ai-building-pulse" aria-hidden />
              <div>
                <strong>Preparing this call…</strong>
                <p>Checking the file and public company context.</p>
              </div>
            </div>
          )}

          {prep && (
            <>
              <ExpandableBrief
                title="Person"
                status={prep.identityStatus}
                section={prep.person}
              />
              <ExpandableBrief
                title="Company"
                status={prep.identityStatus}
                section={prep.company}
              />
              {prep.source !== "fallback" && prep.identityNote && (
                <p className="muted tiny">{prep.identityNote}</p>
              )}
            </>
          )}
          {prepError && (
            <p className="error">
              {prepError} Use Re-verify with AI to try again.
            </p>
          )}

          <div className="talk-points">
            <span className="block-label">Talk points</span>
            {bullets.length ? (
              <ul>
                {bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">AI talk points will appear here once prep finishes.</p>
            )}
            <details className="notes-history">
              <summary>Edit talk points</summary>
              <textarea
                value={talk}
                onChange={(e) => onTalk(e.target.value)}
                rows={5}
                placeholder="One bullet per line"
              />
            </details>
          </div>

          {p.notes && (
            <details className="notes-history">
              <summary>Notes on file</summary>
              <pre>{p.notes}</pre>
            </details>
          )}

          <div className="after-call">
            <h3>After the call — log the result</h3>
            <p className="muted">
              Pick the closest outcome, or write anything that happened and let AI file it.
            </p>

            <div className="outcome-grid">
              {OUTCOME_CHOICES.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  className={
                    outcome === choice.value ? "outcome-card on" : "outcome-card"
                  }
                  onClick={() => onOutcome(choice.value)}
                >
                  <strong>{choice.label}</strong>
                  <span>{choice.hint}</span>
                </button>
              ))}
            </div>

            <label className="block-label">Or write what happened</label>
            <textarea
              value={freeform}
              onChange={(e) => setFreeform(e.target.value)}
              rows={4}
              placeholder='e.g. “Left voicemail. His partner is retiring in October — call back then.” or paste AI notetaker notes'
            />
            <button
              type="button"
              className="btn ai-btn"
              disabled={noteBusy || !freeform.trim()}
              onClick={() => void onLogFreeform(freeform)}
            >
              {noteBusy ? "Filing with AI…" : "Save with AI"}
            </button>
            <p className="muted tiny">
              AI sets the result tag, updates notes, and refreshes tags when it can.
            </p>
            {noteError && <p className="error">{noteError}</p>}
          </div>
        </>
      )}
    </section>
  );
}

function ExpandableBrief({
  title,
  section,
  status,
}: {
  title: string;
  section: CallBriefSection;
  status: CallPrepPacket["identityStatus"];
}) {
  return (
    <details className="brief-card" open>
      <summary>
        <span>{title}</span>
        <em>{status.replace("_", " ")}</em>
      </summary>
      <p className="brief-summary">{section.summary}</p>
      {(section.details.length > 0 || section.sources.length > 0) && (
        <details className="brief-more">
          <summary>More detail</summary>
          {section.details.length > 0 && (
            <ul>
              {section.details.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {section.sources.length > 0 && (
            <div className="brief-sources">
              {section.sources.map((source) => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                  {source.label || source.url}
                </a>
              ))}
            </div>
          )}
        </details>
      )}
    </details>
  );
}
