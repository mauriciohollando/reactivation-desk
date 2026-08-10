import type { Prospect } from "./types";
import { daysSince } from "./rankDays";

/** Stable analysis tags — same book → same tags. Filterable in the desk. */
export type InsightKind = "opportunity" | "timing" | "reach" | "risk";

export type InsightTagId =
  | "buy_sell"
  | "key_person"
  | "liquidity"
  | "succession"
  | "policy_window"
  | "referral"
  | "prior_inbound"
  | "high_value"
  | "decision_maker"
  | "recent_reopen"
  | "recoverable"
  | "careful_gap"
  | "do_not_cold_call"
  | "phone_ready"
  | "thin_file"
  | "linkedin_only"
  | "duplicate_suspect"
  | "approach_caution";

export type InsightTag = {
  /** Known system ids or custom slug from the advisor's allowed vocabulary. */
  id: InsightTagId | string;
  label: string;
  kind: InsightKind;
  /** Short cite from the file (shown under the tag / in why-call). */
  cite: string;
};

export const INSIGHT_META: Record<
  InsightTagId,
  { label: string; kind: InsightKind }
> = {
  buy_sell: { label: "Buy-sell", kind: "opportunity" },
  key_person: { label: "Key person", kind: "opportunity" },
  liquidity: { label: "Liquidity event", kind: "opportunity" },
  succession: { label: "Succession", kind: "opportunity" },
  policy_window: { label: "Policy window", kind: "opportunity" },
  referral: { label: "Warm referral", kind: "opportunity" },
  prior_inbound: { label: "Prior inbound", kind: "opportunity" },
  high_value: { label: "High value", kind: "opportunity" },
  decision_maker: { label: "Decision maker", kind: "opportunity" },
  recent_reopen: { label: "Recent reopen", kind: "timing" },
  recoverable: { label: "Recoverable gap", kind: "timing" },
  careful_gap: { label: "Careful gap", kind: "timing" },
  do_not_cold_call: { label: "Do not cold-call", kind: "risk" },
  phone_ready: { label: "Phone ready", kind: "reach" },
  thin_file: { label: "Thin file", kind: "risk" },
  linkedin_only: { label: "LinkedIn only", kind: "risk" },
  duplicate_suspect: { label: "Possible duplicate", kind: "risk" },
  approach_caution: { label: "Approach with care", kind: "risk" },
};

/** Opportunity tags first — these should drive “why call”, not recency alone. */
const WHY_CALL_PRIORITY: InsightTagId[] = [
  "buy_sell",
  "key_person",
  "liquidity",
  "succession",
  "policy_window",
  "referral",
  "prior_inbound",
  "high_value",
  "decision_maker",
  "recent_reopen",
  "recoverable",
];

function tag(id: InsightTagId, cite: string): InsightTag {
  const meta = INSIGHT_META[id];
  return { id, label: meta.label, kind: meta.kind, cite };
}

function clip(s: string, n = 110): string {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

function hasUsablePhone(phone?: string) {
  return Boolean(phone && !phone.includes("?"));
}

/**
 * Deterministic insight extraction from one prospect row.
 * Same inputs → same tags. This is the analysis layer advisors can trust and filter.
 */
export function extractInsights(p: Prospect): InsightTag[] {
  const out: InsightTag[] = [];
  const notes = p.notes ?? "";
  const notesL = notes.toLowerCase();
  const seg = (p.segment ?? "").toLowerCase();
  const source = (p.source ?? "").toLowerCase();
  const value = (p.estimatedValue ?? "").toLowerCase();
  const days = daysSince(p.lastTouch);

  // —— Commercial opportunity signals (from notes / segment) ——
  if (/buy[\s-]?sell|ownership change|co-owner|partner retirement/.test(notesL)) {
    out.push(tag("buy_sell", clip(notes)));
  }
  if (/key person|key-person|production manager|executive benefits/.test(notesL)) {
    out.push(tag("key_person", clip(notes)));
  }
  if (/acquisit|liquidity|selling minority|exit|stake/.test(notesL) || value.includes("liquidity")) {
    out.push(tag("liquidity", notes ? clip(notes) : clip(p.estimatedValue ?? "Liquidity signal")));
  }
  if (/succession|next gen|sons taking|kids taking|family transition/.test(notesL)) {
    out.push(tag("succession", clip(notes)));
  }
  if (/anniversary|policy|coverage gap|group disability|disability for/.test(notesL)) {
    out.push(tag("policy_window", clip(notes)));
  }
  if (
    /referred|referral|high priority if real/.test(notesL) ||
    seg.includes("referral") ||
    source.includes("referral")
  ) {
    out.push(
      tag(
        "referral",
        notes && /referred|referral|priority/.test(notesL)
          ? clip(notes)
          : `Source/segment: ${p.source ?? p.segment ?? "referral"}`,
      ),
    );
  }
  if (
    /inbound|webinar|prior inbound/.test(notesL) ||
    seg.includes("inbound") ||
    source.includes("inbound") ||
    source.includes("prior inbound")
  ) {
    out.push(
      tag(
        "prior_inbound",
        notes && /inbound|webinar/.test(notesL)
          ? clip(notes)
          : `Channel: ${p.source ?? p.segment ?? "inbound"}`,
      ),
    );
  }
  if (value.includes("high") || value.includes("$")) {
    out.push(tag("high_value", clip(p.estimatedValue!)));
  }
  if (p.title && /owner|ceo|founder|president|cfo|partner|principal|managing/i.test(p.title)) {
    out.push(
      tag(
        "decision_maker",
        `${p.title}${p.company ? ` · ${p.company}` : ""}`,
      ),
    );
  } else if (seg.includes("business owner") || seg.includes("hnw")) {
    out.push(tag("decision_maker", p.segment!));
  }

  // —— Timing ——
  if (days != null) {
    if (days <= 90) {
      out.push(tag("recent_reopen", `Last activity ${days}d ago — still in a natural reopen window`));
    } else if (days <= 365) {
      out.push(tag("recoverable", `Last activity ${days}d ago — recoverable with a cited reason`));
    } else if (days <= 730) {
      out.push(tag("careful_gap", `Last activity ${days}d ago — reopen carefully`));
    } else {
      out.push(tag("do_not_cold_call", `${days}d silence — high opt-out risk if cold-called`));
    }
  }

  // —— Reach / risk ——
  if (hasUsablePhone(p.phone)) {
    out.push(tag("phone_ready", p.phone!));
  }
  const emailOk = Boolean(p.email);
  if (!hasUsablePhone(p.phone) && !emailOk && p.linkedin) {
    out.push(tag("linkedin_only", "No phone or email — LinkedIn only"));
  }
  if (!p.company && !notes) {
    out.push(tag("thin_file", "Little beyond the name"));
  } else if (!notes && !p.segment) {
    out.push(tag("thin_file", "No notes or segment on file"));
  }
  if (/duplicate|same (person|company)|check phone/.test(notesL)) {
    out.push(tag("duplicate_suspect", clip(notes)));
  }
  if (
    !/\[test data/i.test(notes) &&
    /do not email|angry|frustrated|opt-out|do not cold|no unsolicited/.test(notesL)
  ) {
    out.push(tag("approach_caution", clip(notes)));
  }

  // Dedupe by id, keep first cite
  const seen = new Set<string>();
  return out.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

/** Primary commercial “why call” line — never leads with bare recency if a better signal exists. */
export function buildWhyCall(p: Prospect, tags: InsightTag[]): string {
  const byId = new Map(tags.map((t) => [t.id, t]));
  for (const id of WHY_CALL_PRIORITY) {
    const t = byId.get(id);
    if (!t) continue;
    if (id === "recent_reopen" || id === "recoverable") {
      // Only use timing as headline if nothing commercial fired
      const hasCommercial = WHY_CALL_PRIORITY.slice(0, 9).some((x) => byId.has(x));
      if (hasCommercial) continue;
    }
    if (id === "decision_maker" || id === "high_value") {
      const hasStronger = WHY_CALL_PRIORITY.slice(0, 7).some((x) => byId.has(x));
      if (hasStronger) continue;
    }
    return t.cite;
  }

  if (p.notes?.trim()) return clip(p.notes, 140);
  if (p.company) return `Prior relationship at ${p.company}`;
  return "Limited file evidence — verify before dialing";
}

/** Supporting line: who + timing, not the main pitch. */
export function buildWhyCallSupport(p: Prospect, tags: InsightTag[]): string {
  const bits: string[] = [];
  const dm = tags.find((t) => t.id === "decision_maker");
  if (dm) bits.push(dm.cite);
  else if (p.company) bits.push(p.company);

  const timing =
    tags.find((t) => t.id === "recent_reopen") ??
    tags.find((t) => t.id === "recoverable") ??
    tags.find((t) => t.id === "careful_gap");
  if (timing) bits.push(timing.cite);

  const phone = tags.find((t) => t.id === "phone_ready");
  if (phone) bits.push("Phone on file");

  return bits.slice(0, 3).join(" · ");
}

export function countTags(
  tagLists: InsightTag[][],
): { id: string; label: string; count: number; kind: InsightKind }[] {
  const counts = new Map<string, { count: number; label: string; kind: InsightKind }>();
  for (const list of tagLists) {
    for (const t of list) {
      const prev = counts.get(t.id);
      if (prev) prev.count += 1;
      else counts.set(t.id, { count: 1, label: t.label, kind: t.kind });
    }
  }
  return [...counts.entries()]
    .map(([id, meta]) => ({
      id,
      count: meta.count,
      label: INSIGHT_META[id as InsightTagId]?.label ?? meta.label,
      kind: INSIGHT_META[id as InsightTagId]?.kind ?? meta.kind,
    }))
    .sort((a, b) => b.count - a.count);
}

/** Merge rule tags with enrichment tags; enrichment wins on same id. */
export function mergeTags(base: InsightTag[], enrichment?: InsightTag[]): InsightTag[] {
  if (!enrichment?.length) return base;
  const byId = new Map<string, InsightTag>();
  for (const t of base) byId.set(t.id, t);
  for (const t of enrichment) byId.set(t.id, t);
  return [...byId.values()];
}

/** Tags useful as filters in the weekly list (opportunity + key risks). */
export const FILTERABLE_TAG_IDS: InsightTagId[] = [
  "buy_sell",
  "key_person",
  "liquidity",
  "succession",
  "policy_window",
  "referral",
  "prior_inbound",
  "high_value",
  "decision_maker",
  "recent_reopen",
  "recoverable",
  "careful_gap",
  "approach_caution",
  "thin_file",
  "duplicate_suspect",
  "do_not_cold_call",
];
