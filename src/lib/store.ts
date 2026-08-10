"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  canUseDesk,
  emptyAccess,
  resolvePromo,
  type AccessPlan,
  type AccessState,
} from "./access";
import { buildDemoAdvisorBook } from "./demoBook";
import { analyzeBookLocally, balancedCallable } from "./analysisEngine";
import type { ProspectAnalysis, WebEvidencePacket } from "./analysisTypes";
import {
  localBriefFillIds,
  shortlistForBrief,
} from "./briefMatch";
import type { CallPrepPacket } from "./callPrepTypes";
import type { InsightTag } from "./insightTags";
import {
  buildImportSummary,
  mergeProspects,
  rankProspects,
} from "./rank";
import {
  TAG_PRESETS,
  slugTag,
  uniqueAllowedTags,
  type AllowedTag,
} from "./tagPresets";
import type {
  Campaign,
  ImportSummary,
  Outcome,
  Prospect,
  RankedProspect,
  WeekBudget,
  WizardStep,
} from "./types";

type EnrichmentRow = {
  prospectId: string;
  whyCall: string;
  whySupport: string;
  tags: InsightTag[];
};

type State = {
  prospects: Prospect[];
  outcomes: Record<string, Outcome>;
  talkEdits: Record<string, string>;
  reasonHeld: Record<string, "yes" | "stale" | "">;
  campaign: Campaign | null;
  selectedIds: string[];
  sourceLabel: string;
  importSummary: ImportSummary | null;
  step: WizardStep;
  callIndex: number;
  weekBudget: WeekBudget;
  preferWarm: boolean;
  analyses: Record<string, ProspectAnalysis>;
  webEvidence: Record<string, WebEvidencePacket>;
  callPreps: Record<string, CallPrepPacket>;
  analysisStatus: "ready" | "running" | "complete" | "error";
  analysisError: string | null;
  aiAnalyzedCount: number;
  tagFilters: string[];
  allowedTags: AllowedTag[];
  tagPresetId: string;
  access: AccessState;
  campaignBrief: string;
  campaignInterpretedAs: string | null;
  enrichStatus: "idle" | "running" | "complete" | "error";
  enrichError: string | null;
  noteStatus: "idle" | "running" | "error";
  noteError: string | null;
  prepStatus: "idle" | "running" | "error";
  prepError: string | null;
  loadDemoBook: () => void;
  loadProspects: (prospects: Prospect[], sourceLabel: string) => void;
  setTagPreset: (presetId: string) => void;
  setAllowedTags: (tags: AllowedTag[]) => void;
  toggleAllowedTag: (id: string) => void;
  addCustomTag: (label: string) => void;
  unlockAccess: (plan: AccessPlan, promoUsed?: string | null) => boolean;
  unlockWithPromo: (code: string) => { ok: boolean; error?: string };
  toggleSelect: (id: string) => void;
  toggleTagFilter: (id: string) => void;
  clearTagFilters: () => void;
  setCampaignBrief: (brief: string) => void;
  enrichImportedBook: (count?: number) => Promise<boolean>;
  deepenTopProspects: (count?: number) => Promise<boolean>;
  appendProspectNote: (id: string, noteText: string) => Promise<boolean>;
  prepareCall: (id: string, force?: boolean) => Promise<boolean>;
  logFreeformOutcome: (id: string, freeText: string) => Promise<boolean>;
  refreshPublicEvidence: (id: string) => Promise<void>;
  buildWeekPlan: (n?: WeekBudget) => void;
  /** Enrich / curate with AI, then build the week list. */
  buildWeekWithAi: (n?: WeekBudget) => Promise<void>;
  openCall: (id: string) => void;
  clearSelection: () => void;
  setOutcome: (id: string, outcome: Outcome) => void;
  setTalkEdit: (id: string, text: string) => void;
  setReasonHeld: (id: string, v: "yes" | "stale") => void;
  setStep: (step: WizardStep) => void;
  setCallIndex: (i: number) => void;
  setWeekBudget: (n: WeekBudget) => void;
  setPreferWarm: (v: boolean) => void;
  mergeDuplicatePair: (keepId: string, dropId: string) => void;
  ranked: () => RankedProspect[];
  resetAll: () => void;
};

const defaultPreset = TAG_PRESETS[0]!;

function applyBook(prospects: Prospect[], sourceLabel: string, access: AccessState) {
  // Drop per-row CSV raw maps — they duplicate every field and blow storage/memory.
  const slim = prospects.map((p) => ({ ...p, raw: {} as Record<string, string> }));
  const ranked = rankProspects(slim, {});
  const nextAccess =
    access.plan === "sprint" && canUseDesk(access)
      ? { ...access, sprintBooksUsed: access.sprintBooksUsed + 1 }
      : access;
  return {
    prospects: slim,
    sourceLabel,
    importSummary: buildImportSummary(prospects),
    selectedIds: [] as string[],
    campaign: null,
    outcomes: {} as Record<string, Outcome>,
    talkEdits: {} as Record<string, string>,
    reasonHeld: {} as Record<string, "yes" | "stale" | "">,
    tagFilters: [] as string[],
    analyses: analyzeBookLocally(ranked),
    webEvidence: {} as Record<string, WebEvidencePacket>,
    callPreps: {} as Record<string, CallPrepPacket>,
    analysisStatus: "ready" as const,
    analysisError: null as string | null,
    aiAnalyzedCount: 0,
    campaignInterpretedAs: null as string | null,
    enrichStatus: "idle" as const,
    enrichError: null as string | null,
    noteStatus: "idle" as const,
    noteError: null as string | null,
    prepStatus: "idle" as const,
    prepError: null as string | null,
    step: "diagnose" as WizardStep,
    callIndex: 0,
    access: nextAccess,
  };
}

export const useDesk = create<State>()(
  persist(
    (set, get) => ({
      prospects: [],
      outcomes: {},
      talkEdits: {},
      reasonHeld: {},
      campaign: null,
      selectedIds: [],
      sourceLabel: "none",
      importSummary: null,
      step: "import",
      callIndex: 0,
      weekBudget: 10,
      preferWarm: true,
      tagFilters: [],
      analyses: {},
      webEvidence: {},
      callPreps: {},
      analysisStatus: "ready",
      analysisError: null,
      aiAnalyzedCount: 0,
      allowedTags: defaultPreset.tags,
      tagPresetId: defaultPreset.id,
      access: emptyAccess(),
      campaignBrief: "",
      campaignInterpretedAs: null,
      enrichStatus: "idle",
      enrichError: null,
      noteStatus: "idle",
      noteError: null,
      prepStatus: "idle",
      prepError: null,
      loadDemoBook: () => {
        const access = get().access;
        if (!canUseDesk(access) && access.plan !== "none") {
          set({
            analysisError:
              "Sprint already used. Unlock subscription for another book, or enter a promo code.",
          });
          return;
        }
        if (!canUseDesk(access) && access.plan === "none") {
          set({ step: "import" });
          return;
        }
        set({
          ...applyBook(
            buildDemoAdvisorBook(),
            "Sample advisor book",
            access,
          ),
          weekBudget: 10,
        });
      },
      loadProspects: (prospects, sourceLabel) => {
        const access = get().access;
        if (!canUseDesk(access)) {
          set({
            analysisError:
              access.plan === "sprint"
                ? "Sprint already used. Switch to subscription or enter a promo code."
                : "Unlock a sprint or subscription before importing.",
            step: "import",
          });
          return;
        }
        set({ ...applyBook(prospects, sourceLabel, access) });
      },
      setTagPreset: (presetId) => {
        const preset = TAG_PRESETS.find((p) => p.id === presetId) ?? defaultPreset;
        set({ tagPresetId: preset.id, allowedTags: preset.tags });
      },
      setAllowedTags: (tags) => set({ allowedTags: uniqueAllowedTags(tags) }),
      toggleAllowedTag: (id) => {
        const cur = get().allowedTags;
        if (cur.some((t) => t.id === id)) {
          set({ allowedTags: cur.filter((t) => t.id !== id) });
          return;
        }
        const fromPreset = TAG_PRESETS.flatMap((p) => p.tags).find((t) => t.id === id);
        if (fromPreset) set({ allowedTags: uniqueAllowedTags([...cur, fromPreset]) });
      },
      addCustomTag: (label) => {
        const trimmed = label.trim();
        if (!trimmed) return;
        const id = slugTag(trimmed);
        set({
          allowedTags: uniqueAllowedTags([
            ...get().allowedTags,
            { id, label: trimmed, kind: "opportunity" },
          ]),
        });
      },
      unlockAccess: (plan, promoUsed = null) => {
        if (plan === "none") return false;
        set({
          access: {
            plan,
            unlockedAt: new Date().toISOString(),
            promoUsed,
            sprintBooksUsed: 0,
          },
          analysisError: null,
        });
        return true;
      },
      unlockWithPromo: (code) => {
        const plan = resolvePromo(code);
        if (!plan) return { ok: false, error: "Unknown promo code." };
        get().unlockAccess(plan, code.trim().toUpperCase());
        return { ok: true };
      },
      toggleSelect: (id) => {
        const cur = get().selectedIds;
        set({
          selectedIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
        });
      },
      toggleTagFilter: (id) => {
        const cur = get().tagFilters;
        set({
          tagFilters: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
        });
      },
      clearTagFilters: () => set({ tagFilters: [] }),
      enrichImportedBook: async (count = 40) => {
        const ranked = get()
          .ranked()
          .filter((p) => p.silenceBucket !== "do_not_cold_call" && Boolean(p.phone || p.email))
          .slice(0, count);
        if (!ranked.length) return false;
        const allowedTags = get().allowedTags;
        if (!allowedTags.length) {
          set({ enrichStatus: "error", enrichError: "Select at least one allowed tag." });
          return false;
        }
        set({ enrichStatus: "running", enrichError: null });

        const batches: RankedProspect[][] = [];
        for (let i = 0; i < ranked.length; i += 8) batches.push(ranked.slice(i, i + 8));

        try {
          const results = await Promise.allSettled(
            batches.map(async (batch) => {
              const response = await fetch("/api/enrich-import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  allowedTags,
                  prospects: batch.map((p) => ({
                    id: p.id,
                    name: p.name,
                    company: p.company,
                    title: p.title,
                    segment: p.segment,
                    source: p.source,
                    lastTouch: p.lastTouch,
                    notes: p.notes,
                    estimatedValue: p.estimatedValue,
                    phonePresent: Boolean(p.phone),
                    emailPresent: Boolean(p.email),
                  })),
                }),
              });
              if (!response.ok) {
                const body = (await response.json().catch(() => ({}))) as { error?: string };
                throw new Error(body.error ?? `Enrichment failed (${response.status})`);
              }
              return (await response.json()) as { enrichments: EnrichmentRow[] };
            }),
          );

          const rows = results
            .filter(
              (r): r is PromiseFulfilledResult<{ enrichments: EnrichmentRow[] }> =>
                r.status === "fulfilled",
            )
            .flatMap((r) => r.value.enrichments);
          const failures = results.filter((r) => r.status === "rejected");
          if (!rows.length) {
            const first = failures[0] as PromiseRejectedResult | undefined;
            throw first?.reason instanceof Error
              ? first.reason
              : new Error("AI enrichment failed.");
          }

          const byId = new Map(rows.map((r) => [r.prospectId, r]));
          const prospects = get().prospects.map((p) => {
            const row = byId.get(p.id);
            if (!row) return p;
            return {
              ...p,
              enrichmentTags: row.tags,
              whyCallOverride: row.whyCall,
              whySupportOverride: row.whySupport,
            };
          });
          const rankedNext = rankProspects(prospects, get().outcomes);
          set({
            prospects,
            importSummary: buildImportSummary(prospects),
            analyses: analyzeBookLocally(rankedNext),
            enrichStatus: "complete",
            enrichError: failures.length
              ? `${failures.length} batch${failures.length > 1 ? "es" : ""} failed; kept successful rows.`
              : null,
            aiAnalyzedCount: rows.length,
          });
          return true;
        } catch (error) {
          set({
            enrichStatus: "error",
            enrichError:
              error instanceof Error
                ? error.message
                : "AI enrichment failed. Local ranking remains available.",
          });
          return false;
        }
      },
      deepenTopProspects: async (count = 25) => get().enrichImportedBook(count),
      setCampaignBrief: (brief) => set({ campaignBrief: brief }),
      buildWeekWithAi: async (n) => {
        const budget = n ?? get().weekBudget;
        const brief = get().campaignBrief.trim();
        if (!brief) {
          const enrichCount = Math.min(40, Math.max(budget * 3, 20));
          await get().enrichImportedBook(enrichCount);
          get().buildWeekPlan(budget);
          return;
        }

        // Campaign brief path: AI curates the week from a callable shortlist.
        const preferWarm = get().preferWarm;
        let ranked = get()
          .ranked()
          .filter(
            (p) =>
              p.silenceBucket !== "do_not_cold_call" && Boolean(p.phone || p.email),
          );
        if (preferWarm) {
          ranked = [
            ...ranked.filter((p) => p.silenceBucket === "safe_reopen"),
            ...ranked.filter((p) => p.silenceBucket === "handle_with_care"),
          ];
        }
        // Prefer people who match the brief text before plain rank order.
        const shortlist = shortlistForBrief(ranked, brief, 80);
        if (!shortlist.length) {
          set({
            enrichStatus: "error",
            enrichError: "No callable people found for this brief.",
          });
          return;
        }

        const allowedTags = get().allowedTags;
        if (!allowedTags.length) {
          set({
            enrichStatus: "error",
            enrichError: "Select at least one allowed tag.",
          });
          return;
        }

        set({ enrichStatus: "running", enrichError: null, campaignInterpretedAs: null });
        try {
          const response = await fetch("/api/campaign-week", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              brief,
              budget,
              preferWarm,
              allowedTags,
              prospects: shortlist.map((p) => ({
                id: p.id,
                name: p.name,
                company: p.company,
                title: p.title,
                segment: p.segment,
                source: p.source,
                lastTouch: p.lastTouch,
                notes: p.notes,
                estimatedValue: p.estimatedValue,
                silenceBucket: p.silenceBucket,
                phonePresent: Boolean(p.phone),
                emailPresent: Boolean(p.email),
              })),
            }),
          });
          const body = (await response.json()) as {
            interpretedAs?: string;
            picks?: {
              prospectId: string;
              whyCall: string;
              whySupport: string;
              fitNote: string;
              tags: InsightTag[];
            }[];
            error?: string;
          };
          if (!response.ok || !body.picks) {
            throw new Error(body.error ?? "Campaign week failed");
          }

          // Model occasionally repeats the same prospectId — keep first/best only.
          const seen = new Set<string>();
          const uniquePicks = body.picks.filter((pick) => {
            if (seen.has(pick.prospectId)) return false;
            if (!get().prospects.some((p) => p.id === pick.prospectId)) return false;
            seen.add(pick.prospectId);
            return true;
          });
          let pickIds = uniquePicks.map((p) => p.prospectId);
          // If AI under-fills, add other brief matches from the book (file-grounded).
          pickIds = localBriefFillIds(ranked, brief, pickIds, budget);

          const byId = new Map(uniquePicks.map((p) => [p.prospectId, p]));
          const prospects = get().prospects.map((p) => {
            const pick = byId.get(p.id);
            if (!pick) return p;
            return {
              ...p,
              enrichmentTags: pick.tags,
              whyCallOverride: pick.whyCall,
              whySupportOverride: pick.fitNote
                ? `${pick.whySupport}${pick.whySupport ? " · " : ""}${pick.fitNote}`
                : pick.whySupport,
            };
          });

          set({
            prospects,
            importSummary: buildImportSummary(prospects),
            analyses: analyzeBookLocally(rankProspects(prospects, get().outcomes)),
            selectedIds: pickIds,
            campaign: {
              id: `camp-${Date.now()}`,
              name: `Week of ${new Date().toISOString().slice(0, 10)}`,
              createdAt: new Date().toISOString(),
              prospectIds: pickIds,
            },
            weekBudget: budget,
            // Week list is already curated — do not silently hide rows with Ready-step filters.
            tagFilters: [],
            campaignInterpretedAs: body.interpretedAs ?? brief,
            enrichStatus: "complete",
            enrichError: pickIds.length
              ? null
              : "No strong matches for that brief. Try broader wording or clear the prompt.",
            aiAnalyzedCount: uniquePicks.length,
            step: pickIds.length ? "plan" : "diagnose",
            callIndex: 0,
          });
        } catch (error) {
          set({
            enrichStatus: "error",
            enrichError:
              error instanceof Error
                ? error.message
                : "AI campaign week failed. Try again or clear the prompt for the default list.",
          });
        }
      },
      openCall: (id) => {
        const campaign = get().campaign;
        if (!campaign) return;
        const index = campaign.prospectIds.indexOf(id);
        if (index < 0) return;
        set({ callIndex: index, step: "call", prepError: null });
        void get().prepareCall(id);
      },
      prepareCall: async (id, force = false) => {
        const existing = get().callPreps[id];
        // Retry automatically when prior packet was a local fallback after AI failure.
        if (!force && existing && existing.source !== "fallback") return true;
        if (get().prepStatus === "running" && !force) return false;
        const ranked = get().ranked().find((p) => p.id === id);
        const prospect = get().prospects.find((p) => p.id === id);
        if (!prospect || !ranked) return false;
        set({ prepStatus: "running", prepError: null });
        try {
          const response = await fetch("/api/call-prep", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prospect: {
                id: prospect.id,
                name: prospect.name,
                company: prospect.company ?? null,
                title: prospect.title ?? null,
                lastTouch: prospect.lastTouch ?? null,
                notes: (prospect.notes ?? "").slice(0, 2500) || null,
                estimatedValue: prospect.estimatedValue ?? null,
                emailDomain: prospect.email?.split("@")[1] ?? null,
                whyCall: ranked.whyCall ?? null,
              },
            }),
          });
          const body = (await response.json()) as {
            packet?: CallPrepPacket;
            error?: string;
          };
          if (!response.ok || !body.packet) {
            throw new Error(body.error ?? "Call prep failed");
          }
          const packet: CallPrepPacket = { ...body.packet, source: "ai" };
          const bullets = packet.talkBullets.join("\n");
          set({
            callPreps: { ...get().callPreps, [id]: packet },
            talkEdits: {
              ...get().talkEdits,
              [id]: get().talkEdits[id] || bullets,
            },
            prepStatus: "idle",
            prepError: null,
          });
          return true;
        } catch (error) {
          // Local fallback brief from file only.
          const fallback: CallPrepPacket = {
            prospectId: id,
            person: {
              summary:
                ranked.whyCall ||
                (prospect.notes?.slice(0, 180) ?? "Limited file notes for this person."),
              details: [
                prospect.title ? `Title on file: ${prospect.title}` : "",
                prospect.lastTouch ? `Last touch: ${prospect.lastTouch}` : "",
                prospect.estimatedValue ? `Value signal: ${prospect.estimatedValue}` : "",
              ].filter(Boolean),
              sources: [],
            },
            company: {
              summary: prospect.company
                ? `${prospect.company} — public verify unavailable; using file only.`
                : "No company on file.",
              details: [],
              sources: [],
            },
            talkBullets: [
              ranked.whyCall,
              prospect.company ? `Company on file: ${prospect.company}` : "Confirm company/role",
              "Ask what changed since last contact",
            ].filter(Boolean) as string[],
            identityStatus: "file_only",
            identityNote: "Showing file brief only — AI verify did not finish.",
            preparedAt: new Date().toISOString(),
            source: "fallback",
          };
          set({
            callPreps: { ...get().callPreps, [id]: fallback },
            talkEdits: {
              ...get().talkEdits,
              [id]: get().talkEdits[id] || fallback.talkBullets.join("\n"),
            },
            prepStatus: "error",
            prepError:
              error instanceof Error
                ? error.message
                : "AI call prep is temporarily unavailable.",
          });
          return false;
        }
      },
      logFreeformOutcome: async (id, freeText) => {
        const prospect = get().prospects.find((p) => p.id === id);
        const ranked = get().ranked().find((p) => p.id === id);
        if (!prospect) return false;
        const text = freeText.trim();
        if (!text) return false;
        set({ noteStatus: "running", noteError: null });
        try {
          const response = await fetch("/api/log-outcome", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              freeText: text,
              allowedTags: get().allowedTags,
              prospect: {
                id: prospect.id,
                name: prospect.name,
                company: prospect.company ?? null,
                title: prospect.title ?? null,
                notes: prospect.notes ?? null,
                whyCall: ranked?.whyCall ?? prospect.whyCallOverride ?? null,
              },
            }),
          });
          const body = (await response.json()) as {
            outcome?: Outcome;
            reasonHeld?: "yes" | "stale" | "";
            summaryNote?: string;
            tags?: InsightTag[];
            error?: string;
          };
          if (!response.ok) throw new Error(body.error ?? "Could not log outcome");

          const stamp = new Date().toISOString().slice(0, 10);
          const summary = body.summaryNote?.trim() || text;
          const prospects = get().prospects.map((p) =>
            p.id === id
              ? {
                  ...p,
                  notes: [p.notes?.trim(), `[${stamp}] ${summary}`].filter(Boolean).join("\n\n"),
                  lastTouch: stamp,
                  enrichmentTags: body.tags?.length ? body.tags : p.enrichmentTags,
                }
              : p,
          );
          set({
            prospects,
            importSummary: buildImportSummary(prospects),
            analyses: analyzeBookLocally(rankProspects(prospects, get().outcomes)),
            outcomes: {
              ...get().outcomes,
              [id]: body.outcome ?? "called",
            },
            reasonHeld: {
              ...get().reasonHeld,
              ...(body.reasonHeld ? { [id]: body.reasonHeld } : {}),
            },
            noteStatus: "idle",
            noteError: null,
          });
          return true;
        } catch (error) {
          const stamp = new Date().toISOString().slice(0, 10);
          const prospects = get().prospects.map((p) =>
            p.id === id
              ? {
                  ...p,
                  notes: [p.notes?.trim(), `[${stamp}] ${text}`].filter(Boolean).join("\n\n"),
                  lastTouch: stamp,
                }
              : p,
          );
          set({
            prospects,
            importSummary: buildImportSummary(prospects),
            outcomes: { ...get().outcomes, [id]: "called" },
            noteStatus: "error",
            noteError:
              error instanceof Error
                ? `${error.message} Saved as a note and marked Called.`
                : "Saved as a note and marked Called.",
          });
          return true;
        }
      },
      appendProspectNote: async (id, noteText) => {
        const prospect = get().prospects.find((p) => p.id === id);
        if (!prospect) return false;
        const text = noteText.trim();
        if (!text) return false;
        const allowedTags = get().allowedTags;
        set({ noteStatus: "running", noteError: null });
        try {
          const response = await fetch("/api/enrich-note", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              allowedTags,
              noteText: text,
              prospect: {
                id: prospect.id,
                name: prospect.name,
                company: prospect.company,
                title: prospect.title,
                segment: prospect.segment,
                source: prospect.source,
                lastTouch: prospect.lastTouch,
                notes: prospect.notes,
                estimatedValue: prospect.estimatedValue,
                phone: prospect.phone,
                email: prospect.email,
              },
            }),
          });
          const body = (await response.json()) as {
            appendedNote?: string;
            whyCall?: string;
            whySupport?: string;
            tags?: InsightTag[];
            fieldUpdates?: Partial<Prospect>;
            error?: string;
          };
          if (!response.ok) throw new Error(body.error ?? "Note update failed");

          const stamp = new Date().toISOString().slice(0, 10);
          const appended = body.appendedNote?.trim() || text;
          const nextNotes = [prospect.notes?.trim(), `[${stamp}] ${appended}`]
            .filter(Boolean)
            .join("\n\n");
          const updates = body.fieldUpdates ?? {};
          const prospects = get().prospects.map((p) =>
            p.id === id
              ? {
                  ...p,
                  notes: nextNotes,
                  company: updates.company?.trim() || p.company,
                  title: updates.title?.trim() || p.title,
                  estimatedValue: updates.estimatedValue?.trim() || p.estimatedValue,
                  lastTouch: updates.lastTouch?.trim() || stamp,
                  phone: updates.phone?.trim() || p.phone,
                  email: updates.email?.trim() || p.email,
                  enrichmentTags: body.tags ?? p.enrichmentTags,
                  whyCallOverride: body.whyCall?.trim() || p.whyCallOverride,
                  whySupportOverride: body.whySupport?.trim() || p.whySupportOverride,
                }
              : p,
          );
          const rankedNext = rankProspects(prospects, get().outcomes);
          set({
            prospects,
            importSummary: buildImportSummary(prospects),
            analyses: analyzeBookLocally(rankedNext),
            noteStatus: "idle",
            noteError: null,
          });
          return true;
        } catch (error) {
          // Fallback: append raw note without AI.
          const stamp = new Date().toISOString().slice(0, 10);
          const prospects = get().prospects.map((p) =>
            p.id === id
              ? {
                  ...p,
                  notes: [p.notes?.trim(), `[${stamp}] ${text}`].filter(Boolean).join("\n\n"),
                  lastTouch: stamp,
                }
              : p,
          );
          set({
            prospects,
            importSummary: buildImportSummary(prospects),
            noteStatus: "error",
            noteError:
              error instanceof Error
                ? `${error.message} Note was saved without AI enrichment.`
                : "Note saved without AI enrichment.",
          });
          return true;
        }
      },
      refreshPublicEvidence: async (id) => {
        const prospect = get().prospects.find((p) => p.id === id);
        if (!prospect?.company) {
          set({
            analysisError:
              "A company name is required before public evidence can be matched safely.",
          });
          return;
        }
        set({ analysisStatus: "running", analysisError: null });
        try {
          const response = await fetch("/api/evidence-refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prospect: {
                id: prospect.id,
                name: prospect.name,
                company: prospect.company,
                title: prospect.title,
                lastTouch: prospect.lastTouch,
                notes: prospect.notes,
                emailDomain: prospect.email?.split("@")[1],
              },
            }),
          });
          const body = (await response.json()) as {
            packet?: WebEvidencePacket;
            error?: string;
          };
          if (!response.ok || !body.packet) {
            throw new Error(body.error ?? `Evidence refresh failed (${response.status})`);
          }
          set({
            webEvidence: { ...get().webEvidence, [id]: body.packet },
            analysisStatus: "complete",
          });
        } catch (error) {
          set({
            analysisStatus: "error",
            analysisError:
              error instanceof Error ? error.message : "Public evidence refresh failed.",
          });
        }
      },
      buildWeekPlan: (n) => {
        const budget = n ?? get().weekBudget;
        let ranked = get().ranked();
        const preferWarm = get().preferWarm;
        const byWarmth = (list: RankedProspect[]) => {
          if (!preferWarm) return list;
          return [
            ...list.filter((p) => p.silenceBucket === "safe_reopen"),
            ...list.filter((p) => p.silenceBucket === "handle_with_care"),
            ...list.filter((p) => p.silenceBucket === "do_not_cold_call"),
          ];
        };
        const filters = get().tagFilters;
        if (filters.length) {
          const hit = ranked.filter((p) =>
            filters.some((f) => p.tags.some((t) => t.id === f)),
          );
          const miss = ranked.filter((p) => !hit.some((h) => h.id === p.id));
          ranked = [...byWarmth(hit), ...byWarmth(miss)];
        } else {
          ranked = byWarmth(ranked);
        }
        const top = [
          ...new Set(balancedCallable(ranked, get().analyses, budget).map((p) => p.id)),
        ];
        set({
          weekBudget: budget,
          selectedIds: top,
          campaign: {
            id: `camp-${Date.now()}`,
            name: `Week of ${new Date().toISOString().slice(0, 10)}`,
            createdAt: new Date().toISOString(),
            prospectIds: top,
          },
          // Filters may reorder who gets into the week; do not hide week rows afterward.
          tagFilters: [],
          step: "plan",
          callIndex: 0,
        });
      },
      clearSelection: () => set({ selectedIds: [] }),
      setOutcome: (id, outcome) =>
        set({ outcomes: { ...get().outcomes, [id]: outcome } }),
      setTalkEdit: (id, text) =>
        set({ talkEdits: { ...get().talkEdits, [id]: text } }),
      setReasonHeld: (id, v) =>
        set({ reasonHeld: { ...get().reasonHeld, [id]: v } }),
      setStep: (step) => set({ step }),
      setCallIndex: (callIndex) => set({ callIndex }),
      setWeekBudget: (weekBudget) => set({ weekBudget }),
      setPreferWarm: (preferWarm) => set({ preferWarm }),
      mergeDuplicatePair: (keepId, dropId) => {
        const list = get().prospects;
        const keep = list.find((p) => p.id === keepId);
        const drop = list.find((p) => p.id === dropId);
        if (!keep || !drop) return;
        const merged = mergeProspects(keep, drop);
        const next = list
          .filter((p) => p.id !== dropId)
          .map((p) => (p.id === keepId ? merged : p));
        set({
          prospects: next,
          selectedIds: get().selectedIds.filter((id) => id !== dropId),
          importSummary: buildImportSummary(next),
          analyses: analyzeBookLocally(rankProspects(next, get().outcomes)),
          campaign: get().campaign
            ? {
                ...get().campaign!,
                prospectIds: get().campaign!.prospectIds.filter((id) => id !== dropId),
              }
            : null,
        });
      },
      ranked: () => rankProspects(get().prospects, get().outcomes),
      resetAll: () =>
        set({
          prospects: [],
          outcomes: {},
          talkEdits: {},
          reasonHeld: {},
          campaign: null,
          selectedIds: [],
          sourceLabel: "none",
          importSummary: null,
          step: "import",
          callIndex: 0,
          weekBudget: 10,
          preferWarm: true,
          tagFilters: [],
          analyses: {},
          webEvidence: {},
          callPreps: {},
          analysisStatus: "ready",
          analysisError: null,
          aiAnalyzedCount: 0,
          campaignInterpretedAs: null,
          enrichStatus: "idle",
          enrichError: null,
          noteStatus: "idle",
          noteError: null,
          prepStatus: "idle",
          prepError: null,
          // Keep access + tag vocabulary (+ optional campaign brief) across books.
        }),
    }),
    {
      // Only lightweight prefs survive reloads. Full books + AI packets stay in memory
      // so large CSVs (200–500+ rows) do not blow past localStorage quota (~5MB).
      name: "reactivation-desk-v8",
      partialize: (state) => ({
        access: state.access,
        allowedTags: state.allowedTags,
        tagPresetId: state.tagPresetId,
        weekBudget: state.weekBudget,
        preferWarm: state.preferWarm,
        campaignBrief: state.campaignBrief,
      }),
      storage: createJSONStorage(() => {
        const safe: Storage = {
          get length() {
            try {
              return localStorage.length;
            } catch {
              return 0;
            }
          },
          clear() {
            try {
              localStorage.clear();
            } catch {
              /* ignore */
            }
          },
          getItem(key) {
            try {
              return localStorage.getItem(key);
            } catch {
              return null;
            }
          },
          key(index) {
            try {
              return localStorage.key(index);
            } catch {
              return null;
            }
          },
          removeItem(key) {
            try {
              localStorage.removeItem(key);
            } catch {
              /* ignore */
            }
          },
          setItem(key, value) {
            try {
              localStorage.setItem(key, value);
            } catch {
              for (const old of [
                "reactivation-desk-v5",
                "reactivation-desk-v6",
                "reactivation-desk-v7",
                key,
              ]) {
                try {
                  localStorage.removeItem(old);
                } catch {
                  /* ignore */
                }
              }
              try {
                localStorage.setItem(key, value);
              } catch {
                console.warn("Desk prefs could not be persisted (storage full).");
              }
            }
          },
        };
        return safe;
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<State>),
        // Never hydrate a persisted book — those keys are intentionally omitted.
        prospects: currentState.prospects,
        outcomes: currentState.outcomes,
        talkEdits: currentState.talkEdits,
        reasonHeld: currentState.reasonHeld,
        campaign: currentState.campaign,
        selectedIds: currentState.selectedIds,
        sourceLabel: currentState.sourceLabel,
        importSummary: currentState.importSummary,
        analyses: currentState.analyses,
        webEvidence: currentState.webEvidence,
        callPreps: currentState.callPreps,
        tagFilters: currentState.tagFilters,
        step: currentState.step,
        callIndex: currentState.callIndex,
        analysisStatus: "ready",
        analysisError: null,
        enrichStatus: "idle",
        enrichError: null,
        noteStatus: "idle",
        noteError: null,
        prepStatus: "idle",
        prepError: null,
        aiAnalyzedCount: 0,
      }),
      onRehydrateStorage: () => {
        // Drop legacy full-book caches that may already be filling the quota.
        for (const key of [
          "reactivation-desk-v5",
          "reactivation-desk-v6",
          "reactivation-desk-v7",
        ]) {
          try {
            localStorage.removeItem(key);
          } catch {
            /* ignore */
          }
        }
        return undefined;
      },
    },
  ),
);
