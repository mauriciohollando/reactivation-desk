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

const briefSchema = z.object({
  summary: z.string().max(280),
  details: z.array(z.string().max(220)).max(6),
  sources: z
    .array(
      z.object({
        label: z.string().max(80),
        url: z.string().max(400),
      }),
    )
    .max(4),
});

const prepSchema = z.object({
  person: briefSchema,
  company: briefSchema,
  talkBullets: z.array(z.string().max(180)).min(3).max(7),
  identityStatus: z.enum(["matched", "possible", "unresolved", "file_only"]),
  identityNote: z.string().max(220),
});

export async function POST(request: Request) {
  try {
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Invalid call-prep request" }, { status: 400 });
    }

    const p = parsed.data.prospect;
    const hasCompany = Boolean(p.company?.trim());

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
- person.summary and company.summary must be 1-2 sentences useful on a call.
- details are optional expansions (facts only). Use [] when unknown.
- sources only from real search results; use [] when file-only.
- talkBullets: 3-7 short bullets the advisor can glance at while dialing — opening angle, key facts, questions, caution. No long scripts.
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
${p.notes ?? "none"}`,
        },
      ],
    });

    const output = response.output_parsed;
    if (!output) throw new Error("OpenAI returned no call prep");

    return Response.json({
      packet: {
        prospectId: p.id,
        person: output.person,
        company: output.company,
        talkBullets: output.talkBullets,
        identityStatus: hasCompany ? output.identityStatus : "file_only",
        identityNote: output.identityNote,
        preparedAt: new Date().toISOString(),
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
