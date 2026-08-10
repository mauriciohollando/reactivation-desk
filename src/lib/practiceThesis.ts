import type { ImportSummary, Prospect } from "./types";
import { TAG_PRESETS, type AllowedTag } from "./tagPresets";

/** Who they typically reopen. */
export type AudienceId =
  | "business_owners"
  | "smb_operators"
  | "founders"
  | "hnw_families"
  | "high_income_professionals"
  | "mixed"
  | "other";

/** What conversations they reopen for (curation + tips — not voice). */
export type OfferId =
  | "sales_reactivation"
  | "b2b_services"
  | "services_consulting"
  | "saas_software"
  | "data_analytics"
  | "life_benefits"
  | "succession_liquidity"
  | "wealth_aum"
  | "insurance_reviews"
  | "group_healthcare"
  | "general_reactivation"
  | "custom";

export type ThesisConfidence = "default" | "guessed" | "confirmed";

export type BookInsight = {
  id: string;
  text: string;
};

export type PracticeThesis = {
  audience: AudienceId;
  offers: OfferId[];
  /** Free-text when offers includes custom, or extra nuance. */
  customOffer: string;
  companyUrl: string;
  linkedinUrl: string;
  /** Short human summary of how we curate. */
  summary: string;
  confidence: ThesisConfidence;
  /** Where the current summary mostly came from. */
  sources: Array<"default" | "book" | "answers" | "urls" | "manual">;
  updatedAt: string | null;
  /** User dismissed / confirmed the post-import review at least once this book. */
  reviewedForSourceLabel: string | null;
};

export const AUDIENCE_OPTIONS: { id: AudienceId; label: string }[] = [
  { id: "smb_operators", label: "Small-business operators" },
  { id: "founders", label: "Founders / CEOs" },
  { id: "business_owners", label: "Business owners" },
  { id: "hnw_families", label: "HNW families" },
  { id: "high_income_professionals", label: "High-income professionals" },
  { id: "mixed", label: "Mixed book" },
  { id: "other", label: "Other" },
];

export const OFFER_OPTIONS: {
  id: OfferId;
  label: string;
  hint: string;
  tagPresetId: string;
}[] = [
  {
    id: "sales_reactivation",
    label: "Sales / reactivation",
    hint: "Reopen prior prospects in any industry",
    tagPresetId: "general_reactivation",
  },
  {
    id: "b2b_services",
    label: "B2B services",
    hint: "Accounting, marketing, IT, ops services",
    tagPresetId: "general_reactivation",
  },
  {
    id: "services_consulting",
    label: "Services / consulting",
    hint: "Agencies, fractional ops, advisory",
    tagPresetId: "general_reactivation",
  },
  {
    id: "saas_software",
    label: "SaaS / software",
    hint: "Product or tool sellers",
    tagPresetId: "general_reactivation",
  },
  {
    id: "data_analytics",
    label: "Data / analytics",
    hint: "Dashboards, reporting, analysis retainers",
    tagPresetId: "general_reactivation",
  },
  {
    id: "group_healthcare",
    label: "Group healthcare",
    hint: "Employer medical / benefits for companies",
    tagPresetId: "life_benefits",
  },
  {
    id: "life_benefits",
    label: "Life & benefits",
    hint: "Buy-sell, key person, executive benefits",
    tagPresetId: "life_benefits",
  },
  {
    id: "succession_liquidity",
    label: "Succession & liquidity",
    hint: "Ownership transitions, exits, next-gen",
    tagPresetId: "business_owners",
  },
  {
    id: "wealth_aum",
    label: "Wealth / AUM",
    hint: "Planning reviews, asset conversations",
    tagPresetId: "general_reactivation",
  },
  {
    id: "insurance_reviews",
    label: "Insurance reviews",
    hint: "Policy anniversaries, coverage gaps",
    tagPresetId: "life_benefits",
  },
  {
    id: "general_reactivation",
    label: "General reactivation",
    hint: "Warm reopen without a product pack",
    tagPresetId: "general_reactivation",
  },
  {
    id: "custom",
    label: "Something else",
    hint: "Describe in your own words",
    tagPresetId: "general_reactivation",
  },
];

export const AUDIENCE_IDS = AUDIENCE_OPTIONS.map((o) => o.id) as [
  AudienceId,
  ...AudienceId[],
];
export const OFFER_IDS = OFFER_OPTIONS.map((o) => o.id) as [OfferId, ...OfferId[]];

/** Advisor A cold start — disclosed default for curation + tips. */
export function defaultPracticeThesis(): PracticeThesis {
  return {
    audience: "business_owners",
    offers: ["life_benefits", "succession_liquidity"],
    customOffer: "",
    companyUrl: "",
    linkedinUrl: "",
    summary:
      "Default: reopen business owners for life/benefits and succession conversations (Advisor A–style).",
    confidence: "default",
    sources: ["default"],
    updatedAt: null,
    reviewedForSourceLabel: null,
  };
}

export function normalizeThesis(raw: Partial<PracticeThesis> | null | undefined): PracticeThesis {
  const base = defaultPracticeThesis();
  if (!raw) return base;
  const offers = Array.isArray(raw.offers)
    ? raw.offers.filter((o): o is OfferId => OFFER_OPTIONS.some((opt) => opt.id === o))
    : base.offers;
  return {
    ...base,
    ...raw,
    audience: AUDIENCE_OPTIONS.some((a) => a.id === raw.audience)
      ? (raw.audience as AudienceId)
      : base.audience,
    offers: offers.length ? offers.slice(0, 3) : base.offers,
    customOffer: String(raw.customOffer ?? "").slice(0, 280),
    companyUrl: String(raw.companyUrl ?? "").slice(0, 400),
    linkedinUrl: String(raw.linkedinUrl ?? "").slice(0, 400),
    summary: String(raw.summary ?? base.summary).slice(0, 400),
    confidence:
      raw.confidence === "guessed" ||
      raw.confidence === "confirmed" ||
      raw.confidence === "default"
        ? raw.confidence
        : base.confidence,
    sources: Array.isArray(raw.sources) ? raw.sources : base.sources,
    updatedAt: raw.updatedAt ?? null,
    reviewedForSourceLabel: raw.reviewedForSourceLabel ?? null,
  };
}

function audienceLabel(id: AudienceId) {
  return AUDIENCE_OPTIONS.find((a) => a.id === id)?.label ?? id;
}

function offerLabels(offers: OfferId[], custom: string) {
  const labels = offers.map(
    (id) => OFFER_OPTIONS.find((o) => o.id === id)?.label ?? id,
  );
  if (offers.includes("custom") && custom.trim()) {
    return [...labels.filter((l) => l !== "Something else"), custom.trim()];
  }
  return labels;
}

export function thesisSummaryLine(thesis: PracticeThesis): string {
  const aud = audienceLabel(thesis.audience);
  const offers = offerLabels(thesis.offers, thesis.customOffer).join(" · ");
  return `Curate for ${aud}; reopen for ${offers}.`;
}

/** Compact block injected into AI prompts — curation + tips, not voice. */
export function thesisPromptBlock(thesis: PracticeThesis): string {
  const t = normalizeThesis(thesis);
  const offers = offerLabels(t.offers, t.customOffer).join("; ");
  const urls = [
    t.companyUrl ? `Company URL: ${t.companyUrl}` : null,
    t.linkedinUrl ? `LinkedIn: ${t.linkedinUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `ADVISOR PRACTICE THESIS (use for list curation and call tips only — do NOT impersonate their voice or invent that prospects asked for a product):
Audience: ${audienceLabel(t.audience)}
Offer conversations to explore: ${offers}
Curation summary: ${t.summary}
Confidence: ${t.confidence}
${urls ? `${urls}\n` : ""}Prefer people and angles that fit this thesis. Stay grounded in each prospect's file.`;
}

export function tagPresetForThesis(thesis: PracticeThesis): string {
  const primary = thesis.offers[0] ?? "general_reactivation";
  return (
    OFFER_OPTIONS.find((o) => o.id === primary)?.tagPresetId ??
    "general_reactivation"
  );
}

/** Compact sample of the book for AI thesis guessing (keeps prompt small). */
export function bookSampleForThesis(
  prospects: Prospect[],
  summary: ImportSummary | null,
  limit = 28,
) {
  const sample = prospects.slice(0, limit).map((p) => ({
    name: p.name,
    title: p.title ?? "",
    company: p.company ?? "",
    segment: p.segment ?? "",
    notes: (p.notes ?? "").slice(0, 220),
    source: p.source ?? "",
  }));
  return {
    total: summary?.total ?? prospects.length,
    callableThisWeek: summary?.callableThisWeek ?? null,
    thinFiles: summary?.thinFiles ?? null,
    topTags: (summary?.tagCensus ?? []).slice(0, 8).map((t) => ({
      label: t.label,
      count: t.count,
    })),
    sample,
  };
}

export function allowedTagsForThesis(thesis: PracticeThesis): AllowedTag[] {
  const presetId = tagPresetForThesis(thesis);
  const preset = TAG_PRESETS.find((p) => p.id === presetId) ?? TAG_PRESETS[0]!;
  return preset.tags;
}

type SignalHit = { id: OfferId | "owner_titles"; count: number; sample?: string };

function countNoteSignals(prospects: Prospect[]): SignalHit[] {
  const blob = prospects
    .map((p) =>
      [p.notes, p.segment, p.title, p.source, p.estimatedValue].filter(Boolean).join(" "),
    )
    .join("\n")
    .toLowerCase();

  const checks: { id: OfferId | "owner_titles"; re: RegExp }[] = [
    {
      id: "data_analytics",
      re: /dashboard|kpi|analytics|looker|metabase|quickbooks|spreadsheet|cohort|reporting|data pack/g,
    },
    {
      id: "group_healthcare",
      re: /group (medical|health)|open enrollment|stop-?loss|pepm|fully insured|self-?funded|employer.?sponsored health/g,
    },
    {
      id: "saas_software",
      re: /\bsaas\b|product[- ]led|arr\b|mrr\b|subscription software|seat license/g,
    },
    {
      id: "services_consulting",
      re: /consulting|fractional|retainer|agency|advisory engagement/g,
    },
    {
      id: "life_benefits",
      re: /buy[\s-]?sell|key[ -]?person|executive benefits|disability|coverage gap/g,
    },
    {
      id: "succession_liquidity",
      re: /succession|liquidity|ownership|next gen|exit|acquisit|selling (the )?business/g,
    },
    {
      id: "wealth_aum",
      re: /\baum\b|portfolio|managed assets|wealth|financial plan|investment review/g,
    },
    {
      id: "insurance_reviews",
      re: /anniversary|policy review|coverage review|renewal|underwriting/g,
    },
    {
      id: "owner_titles",
      re: /\b(owner|founder|ceo|president|principal|partner)\b/g,
    },
  ];

  return checks.map(({ id, re }) => {
    const matches = blob.match(re);
    return { id, count: matches?.length ?? 0 };
  });
}

/**
 * Guess curation thesis from the imported book, starting from current/default.
 * Does not invent a personal bio — only offer/audience signals in the file.
 */
export function inferThesisFromBook(
  prospects: Prospect[],
  summary: ImportSummary | null,
  previous: PracticeThesis,
): { thesis: PracticeThesis; insights: BookInsight[] } {
  const base = normalizeThesis(previous);
  const insights: BookInsight[] = [];
  const n = prospects.length || summary?.total || 0;

  if (n) {
    insights.push({
      id: "size",
      text: `${n} people in this book${summary ? ` · ${summary.callableThisWeek} look callable this week` : ""}.`,
    });
  }
  if (summary) {
    if (summary.thinFiles > 0) {
      insights.push({
        id: "thin",
        text: `${summary.thinFiles} thin files — we'll favor warmer, better-documented names first.`,
      });
    }
    if (summary.longSilence > 0) {
      insights.push({
        id: "silence",
        text: `${summary.longSilence} with long silence — reopen carefully, not as cold spam.`,
      });
    }
    const topTags = (summary.tagCensus ?? []).slice(0, 3);
    if (topTags.length) {
      insights.push({
        id: "tags",
        text: `Strongest file signals: ${topTags.map((t) => t.label).join(", ")}.`,
      });
    }
  }

  const signals = countNoteSignals(prospects);
  const byId = Object.fromEntries(signals.map((s) => [s.id, s.count])) as Record<
    string,
    number
  >;

  const ownerHits = byId.owner_titles ?? 0;
  const life = byId.life_benefits ?? 0;
  const succession = byId.succession_liquidity ?? 0;
  const wealth = byId.wealth_aum ?? 0;
  const insurance = byId.insurance_reviews ?? 0;
  const data = byId.data_analytics ?? 0;
  const groupHealth = byId.group_healthcare ?? 0;
  const saas = byId.saas_software ?? 0;
  const consulting = byId.services_consulting ?? 0;

  if (ownerHits >= Math.max(3, Math.floor(n * 0.08))) {
    insights.push({
      id: "owners",
      text: `Many owner/founder/CEO titles — fits an operator / founder reopen book.`,
    });
  }
  const signalTotal = life + succession + insurance + wealth + data + groupHealth + saas + consulting;
  if (signalTotal > 0) {
    const parts: string[] = [];
    if (data) parts.push(`analytics/dashboard language (~${data})`);
    if (groupHealth) parts.push(`group healthcare (~${groupHealth})`);
    if (saas) parts.push(`SaaS (~${saas})`);
    if (consulting) parts.push(`consulting/agency (~${consulting})`);
    if (life) parts.push(`life/benefits (~${life})`);
    if (succession) parts.push(`succession/liquidity (~${succession})`);
    if (insurance) parts.push(`policy/review (~${insurance})`);
    if (wealth) parts.push(`wealth/AUM (~${wealth})`);
    insights.push({
      id: "offers",
      text: `Notes point to ${parts.join(", ")}.`,
    });
  } else {
    insights.push({
      id: "sparse",
      text: "Notes are light on product language — using general reactivation until you sharpen it.",
    });
  }

  // If user already confirmed manually and book is sparse, keep their thesis.
  const strongBook =
    signalTotal >= 4 || ownerHits >= Math.max(5, n * 0.1);

  let audience = base.audience;
  let offers = [...base.offers];
  let confidence: ThesisConfidence = base.confidence;
  const sources = new Set(base.sources);

  if (strongBook || base.confidence === "default") {
    if (data + saas + consulting > life + succession) {
      audience = "smb_operators";
    } else if (ownerHits >= Math.max(3, Math.floor(n * 0.08))) {
      audience = "business_owners";
    } else if (wealth > life + succession) {
      audience = "hnw_families";
    }

    const rankedOffers = (
      [
        { id: "data_analytics" as const, score: data },
        { id: "group_healthcare" as const, score: groupHealth },
        { id: "saas_software" as const, score: saas },
        { id: "services_consulting" as const, score: consulting },
        { id: "life_benefits" as const, score: life },
        { id: "succession_liquidity" as const, score: succession },
        { id: "insurance_reviews" as const, score: insurance },
        { id: "wealth_aum" as const, score: wealth },
      ] satisfies { id: OfferId; score: number }[]
    )
      .filter((o) => o.score > 0)
      .sort((a, b) => b.score - a.score);

    if (rankedOffers.length) {
      offers = rankedOffers.slice(0, 2).map((o) => o.id);
    } else if (base.confidence === "default") {
      offers = ["general_reactivation", "sales_reactivation"];
    }

    confidence = rankedOffers.length || ownerHits >= 3 ? "guessed" : base.confidence;
    sources.add("book");
    if (base.confidence === "default") sources.add("default");
  }

  const next: PracticeThesis = {
    ...base,
    audience,
    offers,
    confidence: base.confidence === "confirmed" && !strongBook ? "confirmed" : confidence,
    sources: [...sources],
    summary: "",
    updatedAt: new Date().toISOString(),
  };
  next.summary = thesisSummaryLine(next);

  return { thesis: next, insights: insights.slice(0, 5) };
}

export function applyAnswersToThesis(
  thesis: PracticeThesis,
  answers: { audience: AudienceId; offers: OfferId[]; customOffer?: string },
): PracticeThesis {
  const next = normalizeThesis({
    ...thesis,
    audience: answers.audience,
    offers: answers.offers.slice(0, 3),
    customOffer: answers.customOffer ?? thesis.customOffer,
    confidence: "confirmed",
    sources: [...new Set([...thesis.sources, "answers" as const])],
    updatedAt: new Date().toISOString(),
  });
  next.summary = thesisSummaryLine(next);
  return next;
}

export function mergeUrlDraftIntoThesis(
  thesis: PracticeThesis,
  draft: {
    audience?: AudienceId;
    offers?: OfferId[];
    customOffer?: string;
    summary?: string;
  },
): PracticeThesis {
  const next = normalizeThesis({
    ...thesis,
    audience: draft.audience ?? thesis.audience,
    offers: draft.offers?.length ? draft.offers : thesis.offers,
    customOffer: draft.customOffer ?? thesis.customOffer,
    summary: draft.summary?.trim() || thesis.summary,
    confidence: "guessed",
    sources: [...new Set([...thesis.sources, "urls" as const])],
    updatedAt: new Date().toISOString(),
  });
  if (!draft.summary?.trim()) next.summary = thesisSummaryLine(next);
  return next;
}
