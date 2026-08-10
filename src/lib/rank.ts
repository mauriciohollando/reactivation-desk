import type {
  ColumnMapping,
  Evidence,
  FieldKey,
  ImportSummary,
  Outcome,
  Prospect,
  RankedProspect,
  SilenceBucket,
} from "./types";
import {
  buildWhyCall,
  buildWhyCallSupport,
  countTags,
  extractInsights,
  mergeTags,
  type InsightTag,
} from "./insightTags";
import { daysSince } from "./rankDays";

export { daysSince };

function pushEvidence(
  list: Evidence[],
  field: string,
  snippet: string,
  weight: Evidence["weight"],
) {
  list.push({ field, snippet, weight });
}

function hasUsablePhone(phone?: string) {
  return Boolean(phone && !phone.includes("?"));
}

function learnWeights(outcomes: Record<string, Outcome>, prospects: Prospect[]) {
  const weights = new Map<string, number>();
  const byId = new Map(prospects.map((p) => [p.id, p]));
  for (const [id, outcome] of Object.entries(outcomes)) {
    if (outcome !== "meeting" && outcome !== "sale") continue;
    const p = byId.get(id);
    if (!p) continue;
    for (const t of extractInsights(p)) {
      if (t.kind !== "opportunity") continue;
      weights.set(t.id, (weights.get(t.id) ?? 0) + (outcome === "sale" ? 3 : 2));
    }
  }
  return weights;
}

function evidenceFromTags(tags: InsightTag[], reasons: Evidence[], risks: Evidence[]) {
  for (const t of tags) {
    const weight =
      t.kind === "opportunity" ? "high" :
      t.kind === "risk" ? "high" :
      t.kind === "timing" ? "medium" :
      "medium";
    if (t.kind === "risk") {
      pushEvidence(risks, t.label, t.cite, weight);
    } else if (t.id !== "phone_ready") {
      // Phone ready is table stakes; keep evidence focused
      pushEvidence(reasons, t.label, t.cite, weight);
    }
  }
}

export function rankProspects(
  prospects: Prospect[],
  outcomes: Record<string, Outcome> = {},
): RankedProspect[] {
  const learned = learnWeights(outcomes, prospects);

  const ranked = prospects.map((p) => {
    const tags = mergeTags(extractInsights(p), p.enrichmentTags);
    const reasons: Evidence[] = [];
    const risks: Evidence[] = [];
    let opportunity = 40;
    let reachability = 40;

    const days = daysSince(p.lastTouch);
    let silenceBucket: SilenceBucket = "safe_reopen";

    if (tags.some((t) => t.id === "do_not_cold_call")) {
      silenceBucket = "do_not_cold_call";
      opportunity -= 6;
    } else if (tags.some((t) => t.id === "careful_gap") || tags.some((t) => t.id === "approach_caution")) {
      silenceBucket = "handle_with_care";
      if (tags.some((t) => t.id === "careful_gap")) opportunity += 2;
    } else if (tags.some((t) => t.id === "recent_reopen")) {
      opportunity += 20;
    } else if (tags.some((t) => t.id === "recoverable")) {
      opportunity += 10;
    } else if (days == null) {
      silenceBucket = "handle_with_care";
      opportunity -= 4;
      pushEvidence(risks, "Last touch", "Missing or unreadable last touch", "medium");
    }

    const bump = (id: string, n: number) => {
      if (tags.some((t) => t.id === id)) opportunity += n;
    };
    bump("buy_sell", 18);
    bump("key_person", 16);
    bump("liquidity", 16);
    bump("succession", 14);
    bump("policy_window", 10);
    bump("referral", 14);
    bump("prior_inbound", 12);
    bump("high_value", 10);
    bump("decision_maker", 8);

    if (tags.some((t) => t.id === "thin_file")) opportunity -= 8;
    if (tags.some((t) => t.id === "duplicate_suspect")) reachability -= 15;

    const phoneOk = hasUsablePhone(p.phone);
    const emailOk = Boolean(p.email);
    if (phoneOk && emailOk) reachability += 30;
    else if (phoneOk) reachability += 22;
    else if (emailOk) reachability += 14;
    else if (p.linkedin) reachability -= 10;
    else reachability -= 25;

    evidenceFromTags(tags, reasons, risks);

    let learnBoost = 0;
    for (const t of tags) {
      if (t.kind !== "opportunity") continue;
      const w = learned.get(t.id) ?? 0;
      if (w > 0) learnBoost += Math.min(8, w);
    }
    if (learnBoost > 0) {
      opportunity += learnBoost;
      pushEvidence(
        reasons,
        "Outcome learning",
        `Boosted from patterns in logged meetings/sales (+${learnBoost})`,
        "medium",
      );
    }

    opportunity = Math.max(0, Math.min(99, Math.round(opportunity)));
    reachability = Math.max(0, Math.min(99, Math.round(reachability)));
    const score = Math.round(opportunity * 0.62 + reachability * 0.38);

    const needsReview =
      risks.some((r) => r.weight === "high") ||
      (!phoneOk && !emailOk) ||
      silenceBucket === "do_not_cold_call";

    let tier: RankedProspect["tier"] = "warm";
    if (silenceBucket === "do_not_cold_call" || (needsReview && score < 50)) tier = "risk";
    else if (score >= 72 && reachability >= 55) tier = "hot";
    else if (score < 48 || reachability < 35) tier = "thin";

    const whyCall = p.whyCallOverride?.trim() || buildWhyCall(p, tags);
    const whySupport = p.whySupportOverride?.trim() || buildWhyCallSupport(p, tags);
    const brief = [
      `Call because: ${whyCall}`,
      whySupport ? whySupport : null,
      silenceBucket === "do_not_cold_call"
        ? "Stance: do not cold-call"
        : silenceBucket === "handle_with_care"
          ? "Stance: handle with care"
          : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      ...p,
      score,
      opportunity,
      reachability,
      tier,
      silenceBucket,
      reasons,
      risks,
      tags,
      whyCall,
      whySupport,
      talkTrack: buildTalkTrack(p, days, silenceBucket, tags),
      brief,
      needsReview,
      duplicateOf: [] as string[],
      outcome: outcomes[p.id] ?? "queued",
    } satisfies RankedProspect;
  });

  const byName = new Map<string, string[]>();
  for (const r of ranked) {
    const key = r.name.trim().toLowerCase();
    const list = byName.get(key) ?? [];
    list.push(r.id);
    byName.set(key, list);
  }
  for (const r of ranked) {
    const dups = (byName.get(r.name.trim().toLowerCase()) ?? []).filter((id) => id !== r.id);
    if (dups.length) {
      r.duplicateOf = dups;
      if (!r.tags.some((t) => t.id === "duplicate_suspect")) {
        r.tags.push({
          id: "duplicate_suspect",
          label: "Possible duplicate",
          kind: "risk",
          cite: `Same name as another row in this export`,
        });
      }
      r.risks.push({
        field: "Duplicate",
        snippet: `Possible duplicate of ${dups.join(", ")}`,
        weight: "high",
      });
      r.needsReview = true;
      r.score = Math.max(0, r.score - 5);
      r.reachability = Math.max(0, r.reachability - 5);
    }
  }

  return ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.opportunity - a.opportunity;
  });
}

function buildTalkTrack(
  p: Prospect,
  days: number | null,
  silence: SilenceBucket,
  tags: InsightTag[],
): string {
  const first = p.name.split(" ")[0] ?? p.name;
  const companyBit = p.company ? ` at ${p.company}` : "";
  const commercial = tags.find((t) =>
    ["buy_sell", "key_person", "liquidity", "succession", "policy_window"].includes(t.id),
  );

  if (silence === "do_not_cold_call") {
    return `Hi ${first}, it has been a very long time and I will keep this short. If you would rather I close your file, just say so. If a brief catch-up${companyBit} would still be useful, I have 15 minutes this week with no pitch required.`;
  }

  if (silence === "handle_with_care") {
    return `Hi ${first}, it has been a while and I do not want to be a nuisance. When we last spoke${companyBit}, we touched on planning topics. If timing is bad, tell me a better month. If helpful, I can do a quick no-pressure check-in this week.`;
  }

  if (commercial?.id === "buy_sell" || commercial?.id === "key_person") {
    return `Hi ${first}, circling back on the buy-sell / key-person notes in your file. Open to a short call to see if anything changed${companyBit}?`;
  }
  if (commercial?.id === "liquidity") {
    return `Hi ${first}, following up on the liquidity / ownership notes in your file. If timing moved, I would still like a short catch-up${companyBit}.`;
  }
  if (commercial?.id === "succession") {
    return `Hi ${first}, I wanted to reopen the succession conversation on your file. Open to a brief call${companyBit} this week?`;
  }
  if (commercial?.id === "policy_window") {
    return `Hi ${first}, your file flagged a coverage or policy review window. Happy to do a brief check-in so nothing drifts. Does a short call this week work?`;
  }
  if (tags.some((t) => t.id === "referral")) {
    return `Hi ${first}, following up on the referral note in your file${companyBit}. Wanted to close the loop with a short, focused call.`;
  }

  if (days != null && days <= 90) {
    return `Hi ${first}, following up while our last conversation is still recent${companyBit}. Wanted to close the loop and see if a focused planning chat would help.`;
  }

  return `Hi ${first}, I am prioritizing a small set of prior relationships this week${companyBit}. Based on our file, a short catch-up seemed worth offering. If timing is bad, I can note a better month.`;
}

const FIELD_ALIASES: Record<FieldKey, string[]> = {
  name: ["name", "full name", "fullname", "contact", "contact name", "client"],
  email: ["email", "e-mail", "email address", "mail"],
  phone: ["phone", "mobile", "cell", "telephone", "phone number"],
  company: ["company", "firm", "organization", "business", "employer"],
  title: ["title", "role", "job title", "position"],
  segment: ["segment", "type", "category", "persona", "tag"],
  source: ["source", "origin", "channel"],
  lastTouch: ["last touch", "last_touch", "last contact", "lastcontact", "last activity", "last_activity"],
  notes: ["notes", "note", "comments", "comment", "memo"],
  estimatedValue: ["value", "estimated value", "aum", "potential", "est value"],
  linkedin: ["linkedin", "li", "linkedin url", "profile"],
};

export function suggestColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [FieldKey, string[]][]) {
    const hit = headers.find((h) => {
      const key = h.toLowerCase().trim();
      return aliases.includes(key) && !used.has(h);
    });
    if (hit) {
      mapping[field] = hit;
      used.add(hit);
    }
  }
  return mapping;
}

export function prospectsFromMappedRows(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
): Prospect[] {
  return rows.map((raw, i) => {
    const get = (field: FieldKey) => {
      const header = mapping[field];
      if (!header) return undefined;
      const v = raw[header];
      return v?.trim() || undefined;
    };
    const name = get("name") ?? `Unknown ${i + 1}`;
    return {
      id: `csv-${i + 1}-${name.slice(0, 12).replace(/\s+/g, "-").toLowerCase()}`,
      name,
      email: get("email"),
      phone: get("phone"),
      company: get("company"),
      title: get("title"),
      segment: get("segment"),
      source: get("source") ?? "csv upload",
      lastTouch: get("lastTouch"),
      notes: get("notes"),
      estimatedValue: get("estimatedValue"),
      linkedin: get("linkedin"),
      raw,
    };
  });
}

/** Back-compat helper used by simple paste path. */
export function prospectsFromCsvRows(rows: Record<string, string>[]): Prospect[] {
  if (!rows.length) return [];
  const headers = Object.keys(rows[0] ?? {});
  return prospectsFromMappedRows(rows, suggestColumnMapping(headers));
}

export function buildImportSummary(prospects: Prospect[]): ImportSummary {
  const ranked = rankProspects(prospects, {});
  const missingContact = ranked.filter(
    (p) => !hasUsablePhone(p.phone) && !p.email,
  ).length;
  const thinFiles = ranked.filter((p) => p.tags.some((t) => t.id === "thin_file")).length;
  const longSilence = ranked.filter((p) => p.silenceBucket !== "safe_reopen").length;
  const callableThisWeek = ranked.filter(
    (p) =>
      p.silenceBucket !== "do_not_cold_call" &&
      (hasUsablePhone(p.phone) || Boolean(p.email)),
  ).length;
  const handleWithCare = ranked.filter((p) => p.silenceBucket === "handle_with_care").length;
  const doNotColdCall = ranked.filter((p) => p.silenceBucket === "do_not_cold_call").length;
  const withEvidence = ranked.filter(
    (p) => p.tags.some((t) => t.kind === "opportunity") || Boolean(p.notes),
  ).length;
  const dupNames = new Set(
    ranked.filter((p) => p.duplicateOf.length > 0).map((p) => p.name.toLowerCase()),
  );
  const warnings: string[] = [];
  if (!prospects.some((p) => p.name && !p.name.startsWith("Unknown"))) {
    warnings.push("No clear Name column detected.");
  }
  if (missingContact === prospects.length && prospects.length > 0) {
    warnings.push("No usable phone or email on any row. Calling will be blocked.");
  }

  const census = countTags(ranked.map((p) => p.tags))
    .filter((t) => t.kind === "opportunity" || t.id === "do_not_cold_call" || t.id === "thin_file")
    .slice(0, 10);

  return {
    total: prospects.length,
    missingContact,
    thinFiles,
    duplicateGroups: dupNames.size,
    longSilence,
    callableThisWeek,
    handleWithCare,
    doNotColdCall,
    evidenceCoveragePct: prospects.length
      ? Math.round((withEvidence / prospects.length) * 100)
      : 0,
    parseWarnings: warnings,
    tagCensus: census,
  };
}

export function mergeProspects(primary: Prospect, secondary: Prospect): Prospect {
  const pick = <T,>(a: T | undefined, b: T | undefined) => a || b;
  const notes = [primary.notes, secondary.notes].filter(Boolean).join(" | ");
  return {
    ...primary,
    email: pick(primary.email, secondary.email),
    phone: pick(primary.phone, secondary.phone),
    company: pick(primary.company, secondary.company),
    title: pick(primary.title, secondary.title),
    segment: pick(primary.segment, secondary.segment),
    source: pick(primary.source, secondary.source),
    lastTouch: pick(primary.lastTouch, secondary.lastTouch),
    notes: notes || undefined,
    estimatedValue: pick(primary.estimatedValue, secondary.estimatedValue),
    linkedin: pick(primary.linkedin, secondary.linkedin),
    raw: { ...secondary.raw, ...primary.raw },
  };
}

export function excludedFromPlan(ranked: RankedProspect[]) {
  return ranked.filter(
    (p) =>
      p.silenceBucket === "do_not_cold_call" ||
      (!hasUsablePhone(p.phone) && !p.email),
  );
}

export function topCallable(ranked: RankedProspect[], n: number) {
  return ranked
    .filter((p) => p.silenceBucket !== "do_not_cold_call")
    .filter((p) => hasUsablePhone(p.phone) || Boolean(p.email))
    .slice(0, n);
}
