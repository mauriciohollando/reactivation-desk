import type {
  AnalysisContradiction,
  AnalysisFact,
  BookPattern,
  NextBestAction,
  ProspectAnalysis,
  RelationshipInsight,
  TimelineEvent,
} from "./analysisTypes";
import type { InsightTagId } from "./insightTags";
import type { Prospect, RankedProspect } from "./types";

const TODAY = () => new Date();

function clip(value: string, max = 150) {
  const clean = value.trim().replace(/\s+/g, " ");
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function normalize(value?: string) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function phoneKey(value?: string) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length >= 7 ? digits.slice(-10) : "";
}

function domain(value?: string) {
  return value?.split("@")[1]?.toLowerCase().replace(/^www\./, "") ?? "";
}

function fact(
  category: AnalysisFact["category"],
  label: string,
  value: string,
  sourceField: string,
  quote: string,
  confidence: number,
): AnalysisFact {
  return { category, label, value, sourceField, quote: clip(quote), confidence };
}

function parseFacts(p: RankedProspect): AnalysisFact[] {
  const notes = p.notes ?? "";
  const lower = notes.toLowerCase();
  const facts: AnalysisFact[] = [];

  const patterns: Array<{
    re: RegExp;
    category: AnalysisFact["category"];
    label: string;
    value: string;
  }> = [
    { re: /buy[\s-]?sell|co-owner|ownership/, category: "commercial", label: "Planning topic", value: "Buy-sell / ownership" },
    { re: /key[\s-]?person|production manager/, category: "commercial", label: "Planning topic", value: "Key-person exposure" },
    { re: /acquisit|selling|liquidity|exit|stake/, category: "commercial", label: "Business event", value: "Liquidity or M&A" },
    { re: /succession|sons taking|kids taking|next gen/, category: "commercial", label: "Business event", value: "Succession" },
    { re: /anniversary|policy|coverage gap|disability/, category: "commercial", label: "Review trigger", value: "Policy / coverage review" },
    { re: /referred by|referral/, category: "relationship", label: "Relationship source", value: "Referral" },
    { re: /prefers? morning|morning calls?/, category: "preference", label: "Contact preference", value: "Morning" },
    { re: /do not email|phone only/, category: "preference", label: "Channel preference", value: "Phone only" },
    { re: /wife handles|husband handles|spouse/, category: "relationship", label: "Decision context", value: "Spouse involved" },
    { re: /angry|frustrated|complaint/, category: "risk", label: "Relationship risk", value: "Prior friction" },
    { re: /wrong number|email bounced/, category: "contact", label: "Contact issue", value: "Contact data may be stale" },
  ];

  for (const item of patterns) {
    if (item.re.test(lower)) {
      facts.push(fact(item.category, item.label, item.value, "Notes", notes, 84));
    }
  }

  if (p.title) {
    facts.push(fact("relationship", "Role on file", p.title, "Title", p.title, 98));
  }
  if (p.company) {
    facts.push(fact("relationship", "Company on file", p.company, "Company", p.company, 98));
  }
  if (p.source && /referral|inbound/i.test(p.source)) {
    facts.push(fact("relationship", "Source", p.source, "Source", p.source, 98));
  }
  if (p.estimatedValue) {
    facts.push(fact("commercial", "Potential on file", p.estimatedValue, "Value", p.estimatedValue, 95));
  }

  return facts.slice(0, 10);
}

function parseTimeline(p: RankedProspect): TimelineEvent[] {
  const timeline: TimelineEvent[] = [];
  const notes = p.notes ?? "";
  const lower = notes.toLowerCase();

  if (p.lastTouch) {
    timeline.push({
      date: p.lastTouch,
      label: "Last recorded activity",
      status: "past",
      quote: p.lastTouch,
    });
  }

  const yearQuarter = lower.match(/\b(?:after|in|by|follow up|revisit)\s+q([1-4])(?:\s+(20\d{2}))?/);
  if (yearQuarter) {
    const quarter = Number(yearQuarter[1]);
    const year = Number(yearQuarter[2] ?? TODAY().getFullYear());
    const month = quarter * 3;
    const target = new Date(Date.UTC(year, month, 1));
    timeline.push({
      date: target.toISOString().slice(0, 10),
      label: `Follow-up around Q${quarter} ${year}`,
      status: target < TODAY() ? "overdue" : "upcoming",
      quote: clip(notes),
    });
  }

  const months = lower.match(/\b(?:in|after|within)\s+(\d{1,2})\s+months?\b/);
  if (months && p.lastTouch) {
    const target = new Date(p.lastTouch);
    target.setMonth(target.getMonth() + Number(months[1]));
    timeline.push({
      date: target.toISOString().slice(0, 10),
      label: `Expected ${months[1]}-month follow-up`,
      status: target < TODAY() ? "overdue" : "upcoming",
      quote: clip(notes),
    });
  }

  const temporalTriggers = [
    /call (?:back )?after ([^.]+)/i,
    /follow up ([^.]+)/i,
    /revisit ([^.]+)/i,
    /review ([^.]+)/i,
  ];
  for (const re of temporalTriggers) {
    const hit = notes.match(re);
    if (hit && !timeline.some((t) => t.quote === clip(notes))) {
      timeline.push({
        date: null,
        label: clip(hit[0], 90),
        status: "unknown",
        quote: clip(notes),
      });
      break;
    }
  }

  if (/anniversary next month/i.test(notes) && p.lastTouch) {
    const target = new Date(p.lastTouch);
    target.setMonth(target.getMonth() + 1);
    timeline.push({
      date: target.toISOString().slice(0, 10),
      label: "Policy anniversary window",
      status: target < TODAY() ? "overdue" : "upcoming",
      quote: clip(notes),
    });
  }

  return timeline.slice(0, 5);
}

function detectContradictions(p: RankedProspect): AnalysisContradiction[] {
  const notes = (p.notes ?? "").toLowerCase();
  const out: AnalysisContradiction[] = [];

  if (/do not email|phone only/.test(notes) && p.email) {
    out.push({
      label: "Channel restriction",
      left: `Email present: ${p.email}`,
      right: "Notes restrict email outreach",
      severity: "block",
      quote: clip(p.notes ?? ""),
    });
  }
  if (/wrong number/.test(notes) && p.phone) {
    out.push({
      label: "Phone may be invalid",
      left: `Phone present: ${p.phone}`,
      right: "Notes record a wrong-number result",
      severity: "block",
      quote: clip(p.notes ?? ""),
    });
  }
  if (/email bounced/.test(notes) && p.email) {
    out.push({
      label: "Email may be invalid",
      left: `Email present: ${p.email}`,
      right: "Notes record a bounced email",
      severity: "block",
      quote: clip(p.notes ?? ""),
    });
  }
  if (/retired|left the company|former owner/.test(notes) && p.title && /owner|ceo|president|cfo/i.test(p.title)) {
    out.push({
      label: "Role may be stale",
      left: `Role on file: ${p.title}`,
      right: "Notes indicate a role or employment change",
      severity: "review",
      quote: clip(p.notes ?? ""),
    });
  }

  return out;
}

function chooseNextAction(
  p: RankedProspect,
  contradictions: AnalysisContradiction[],
  relationships: RelationshipInsight[],
  timeline: TimelineEvent[],
): { action: NextBestAction; reason: string } {
  if (p.silenceBucket === "do_not_cold_call" || /do not contact|no unsolicited/i.test(p.notes ?? "")) {
    return { action: "do_not_contact", reason: "Hard outreach restriction or extreme silence risk." };
  }
  if (relationships.some((r) => r.type === "possible_duplicate" && r.confidence >= 85)) {
    return { action: "merge_records", reason: "Resolve a likely duplicate before using stale or conflicting details." };
  }
  if (!p.phone && !p.email) {
    return { action: "find_contact", reason: "No usable phone or email is available." };
  }
  if (contradictions.some((c) => c.severity === "block")) {
    return { action: "verify_first", reason: "The file contains a contact or channel contradiction." };
  }
  if (relationships.some((r) => r.type === "referral")) {
    return { action: "ask_referrer", reason: "The relationship source can validate context before outreach." };
  }
  if (timeline.some((t) => t.status === "upcoming")) {
    return { action: "wait", reason: "The file contains a future timing commitment." };
  }
  if (!p.phone && p.email) {
    return { action: "email_first", reason: "Email is the only verified direct channel." };
  }
  if (p.needsReview || p.silenceBucket === "handle_with_care") {
    return { action: "verify_first", reason: "A file risk should be checked before a direct call." };
  }
  return { action: "call_now", reason: "Reachable, no hard conflict, and a cited commercial reason is available." };
}

function confidenceFor(
  p: RankedProspect,
  facts: AnalysisFact[],
  contradictions: AnalysisContradiction[],
) {
  let score = 38;
  if (p.notes) score += 18;
  if (p.lastTouch) score += 12;
  if (p.phone || p.email) score += 10;
  if (p.company) score += 8;
  if (facts.some((f) => f.category === "commercial")) score += 12;
  score -= contradictions.length * 12;
  if (p.tags.some((t) => t.id === "thin_file")) score -= 22;
  return Math.max(8, Math.min(96, score));
}

export function analyzeProspectLocally(
  p: RankedProspect,
  relationships: RelationshipInsight[] = [],
): ProspectAnalysis {
  const facts = parseFacts(p);
  const timeline = parseTimeline(p);
  const contradictions = detectContradictions(p);
  const next = chooseNextAction(p, contradictions, relationships, timeline);
  const commercial = facts.find((f) => f.category === "commercial");

  return {
    prospectId: p.id,
    mode: "local",
    summary: commercial
      ? `${commercial.value}. ${next.reason}`
      : `${p.whyCall} ${next.reason}`,
    facts,
    timeline,
    contradictions,
    relationships,
    evidenceConfidence: confidenceFor(p, facts, contradictions),
    nextAction: next.action,
    nextActionReason: next.reason,
    discoveryQuestions: buildDiscoveryQuestions(p),
    cautions: [
      ...contradictions.map((c) => c.label),
      ...p.risks.slice(0, 2).map((r) => r.snippet),
    ].filter((x, i, all) => all.indexOf(x) === i),
    analyzedAt: new Date().toISOString(),
  };
}

function buildDiscoveryQuestions(p: RankedProspect) {
  const ids = new Set(p.tags.map((t) => t.id));
  const questions: string[] = [];
  if (ids.has("buy_sell")) questions.push("Has the ownership structure or buy-sell agreement changed since you last spoke?");
  if (ids.has("key_person")) questions.push("Which role would create the largest operational gap if that person were unavailable?");
  if (ids.has("liquidity")) questions.push("Did the transaction or ownership event close, change, or pause?");
  if (ids.has("succession")) questions.push("Who is now expected to take over ownership or day-to-day operations?");
  if (ids.has("policy_window")) questions.push("Has the coverage or renewal need changed since the date in the file?");
  if (ids.has("referral")) questions.push("Is the original referral context still accurate?");
  questions.push("What has changed since the last note in the file?");
  return questions.slice(0, 3);
}

export function buildRelationships(prospects: Prospect[]): Record<string, RelationshipInsight[]> {
  const result: Record<string, RelationshipInsight[]> = Object.fromEntries(
    prospects.map((p) => [p.id, []]),
  );
  const byPhone = new Map<string, Prospect[]>();
  const byEmail = new Map<string, Prospect[]>();
  const byCompany = new Map<string, Prospect[]>();

  for (const p of prospects) {
    const phone = phoneKey(p.phone);
    const email = normalize(p.email);
    const company = normalize(p.company);
    if (phone) byPhone.set(phone, [...(byPhone.get(phone) ?? []), p]);
    if (email) byEmail.set(email, [...(byEmail.get(email) ?? []), p]);
    if (company) byCompany.set(company, [...(byCompany.get(company) ?? []), p]);
  }

  const connect = (
    group: Prospect[],
    type: RelationshipInsight["type"],
    reason: string,
    confidence: number,
  ) => {
    for (const p of group) {
      for (const other of group) {
        if (p.id === other.id) continue;
        if (result[p.id]!.some((r) => r.relatedProspectId === other.id && r.type === type)) continue;
        result[p.id]!.push({
          type,
          relatedProspectId: other.id,
          relatedName: other.name,
          reason,
          confidence,
        });
      }
    }
  };

  for (const group of byPhone.values()) if (group.length > 1) connect(group, "possible_duplicate", "Same phone number", 98);
  for (const group of byEmail.values()) if (group.length > 1) connect(group, "possible_duplicate", "Same email address", 99);
  for (const group of byCompany.values()) {
    if (group.length > 1 && group.length <= 12) connect(group, "same_company", "Same normalized company", 94);
  }

  // Email domain/company mismatch is useful evidence, but free-mail domains are ignored.
  const free = new Set(["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com"]);
  for (const p of prospects) {
    const d = domain(p.email);
    if (!d || free.has(d) || !p.company) continue;
    const companyWords = normalize(p.company);
    const domainRoot = normalize(d.split(".")[0]);
    if (domainRoot.length >= 5 && !companyWords.includes(domainRoot) && !domainRoot.includes(companyWords)) {
      result[p.id]!.push({
        type: "same_company",
        relatedName: p.company,
        reason: `Email domain ${d} does not clearly match the company name`,
        confidence: 55,
      });
    }
  }

  return result;
}

export function analyzeBookLocally(ranked: RankedProspect[]) {
  const relationships = buildRelationships(ranked);
  return Object.fromEntries(
    ranked.map((p) => [p.id, analyzeProspectLocally(p, relationships[p.id] ?? [])]),
  );
}

export function buildBookPatterns(
  ranked: RankedProspect[],
  analyses: Record<string, ProspectAnalysis>,
): BookPattern[] {
  const patterns: Array<{ id: string; label: string; description: string; kind: BookPattern["kind"]; match: (p: RankedProspect) => boolean }> = [
    { id: "owner-transition", label: "Owner transitions", description: "Buy-sell, succession, or liquidity conversations worth a focused campaign.", kind: "campaign", match: (p) => hasAny(p, ["buy_sell", "succession", "liquidity"]) },
    { id: "coverage-window", label: "Coverage review windows", description: "Policy anniversaries, disability, and coverage-gap signals.", kind: "campaign", match: (p) => hasAny(p, ["policy_window", "key_person"]) },
    { id: "unfinished-referrals", label: "Unfinished referrals", description: "Warm-source records that still have a usable contact path.", kind: "campaign", match: (p) => hasAny(p, ["referral"]) && Boolean(p.phone || p.email) },
    { id: "overdue-promises", label: "Overdue follow-ups", description: "The file contains a follow-up trigger whose date appears to have passed.", kind: "campaign", match: (p) => analyses[p.id]?.timeline.some((t) => t.status === "overdue") ?? false },
    { id: "verify-before-contact", label: "Verify before contact", description: "Contradictions or stale contact details should be resolved first.", kind: "risk", match: (p) => analyses[p.id]?.nextAction === "verify_first" },
    { id: "duplicate-work", label: "Likely duplicate work", description: "Records sharing a phone, email, or explicit duplicate note.", kind: "data", match: (p) => analyses[p.id]?.nextAction === "merge_records" },
  ];

  return patterns
    .map((pattern) => {
      const prospectIds = ranked.filter(pattern.match).map((p) => p.id);
      return { ...pattern, count: prospectIds.length, prospectIds };
    })
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count);
}

function hasAny(p: RankedProspect, ids: InsightTagId[]) {
  return p.tags.some((t) => ids.includes(t.id as InsightTagId));
}

/** Diversifies a week without allowing weaker records to jump far ahead. */
export function balancedCallable(
  ranked: RankedProspect[],
  analyses: Record<string, ProspectAnalysis>,
  count: number,
) {
  const callable = ranked.filter(
    (p) =>
      p.silenceBucket !== "do_not_cold_call" &&
      Boolean(p.phone || p.email) &&
      analyses[p.id]?.nextAction !== "do_not_contact",
  );
  const selected: RankedProspect[] = [];
  const tagUse = new Map<string, number>();

  while (selected.length < count && selected.length < callable.length) {
    const pool = callable.filter((p) => !selected.some((s) => s.id === p.id));
    pool.sort((a, b) => {
      const diversity = (p: RankedProspect) =>
        p.tags
          .filter((t) => t.kind === "opportunity")
          .reduce((sum, t) => sum + (tagUse.get(t.id) ?? 0), 0);
      const aAdjusted = a.score - Math.min(10, diversity(a) * 3);
      const bAdjusted = b.score - Math.min(10, diversity(b) * 3);
      return bAdjusted - aAdjusted;
    });
    const next = pool[0];
    if (!next) break;
    selected.push(next);
    for (const t of next.tags.filter((t) => t.kind === "opportunity")) {
      tagUse.set(t.id, (tagUse.get(t.id) ?? 0) + 1);
    }
  }
  return selected;
}
