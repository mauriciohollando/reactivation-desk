"use client";

import { useState } from "react";
import {
  AUDIENCE_OPTIONS,
  OFFER_OPTIONS,
  type AudienceId,
  type OfferId,
  type PracticeThesis,
} from "@/lib/practiceThesis";

type Props = {
  thesis: PracticeThesis;
  open: boolean;
  onClose: () => void;
  onSave: (patch: {
    audience: AudienceId;
    offers: OfferId[];
    customOffer: string;
    companyUrl: string;
    linkedinUrl: string;
  }) => void;
  onEnrichUrls: (urls: { companyUrl: string; linkedinUrl: string }) => Promise<void>;
  busy?: boolean;
  error?: string | null;
};

export function ThesisEditor({
  thesis,
  open,
  onClose,
  onSave,
  onEnrichUrls,
  busy,
  error,
}: Props) {
  const [audience, setAudience] = useState<AudienceId>(thesis.audience);
  const [offers, setOffers] = useState<OfferId[]>(thesis.offers);
  const [customOffer, setCustomOffer] = useState(thesis.customOffer);
  const [companyUrl, setCompanyUrl] = useState(thesis.companyUrl);
  const [linkedinUrl, setLinkedinUrl] = useState(thesis.linkedinUrl);

  if (!open) return null;

  const toggleOffer = (id: OfferId) => {
    setOffers((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 3) return [...cur.slice(1), id];
      return [...cur, id];
    });
  };

  return (
    <div className="thesis-drawer-backdrop" onClick={onClose} role="presentation">
      <aside
        className="thesis-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="How we curate"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="thesis-drawer-head">
          <div>
            <p className="thesis-modal-kicker">Practice thesis</p>
            <h2>How we curate your weeks</h2>
          </div>
          <button type="button" className="btn ghost sm" onClick={onClose}>
            Close
          </button>
        </header>
        <p className="muted tiny">
          Used for list ranking and call tips. Not for impersonating your voice. The desk
          also updates this from books you import.
        </p>
        <p className="thesis-drawer-summary">{thesis.summary}</p>

        <fieldset>
          <legend>Audience</legend>
          <div className="filters">
            {AUDIENCE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={audience === opt.id ? "chip on" : "chip"}
                onClick={() => setAudience(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Offer conversations</legend>
          <div className="filters">
            {OFFER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={offers.includes(opt.id) ? "chip on" : "chip"}
                onClick={() => toggleOffer(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {offers.includes("custom") && (
            <input
              value={customOffer}
              onChange={(e) => setCustomOffer(e.target.value)}
              placeholder="Your offer in a phrase"
            />
          )}
        </fieldset>

        <label>
          Company URL
          <input
            value={companyUrl}
            onChange={(e) => setCompanyUrl(e.target.value)}
            placeholder="https://"
          />
        </label>
        <label>
          LinkedIn URL
          <input
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="https://www.linkedin.com/…"
          />
        </label>

        <div className="thesis-modal-actions">
          <button
            type="button"
            className="btn primary"
            disabled={busy || !offers.length}
            onClick={() =>
              onSave({
                audience,
                offers,
                customOffer,
                companyUrl: companyUrl.trim(),
                linkedinUrl: linkedinUrl.trim(),
              })
            }
          >
            Save
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy || (!companyUrl.trim() && !linkedinUrl.trim())}
            onClick={() =>
              void onEnrichUrls({
                companyUrl: companyUrl.trim(),
                linkedinUrl: linkedinUrl.trim(),
              })
            }
          >
            {busy ? "Updating…" : "Refresh from URLs"}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </aside>
    </div>
  );
}
