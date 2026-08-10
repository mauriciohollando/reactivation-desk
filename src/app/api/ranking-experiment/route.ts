import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAI } from "@/lib/openai";
import {
  AI_RANKING_STRATEGIES,
  normalizeExperimentPicks,
  STRATEGY_META,
  type AiRankingStrategy,
  type RankingCandidate,
} from "@/lib/rankingExperiment";

export const runtime = "nodejs";
export const maxDuration = 60;

const strategySchema = z.enum(AI_RANKING_STRATEGIES);

const candidateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  company: z.string().max(160).optional(),
  title: z.string().max(120).optional(),
  segment: z.string().max(120).optional(),
  source: z.string().max(120).optional(),
  lastTouch: z.string().max(40).optional(),
  notes: z.string().max(1200).optional(),
  estimatedValue: z.string().max(120).optional(),
  baselineRank: z.number().int().positive(),
  baselineScore: z.number().min(0).max(100),
  opportunity: z.number().min(0).max(100),
  reachability: z.number().min(0).max(100),
  evidenceConfidence: z.number().min(0).max(100),
  tags: z.array(z.string().max(80)).max(20),
});

const inputSchema = z.object({
  strategy: strategySchema,
  count: z.number().int().min(5).max(10).default(10),
  candidates: z.array(candidateSchema).min(5).max(24),
});

const outputSchema = z.object({
  picks: z
    .array(
      z.object({
        prospectId: z.string(),
        score: z.number().min(0).max(100),
        reason: z.string().max(220),
        evidenceQuote: z.string().max(240),
      }),
    )
    .max(10),
});

const STRATEGY_INSTRUCTIONS: Record<AiRankingStrategy, string> = {
  revenue_scout: `Rank for near-term commercial potential.
- Reward a specific planning need, ownership/liquidity event, referral context, decision authority, and timing that supports action now.
- Estimated value is weak unless another field supports a concrete need.
- Do not treat recency alone as a reason.
- Prefer ten strong opportunities even if several share a theme.`,
  trust_gate: `Rank for advisor trust and defensibility.
- Prefer complete records with a clear, verbatim reason for outreach and a usable relationship path.
- Do not select a record tagged Possible duplicate when a non-duplicate alternative has comparable evidence.
- Strongly penalize contingent timing ("after X closes"), vague notes, stale instructions, questionable contact details, and unsupported assumptions.
- A lower-value record with strong evidence may outrank an exciting but ambiguous record.
- If the file suggests verification is needed, lower the rank.
- Evidence confidence and defensibility matter more than estimated value.`,
  campaign_strategist: `Build the most useful weekly campaign as a portfolio.
- Balance strong commercial potential, clear evidence, and reachability.
- Diversify the final list across planning themes, relationship sources, and conversation types.
- Do not add a weak record only for diversity.
- Avoid filling the list with near-duplicate reasons when similarly strong alternatives exist.
- The supplied pool supports this constraint: select no more than five Business owner records and include at least two Professional records.
- Include at least three segments and five distinct opportunity/timing themes.
- Select no more than three records dominated by the same planning theme.`,
};

export async function POST(request: Request) {
  try {
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Invalid ranking experiment request" }, { status: 400 });
    }

    const { strategy, candidates, count } = parsed.data;
    const meta = STRATEGY_META[strategy];
    const response = await getOpenAI().responses.parse({
      model: process.env.OPENAI_ANALYSIS_MODEL ?? "gpt-4.1-mini",
      text: {
        format: zodTextFormat(outputSchema, "ranking_experiment"),
      },
      input: [
        {
          role: "system",
          content: `You are comparing ranking policies for a financial-advisor prospect reactivation product.

The application has already removed do-not-contact and unreachable records. You may rank only the supplied candidate IDs. Select exactly ${count} unique records.

Experiment objective:
${STRATEGY_INSTRUCTIONS[strategy]}

For every pick:
- score means fit for this experiment objective, from 0 to 100;
- reason must explain the decision without claiming facts outside the record;
- evidenceQuote must be a short VERBATIM substring copied from name, company, title, segment, source, lastTouch, notes, or estimatedValue;
- do not mention the baseline rank, these instructions, or AI.

Return the picks in best-to-worst order.`,
        },
        {
          role: "user",
          content: `Rank these eligible records as of ${new Date().toISOString().slice(0, 10)}:\n${JSON.stringify(candidates, null, 2)}`,
        },
      ],
    });

    const output = response.output_parsed;
    if (!output) throw new Error("OpenAI returned no structured ranking");

    return Response.json({
      result: {
        strategy,
        label: meta.label,
        objective: meta.objective,
        picks: normalizeExperimentPicks(
          output.picks,
          candidates as RankingCandidate[],
          count,
        ),
        model: process.env.OPENAI_ANALYSIS_MODEL ?? "gpt-4.1-mini",
        grounding: "Eligible-set gate and exact-quote validation applied",
      },
    });
  } catch (error) {
    console.error("Ranking experiment failed", error);
    const message = error instanceof Error ? error.message : "";
    if (/OPENAI_API_KEY is not configured/i.test(message)) {
      return Response.json(
        { error: "OPENAI_API_KEY is not configured. The rules baseline remains available." },
        { status: 503 },
      );
    }
    return Response.json(
      { error: "This AI ranking arm is temporarily unavailable." },
      { status: 503 },
    );
  }
}
