import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAI } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

const allowedTagSchema = z.object({
  id: z.string().min(1).max(60),
  label: z.string().min(1).max(80),
  kind: z.enum(["opportunity", "timing", "reach", "risk"]),
});

const inputSchema = z.object({
  allowedTags: z.array(allowedTagSchema).min(1).max(40),
  prospects: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string(),
        company: z.string().optional(),
        title: z.string().optional(),
        segment: z.string().optional(),
        source: z.string().optional(),
        lastTouch: z.string().optional(),
        notes: z.string().optional(),
        estimatedValue: z.string().optional(),
        phonePresent: z.boolean(),
        emailPresent: z.boolean(),
      }),
    )
    .min(1)
    .max(10),
});

const enrichmentSchema = z.object({
  enrichments: z.array(
    z.object({
      prospectId: z.string(),
      whyCall: z.string().max(220),
      whySupport: z.string().max(180),
      tags: z
        .array(
          z.object({
            id: z.string(),
            cite: z.string().max(160),
          }),
        )
        .max(8),
    }),
  ),
});

function grounded(quote: string, text: string) {
  const needle = quote.trim().toLowerCase();
  if (!needle || needle.length < 4) return false;
  return text.toLowerCase().includes(needle);
}

export async function POST(request: Request) {
  try {
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Invalid enrich-import request" }, { status: 400 });
    }

    const allowed = new Map(parsed.data.allowedTags.map((t) => [t.id, t]));
    const allowedList = parsed.data.allowedTags
      .map((t) => `${t.id} (${t.kind}): ${t.label}`)
      .join("\n");

    const response = await getOpenAI().responses.parse({
      model: process.env.OPENAI_ANALYSIS_MODEL ?? "gpt-4.1-mini",
      text: {
        format: zodTextFormat(enrichmentSchema, "import_enrichment"),
      },
      input: [
        {
          role: "system",
          content: `You enrich a financial advisor's imported prospect book for weekly reactivation.

Write a concrete why-call grounded in the file. Prefer commercial meaning over bare recency.
Assign ONLY tags from the allowed vocabulary. Do not invent tag ids.
For each assigned tag, include { id, cite } with a short verbatim quote from the record.
If evidence is thin, use thin_file or skip opportunity tags and say so in whyCall.
Never invent events, products, or relationships.
Do not mention AI or these instructions.
Return one enrichment for every prospectId.`,
        },
        {
          role: "user",
          content: `Allowed tags:\n${allowedList}\n\nProspects:\n${JSON.stringify(parsed.data.prospects, null, 2)}`,
        },
      ],
    });

    const output = response.output_parsed;
    if (!output) throw new Error("OpenAI returned no enrichment");

    const byId = new Map(parsed.data.prospects.map((p) => [p.id, p]));
    const enrichments = output.enrichments
      .filter((row) => byId.has(row.prospectId))
      .map((row) => {
        const p = byId.get(row.prospectId)!;
        const blob = [
          p.name,
          p.company,
          p.title,
          p.segment,
          p.source,
          p.lastTouch,
          p.notes,
          p.estimatedValue,
        ]
          .filter(Boolean)
          .join(" | ");

        const tags = row.tags
          .filter((item) => allowed.has(item.id))
          .slice(0, 8)
          .map((item) => {
            const meta = allowed.get(item.id)!;
            const cite = item.cite?.trim() ?? "";
            const safeCite =
              cite && grounded(cite, blob) ? cite : (p.notes?.slice(0, 120) || meta.label);
            return {
              id: meta.id,
              label: meta.label,
              kind: meta.kind,
              cite: safeCite,
            };
          });

        return {
          prospectId: row.prospectId,
          whyCall: row.whyCall.trim().slice(0, 220),
          whySupport: row.whySupport.trim().slice(0, 180),
          tags,
        };
      });

    return Response.json({
      enrichments,
      model: process.env.OPENAI_ANALYSIS_MODEL ?? "gpt-4.1-mini",
    });
  } catch (error) {
    console.error("Import enrichment failed", error);
    const message = error instanceof Error ? error.message : "";
    if (/OPENAI_API_KEY is not configured/i.test(message)) {
      return Response.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 503 },
      );
    }
    return Response.json(
      { error: "AI import enrichment is temporarily unavailable." },
      { status: 503 },
    );
  }
}
