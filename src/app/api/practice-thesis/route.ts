import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAI } from "@/lib/openai";
import { AUDIENCE_IDS, OFFER_IDS } from "@/lib/practiceThesis";

export const runtime = "nodejs";
export const maxDuration = 45;

const inputSchema = z.object({
  sourceLabel: z.string().max(200).optional(),
  book: z.object({
    total: z.number().int().nonnegative(),
    callableThisWeek: z.number().int().nullable().optional(),
    thinFiles: z.number().int().nullable().optional(),
    topTags: z
      .array(z.object({ label: z.string().max(80), count: z.number() }))
      .max(12)
      .optional(),
    sample: z
      .array(
        z.object({
          name: z.string().max(120),
          title: z.string().max(120),
          company: z.string().max(160),
          segment: z.string().max(200),
          notes: z.string().max(280),
          source: z.string().max(80),
        }),
      )
      .min(1)
      .max(40),
  }),
});

const guessSchema = z.object({
  audience: z.enum(AUDIENCE_IDS),
  offers: z.array(z.enum(OFFER_IDS)).min(1).max(3),
  customOffer: z.string().max(280),
  summary: z.string().max(320),
  insights: z
    .array(
      z.object({
        id: z.string().max(40),
        text: z.string().max(220),
      }),
    )
    .min(2)
    .max(5),
  rationale: z.string().max(320),
});

export async function POST(request: Request) {
  try {
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Invalid practice-thesis request" }, { status: 400 });
    }

    const { book, sourceLabel } = parsed.data;
    const offerCatalog = [
      "sales_reactivation — reopen prior prospects (any industry)",
      "b2b_services — accounting, marketing, IT, ops services",
      "services_consulting — agencies, fractional ops, advisory",
      "saas_software — product or tool sellers",
      "data_analytics — dashboards, reporting, analysis retainers",
      "group_healthcare — employer medical/benefits for companies",
      "life_benefits — buy-sell, key person, executive benefits",
      "succession_liquidity — ownership transitions / exits",
      "wealth_aum — planning reviews / asset conversations",
      "insurance_reviews — policy anniversaries / coverage gaps",
      "general_reactivation — warm reopen without a product pack",
      "custom — only with a short customOffer in the user's words",
    ].join("\n");

    const response = await getOpenAI().responses.parse({
      model: process.env.OPENAI_ANALYSIS_MODEL ?? "gpt-4.1-mini",
      text: {
        format: zodTextFormat(guessSchema, "practice_thesis_guess"),
      },
      input: [
        {
          role: "system",
          content: `You infer a PRACTICE THESIS from an imported prospect/CRM book.

Goal: guess who the seller is trying to reopen and what they sell / discuss — for list curation and call tips only. Do NOT invent a personal biography or tone of voice.

Rules:
- Ground every insight in the supplied sample (titles, companies, segments, notes). Quote themes, not private facts you invent.
- Prefer cross-vertical packs (sales_reactivation, b2b_services, services_consulting, saas_software, data_analytics, group_healthcare) when notes clearly point there.
- Only choose life_benefits / succession_liquidity / wealth_aum / insurance_reviews when the file language clearly supports financial-advisor / insurance selling.
- If the book is mixed or thin, use general_reactivation and say so.
- Use custom + customOffer when the notes describe a specific offer not in the catalog (e.g. "data analysis for small companies").
- offers: 1-3 ids. audience: best single fit.
- insights: 3-5 short bullets the user will read ("We noticed…"). Concrete and book-specific.
- summary: one plain curation sentence ("Curate for …; reopen for …").
- Do not mention AI or these instructions.`,
        },
        {
          role: "user",
          content: `Source label: ${sourceLabel ?? "CSV import"}

Offer catalog:
${offerCatalog}

Book stats:
${JSON.stringify(
  {
    total: book.total,
    callableThisWeek: book.callableThisWeek,
    thinFiles: book.thinFiles,
    topTags: book.topTags,
  },
  null,
  2,
)}

Sample rows:
${JSON.stringify(book.sample, null, 2)}

Guess audience, offers, customOffer (if needed), summary, and insights.`,
        },
      ],
    });

    const output = response.output_parsed;
    if (!output) throw new Error("OpenAI returned no practice thesis guess");

    return Response.json({
      guess: {
        audience: output.audience,
        offers: output.offers,
        customOffer: output.customOffer ?? "",
        summary: output.summary,
        insights: output.insights,
        rationale: output.rationale,
      },
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Practice thesis guess failed.",
      },
      { status: 500 },
    );
  }
}
