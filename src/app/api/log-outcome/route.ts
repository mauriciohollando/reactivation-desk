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
  freeText: z.string().min(1).max(8000),
  allowedTags: z.array(allowedTagSchema).min(1).max(40),
  prospect: z.object({
    id: z.string().min(1),
    name: z.string(),
    company: z.string().nullable(),
    title: z.string().nullable(),
    notes: z.string().nullable(),
    whyCall: z.string().nullable(),
  }),
});

const outcomeSchema = z.object({
  outcome: z.enum([
    "called",
    "meeting",
    "sale",
    "not_now",
    "wrong_number",
    "do_not_contact",
    "skip",
  ]),
  reasonStillValid: z.enum(["yes", "stale", "unknown"]),
  summaryNote: z.string().max(600),
  tags: z
    .array(
      z.object({
        id: z.string(),
        cite: z.string().max(160),
      }),
    )
    .max(8),
  followUpHint: z.string().max(180).nullable(),
});

export async function POST(request: Request) {
  try {
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Invalid log-outcome request" }, { status: 400 });
    }

    const { prospect, freeText, allowedTags } = parsed.data;
    const allowed = new Map(allowedTags.map((t) => [t.id, t]));
    const allowedList = allowedTags.map((t) => `${t.id} (${t.kind}): ${t.label}`).join("\n");

    const response = await getOpenAI().responses.parse({
      model: process.env.OPENAI_ANALYSIS_MODEL ?? "gpt-4.1-mini",
      text: {
        format: zodTextFormat(outcomeSchema, "call_outcome_log"),
      },
      input: [
        {
          role: "system",
          content: `You turn a freeform advisor call note into a structured reactivation outcome.

Map to exactly one outcome:
- meeting: appointment booked or clear next meeting
- sale: closed business
- wrong_number: bad contact info
- do_not_contact: asked not to be contacted / angry opt-out
- not_now: spoke or replied, timing is later
- called: dialed / voicemail / spoke without a firmer result
- skip: intentionally skipped

reasonStillValid:
- yes if the original why-call still seems true
- stale if the reason no longer applies
- unknown if unclear

summaryNote: short durable note from their words (facts only).
tags: only from allowed vocabulary.
followUpHint: one short next step or null.
Do not invent facts. Do not mention AI.`,
        },
        {
          role: "user",
          content: `Allowed tags:\n${allowedList}\n\nProspect: ${prospect.name} · ${prospect.company ?? "no company"}\nTitle: ${prospect.title ?? "unknown"}\nWhy call: ${prospect.whyCall ?? "unknown"}\nExisting notes:\n${prospect.notes ?? "none"}\n\nAdvisor wrote:\n${freeText}`,
        },
      ],
    });

    const output = response.output_parsed;
    if (!output) throw new Error("OpenAI returned no outcome parse");

    const tags = output.tags
      .filter((item) => allowed.has(item.id))
      .slice(0, 8)
      .map((item) => {
        const meta = allowed.get(item.id)!;
        return {
          id: meta.id,
          label: meta.label,
          kind: meta.kind,
          cite: item.cite?.trim() || output.summaryNote.slice(0, 120) || meta.label,
        };
      });

    return Response.json({
      prospectId: prospect.id,
      outcome: output.outcome,
      reasonHeld: output.reasonStillValid === "unknown" ? "" : output.reasonStillValid,
      summaryNote: output.summaryNote.trim(),
      followUpHint: output.followUpHint,
      tags,
      model: process.env.OPENAI_ANALYSIS_MODEL ?? "gpt-4.1-mini",
    });
  } catch (error) {
    console.error("Log outcome failed", error);
    const message = error instanceof Error ? error.message : "";
    if (/OPENAI_API_KEY is not configured/i.test(message)) {
      return Response.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });
    }
    return Response.json(
      { error: "AI outcome logging is temporarily unavailable." },
      { status: 503 },
    );
  }
}
