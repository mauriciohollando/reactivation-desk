"use client";

import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { prospectsFromCsvRows } from "@/lib/rank";
import { useDesk } from "@/lib/store";
import type { Outcome, RankedProspect } from "@/lib/types";

const OUTCOMES: Outcome[] = [
  "queued",
  "called",
  "meeting",
  "sale",
  "skip",
  "do_not_contact",
];

export function DeskApp() {
  const prospects = useDesk((s) => s.prospects);
  const sourceLabel = useDesk((s) => s.sourceLabel);
  const selectedIds = useDesk((s) => s.selectedIds);
  const campaign = useDesk((s) => s.campaign);
  const talkEdits = useDesk((s) => s.talkEdits);
  const loadSynthetic = useDesk((s) => s.loadSynthetic);
  const loadProspects = useDesk((s) => s.loadProspects);
  const toggleSelect = useDesk((s) => s.toggleSelect);
  const selectTop = useDesk((s) => s.selectTop);
  const clearSelection = useDesk((s) => s.clearSelection);
  const setOutcome = useDesk((s) => s.setOutcome);
  const setTalkEdit = useDesk((s) => s.setTalkEdit);
  const createCampaignFromSelection = useDesk((s) => s.createCampaignFromSelection);
  const rankedFn = useDesk((s) => s.ranked);
  const resetAll = useDesk((s) => s.resetAll);

  const [filter, setFilter] = useState<"all" | "hot" | "warm" | "thin" | "risk">("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const outcomes = useDesk((s) => s.outcomes);
  const rankedLive = useMemo(
    () => rankedFn(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prospects, outcomes, rankedFn],
  );

  const visible = rankedLive.filter((p) =>
    filter === "all" ? true : p.tier === filter,
  );
  const active =
    rankedLive.find((p) => p.id === activeId) ?? visible[0] ?? null;

  const campaignRows = campaign
    ? rankedLive.filter((p) => campaign.prospectIds.includes(p.id))
    : [];

  const onFile = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rows = (res.data ?? []).filter((r) =>
          Object.values(r).some((v) => String(v ?? "").trim()),
        );
        loadProspects(
          prospectsFromCsvRows(rows),
          `CSV upload: ${file.name} (${rows.length} rows)`,
        );
      },
    });
  };

  const onPaste = () => {
    const parsed = Papa.parse<Record<string, string>>(pasteText, {
      header: true,
      skipEmptyLines: true,
    });
    const rows = (parsed.data ?? []).filter((r) =>
      Object.values(r).some((v) => String(v ?? "").trim()),
    );
    if (!rows.length) return;
    loadProspects(prospectsFromCsvRows(rows), `Pasted CSV (${rows.length} rows)`);
    setPasteOpen(false);
    setPasteText("");
  };

  const exportCampaign = () => {
    if (!campaign) return;
    const rows = campaignRows.map((p) => ({
      name: p.name,
      score: p.score,
      tier: p.tier,
      company: p.company ?? "",
      phone: p.phone ?? "",
      email: p.email ?? "",
      outcome: outcomes[p.id] ?? p.outcome,
      talk_track: talkEdits[p.id] ?? p.talkTrack,
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
  };

  return (
    <div className="desk">
      <header className="desk-header">
        <div>
          <p className="eyebrow">Rowan case prototype · disclosed synthetic OK</p>
          <h1>Reactivation Desk</h1>
          <p className="sub">
            Messy prior prospects in → ranked who/why/what to say → you act → durable campaign log.
            No continuous CRM or inbox access. No auto-send.
          </p>
        </div>
        <div className="price-card">
          <strong>$299/mo</strong>
          <span>Independent IA / solo broker</span>
          <span className="muted">or $1,500 cleanup sprint + $99/mo</span>
        </div>
      </header>

      <section className="hard-nos">
        <h2>Hard nos (product judgment)</h2>
        <ul>
          <li>No continuous CRM / email / planning-data access</li>
          <li>No auto-email or auto-dial blasts</li>
          <li>No invented facts — scores cite row evidence or mark needs-human</li>
          <li>Not a content studio, alert graph, or succession OS</li>
        </ul>
      </section>

      <section className="toolbar">
        <button type="button" className="btn primary" onClick={loadSynthetic}>
          Load synthetic 120-prospect book
        </button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          Upload CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
        <button type="button" className="btn" onClick={() => setPasteOpen((v) => !v)}>
          Paste CSV
        </button>
        <button type="button" className="btn ghost" onClick={resetAll}>
          Reset
        </button>
        <a className="btn ghost" href="/memo">
          Decision memo
        </a>
      </section>

      {pasteOpen && (
        <section className="paste-box">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste CSV with headers: Name, Email, Phone, Company, Title, Segment, Last Touch, Notes, Value..."
            rows={6}
          />
          <button type="button" className="btn primary" onClick={onPaste}>
            Parse paste
          </button>
        </section>
      )}

      {prospects.length === 0 ? (
        <section className="empty">
          <p>Load the synthetic book (recommended for the panel) or upload your own export.</p>
        </section>
      ) : (
        <>
          <p className="source">{sourceLabel}</p>

          <section className="campaign-bar">
            <div className="filters">
              {(["all", "hot", "warm", "thin", "risk"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={filter === f ? "chip on" : "chip"}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="actions">
              <button type="button" className="btn" onClick={() => selectTop(10)}>
                Select top 10
              </button>
              <button type="button" className="btn" onClick={clearSelection}>
                Clear ({selectedIds.length})
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={createCampaignFromSelection}
                disabled={!selectedIds.length}
              >
                Create this week&apos;s campaign
              </button>
              {campaign && (
                <button type="button" className="btn" onClick={exportCampaign}>
                  Export campaign CSV
                </button>
              )}
            </div>
          </section>

          {campaign && (
            <section className="campaign-panel">
              <h2>{campaign.name}</h2>
              <p className="muted">
                {campaign.prospectIds.length} people · durable outcomes below · export anytime
              </p>
              <div className="campaign-grid">
                {campaignRows.map((p) => (
                  <CampaignCard
                    key={p.id}
                    p={p}
                    talk={talkEdits[p.id] ?? p.talkTrack}
                    outcome={outcomes[p.id] ?? p.outcome}
                    onTalk={(t) => setTalkEdit(p.id, t)}
                    onOutcome={(o) => setOutcome(p.id, o)}
                    onOpen={() => setActiveId(p.id)}
                  />
                ))}
              </div>
            </section>
          )}

          <div className="main-grid">
            <div className="queue">
              <h2>Ranked queue ({visible.length})</h2>
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
                      <span className={`tier ${p.tier}`}>{p.tier}</span>
                      <span className="name">{p.name}</span>
                      <span className="meta">{p.company ?? "—"}</span>
                      {p.needsHuman && <span className="flag">needs human</span>}
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
                />
              ) : (
                <p>Select a prospect.</p>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
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
}: {
  p: RankedProspect;
  talk: string;
  outcome: Outcome;
  selected: boolean;
  onToggle: () => void;
  onTalk: (t: string) => void;
  onOutcome: (o: Outcome) => void;
}) {
  return (
    <div>
      <div className="detail-head">
        <h2>{p.name}</h2>
        <button type="button" className="btn" onClick={onToggle}>
          {selected ? "Selected" : "Add to campaign"}
        </button>
      </div>
      <p className="meta-line">
        {p.title ? `${p.title} · ` : ""}
        {p.company ?? "No company"} · {p.segment ?? "No segment"}
      </p>
      <p className="meta-line">
        {p.phone ?? "No phone"} · {p.email ?? "No email"} · Last touch: {p.lastTouch ?? "?"}
      </p>

      <h3>Why this rank (evidence)</h3>
      <ul className="evidence">
        {p.reasons.map((e, i) => (
          <li key={`r-${i}`}>
            <strong>{e.field}</strong> [{e.weight}]: {e.snippet}
          </li>
        ))}
        {!p.reasons.length && <li>Insufficient positive evidence</li>}
      </ul>

      <h3>Risks / needs human</h3>
      <ul className="evidence risk">
        {p.risks.map((e, i) => (
          <li key={`k-${i}`}>
            <strong>{e.field}</strong> [{e.weight}]: {e.snippet}
          </li>
        ))}
        {!p.risks.length && <li>No high risks flagged</li>}
      </ul>

      <h3>Talk track (editable · grounded in file)</h3>
      <textarea value={talk} onChange={(e) => onTalk(e.target.value)} rows={5} />

      <h3>Outcome</h3>
      <select value={outcome} onChange={(e) => onOutcome(e.target.value as Outcome)}>
        {OUTCOMES.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>

      <h3>Trace</h3>
      <pre className="trace">
        {JSON.stringify(
          {
            id: p.id,
            score: p.score,
            tier: p.tier,
            needsHuman: p.needsHuman,
            reasons: p.reasons,
            risks: p.risks,
          },
          null,
          2,
        )}
      </pre>
    </div>
  );
}

function CampaignCard({
  p,
  talk,
  outcome,
  onTalk,
  onOutcome,
  onOpen,
}: {
  p: RankedProspect;
  talk: string;
  outcome: Outcome;
  onTalk: (t: string) => void;
  onOutcome: (o: Outcome) => void;
  onOpen: () => void;
}) {
  return (
    <div className="camp-card">
      <button type="button" className="linkish" onClick={onOpen}>
        {p.name} · {p.score}
      </button>
      <textarea value={talk} onChange={(e) => onTalk(e.target.value)} rows={3} />
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
