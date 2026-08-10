export type EvidenceOrigin = "file" | "public";

export type BriefDetail = {
  text: string;
  origin: EvidenceOrigin;
  /** File quote or publisher label */
  cite: string;
  /** Public source URL only; empty for file */
  url: string;
};

export type CallBriefSection = {
  summary: string;
  details: BriefDetail[];
  sources: { label: string; url: string }[];
};

/** Public, linked facts that help the sales approach on this call. */
export type SaleHighlight = {
  text: string;
  whyItMatters: string;
  publisher: string;
  url: string;
};

export type CallPrepPacket = {
  prospectId: string;
  person: CallBriefSection;
  company: CallBriefSection;
  saleHighlights: SaleHighlight[];
  /** One-line coaching on how to open, given file + public context */
  approachNote: string;
  talkBullets: string[];
  identityStatus: "matched" | "possible" | "unresolved" | "file_only";
  identityNote: string;
  preparedAt: string;
  /** ai = verified packet; fallback = local file-only after AI failure */
  source?: "ai" | "fallback";
};

/** Normalize older in-memory packets that used string[] details. */
export function normalizeBriefSection(section: CallBriefSection | {
  summary: string;
  details: Array<string | BriefDetail>;
  sources: { label: string; url: string }[];
}): CallBriefSection {
  return {
    summary: section.summary,
    details: (section.details ?? []).map((item) => {
      if (typeof item === "string") {
        return { text: item, origin: "file" as const, cite: "", url: "" };
      }
      return {
        text: item.text,
        origin: item.origin === "public" ? "public" : "file",
        cite: item.cite ?? "",
        url: item.url ?? "",
      };
    }),
    sources: section.sources ?? [],
  };
}

export function normalizeCallPrepPacket(packet: CallPrepPacket): CallPrepPacket {
  return {
    ...packet,
    person: normalizeBriefSection(packet.person),
    company: normalizeBriefSection(packet.company),
    saleHighlights: packet.saleHighlights ?? [],
    approachNote: packet.approachNote ?? "",
  };
}
