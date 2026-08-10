export type CallBriefSection = {
  summary: string;
  details: string[];
  sources: { label: string; url: string }[];
};

export type CallPrepPacket = {
  prospectId: string;
  person: CallBriefSection;
  company: CallBriefSection;
  talkBullets: string[];
  identityStatus: "matched" | "possible" | "unresolved" | "file_only";
  identityNote: string;
  preparedAt: string;
  /** ai = verified packet; fallback = local file-only after AI failure */
  source?: "ai" | "fallback";
};
