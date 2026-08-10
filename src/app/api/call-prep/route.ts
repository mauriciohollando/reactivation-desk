import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAI } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

const inputSchema = z.object({
  prospect: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    company: z.string().nullable(),
    title: z.string().nullable(),
    lastTouch: z.string().nullable(),
    notes: z.string().nullable(),
    estimatedValue: z.string().nullable(),
    emailDomain: z.string().nullable(),
    whyCall: z.string().nullable(),
  }),
});

// Keep ceilings generous — web_search answers often overrun short maxes and
// zodTextFormat rejects the whole packet (503). We still clip before respond.
const briefSchema = z.object({
  summary: z.string().max(500),
  details: z.array(z.string().max(500)).max(6),
  sources: z
    .array(
      z.object({
        label: z.string().max(120),
        url: z.string().max(2000),
      }),
    )
    .max(4),
});

const prepSchema = z.object({
  person: briefSchema,
  company: briefSchema,
  talkBullets: z.array(z.string().max(320)).min(3).max(7),
  identityStatus: z.enum(["matched", "possible", "unresolved", "file_only"]),
  identityNote: z.string().max(320),
});

function clip(text: string, max: number) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function clipBrief(section: z.infer<typeof briefSchema>) {
  return {
    summary: clip(section.summary, 280),
    details: section.details.map((d) => clip(d, 220)).slice(0, 6),
    sources: section.sources
      .map((s) => ({
        label: clip(s.label, 80),
        url: s.url.trim().slice(0, 400),
      }))
      .filter((s) => s.label && s.url)
      .slice(0, 4),
  };
}

export async function POST(request: Request) {
  try {
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Invalid call-prep request" }, { status: 400 });
    }

    const p = parsed.data.prospect;
    const hasCompany = Boolean(p.company?.trim());
    const notes = (p.notes ?? "").slice(0, 2500);

    const response = await getOpenAI().responses.parse({
      model: process.env.OPENAI_WEB_MODEL ?? "gpt-4.1-mini",
      tools: hasCompany ? [{ type: "web_search" }] : [],
      include: hasCompany ? ["web_search_call.action.sources"] : undefined,
      text: {
        format: zodTextFormat(prepSchema, "call_prep_brief"),
      },
      input: [
        {
          role: "system",
          content: `You prepare a short, practical call brief for a financial advisor.

Rules:
- Ground person summary first in the CRM/file notes and why-call reason.
- If a company is provided, lightly verify public business facts (role association, company what-they-do, material recent events). Prefer official sites and reputable business news.
- Do NOT research personal life, family, politics, health, or home addresses.
- person.summary and company.summary: 1-2 short sentences (under 220 chars each).
- details: short facts only, each under 180 characters. Use [] when unknown.
- sources only from real search results; use [] when file-only.
- talkBullets: 3-7 short bullets (under 140 chars) the advisor can glance at while dialing — opening angle, key facts, questions, caution. No long scripts.
- If company is missing or identity is unclear, set identityStatus to file_only or unresolved and say so in identityNote.
- Never invent revenue, ownership, or events not supported by file or sources.`,
        },
        {
          role: "user",
          content: `Prepare a call brief as of ${new Date().toISOString().slice(0, 10)}.

NAME: ${p.name}
TITLE: ${p.title ?? "unknown"}
COMPANY: ${p.company ?? "unknown"}
EMAIL DOMAIN: ${p.emailDomain ?? "unknown"}
LAST TOUCH: ${p.lastTouch ?? "unknown"}
ESTIMATED VALUE: ${p.estimatedValue ?? "unknown"}
WHY CALL: ${p.whyCall ?? "unknown"}
NOTES:
${notes || "none"}`,
        },
      ],
    });

    const output = response.output_parsed;
    if (!output) throw new Error("OpenAI returned no call prep");

    return Response.json({
      packet: {
        prospectId: p.id,
        person: clipBrief(output.person),
        company: clipBrief(output.company),
        talkBullets: output.talkBullets.map((b) => clip(b, 180)).slice(0, 7),
        identityStatus: hasCompany ? output.identityStatus : "file_only",
        identityNote: clip(output.identityNote, 220),
        preparedAt: new Date().toISOString(),
        source: "ai" as const,
      },
      model: process.env.OPENAI_WEB_MODEL ?? "gpt-4.1-mini",
    });
  } catch (error) {
    console.error("Call prep failed", error);
    const message = error instanceof Error ? error.message : "";
    if (/OPENAI_API_KEY is not configured/i.test(message)) {
      return Response.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });
    }
    return Response.json(
      { error: "AI call prep is temporarily unavailable." },
      { status: 503 },
    );
  }
}
