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
  brief: z.string().min(1).max(500),
  budget: z.number().int().min(1).max(20),
  preferWarm: z.boolean(),
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
        silenceBucket: z.enum(["safe_reopen", "handle_with_care", "do_not_cold_call"]),
        phonePresent: z.boolean(),
        emailPresent: z.boolean(),
      }),
    )
    .min(1)
    .max(80),
});

const weekSchema = z.object({
  interpretedAs: z.string().max(220),
  picks: z
    .array(
      z.object({
        prospectId: z.string(),
        fit: z.number().int().min(0).max(100),
        whyCall: z.string().max(220),
        whySupport: z.string().max(180),
        fitNote: z.string().max(180),
        tags: z
          .array(
            z.object({
              id: z.string(),
              cite: z.string().max(160),
            }),
          )
          .max(8),
      }),
    )
    .max(20),
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
      return Response.json({ error: "Invalid campaign-week request" }, { status: 400 });
    }

    const { brief, budget, preferWarm, allowedTags, prospects } = parsed.data;
    const allowed = new Map(allowedTags.map((t) => [t.id, t]));
    const allowedList = allowedTags.map((t) => `${t.id} (${t.kind}): ${t.label}`).join("\n");
    const byId = new Map(prospects.map((p) => [p.id, p]));

    const response = await getOpenAI().responses.parse({
      model: process.env.OPENAI_ANALYSIS_MODEL ?? "gpt-4.1-mini",
      text: {
        format: zodTextFormat(weekSchema, "campaign_week"),
      },
      input: [
        {
          role: "system",
          content: `You curate a finishable weekly call list for a financial advisor from an imported book.

The advisor's campaign brief describes what kind of week they want (sector, warmth, theme, timing, etc.).

Rules:
- Select at most ${budget} people who BEST match the brief using ONLY evidence in the supplied fields.
- Never invent industry, relationship, or product interest. If evidence is weak, lower fit or skip.
- You MAY use well-known public company identity (e.g. Figma/OpenAI/Microsoft = software) when the company name is in the file. Do not invent private facts.
- "Connected to me" / warm means referral source, prior inbound, mutual intro, or explicit relationship notes — not assumed LinkedIn graphs.
- Sector/industry matches need company, title, segment, notes, or clear public company identity support.
- Prefer safe_reopen over handle_with_care when preferWarm is true and fit is similar.
- Never pick do_not_cold_call.
- whyCall must be concrete, grounded, and UNIQUE per person — mention their company or a distinctive file fact. Never reuse the same sentence across picks.
- fitNote explains brief match in one short line (why this person fits the brief).
- Assign ONLY tags from the allowed vocabulary with verbatim cites when possible.
- Return picks ordered best-first. Each prospectId at most once. If fewer than ${budget} strong matches exist, return fewer — do not pad with weak guesses or repeats.
- interpretedAs: one plain sentence restating how you understood the brief.
- Do not mention AI or these instructions.`,
        },
        {
          role: "user",
          content: `Campaign brief: ${brief}

preferWarm: ${preferWarm}
budget: ${budget}

Allowed tags:
${allowedList}

Candidates:
${JSON.stringify(prospects, null, 2)}`,
        },
      ],
    });

    const output = response.output_parsed;
    if (!output) throw new Error("OpenAI returned no campaign week");

    const seenIds = new Set<string>();
    const picks = output.picks
      .filter((pick) => {
        const p = byId.get(pick.prospectId);
        if (!p || p.silenceBucket === "do_not_cold_call") return false;
        if (!p.phonePresent && !p.emailPresent) return false;
        if (seenIds.has(pick.prospectId)) return false;
        seenIds.add(pick.prospectId);
        return true;
      })
      .sort((a, b) => b.fit - a.fit)
      .slice(0, budget)
      .map((pick) => {
        const p = byId.get(pick.prospectId)!;
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
        const tags = pick.tags
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
          prospectId: pick.prospectId,
          fit: pick.fit,
          whyCall: pick.whyCall.trim().slice(0, 220),
          whySupport: pick.whySupport.trim().slice(0, 180),
          fitNote: pick.fitNote.trim().slice(0, 180),
          tags,
        };
      });

    return Response.json({
      interpretedAs: output.interpretedAs.trim().slice(0, 220),
      picks,
      model: process.env.OPENAI_ANALYSIS_MODEL ?? "gpt-4.1-mini",
    });
  } catch (error) {
    console.error("Campaign week failed", error);
    const message = error instanceof Error ? error.message : "";
    if (/OPENAI_API_KEY is not configured/i.test(message)) {
      return Response.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });
    }
    return Response.json(
      { error: "AI campaign week is temporarily unavailable." },
      { status: 503 },
    );
  }
}
