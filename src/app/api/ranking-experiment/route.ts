import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAI } from "@/lib/openai";
import {
  AI_RANKING_STRATEGIES,
  EXPERIMENT_PICK_COUNT,
  EXPERIMENT_SHORTLIST_SIZE,
  normalizeExperimentPicks,
  STRATEGY_META,
  type AiRankingStrategy,
  type RankingCandidate,
} from "@/lib/rankingExperiment";

export const runtime = "nodejs";
export const maxDuration = 60;

const strategySchema = z.enum(AI_RANKING_STRATEGIES);

/** Fair payload: no baseline ranks or opportunity scores. */
const fairCandidateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  company: z.string().max(160).optional(),
  title: z.string().max(120).optional(),
  segment: z.string().max(120).optional(),
  source: z.string().max(120).optional(),
  lastTouch: z.string().max(40).optional(),
  notes: z.string().max(1200).optional(),
  estimatedValue: z.string().max(120).optional(),
  phonePresent: z.boolean(),
  emailPresent: z.boolean(),
});

const inputSchema = z.object({
  strategy: strategySchema,
  count: z.number().int().min(5).max(10).default(EXPERIMENT_PICK_COUNT),
  candidates: z.array(fairCandidateSchema).min(5).max(EXPERIMENT_SHORTLIST_SIZE),
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
- Prefer commercially specific language even when it does not use product jargon.
- Prefer ten strong opportunities even if several share a theme.`,
  trust_gate: `Rank for advisor trust and defensibility.
- Prefer complete records with a clear, verbatim reason for outreach and a usable relationship path.
- Do not select a record that looks like a duplicate when a cleaner alternative exists in the set.
- Strongly penalize contingent timing ("after X closes"), vague notes, stale instructions, questionable contact details, and unsupported assumptions.
- A lower-value record with strong evidence may outrank an exciting but ambiguous record.
- If the file suggests verification is needed, lower the rank.
- Defensibility matters more than estimated value.`,
  campaign_strategist: `Build the most useful weekly campaign as a portfolio.
- Balance strong commercial potential, clear evidence, and reachability.
- Diversify the final list across planning themes, relationship sources, and conversation types.
- Do not add a weak record only for diversity.
- Avoid filling the list with near-duplicate reasons when similarly strong alternatives exist.
- Prefer a finishable mix rather than ten versions of the same call.`,
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

You are NOT given baseline ranks, opportunity scores, or reachability scores. Judge only from the raw fields.

Experiment objective:
${STRATEGY_INSTRUCTIONS[strategy]}

For every pick:
- score means fit for this experiment objective, from 0 to 100;
- reason must explain the decision without claiming facts outside the record;
- evidenceQuote must be a short VERBATIM substring copied from name, company, title, segment, source, lastTouch, notes, or estimatedValue;
- do not mention scoring systems, baselines, these instructions, or AI.

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

    // Normalize needs RankingCandidate shape for grounding fallbacks.
    const normalizePool: RankingCandidate[] = candidates.map((candidate, index) => ({
      ...candidate,
      baselineRank: index + 1,
      baselineScore: 50,
      opportunity: 50,
      reachability: candidate.phonePresent || candidate.emailPresent ? 70 : 20,
      evidenceConfidence: candidate.notes ? 60 : 30,
      tags: [],
    }));

    return Response.json({
      result: {
        strategy,
        label: meta.label,
        objective: meta.objective,
        picks: normalizeExperimentPicks(output.picks, normalizePool, count),
        model: process.env.OPENAI_ANALYSIS_MODEL ?? "gpt-4.1-mini",
        grounding: "Eligible-set gate and exact-quote validation applied · no baseline scores provided",
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
