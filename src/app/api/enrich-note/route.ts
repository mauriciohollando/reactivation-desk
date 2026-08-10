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
  noteText: z.string().min(1).max(12000),
  prospect: z.object({
    id: z.string().min(1),
    name: z.string(),
    company: z.string().optional(),
    title: z.string().optional(),
    segment: z.string().optional(),
    source: z.string().optional(),
    lastTouch: z.string().optional(),
    notes: z.string().optional(),
    estimatedValue: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
  }),
});

const noteSchema = z.object({
  appendedNote: z.string().max(2000),
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
  fieldUpdates: z.object({
    company: z.string().max(120).nullable(),
    title: z.string().max(120).nullable(),
    estimatedValue: z.string().max(80).nullable(),
    lastTouch: z.string().max(40).nullable(),
    phone: z.string().max(40).nullable(),
    email: z.string().max(120).nullable(),
  }),
  doNotContact: z.boolean(),
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
      return Response.json({ error: "Invalid enrich-note request" }, { status: 400 });
    }

    const { prospect, noteText, allowedTags } = parsed.data;
    const allowed = new Map(allowedTags.map((t) => [t.id, t]));
    const allowedList = allowedTags.map((t) => `${t.id} (${t.kind}): ${t.label}`).join("\n");

    const response = await getOpenAI().responses.parse({
      model: process.env.OPENAI_ANALYSIS_MODEL ?? "gpt-4.1-mini",
      text: {
        format: zodTextFormat(noteSchema, "note_enrichment"),
      },
      input: [
        {
          role: "system",
          content: `You update one prospect file after a human pastes call notes or an AI notetaker transcript.

Tasks:
1) Compress the new note into a short durable appendedNote (facts only, no fluff).
2) Rewrite whyCall / whySupport from the full file + new note.
3) Assign ONLY tags from the allowed vocabulary as { id, cite }.
4) Suggest fieldUpdates only when the new note clearly states a better company, title, value, phone, email, or last touch date (ISO if possible). Use null when unchanged.
5) Set doNotContact true only for explicit opt-out / do-not-call language.

Never invent facts. Prefer verbatim cites from the new note or existing notes.
Do not create task lists. Do not mention AI.`,
        },
        {
          role: "user",
          content: `Allowed tags:\n${allowedList}\n\nExisting prospect:\n${JSON.stringify(prospect, null, 2)}\n\nNew note to ingest:\n${noteText}`,
        },
      ],
    });

    const output = response.output_parsed;
    if (!output) throw new Error("OpenAI returned no note enrichment");

    const blob = `${prospect.notes ?? ""}\n${noteText}\n${output.appendedNote}`;
    const tags = output.tags
      .filter((item) => allowed.has(item.id))
      .slice(0, 8)
      .map((item) => {
        const meta = allowed.get(item.id)!;
        const cite = item.cite?.trim() ?? "";
        const safeCite = cite && grounded(cite, blob) ? cite : output.appendedNote.slice(0, 120);
        return {
          id: meta.id,
          label: meta.label,
          kind: meta.kind,
          cite: safeCite || meta.label,
        };
      });

    if (output.doNotContact && allowed.has("do_not_cold_call") && !tags.some((t) => t.id === "do_not_cold_call")) {
      const meta = allowed.get("do_not_cold_call")!;
      tags.push({
        id: meta.id,
        label: meta.label,
        kind: meta.kind,
        cite: "Explicit do-not-contact language in new note",
      });
    }

    return Response.json({
      prospectId: prospect.id,
      appendedNote: output.appendedNote.trim(),
      whyCall: output.whyCall.trim(),
      whySupport: output.whySupport.trim(),
      tags,
      fieldUpdates: Object.fromEntries(
        Object.entries(output.fieldUpdates ?? {}).filter(
          ([, value]) => typeof value === "string" && value.trim(),
        ),
      ),
      doNotContact: output.doNotContact,
      model: process.env.OPENAI_ANALYSIS_MODEL ?? "gpt-4.1-mini",
    });
  } catch (error) {
    console.error("Note enrichment failed", error);
    const message = error instanceof Error ? error.message : "";
    if (/OPENAI_API_KEY is not configured/i.test(message)) {
      return Response.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 503 },
      );
    }
    return Response.json(
      { error: "AI note update is temporarily unavailable." },
      { status: 503 },
    );
  }
}
