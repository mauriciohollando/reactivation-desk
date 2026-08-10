import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAI } from "@/lib/openai";
import type { BriefDetail, CallPrepPacket, SaleHighlight } from "@/lib/callPrepTypes";
import {
  aiValidateCallPrep,
  heuristicValidateCallPrep,
} from "@/lib/callPrepValidate";

export const runtime = "nodejs";
export const maxDuration = 60;

const inputSchema = z.object({
  prospect: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    company: z.string().nullable(),
    title: z.string().nullable(),
    lastTouch: z.string().nullable(),
    notes: z.string().nullable(),
    estimatedValue: z.string().nullable(),
    emailDomain: z.string().nullable(),
    whyCall: z.string().nullable(),
  }),
});

// Generous ceilings — web_search + structured output often overruns tight maxes.
const detailSchema = z.object({
  text: z.string().max(500),
  origin: z.enum(["file", "public"]),
  cite: z.string().max(320),
  url: z.string().max(2000),
});

const briefSchema = z.object({
  summary: z.string().max(500),
  details: z.array(detailSchema).max(6),
  sources: z
    .array(
      z.object({
        label: z.string().max(120),
        url: z.string().max(2000),
      }),
    )
    .max(4),
});

const highlightSchema = z.object({
  text: z.string().max(420),
  whyItMatters: z.string().max(280),
  publisher: z.string().max(120),
  url: z.string().max(2000),
});

const prepSchema = z.object({
  person: briefSchema,
  company: briefSchema,
  saleHighlights: z.array(highlightSchema).max(4),
  leadWhy: z.string().max(320),
  offerFocus: z.string().max(320),
  approachNote: z.string().max(320),
  talkBullets: z.array(z.string().max(320)).min(4).max(7),
  identityStatus: z.enum(["matched", "possible", "unresolved", "file_only"]),
  identityNote: z.string().max(320),
});

function clip(text: string, max: number) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function isVagueEventClaim(text: string) {
  const t = text.toLowerCase();
  const vagueEvent =
    /\b(webinar|conference|event|summit|panel|podcast)\b/.test(t) &&
    !/\b(20\d{2}|january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(
      t,
    );
  const unnamed =
    /\b(recent|a webinar|an event|industry conference|sector news)\b/.test(t) &&
    !/\b(named|titled|called)\b/.test(t);
  return vagueEvent || (unnamed && /\b(webinar|conference|event)\b/.test(t));
}

function clipDetail(detail: z.infer<typeof detailSchema>): BriefDetail | null {
  const text = clip(detail.text, 220);
  if (!text) return null;
  const origin = detail.origin === "public" ? "public" : "file";
  const url = origin === "public" ? detail.url.trim().slice(0, 400) : "";
  const cite = clip(detail.cite || "", 160);

  // Public claims need a real URL.
  if (origin === "public" && !/^https?:\/\//i.test(url)) return null;

  // Drop or rewrite vague event claims with no name/date/link.
  if (origin === "file" && isVagueEventClaim(text) && !cite) {
    return {
      text: "Notes mention an event or webinar — specific name not on file",
      origin: "file",
      cite: cite || "file notes",
      url: "",
    };
  }
  if (origin === "public" && isVagueEventClaim(text)) {
    // Keep only if URL present (already required) and text isn't totally empty of specifics.
    if (!/\b(20\d{2}|[A-Z][a-z]+ \d{1,2})\b/.test(detail.text) && text.length < 40) {
      return null;
    }
  }

  return { text, origin, cite, url };
}

function clipBrief(section: z.infer<typeof briefSchema>) {
  const details = section.details
    .map(clipDetail)
    .filter((d): d is BriefDetail => Boolean(d))
    .slice(0, 6);
  const sources = section.sources
    .map((s) => ({
      label: clip(s.label, 80),
      url: s.url.trim().slice(0, 400),
    }))
    .filter((s) => s.label && /^https?:\/\//i.test(s.url))
    .slice(0, 4);

  // Pull source links from public details if sources array was thin.
  for (const d of details) {
    if (d.origin === "public" && d.url && !sources.some((s) => s.url === d.url)) {
      sources.push({ label: clip(d.cite || "Source", 80), url: d.url });
    }
    if (sources.length >= 4) break;
  }

  return {
    summary: clip(section.summary, 280),
    details,
    sources: sources.slice(0, 4),
  };
}

function clipHighlights(
  items: z.infer<typeof highlightSchema>[],
): SaleHighlight[] {
  return items
    .map((item) => {
      const url = item.url.trim().slice(0, 400);
      if (!/^https?:\/\//i.test(url)) return null;
      const text = clip(item.text, 260);
      const whyItMatters = clip(item.whyItMatters, 180);
      const publisher = clip(item.publisher || "Source", 80);
      if (!text || !whyItMatters) return null;
      if (isVagueEventClaim(text) && text.length < 50) return null;
      return { text, whyItMatters, publisher, url };
    })
    .filter((item): item is SaleHighlight => Boolean(item))
    .slice(0, 4);
}

export async function POST(request: Request) {
  try {
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Invalid call-prep request" }, { status: 400 });
    }

    const p = parsed.data.prospect;
    const hasCompany = Boolean(p.company?.trim());
    const notes = (p.notes ?? "").slice(0, 2500);

    const response = await getOpenAI().responses.parse({
      model: process.env.OPENAI_WEB_MODEL ?? "gpt-4.1-mini",
      tools: hasCompany ? [{ type: "web_search" }] : [],
      include: hasCompany ? ["web_search_call.action.sources"] : undefined,
      text: {
        format: zodTextFormat(prepSchema, "call_prep_brief"),
      },
      input: [
        {
          role: "system",
          content: `You prepare a short call brief for a financial advisor who sells planning, insurance, and wealth conversations to business owners and executives.

Company research is supporting context only. The advisor already sees company facts elsewhere. Your job is to coach the SALE.

Every factual detail must answer: what exactly, and how do we know?

Rules:
- Ground person.summary first in CRM/file notes and the why-call reason.
- If a company is provided, use web_search for public BUSINESS facts: role association, what the company does, material recent events (funding, launch, earnings, leadership, M&A, expansion). Prefer official sites and reputable business news.
- Do NOT research personal life, family, politics, health, or home addresses.
- details[].origin must be "file" or "public".
  - file: only from notes/fields. cite = short verbatim quote or field label. url = "".
  - public: only from search results. cite = publisher or page title. url = real https URL from search.
- Never promote vague file crumbs as hard facts. If notes say "webinar" / "conference" with no event name or date, either omit or write: "Notes mention webinar attendance — event not named on file".
- Never invent event names, revenue, ownership, or dates.
- saleHighlights: 0-4 PUBLIC linked facts. text = the business fact. whyItMatters = the advisor sales angle (key-person risk, succession, liquidity, buy-sell, deferred comp, executive benefits, cash concentration, growth-stage planning) — never a generic "community engagement" fluff line.
- leadWhy: 1-2 sentences — why THIS person is a good lead to dial now (file warmth + role + timing). Not a company description.
- offerFocus: 1-2 sentences — which planning / insurance / wealth conversations to explore on this call. Be concrete (e.g. key-person coverage, buy-sell funding, succession income planning). Do not invent that they asked for a product.
- approachNote: one sentence on how to open (file warmth + public hook + ask).
- talkBullets: 4-7 SALES coaching bullets for while dialing. Required mix:
  1) Why they're worth calling now
  2) What to explore selling / discussing (advisor offer angle)
  3) One discovery question
  4) One caution or preference from the file
  Optional: public hook used as proof, not as the whole bullet list.
  FORBIDDEN in talkBullets: repeating what the company does, product feature lists, encyclopedia facts with no sales angle.
  Keep each bullet under 140 characters.
- identityStatus is about person↔company match only, not overall evidence quality.
- identityNote: plain language on match confidence and any synthetic/test-data caveats in the file.
- person.summary and company.summary: 1-2 short sentences.
- sources: public URLs only; [] when file-only.`,
        },
        {
          role: "user",
          content: `Prepare a call brief as of ${new Date().toISOString().slice(0, 10)}.

NAME: ${p.name}
TITLE: ${p.title ?? "unknown"}
COMPANY: ${p.company ?? "unknown"}
EMAIL DOMAIN: ${p.emailDomain ?? "unknown"}
LAST TOUCH: ${p.lastTouch ?? "unknown"}
ESTIMATED VALUE: ${p.estimatedValue ?? "unknown"}
WHY CALL: ${p.whyCall ?? "unknown"}
NOTES:
${notes || "none"}

Coach the advisor on why to call, what planning conversations to explore, and how to open. Keep company encyclopedia facts in person/company sections and saleHighlights — not in talkBullets.`,
        },
      ],
    });

    const output = response.output_parsed;
    if (!output) throw new Error("OpenAI returned no call prep");

    const saleHighlights = hasCompany ? clipHighlights(output.saleHighlights) : [];

    const draft: CallPrepPacket = heuristicValidateCallPrep({
      prospectId: p.id,
      person: clipBrief(output.person),
      company: clipBrief(output.company),
      saleHighlights,
      leadWhy: clip(output.leadWhy, 240),
      offerFocus: clip(output.offerFocus, 240),
      approachNote: clip(output.approachNote, 220),
      talkBullets: output.talkBullets.map((b) => clip(b, 180)).slice(0, 7),
      identityStatus: hasCompany ? output.identityStatus : "file_only",
      identityNote: clip(output.identityNote, 220),
      preparedAt: new Date().toISOString(),
      source: "ai",
    });

    // Second pass: drop non-sales noise and rewrite coaching fields.
    let packet = draft;
    try {
      packet = heuristicValidateCallPrep(
        await aiValidateCallPrep(draft, {
          name: p.name,
          company: p.company,
          title: p.title,
          whyCall: p.whyCall,
          notes: notes || null,
        }),
      );
    } catch (validationError) {
      console.error("Call prep validation pass failed; using heuristic draft", validationError);
    }

    return Response.json({
      packet,
      model: process.env.OPENAI_WEB_MODEL ?? "gpt-4.1-mini",
    });
  } catch (error) {
    console.error("Call prep failed", error);
    const message = error instanceof Error ? error.message : "";
    if (/OPENAI_API_KEY is not configured/i.test(message)) {
      return Response.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });
    }
    return Response.json(
      { error: "AI call prep is temporarily unavailable." },
      { status: 503 },
    );
  }
}
