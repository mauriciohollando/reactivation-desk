import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAI } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

const inputSchema = z.object({
  prospect: z.object({
    id: z.string().min(1),
    name: z.string().min(2),
    company: z.string().min(2),
    title: z.string().optional(),
    lastTouch: z.string().optional(),
    notes: z.string().optional(),
    emailDomain: z.string().optional(),
  }),
});

const evidenceSchema = z.object({
  identityStatus: z.enum(["matched", "possible", "unresolved"]),
  identityReason: z.string().max(240),
  claims: z
    .array(
      z.object({
        category: z.enum([
          "role",
          "acquisition",
          "financing",
          "ownership_leadership",
          "expansion",
          "workforce",
          "distress",
          "succession",
          "regulatory",
          "major_contract",
        ]),
        claim: z.string().max(240),
        status: z.enum(["confirmed", "changed", "unresolved"]),
        excerpt: z.string().max(300),
        url: z.string().min(1),
        publisher: z.string().max(120),
        publishedAt: z.string().nullable(),
        identityConfidence: z.number().int().min(0).max(100),
        claimConfidence: z.number().int().min(0).max(100),
      }),
    )
    .max(6),
  whyNow: z.string().max(260).nullable(),
});

export async function POST(request: Request) {
  try {
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "A named company is required for safe public-evidence matching." },
        { status: 400 },
      );
    }

    const p = parsed.data.prospect;
    const response = await getOpenAI().responses.parse({
      model: process.env.OPENAI_WEB_MODEL ?? "gpt-4.1-mini",
      tools: [{ type: "web_search" }],
      include: ["web_search_call.action.sources"],
      text: {
        format: zodTextFormat(evidenceSchema, "public_business_evidence"),
      },
      input: [
        {
          role: "system",
          content: `You research public BUSINESS evidence for a human-reviewed advisor workflow.

Scope:
- Verify whether the named person appears associated with the named company.
- Search for material company events since the last-contact date: acquisition/sale, financing, ownership or leadership change, expansion/new location, major hiring/layoffs/closure/bankruptcy, succession, regulatory action, or major contract.
- Prefer official company pages, government/regulatory filings, and reputable business/local news.
- Do not research personal life, family, social posts, home addresses, political views, health, protected traits, or unrelated people.
- Never match identity from name alone. Company, role, location, email domain, or an official biography must support the match.
- Search snippets are discovery clues, not sufficient evidence for a sensitive claim.
- Do not return stock price, market capitalization, valuation multiples, EPS, generic
  company descriptions, product launches, or ordinary earnings unless they directly
  establish one of the material event categories above.
- If evidence is ambiguous, use unresolved.
- Every returned claim must have a real source URL from search results and a supporting excerpt.
- whyNow must be null unless at least one high-confidence material claim directly changes or confirms the file reason.
- This output is for review only and cannot authorize outreach.`,
        },
        {
          role: "user",
          content: `Refresh public business evidence as of ${new Date().toISOString().slice(0, 10)}.

PERSON ON FILE: ${p.name}
COMPANY ON FILE: ${p.company}
ROLE ON FILE: ${p.title ?? "unknown"}
EMAIL DOMAIN: ${p.emailDomain ?? "unknown"}
LAST CONTACT: ${p.lastTouch ?? "unknown"}
FILE NOTE: ${p.notes ?? "none"}

Search narrowly. Return only evidence connected to this exact person/company or the named company itself.`,
        },
      ],
    });
    const output = response.output_parsed;
    if (!output) throw new Error("OpenAI returned no structured web evidence");
    const sourceUrls = collectUrls(response.output);
    const claims = output.claims.filter(
      (claim) =>
        sourceUrls.has(normalizeUrl(claim.url)) &&
        claim.excerpt.trim().length >= 12,
    );

    return Response.json({
      packet: {
        prospectId: p.id,
        identityStatus: output.identityStatus,
        identityReason: output.identityReason,
        claims,
        whyNow: claims.length ? output.whyNow : null,
        searchedAt: new Date().toISOString(),
      },
      sourceCount: sourceUrls.size,
      reviewOnly: true,
    });
  } catch (error) {
    console.error("Evidence refresh failed", error);
    const message = error instanceof Error ? error.message : "";
    if (/OPENAI_API_KEY is not configured/i.test(message)) {
      return Response.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 503 },
      );
    }
    return Response.json(
      { error: "Public evidence refresh is temporarily unavailable." },
      { status: 503 },
    );
  }
}

function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.replace(/\/$/, "");
  }
}

function collectUrls(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) out.add(normalizeUrl(value));
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectUrls(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectUrls(item, out);
    }
  }
  return out;
}
