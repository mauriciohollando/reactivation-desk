import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAI } from "@/lib/openai";
import { AUDIENCE_IDS, OFFER_IDS } from "@/lib/practiceThesis";

export const runtime = "nodejs";
export const maxDuration = 45;

const inputSchema = z.object({
  companyUrl: z.string().max(400).optional().nullable(),
  linkedinUrl: z.string().max(400).optional().nullable(),
  bookHints: z.array(z.string().max(200)).max(8).optional(),
});

const draftSchema = z.object({
  audience: z.enum(AUDIENCE_IDS),
  offers: z.array(z.enum(OFFER_IDS)).min(1).max(3),
  customOffer: z.string().max(280),
  summary: z.string().max(320),
  rationale: z.string().max(320),
});

function looksLikeUrl(s: string) {
  return /^https?:\/\//i.test(s.trim());
}

export async function POST(request: Request) {
  try {
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Invalid practice-profile request" }, { status: 400 });
    }

    const companyUrl = (parsed.data.companyUrl ?? "").trim();
    const linkedinUrl = (parsed.data.linkedinUrl ?? "").trim();
    if (!companyUrl && !linkedinUrl) {
      return Response.json(
        { error: "Add a company URL or LinkedIn URL." },
        { status: 400 },
      );
    }
    if (companyUrl && !looksLikeUrl(companyUrl)) {
      return Response.json({ error: "Company URL must start with https://" }, { status: 400 });
    }
    if (linkedinUrl && !looksLikeUrl(linkedinUrl)) {
      return Response.json({ error: "LinkedIn URL must start with https://" }, { status: 400 });
    }

    const hints = parsed.data.bookHints?.filter(Boolean).join("\n") ?? "";

    const response = await getOpenAI().responses.parse({
      model: process.env.OPENAI_WEB_MODEL ?? "gpt-4.1-mini",
      tools: [{ type: "web_search" }],
      include: ["web_search_call.action.sources"],
      text: {
        format: zodTextFormat(draftSchema, "practice_thesis_draft"),
      },
      input: [
        {
          role: "system",
          content: `You infer a financial advisor's PRACTICE THESIS for list curation and call tips.

Return what they typically sell / reopen for and who they serve — NOT a biography, tone of voice, or personal brand copy.

Rules:
- Use web_search on the provided URLs only as needed.
- Prefer firm positioning: audience + offer conversations (life/benefits, succession, wealth/AUM, insurance reviews, general reactivation).
- Do not invent licenses, AUM figures, or product guarantees.
- If pages are thin or marketing fluff, choose the closest generic pack and say so in rationale.
- offers: 1-3 ids from the allowed enum. Use custom only with a short customOffer.
- summary: one plain sentence for curation ("Curate for …; reopen for …").
- This is for ranking/tips context, not impersonating the advisor.`,
        },
        {
          role: "user",
          content: `Company URL: ${companyUrl || "none"}
LinkedIn URL: ${linkedinUrl || "none"}

Book hints already observed:
${hints || "none"}

Draft audience + offers + summary.`,
        },
      ],
    });

    const output = response.output_parsed;
    if (!output) throw new Error("OpenAI returned no practice profile");

    return Response.json({
      draft: {
        audience: output.audience,
        offers: output.offers,
        customOffer: output.customOffer ?? "",
        summary: output.summary,
        rationale: output.rationale,
      },
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Practice profile enrichment failed.",
      },
      { status: 500 },
    );
  }
}
