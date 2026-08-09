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

export function daysSince(iso?: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

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

function featureTags(p: Prospect): string[] {
  const tags: string[] = [];
  const seg = (p.segment ?? "").toLowerCase();
  const notes = (p.notes ?? "").toLowerCase();
  if (seg.includes("business owner") || seg.includes("hnw")) tags.push("seg:owner");
  if (seg.includes("referral") || seg.includes("inbound")) tags.push("seg:warm_source");
  if (notes.includes("buy-sell") || notes.includes("key person")) tags.push("note:protection");
  if (notes.includes("acquisition") || notes.includes("selling")) tags.push("note:liquidity");
  if (notes.includes("anniversary") || notes.includes("policy")) tags.push("note:policy");
  if (notes.includes("referred") || notes.includes("high priority")) tags.push("note:priority");
  const days = daysSince(p.lastTouch);
  if (days != null && days <= 90) tags.push("recency:hot");
  else if (days != null && days <= 365) tags.push("recency:warm");
  return tags;
}

function learnWeights(outcomes: Record<string, Outcome>, prospects: Prospect[]) {
  const weights = new Map<string, number>();
  const byId = new Map(prospects.map((p) => [p.id, p]));
  for (const [id, outcome] of Object.entries(outcomes)) {
    if (outcome !== "meeting" && outcome !== "sale") continue;
    const p = byId.get(id);
    if (!p) continue;
    for (const tag of featureTags(p)) {
      weights.set(tag, (weights.get(tag) ?? 0) + (outcome === "sale" ? 3 : 2));
    }
  }
  return weights;
}

export function rankProspects(
  prospects: Prospect[],
  outcomes: Record<string, Outcome> = {},
): RankedProspect[] {
  const learned = learnWeights(outcomes, prospects);

  const ranked = prospects.map((p) => {
    const reasons: Evidence[] = [];
    const risks: Evidence[] = [];
    let opportunity = 40;
    let reachability = 40;

    const days = daysSince(p.lastTouch);
    let silenceBucket: SilenceBucket = "safe_reopen";

    if (days != null) {
      if (days <= 90) {
        opportunity += 20;
        pushEvidence(reasons, "Last touch", `${days}d ago, still warm`, "high");
      } else if (days <= 365) {
        opportunity += 10;
        pushEvidence(reasons, "Last touch", `${days}d ago, recoverable`, "medium");
      } else if (days <= 730) {
        opportunity += 2;
        silenceBucket = "handle_with_care";
        pushEvidence(reasons, "Last touch", `${days}d ago, cold`, "low");
        pushEvidence(risks, "Silence", "Long gap, reopen carefully", "high");
      } else {
        opportunity -= 6;
        silenceBucket = "do_not_cold_call";
        pushEvidence(risks, "Silence", `${days}d silence, high opt-out risk`, "high");
      }
    } else {
      opportunity -= 4;
      silenceBucket = "handle_with_care";
      pushEvidence(risks, "Last touch", "Missing or unreadable last touch", "medium");
    }

    const seg = (p.segment ?? "").toLowerCase();
    if (seg.includes("business owner") || seg.includes("hnw")) {
      opportunity += 16;
      pushEvidence(reasons, "Segment", p.segment!, "high");
    } else if (seg.includes("referral") || seg.includes("inbound")) {
      opportunity += 12;
      pushEvidence(reasons, "Segment", p.segment!, "medium");
    } else if (p.segment) {
      opportunity += 4;
      pushEvidence(reasons, "Segment", p.segment, "low");
    }

    const notes = (p.notes ?? "").toLowerCase();
    if (notes.includes("buy-sell") || notes.includes("key person") || notes.includes("acquisition") || notes.includes("selling")) {
      opportunity += 16;
      pushEvidence(reasons, "Notes", p.notes!.slice(0, 120), "high");
    } else if (notes.includes("high priority") || notes.includes("referred")) {
      opportunity += 12;
      pushEvidence(reasons, "Notes", p.notes!.slice(0, 120), "high");
    } else if (notes.includes("anniversary") || notes.includes("policy")) {
      opportunity += 8;
      pushEvidence(reasons, "Notes", p.notes!.slice(0, 120), "medium");
    } else if (p.notes) {
      opportunity += 3;
      pushEvidence(reasons, "Notes", p.notes.slice(0, 120), "low");
    }

    if ((p.estimatedValue ?? "").toLowerCase().includes("high") || (p.estimatedValue ?? "").includes("$")) {
      opportunity += 10;
      pushEvidence(reasons, "Value", p.estimatedValue!, "medium");
    }

    if (p.title && /owner|ceo|founder|president|cfo|partner/i.test(p.title)) {
      opportunity += 8;
      pushEvidence(reasons, "Title", p.title, "medium");
    }

    const phoneOk = hasUsablePhone(p.phone);
    const emailOk = Boolean(p.email);
    if (phoneOk && emailOk) {
      reachability += 30;
      pushEvidence(reasons, "Reachability", "Phone and email present", "medium");
    } else if (phoneOk) {
      reachability += 22;
      pushEvidence(reasons, "Reachability", "Phone only", "medium");
    } else if (emailOk) {
      reachability += 14;
      pushEvidence(reasons, "Reachability", "Email only", "low");
    } else if (p.linkedin) {
      reachability -= 10;
      pushEvidence(risks, "Reachability", "LinkedIn only, thin contact file", "high");
    } else {
      reachability -= 25;
      pushEvidence(risks, "Reachability", "No usable phone, email, or LinkedIn", "high");
    }

    if (!p.company && !p.notes) {
      opportunity -= 8;
      pushEvidence(risks, "Data quality", "Thin file, little beyond the name", "medium");
    }

    if (notes.includes("duplicate") || notes.includes("wrong number")) {
      reachability -= 15;
      pushEvidence(risks, "Data quality", p.notes!, "high");
    }

    if (notes.includes("do not email") || notes.includes("angry")) {
      pushEvidence(risks, "Approach", p.notes!.slice(0, 100), "medium");
      if (silenceBucket === "safe_reopen") silenceBucket = "handle_with_care";
    }

    // Outcome learning: boost tags that converted this session
    let learnBoost = 0;
    for (const tag of featureTags(p)) {
      const w = learned.get(tag) ?? 0;
      if (w > 0) {
        learnBoost += Math.min(8, w);
      }
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

    // Prefer reachable opportunity
    const score = Math.round(opportunity * 0.62 + reachability * 0.38);

    const needsReview =
      risks.some((r) => r.weight === "high") ||
      (!phoneOk && !emailOk) ||
      silenceBucket === "do_not_cold_call";

    let tier: RankedProspect["tier"] = "warm";
    if (silenceBucket === "do_not_cold_call" || (needsReview && score < 50)) tier = "risk";
    else if (score >= 72 && reachability >= 55) tier = "hot";
    else if (score < 48 || reachability < 35) tier = "thin";

    return {
      ...p,
      score,
      opportunity,
      reachability,
      tier,
      silenceBucket,
      reasons,
      risks,
      talkTrack: buildTalkTrack(p, days, silenceBucket),
      brief: buildBrief(p, reasons, risks, silenceBucket),
      needsReview,
      duplicateOf: [] as string[],
      outcome: outcomes[p.id] ?? "queued",
    } satisfies RankedProspect;
  });

  // Duplicate detection
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

function buildBrief(
  p: Prospect,
  reasons: Evidence[],
  risks: Evidence[],
  silence: SilenceBucket,
): string {
  const why = reasons.find((r) => r.weight === "high") ?? reasons[0];
  const risk = risks.find((r) => r.weight === "high") ?? risks[0];
  const bits = [
    why ? `Call because: ${why.snippet}` : "Call because: limited file evidence",
    risk ? `Watch: ${risk.snippet}` : null,
    silence === "do_not_cold_call"
      ? "Bucket: do not cold-call"
      : silence === "handle_with_care"
        ? "Bucket: handle with care"
        : "Bucket: safe reopen",
  ].filter(Boolean);
  return bits.join(" · ");
}

function buildTalkTrack(
  p: Prospect,
  days: number | null,
  silence: SilenceBucket,
): string {
  const first = p.name.split(" ")[0] ?? p.name;
  const companyBit = p.company ? ` at ${p.company}` : "";

  if (silence === "do_not_cold_call") {
    return `Hi ${first}, it has been a very long time and I will keep this short. If you would rather I close your file, just say so. If a brief catch-up${companyBit} would still be useful, I have 15 minutes this week with no pitch required.`;
  }

  if (silence === "handle_with_care") {
    return `Hi ${first}, it has been a while and I do not want to be a nuisance. When we last spoke${companyBit}, we touched on planning topics. If timing is bad, tell me a better month. If helpful, I can do a quick no-pressure check-in this week.`;
  }

  if ((p.notes ?? "").toLowerCase().includes("buy-sell") || (p.notes ?? "").toLowerCase().includes("key person")) {
    return `Hi ${first}, circling back on the buy-sell / key-person notes in your file. Open to a short call to see if anything changed${companyBit}?`;
  }

  if ((p.notes ?? "").toLowerCase().includes("anniversary") || (p.notes ?? "").toLowerCase().includes("policy")) {
    return `Hi ${first}, your file flagged a coverage or policy review window. Happy to do a brief check-in so nothing drifts. Does a short call this week work?`;
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
  const thinFiles = ranked.filter((p) => !p.company && !p.notes).length;
  const longSilence = ranked.filter((p) => p.silenceBucket !== "safe_reopen").length;
  const callableThisWeek = ranked.filter(
    (p) =>
      p.silenceBucket !== "do_not_cold_call" &&
      (hasUsablePhone(p.phone) || Boolean(p.email)),
  ).length;
  const handleWithCare = ranked.filter((p) => p.silenceBucket === "handle_with_care").length;
  const doNotColdCall = ranked.filter((p) => p.silenceBucket === "do_not_cold_call").length;
  const withEvidence = ranked.filter((p) =>
    p.reasons.some((r) => r.weight === "high" || r.weight === "medium"),
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
