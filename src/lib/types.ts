export type Outcome =
  | "queued"
  | "called"
  | "meeting"
  | "sale"
  | "skip"
  | "do_not_contact";

export type Prospect = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  segment?: string;
  source?: string;
  lastTouch?: string; // ISO date or free text
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
  score: number;
  tier: "hot" | "warm" | "thin" | "risk";
  reasons: Evidence[];
  risks: Evidence[];
  talkTrack: string;
  needsHuman: boolean;
  outcome: Outcome;
};

export type Campaign = {
  id: string;
  name: string;
  createdAt: string;
  prospectIds: string[];
};
