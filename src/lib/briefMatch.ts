import type { Prospect } from "./types";

const STOP = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "for",
  "to",
  "of",
  "in",
  "on",
  "at",
  "by",
  "as",
  "is",
  "are",
  "be",
  "do",
  "my",
  "me",
  "we",
  "our",
  "only",
  "people",
  "person",
  "with",
  "from",
  "that",
  "this",
  "want",
  "week",
  "call",
  "calls",
  "good",
  "match",
  "matches",
  "over",
  "cold",
  "warm",
  "lead",
  "leads",
  "focus",
  "into",
  "about",
  "their",
  "them",
  "have",
  "been",
  "were",
  "your",
  "find",
  "looking",
  "prioritize",
  "prioritizing",
  "priority",
  "upto",
  "than",
  "then",
  "also",
  "just",
  "more",
  "most",
  "some",
  "any",
  "who",
  "whom",
  "what",
  "when",
  "where",
  "which",
  "how",
  "industry",
  "sector",
  "company",
  "companies",
  "connection",
  "connections",
  "referral",
  "referrals",
]);

/** Extra search terms when a brief names a common sector. */
const THEME_EXPANSIONS: Record<string, string[]> = {
  software: [
    "software",
    "saas",
    "cloud",
    "platform",
    "developer",
    "github",
    "openai",
    "figma",
    "meta",
    "microsoft",
    "google",
    "oracle",
    "adobe",
    "salesforce",
    "stripe",
    "shopify",
    "nvidia",
    "apple",
    "linkedin",
    "plangrid",
    "cloudflare",
    "deepmind",
    "alphabet",
  ],
  tech: [
    "software",
    "saas",
    "cloud",
    "technology",
    "openai",
    "figma",
    "microsoft",
    "google",
    "nvidia",
    "meta",
  ],
  technology: [
    "software",
    "saas",
    "cloud",
    "technology",
    "openai",
    "figma",
    "microsoft",
    "google",
    "nvidia",
    "meta",
  ],
  automotive: [
    "auto",
    "automotive",
    "dealer",
    "vehicle",
    "motors",
    "ford",
    "gm",
    "toyota",
    "tesla",
    "stellantis",
  ],
  dealer: ["dealer", "dealership", "automotive", "auto", "motors"],
  healthcare: ["health", "hospital", "medical", "pharma", "biotech", "unitedhealth"],
  real: ["real estate", "realty", "property", "brokerage"],
  estate: ["real estate", "realty", "property"],
};

export function tokenizeBrief(brief: string): string[] {
  const raw = brief
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));
  const extras: string[] = [];
  for (const token of raw) {
    const expansion = THEME_EXPANSIONS[token];
    if (expansion) extras.push(...expansion);
  }
  return [...new Set([...raw, ...extras])];
}

function blobFor(p: Pick<Prospect, "name" | "company" | "title" | "segment" | "notes" | "source">) {
  return [p.name, p.company, p.title, p.segment, p.source, p.notes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function briefMatchScore(
  p: Pick<Prospect, "name" | "company" | "title" | "segment" | "notes" | "source">,
  tokens: string[],
): number {
  if (!tokens.length) return 0;
  const blob = blobFor(p);
  let score = 0;
  for (const token of tokens) {
    if (blob.includes(token)) score += token.length >= 6 ? 3 : 2;
  }
  return score;
}

/** Prefer brief matches, then keep original relative order for the rest. */
export function shortlistForBrief<T extends Prospect & { score?: number }>(
  ranked: T[],
  brief: string,
  limit: number,
): T[] {
  const tokens = tokenizeBrief(brief);
  if (!tokens.length) return ranked.slice(0, limit);
  const scored = ranked.map((p, index) => ({
    p,
    index,
    match: briefMatchScore(p, tokens),
  }));
  scored.sort((a, b) => {
    if (b.match !== a.match) return b.match - a.match;
    const scoreDiff = (b.p.score ?? 0) - (a.p.score ?? 0);
    if (scoreDiff) return scoreDiff;
    return a.index - b.index;
  });
  return scored.slice(0, limit).map((row) => row.p);
}

export function localBriefFillIds(
  ranked: Prospect[],
  brief: string,
  already: string[],
  budget: number,
): string[] {
  const tokens = tokenizeBrief(brief);
  if (!tokens.length || already.length >= budget) return already;
  const picked = new Set(already);
  const out = [...already];
  for (const p of ranked) {
    if (out.length >= budget) break;
    if (picked.has(p.id)) continue;
    if (briefMatchScore(p, tokens) <= 0) continue;
    picked.add(p.id);
    out.push(p.id);
  }
  return out;
}
