import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAI } from "@/lib/openai";
import type {
  BriefDetail,
  CallBriefSection,
  CallPrepPacket,
  SaleHighlight,
} from "@/lib/callPrepTypes";

const SALES_SIGNAL =
  /\b(buy-?sell|key[ -]?person|succession|estate|liquidity|deferred|benefits|coverage|policy|planning|owner|partner|reopen|why now|offer|ask|caution|timing|value|referral|inbound|decision maker|household|risk|funding|transition|retirement|comp)\b/i;

const COMPANY_FLUFF =
  /\b(launched|opened in|offers free|providing|specializ|co-?working|workspace|retaining talent|community engagement|innovative solutions|what they do|product suite|aiming to|focus(?:es|ing)? on sectors)\b/i;

const GENERIC_ANGLE =
  /\b(community engagement|attract potential clients|innovative solutions|local partnerships|enhance community|streamline|synerg|brand awareness)\b/i;

function clip(text: string, max: number) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

export function isCompanyEncyclopediaBullet(text: string) {
  const t = text.trim();
  if (!t) return true;
  if (SALES_SIGNAL.test(t)) return false;
  if (COMPANY_FLUFF.test(t)) return true;
  // Pure "Company does X" with no advisor angle.
  if (/^(offers|provides|focus(?:es)? on|supports|aims to)\b/i.test(t)) return true;
  return false;
}

export function isWeakSalesAngle(text: string) {
  const t = text.trim();
  if (!t) return true;
  if (GENERIC_ANGLE.test(t)) return true;
  if (SALES_SIGNAL.test(t)) return false;
  // Angle that only restates company purpose.
  if (COMPANY_FLUFF.test(t) && !SALES_SIGNAL.test(t)) return true;
  return false;
}

export function filterTalkBullets(bullets: string[]) {
  const kept = bullets
    .map((b) => clip(b, 180))
    .filter((b) => b && !isCompanyEncyclopediaBullet(b));
  return kept.slice(0, 7);
}

export function filterHighlights(items: SaleHighlight[]) {
  return items
    .filter((item) => {
      if (!item.text?.trim() || !item.url) return false;
      if (isWeakSalesAngle(item.whyItMatters)) return false;
      return true;
    })
    .slice(0, 4);
}

function filterDetails(details: BriefDetail[], mode: "person" | "company") {
  return details
    .filter((d) => {
      const t = d.text.trim();
      if (!t) return false;
      if (mode === "person") {
        // Keep role/file/timing; drop company brochure lines on the person card.
        if (isCompanyEncyclopediaBullet(t) && !SALES_SIGNAL.test(t)) return false;
      }
      if (mode === "company") {
        // Keep material events / identity; drop laundry-list feature fluff.
        if (
          /\b(product suite|tools like|offers tools|streamline product)\b/i.test(t) &&
          !SALES_SIGNAL.test(t)
        ) {
          return false;
        }
      }
      return true;
    })
    .slice(0, 6);
}

function filterSection(section: CallBriefSection, mode: "person" | "company") {
  return {
    ...section,
    details: filterDetails(section.details, mode),
  };
}

/** Fast local pass — always run before/after the AI validator. */
export function heuristicValidateCallPrep(packet: CallPrepPacket): CallPrepPacket {
  let talkBullets = filterTalkBullets(packet.talkBullets);
  if (talkBullets.length < 3) {
    // Keep originals if filter was too aggressive; AI pass can still rewrite.
    talkBullets = packet.talkBullets.map((b) => clip(b, 180)).filter(Boolean).slice(0, 7);
  }

  return {
    ...packet,
    person: filterSection(packet.person, "person"),
    company: filterSection(packet.company, "company"),
    saleHighlights: filterHighlights(packet.saleHighlights),
    leadWhy: clip(packet.leadWhy, 240),
    offerFocus: clip(packet.offerFocus, 240),
    approachNote: clip(packet.approachNote, 220),
    talkBullets,
  };
}

const validateSchema = z.object({
  leadWhy: z.string().max(320),
  offerFocus: z.string().max(320),
  approachNote: z.string().max(320),
  talkBullets: z.array(z.string().max(320)).min(3).max(7),
  keepHighlightIndexes: z.array(z.number().int().min(0).max(20)).max(4),
  keepPersonDetailIndexes: z.array(z.number().int().min(0).max(20)).max(6),
  keepCompanyDetailIndexes: z.array(z.number().int().min(0).max(20)).max(6),
  droppedSummary: z.string().max(220),
});

function pickByIndex<T>(items: T[], indexes: number[]) {
  const out: T[] = [];
  const seen = new Set<number>();
  for (const i of indexes) {
    if (!Number.isInteger(i) || i < 0 || i >= items.length || seen.has(i)) continue;
    seen.add(i);
    out.push(items[i]!);
  }
  return out;
}

/**
 * Second-pass AI validator: drops non-sales noise and rewrites coaching fields.
 * No web search — uses only the draft packet + file context.
 */
export async function aiValidateCallPrep(
  draft: CallPrepPacket,
  context: {
    name: string;
    company: string | null;
    title: string | null;
    whyCall: string | null;
    notes: string | null;
  },
): Promise<CallPrepPacket> {
  const response = await getOpenAI().responses.parse({
    model: process.env.OPENAI_ANALYSIS_MODEL ?? "gpt-4.1-mini",
    text: {
      format: zodTextFormat(validateSchema, "call_prep_sales_validation"),
    },
    input: [
      {
        role: "system",
        content: `You are a ruthless sales editor for a financial advisor's call brief.

Keep ONLY information that helps the advisor:
- decide this is a good lead to dial now
- know what planning/insurance/wealth conversation to explore
- open the call well
- ask a useful question or heed a caution

DROP:
- company encyclopedia / product feature lists with no sales angle
- generic "community / innovation / partnership" fluff
- vague event claims that cannot be used on a call
- duplicate facts

Rewrite leadWhy, offerFocus, approachNote, and talkBullets so they are sales coaching.
talkBullets must include: why now, offer angle, discovery question, caution/preference.
Return keep*Indexes as 0-based indexes into the provided arrays for highlights/details worth keeping.
If an array item is weak, omit its index. Prefer fewer strong items.
droppedSummary: short note of what you removed (for logs).`,
      },
      {
        role: "user",
        content: `Prospect: ${context.name}
Title: ${context.title ?? "unknown"}
Company: ${context.company ?? "unknown"}
Why call (file): ${context.whyCall ?? "unknown"}
Notes: ${(context.notes ?? "none").slice(0, 1200)}

DRAFT PACKET:
${JSON.stringify(
  {
    leadWhy: draft.leadWhy,
    offerFocus: draft.offerFocus,
    approachNote: draft.approachNote,
    talkBullets: draft.talkBullets,
    saleHighlights: draft.saleHighlights.map((h, i) => ({
      i,
      text: h.text,
      whyItMatters: h.whyItMatters,
    })),
    personDetails: draft.person.details.map((d, i) => ({
      i,
      origin: d.origin,
      text: d.text,
    })),
    companyDetails: draft.company.details.map((d, i) => ({
      i,
      origin: d.origin,
      text: d.text,
    })),
  },
  null,
  2,
)}`,
      },
    ],
  });

  const v = response.output_parsed;
  if (!v) throw new Error("Call prep validation returned nothing");

  const talkBullets = filterTalkBullets(v.talkBullets);
  if (talkBullets.length < 3) {
    throw new Error("Call prep validation produced too few sales bullets");
  }

  const saleHighlights = filterHighlights(
    pickByIndex(draft.saleHighlights, v.keepHighlightIndexes),
  );
  const personDetails = filterDetails(
    pickByIndex(draft.person.details, v.keepPersonDetailIndexes),
    "person",
  );
  const companyDetails = filterDetails(
    pickByIndex(draft.company.details, v.keepCompanyDetailIndexes),
    "company",
  );

  if (v.droppedSummary) {
    console.info("Call prep validation dropped:", v.droppedSummary);
  }

  return {
    ...draft,
    person: { ...draft.person, details: personDetails },
    company: { ...draft.company, details: companyDetails },
    saleHighlights,
    leadWhy: clip(v.leadWhy, 240),
    offerFocus: clip(v.offerFocus, 240),
    approachNote: clip(v.approachNote, 220),
    talkBullets,
  };
}
