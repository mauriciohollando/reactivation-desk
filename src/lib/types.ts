export type Outcome =
  | "queued"
  | "called"
  | "meeting"
  | "sale"
  | "skip"
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
  parseWarnings: string[];
};

export type WizardStep = "import" | "rank" | "campaign" | "call" | "done";

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
