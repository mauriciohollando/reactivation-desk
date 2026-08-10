import type { InsightKind } from "./insightTags";

/** Controlled tag definition advisors can allow at import time. */
export type AllowedTag = {
  id: string;
  label: string;
  kind: InsightKind;
};

export type TagPreset = {
  id: string;
  name: string;
  description: string;
  tags: AllowedTag[];
};

const t = (id: string, label: string, kind: InsightKind): AllowedTag => ({
  id,
  label,
  kind,
});

/** Curated packs — pick one, then toggle/add before import. */
export const TAG_PRESETS: TagPreset[] = [
  {
    id: "life_benefits",
    name: "Life & benefits",
    description: "Buy-sell, key person, policy windows, referrals.",
    tags: [
      t("buy_sell", "Buy-sell", "opportunity"),
      t("key_person", "Key person", "opportunity"),
      t("policy_window", "Policy window", "opportunity"),
      t("referral", "Warm referral", "opportunity"),
      t("prior_inbound", "Prior inbound", "opportunity"),
      t("high_value", "High value", "opportunity"),
      t("decision_maker", "Decision maker", "opportunity"),
      t("recent_reopen", "Recent reopen", "timing"),
      t("recoverable", "Recoverable gap", "timing"),
      t("approach_caution", "Approach with care", "risk"),
      t("thin_file", "Thin file", "risk"),
      t("do_not_cold_call", "Do not cold-call", "risk"),
    ],
  },
  {
    id: "business_owners",
    name: "Business owners",
    description: "Liquidity, succession, ownership transitions.",
    tags: [
      t("liquidity", "Liquidity event", "opportunity"),
      t("succession", "Succession", "opportunity"),
      t("buy_sell", "Buy-sell", "opportunity"),
      t("key_person", "Key person", "opportunity"),
      t("decision_maker", "Decision maker", "opportunity"),
      t("high_value", "High value", "opportunity"),
      t("referral", "Warm referral", "opportunity"),
      t("recent_reopen", "Recent reopen", "timing"),
      t("recoverable", "Recoverable gap", "timing"),
      t("careful_gap", "Careful gap", "timing"),
      t("approach_caution", "Approach with care", "risk"),
      t("do_not_cold_call", "Do not cold-call", "risk"),
    ],
  },
  {
    id: "general_reactivation",
    name: "General reactivation",
    description: "Broad reopen signals without product-specific tags.",
    tags: [
      t("referral", "Warm referral", "opportunity"),
      t("prior_inbound", "Prior inbound", "opportunity"),
      t("high_value", "High value", "opportunity"),
      t("decision_maker", "Decision maker", "opportunity"),
      t("recent_reopen", "Recent reopen", "timing"),
      t("recoverable", "Recoverable gap", "timing"),
      t("careful_gap", "Careful gap", "timing"),
      t("phone_ready", "Phone ready", "reach"),
      t("thin_file", "Thin file", "risk"),
      t("approach_caution", "Approach with care", "risk"),
      t("do_not_cold_call", "Do not cold-call", "risk"),
    ],
  },
];

export function slugTag(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40) || "custom_tag";
}

export function uniqueAllowedTags(tags: AllowedTag[]): AllowedTag[] {
  const seen = new Set<string>();
  const out: AllowedTag[] = [];
  for (const tag of tags) {
    const id = tag.id || slugTag(tag.label);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ ...tag, id });
  }
  return out;
}
