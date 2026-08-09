export type AnalysisMode = "local" | "ai";

export type AnalysisFact = {
  category:
    | "relationship"
    | "commercial"
    | "timing"
    | "preference"
    | "contact"
    | "risk";
  label: string;
  value: string;
  sourceField: string;
  quote: string;
  confidence: number;
};

export type TimelineEvent = {
  date: string | null;
  label: string;
  status: "past" | "overdue" | "upcoming" | "unknown";
  quote: string;
};

export type AnalysisContradiction = {
  label: string;
  left: string;
  right: string;
  severity: "review" | "block";
  quote: string;
};

export type RelationshipInsight = {
  type: "possible_duplicate" | "same_company" | "referral";
  relatedProspectId?: string;
  relatedName: string;
  reason: string;
  confidence: number;
};

export type NextBestAction =
  | "call_now"
  | "verify_first"
  | "ask_referrer"
  | "email_first"
  | "wait"
  | "merge_records"
  | "find_contact"
  | "do_not_contact";

export type ProspectAnalysis = {
  prospectId: string;
  mode: AnalysisMode;
  summary: string;
  facts: AnalysisFact[];
  timeline: TimelineEvent[];
  contradictions: AnalysisContradiction[];
  relationships: RelationshipInsight[];
  evidenceConfidence: number;
  nextAction: NextBestAction;
  nextActionReason: string;
  discoveryQuestions: string[];
  cautions: string[];
  analyzedAt: string;
};

export type WebEvidenceClaim = {
  category:
    | "role"
    | "acquisition"
    | "financing"
    | "ownership_leadership"
    | "expansion"
    | "workforce"
    | "distress"
    | "succession"
    | "regulatory"
    | "major_contract";
  claim: string;
  status: "confirmed" | "changed" | "unresolved";
  excerpt: string;
  url: string;
  publisher: string;
  publishedAt: string | null;
  identityConfidence: number;
  claimConfidence: number;
};

export type WebEvidencePacket = {
  prospectId: string;
  identityStatus: "matched" | "possible" | "unresolved";
  identityReason: string;
  claims: WebEvidenceClaim[];
  whyNow: string | null;
  searchedAt: string;
};

export type BookPattern = {
  id: string;
  label: string;
  description: string;
  count: number;
  prospectIds: string[];
  kind: "campaign" | "risk" | "data";
};
