export type Outcome =
  | "queued"
  | "called"
  | "meeting"
  | "sale"
  | "skip"
  | "not_now"
  | "wrong_number"
  | "do_not_contact";

export type SilenceBucket = "safe_reopen" | "handle_with_care" | "do_not_cold_call";

export type Prospect = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  segment?: string;
  source?: string;
  lastTouch?: string;
  notes?: string;
  estimatedValue?: string;
  linkedin?: string;
  raw: Record<string, string>;
  /** AI/human enrichment tags (filtered to the allowed import vocabulary). */
  enrichmentTags?: import("./insightTags").InsightTag[];
  /** Prefer this commercial reason when AI wrote a grounded why-call. */
  whyCallOverride?: string;
  whySupportOverride?: string;
};

export type Evidence = {
  field: string;
  snippet: string;
  weight: "high" | "medium" | "low";
};

export type RankedProspect = Prospect & {
  /** Combined sort score (opportunity × reachability). */
  score: number;
  opportunity: number;
  reachability: number;
  tier: "hot" | "warm" | "thin" | "risk";
  silenceBucket: SilenceBucket;
  reasons: Evidence[];
  risks: Evidence[];
  /** Deterministic analysis tags from the file. */
  tags: import("./insightTags").InsightTag[];
  /** Primary commercial reason to call (not bare recency). */
  whyCall: string;
  /** Supporting context: role, timing, reach. */
  whySupport: string;
  talkTrack: string;
  brief: string;
  needsReview: boolean;
  duplicateOf: string[];
  outcome: Outcome;
};

export type Campaign = {
  id: string;
  name: string;
  createdAt: string;
  prospectIds: string[];
};

export type ImportSummary = {
  total: number;
  missingContact: number;
  thinFiles: number;
  duplicateGroups: number;
  longSilence: number;
  callableThisWeek: number;
  handleWithCare: number;
  doNotColdCall: number;
  evidenceCoveragePct: number;
  parseWarnings: string[];
  /** Top opportunity tags found in this book. */
  tagCensus: { id: string; label: string; count: number; kind: string }[];
};

export type WizardStep =
  | "import"
  | "plans"
  | "diagnose"
  | "plan"
  | "call"
  | "wrap"
  | "review";

/** Calls planned for one week (clamped 1–40 in the store). */
export type WeekBudget = number;

export type FieldKey =
  | "name"
  | "email"
  | "phone"
  | "company"
  | "title"
  | "segment"
  | "source"
  | "lastTouch"
  | "notes"
  | "estimatedValue"
  | "linkedin";

export type ColumnMapping = Partial<Record<FieldKey, string>>;
