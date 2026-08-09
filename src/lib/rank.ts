import type { Evidence, Outcome, Prospect, RankedProspect } from "./types";

function daysSince(iso?: string): number | null {
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

export function rankProspects(
  prospects: Prospect[],
  outcomes: Record<string, Outcome> = {},
): RankedProspect[] {
  const meetingBoost = new Set(
    Object.entries(outcomes)
      .filter(([, o]) => o === "meeting" || o === "sale")
      .map(([id]) => id),
  );

  const ranked = prospects.map((p) => {
    const reasons: Evidence[] = [];
    const risks: Evidence[] = [];
    let score = 35;

    const days = daysSince(p.lastTouch);
    if (days != null) {
      if (days <= 90) {
        score += 22;
        pushEvidence(reasons, "Last Touch", `${days}d ago — still warm`, "high");
      } else if (days <= 365) {
        score += 10;
        pushEvidence(reasons, "Last Touch", `${days}d ago — recoverable`, "medium");
      } else if (days <= 730) {
        score += 2;
        pushEvidence(reasons, "Last Touch", `${days}d ago — cold`, "low");
        pushEvidence(risks, "Silence risk", "Long gap — reopen carefully", "high");
      } else {
        score -= 8;
        pushEvidence(risks, "Silence risk", `${days}d silence — high opt-out risk`, "high");
      }
    } else {
      score -= 5;
      pushEvidence(risks, "Last Touch", "Missing / unparseable last touch", "medium");
    }

    const seg = (p.segment ?? "").toLowerCase();
    if (seg.includes("business owner") || seg.includes("hnw")) {
      score += 14;
      pushEvidence(reasons, "Segment", p.segment!, "high");
    } else if (seg.includes("referral") || seg.includes("inbound")) {
      score += 10;
      pushEvidence(reasons, "Segment", p.segment!, "medium");
    } else if (p.segment) {
      score += 4;
      pushEvidence(reasons, "Segment", p.segment, "low");
    }

    const notes = (p.notes ?? "").toLowerCase();
    if (notes.includes("buy-sell") || notes.includes("key person") || notes.includes("acquisition") || notes.includes("selling")) {
      score += 16;
      pushEvidence(reasons, "Notes", p.notes!.slice(0, 120), "high");
    } else if (notes.includes("high priority") || notes.includes("referred")) {
      score += 12;
      pushEvidence(reasons, "Notes", p.notes!.slice(0, 120), "high");
    } else if (notes.includes("anniversary") || notes.includes("policy")) {
      score += 8;
      pushEvidence(reasons, "Notes", p.notes!.slice(0, 120), "medium");
    } else if (p.notes) {
      score += 3;
      pushEvidence(reasons, "Notes", p.notes.slice(0, 120), "low");
    }

    if ((p.estimatedValue ?? "").toLowerCase().includes("high") || (p.estimatedValue ?? "").includes("$")) {
      score += 10;
      pushEvidence(reasons, "Value", p.estimatedValue!, "medium");
    }

    if (p.title && /owner|ceo|founder|president|cfo|partner/i.test(p.title)) {
      score += 8;
      pushEvidence(reasons, "Title", p.title, "medium");
    }

    // Contactability
    const hasPhone = Boolean(p.phone && !p.phone.includes("?"));
    const hasEmail = Boolean(p.email);
    if (hasPhone && hasEmail) {
      score += 8;
      pushEvidence(reasons, "Contact", "Phone + email present", "medium");
    } else if (hasPhone || hasEmail) {
      score += 4;
      pushEvidence(reasons, "Contact", hasPhone ? "Phone only" : "Email only", "low");
    } else if (p.linkedin) {
      score -= 2;
      pushEvidence(risks, "Contact", "LinkedIn-only — thin file", "high");
    } else {
      score -= 12;
      pushEvidence(risks, "Contact", "No usable phone, email, or LinkedIn", "high");
    }

    if (!p.company && !p.notes) {
      score -= 6;
      pushEvidence(risks, "Data quality", "Thin file — name little else", "medium");
    }

    if ((p.notes ?? "").toLowerCase().includes("duplicate") || (p.notes ?? "").toLowerCase().includes("wrong number")) {
      score -= 10;
      pushEvidence(risks, "Data quality", p.notes!, "high");
    }

    if ((p.notes ?? "").toLowerCase().includes("do not email") || (p.notes ?? "").toLowerCase().includes("angry")) {
      pushEvidence(risks, "Approach", p.notes!.slice(0, 100), "medium");
    }

    // Light outcome learning: boost similar segments when meetings/sales logged
    if (meetingBoost.size > 0 && seg) {
      score += 3;
      pushEvidence(reasons, "Outcome learning", "Similar to prior meeting/sale patterns this session", "low");
    }

    score = Math.max(0, Math.min(99, Math.round(score)));

    const needsHuman =
      risks.some((r) => r.weight === "high") ||
      reasons.length === 0 ||
      (!hasPhone && !hasEmail);

    let tier: RankedProspect["tier"] = "warm";
    if (needsHuman && score < 45) tier = "risk";
    else if (score >= 70) tier = "hot";
    else if (score < 45) tier = "thin";

    const talkTrack = buildTalkTrack(p, days, risks);

    return {
      ...p,
      score,
      tier,
      reasons,
      risks,
      talkTrack,
      needsHuman,
      outcome: outcomes[p.id] ?? "queued",
    } satisfies RankedProspect;
  });

  // Duplicate detection pass
  const byName = new Map<string, string[]>();
  for (const r of ranked) {
    const key = r.name.trim().toLowerCase();
    const list = byName.get(key) ?? [];
    list.push(r.id);
    byName.set(key, list);
  }
  for (const r of ranked) {
    const dups = byName.get(r.name.trim().toLowerCase()) ?? [];
    if (dups.length > 1) {
      r.risks.push({
        field: "Duplicate",
        snippet: `Possible duplicate of ${dups.filter((id) => id !== r.id).join(", ")}`,
        weight: "high",
      });
      r.needsHuman = true;
      r.score = Math.max(0, r.score - 5);
    }
  }

  return ranked.sort((a, b) => b.score - a.score);
}

function buildTalkTrack(p: Prospect, days: number | null, risks: Evidence[]): string {
  const silence = risks.some((r) => r.field === "Silence risk");
  const first = p.name.split(" ")[0] ?? p.name;
  const companyBit = p.company ? ` at ${p.company}` : "";

  if (silence) {
    return `Hi ${first} — it's been a long time and I don't want to be a nuisance. When we last spoke${companyBit}, we touched on planning topics. If it's no longer useful to stay in touch, say the word and I'll close the file. If helpful, I have 15 minutes this week for a quick catch-up — no pitch required.`;
  }

  if ((p.notes ?? "").toLowerCase().includes("buy-sell") || (p.notes ?? "").toLowerCase().includes("key person")) {
    return `Hi ${first} — circling back on the buy-sell / key-person conversation from our notes. Business-owner planning has been active for peers in similar spots. Open to a short call to see if anything changed${companyBit}?`;
  }

  if ((p.notes ?? "").toLowerCase().includes("anniversary") || (p.notes ?? "").toLowerCase().includes("policy")) {
    return `Hi ${first} — your file flagged a coverage / policy review window. Happy to do a no-pressure check-in so nothing drifts. Does a brief call this week work?`;
  }

  if (days != null && days <= 90) {
    return `Hi ${first} — following up while our last conversation is still recent${companyBit}. Wanted to close the loop and see if you'd like to schedule a focused planning chat.`;
  }

  return `Hi ${first} — I'm prioritizing a small set of prior relationships this week${companyBit}. Based on our file, a short catch-up seemed worth offering. If timing is bad, I can note a better month — either way appreciated.`;
}

export function prospectsFromCsvRows(rows: Record<string, string>[]): Prospect[] {
  return rows.map((raw, i) => {
    const get = (...keys: string[]) => {
      for (const k of keys) {
        const found = Object.entries(raw).find(
          ([key]) => key.toLowerCase().trim() === k.toLowerCase(),
        );
        if (found?.[1]?.trim()) return found[1].trim();
      }
      return undefined;
    };
    const name = get("name", "full name", "contact") ?? `Unknown ${i + 1}`;
    return {
      id: `csv-${i + 1}-${name.slice(0, 12).replace(/\s+/g, "-").toLowerCase()}`,
      name,
      email: get("email", "e-mail"),
      phone: get("phone", "mobile", "cell"),
      company: get("company", "firm", "organization"),
      title: get("title", "role"),
      segment: get("segment", "type", "category"),
      source: get("source") ?? "csv upload",
      lastTouch: get("last touch", "last_touch", "last contact", "lastcontact"),
      notes: get("notes", "note", "comments"),
      estimatedValue: get("value", "estimated value", "aum"),
      linkedin: get("linkedin", "li"),
      raw,
    };
  });
}
