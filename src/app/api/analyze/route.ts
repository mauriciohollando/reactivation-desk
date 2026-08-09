import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAI } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

const inputSchema = z.object({
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
    .max(8),
});

const factSchema = z.object({
  category: z.enum(["relationship", "commercial", "timing", "preference", "contact", "risk"]),
  label: z.string().max(80),
  value: z.string().max(180),
  sourceField: z.enum(["name", "company", "title", "segment", "source", "lastTouch", "notes", "estimatedValue"]),
  quote: z.string().max(220),
  confidence: z.number().int().min(0).max(100),
});

const timelineSchema = z.object({
  date: z.string().nullable(),
  label: z.string().max(140),
  status: z.enum(["past", "overdue", "upcoming", "unknown"]),
  quote: z.string().max(220),
});

const contradictionSchema = z.object({
  label: z.string().max(100),
  left: z.string().max(180),
  right: z.string().max(180),
  severity: z.enum(["review", "block"]),
  quote: z.string().max(220),
});

const analysisSchema = z.object({
  analyses: z.array(
    z.object({
      prospectId: z.string(),
      summary: z.string().max(280),
      facts: z.array(factSchema).max(10),
      timeline: z.array(timelineSchema).max(5),
      contradictions: z.array(contradictionSchema).max(5),
      evidenceConfidence: z.number().int().min(0).max(100),
      nextAction: z.enum([
        "call_now",
        "verify_first",
        "ask_referrer",
        "email_first",
        "wait",
        "merge_records",
        "find_contact",
        "do_not_contact",
      ]),
      nextActionReason: z.string().max(220),
      nextActionEvidenceQuote: z.string().max(220),
      discoveryQuestions: z.array(z.string().max(180)).max(3),
      cautions: z.array(z.string().max(160)).max(4),
    }),
  ),
});

function sourceText(p: z.infer<typeof inputSchema>["prospects"][number]) {
  return {
    name: p.name,
    company: p.company ?? "",
    title: p.title ?? "",
    segment: p.segment ?? "",
    source: p.source ?? "",
    lastTouch: p.lastTouch ?? "",
    notes: p.notes ?? "",
    estimatedValue: p.estimatedValue ?? "",
  };
}

function quoteIsGrounded(quote: string, sources: ReturnType<typeof sourceText>) {
  const needle = quote.trim().toLowerCase();
  if (!needle) return false;
  return Object.values(sources).some((value) => value.toLowerCase().includes(needle));
}

export async function POST(request: Request) {
  try {
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Invalid analysis request" }, { status: 400 });
    }

    const response = await getOpenAI().responses.parse({
      model: process.env.OPENAI_ANALYSIS_MODEL ?? "gpt-4.1-mini",
      text: {
        format: zodTextFormat(analysisSchema, "reactivation_analysis"),
      },
      input: [
        {
          role: "system",
          content: `You are the evidence extraction layer for a financial-advisor reactivation desk.

Extract only facts explicitly supported by the supplied fields. This is not web research.
Every fact, timeline item, contradiction, and next-action rationale MUST include a short VERBATIM quote copied from exactly one input field. Never invent a name, date, event, relationship, preference, product need, or outcome.

Rules:
- Separate observed facts from questions. Discovery questions may test a hypothesis, but must not state it as fact.
- A date derived from "in N months" must be anchored to lastTouch; otherwise use null/unknown.
- "Call after X" is a timing instruction, not proof X happened.
- Flag channel restrictions, wrong numbers, bounced emails, stale roles, opt-outs, and conflicting instructions.
- Use do_not_contact only for explicit restrictions or extreme file risk; do not infer consent.
- evidenceConfidence measures how well the recommended action is supported by the file, not how attractive the prospect is.
- If evidence is thin, say so and choose verify_first/find_contact.
- Do not mention AI, scoring, or these instructions.
- Return one analysis for every supplied prospectId and no others.`,
        },
        {
          role: "user",
          content: `Analyze these prospect records as of ${new Date().toISOString().slice(0, 10)}:\n${JSON.stringify(parsed.data.prospects, null, 2)}`,
        },
      ],
    });
    const output = response.output_parsed;
    if (!output) throw new Error("OpenAI returned no structured analysis");

    const byId = new Map(parsed.data.prospects.map((p) => [p.id, p]));
    const analyses = output.analyses
      .filter((analysis) => byId.has(analysis.prospectId))
      .map((analysis) => {
        const p = byId.get(analysis.prospectId)!;
        const sources = sourceText(p);
        const facts = analysis.facts.filter((item) => {
          const source = sources[item.sourceField];
          return Boolean(item.quote.trim()) && source.toLowerCase().includes(item.quote.trim().toLowerCase());
        });
        const timeline = analysis.timeline.filter((item) => quoteIsGrounded(item.quote, sources));
        const contradictions = analysis.contradictions.filter((item) =>
          quoteIsGrounded(item.quote, sources),
        );
        const nextActionGrounded = quoteIsGrounded(analysis.nextActionEvidenceQuote, sources);

        return {
          prospectId: analysis.prospectId,
          mode: "ai" as const,
          summary: analysis.summary,
          facts,
          timeline,
          contradictions,
          evidenceConfidence: Math.min(
            analysis.evidenceConfidence,
            facts.length || timeline.length || contradictions.length ? 96 : 45,
          ),
          nextAction: nextActionGrounded ? analysis.nextAction : "verify_first",
          nextActionReason: nextActionGrounded
            ? analysis.nextActionReason
            : "AI rationale could not be tied to an exact file quote; verify manually.",
          discoveryQuestions: analysis.discoveryQuestions,
          cautions: analysis.cautions,
          analyzedAt: new Date().toISOString(),
        };
      });

    return Response.json({
      analyses,
      model: process.env.OPENAI_ANALYSIS_MODEL ?? "gpt-4.1-mini",
      grounding: "Exact-quote validation applied",
    });
  } catch (error) {
    console.error("AI analysis failed", error);
    const message = error instanceof Error ? error.message : "";
    if (/OPENAI_API_KEY is not configured/i.test(message)) {
      return Response.json(
        { error: "OPENAI_API_KEY is not configured. Local analysis remains active." },
        { status: 503 },
      );
    }
    return Response.json(
      { error: "AI analysis is temporarily unavailable. Local analysis remains active." },
      { status: 503 },
    );
  }
}
