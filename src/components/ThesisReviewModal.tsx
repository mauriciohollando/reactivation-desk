"use client";

import { useEffect, useState } from "react";
import {
  AUDIENCE_OPTIONS,
  OFFER_OPTIONS,
  type AudienceId,
  type BookInsight,
  type OfferId,
  type PracticeThesis,
} from "@/lib/practiceThesis";

type Props = {
  thesis: PracticeThesis;
  insights: BookInsight[];
  sourceLabel: string;
  /** True while the AI is reading the book (or URL enrich). */
  busy?: boolean;
  error?: string | null;
  onConfirm: (next: {
    audience: AudienceId;
    offers: OfferId[];
    customOffer: string;
    companyUrl: string;
    linkedinUrl: string;
    enrichFromUrls: boolean;
  }) => void;
  onSkip: () => void;
};

export function ThesisReviewModal({
  thesis,
  insights,
  sourceLabel,
  busy,
  error,
  onConfirm,
  onSkip,
}: Props) {
  const [audience, setAudience] = useState<AudienceId>(thesis.audience);
  const [offers, setOffers] = useState<OfferId[]>(thesis.offers);
  const [customOffer, setCustomOffer] = useState(thesis.customOffer);
  const [companyUrl, setCompanyUrl] = useState(thesis.companyUrl);
  const [linkedinUrl, setLinkedinUrl] = useState(thesis.linkedinUrl);
  const [mode, setMode] = useState<"reflect" | "urls">("reflect");

  // When AI guess lands, refresh local chips from the new thesis.
  useEffect(() => {
    setAudience(thesis.audience);
    setOffers(thesis.offers);
    setCustomOffer(thesis.customOffer);
    setCompanyUrl(thesis.companyUrl);
    setLinkedinUrl(thesis.linkedinUrl);
  }, [
    thesis.audience,
    thesis.offers,
    thesis.customOffer,
    thesis.companyUrl,
    thesis.linkedinUrl,
    thesis.updatedAt,
    thesis.summary,
  ]);

  const guessing = Boolean(busy && thesis.confidence !== "guessed" && !error);
  const awaitingCorroboration = !guessing;

  const toggleOffer = (id: OfferId) => {
    setOffers((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 3) return [...cur.slice(1), id];
      return [...cur, id];
    });
  };

  const submit = (enrichFromUrls: boolean) => {
    onConfirm({
      audience,
      offers: offers.length ? offers : ["general_reactivation"],
      customOffer,
      companyUrl: companyUrl.trim(),
      linkedinUrl: linkedinUrl.trim(),
      enrichFromUrls,
    });
  };

  return (
    <div className="thesis-modal-backdrop" role="presentation">
      <div
        className="thesis-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="thesis-modal-title"
      >
        <p className="thesis-modal-kicker">From your book</p>
        <h2 id="thesis-modal-title">
          {guessing ? "Reading your book…" : "Does this match what you sell?"}
        </h2>
        <p className="muted thesis-modal-lead">
          Based on <strong>{sourceLabel}</strong>. AI proposes how we should curate and
          tip — you corroborate. Not a copy of your voice.
        </p>

        {guessing ? (
          <div className="thesis-ai-loading" role="status" aria-live="polite">
            <div className="ai-building-pulse" aria-hidden />
            <div>
              <strong>Guessing audience and offer conversations…</strong>
              <p className="muted tiny">
                Sampling titles, companies, and notes — this usually takes a few seconds.
              </p>
            </div>
          </div>
        ) : (
          <>
            <ul className="thesis-insight-list">
              {insights.map((ins) => (
                <li key={ins.id}>{ins.text}</li>
              ))}
            </ul>

            <div className="thesis-guess">
              <span className="block-label">Proposed curation</span>
              <p>{thesis.summary}</p>
              <span className={`thesis-confidence ${thesis.confidence}`}>
                {thesis.confidence === "default"
                  ? "Default"
                  : thesis.confidence === "guessed"
                    ? "AI guess from this book"
                    : "Confirmed"}
              </span>
            </div>
          </>
        )}

        {awaitingCorroboration && mode === "reflect" && (
          <div className="thesis-form">
            <fieldset>
              <legend>Who are these people, mostly?</legend>
              <div className="filters">
                {AUDIENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={audience === opt.id ? "chip on" : "chip"}
                    onClick={() => setAudience(opt.id)}
                    disabled={busy}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>What conversations are you reopening? (pick up to 3)</legend>
              <div className="filters">
                {OFFER_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={offers.includes(opt.id) ? "chip on" : "chip"}
                    title={opt.hint}
                    onClick={() => toggleOffer(opt.id)}
                    disabled={busy}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {offers.includes("custom") && (
                <input
                  value={customOffer}
                  onChange={(e) => setCustomOffer(e.target.value)}
                  placeholder="e.g. Data analysis and dashboards for small companies"
                  aria-label="Custom offer"
                  disabled={busy}
                />
              )}
            </fieldset>
            <div className="thesis-modal-actions">
              <button
                type="button"
                className="btn primary lg"
                disabled={busy || !offers.length}
                onClick={() => submit(false)}
              >
                Looks right — continue
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => setMode("urls")}
              >
                Add company / LinkedIn
              </button>
              <button type="button" className="btn ghost" disabled={busy} onClick={onSkip}>
                Skip for now
              </button>
            </div>
          </div>
        )}

        {mode === "urls" && (
          <div className="thesis-form">
            <p className="muted tiny">
              Optional. We’ll sharpen the guess from public pages — you can edit anytime.
            </p>
            <label>
              Company URL
              <input
                value={companyUrl}
                onChange={(e) => setCompanyUrl(e.target.value)}
                placeholder="https://"
                inputMode="url"
              />
            </label>
            <label>
              LinkedIn profile or company
              <input
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://www.linkedin.com/…"
                inputMode="url"
              />
            </label>
            <div className="thesis-modal-actions">
              <button
                type="button"
                className="btn primary lg"
                disabled={busy || (!companyUrl.trim() && !linkedinUrl.trim())}
                onClick={() => submit(true)}
              >
                {busy ? "Reading pages…" : "Sharpen from URLs"}
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => submit(false)}
              >
                Save URLs only
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={busy}
                onClick={() => setMode("reflect")}
              >
                Back
              </button>
            </div>
          </div>
        )}

        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
