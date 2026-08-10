"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  canBuildWeek,
  canImportBook,
  canUseDesk,
  emptyAccess,
  maxWeekSizeForPlan,
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
import { normalizeCallPrepPacket } from "./callPrepTypes";
import type { InsightTag } from "./insightTags";
import {
  buildImportSummary,
  mergeProspects,
  rankProspects,
} from "./rank";
import {
  clampWeekBudget,
  isTerminalOutcome,
  orderForNextWeek,
  type NextWeekMode,
} from "./weekFlow";
import {
  TAG_PRESETS,
  slugTag,
  uniqueAllowedTags,
  type AllowedTag,
} from "./tagPresets";
import {
  allowedTagsForThesis,
  applyAnswersToThesis,
  bookSampleForThesis,
  defaultPracticeThesis,
  inferThesisFromBook,
  mergeUrlDraftIntoThesis,
  normalizeThesis,
  tagPresetForThesis,
  thesisPromptBlock,
  thesisSummaryLine,
  type AudienceId,
  type BookInsight,
  type OfferId,
  type PracticeThesis,
} from "./practiceThesis";
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
  practiceThesis: PracticeThesis;
  bookInsights: BookInsight[];
  thesisReviewPending: boolean;
  thesisStatus: "idle" | "running" | "error";
  thesisError: string | null;
  campaignBrief: string;
  campaignInterpretedAs: string | null;
  enrichStatus: "idle" | "running" | "complete" | "error";
  enrichError: string | null;
  noteStatus: "idle" | "running" | "error";
  noteError: string | null;
  prepStatus: "idle" | "running" | "error";
  prepError: string | null;
  /** Ids currently fetching call-prep (background or foreground). */
  preparingIds: string[];
  /** Background prefetch progress for the current week list. */
  weekPrep: { status: "idle" | "running" | "complete"; done: number; total: number };
  loadDemoBook: () => void;
  loadProspects: (prospects: Prospect[], sourceLabel: string) => void;
  setTagPreset: (presetId: string) => void;
  setAllowedTags: (tags: AllowedTag[]) => void;
  toggleAllowedTag: (id: string) => void;
  addCustomTag: (label: string) => void;
  unlockAccess: (plan: AccessPlan, promoUsed?: string | null) => boolean;
  unlockWithPromo: (code: string) => { ok: boolean; error?: string };
  /** Full wipe: plan, thesis, prefs, and in-memory book (prototype / demo reset). */
  clearAccess: () => void;
  /** AI guess of practice thesis from the imported book (post-import popup). */
  guessThesisFromBook: () => Promise<boolean>;
  confirmThesisReview: (input: {
    audience: AudienceId;
    offers: OfferId[];
    customOffer: string;
    companyUrl: string;
    linkedinUrl: string;
    enrichFromUrls: boolean;
  }) => Promise<void>;
  skipThesisReview: () => void;
  updatePracticeThesis: (patch: Partial<PracticeThesis>) => void;
  enrichThesisFromUrls: (urls?: {
    companyUrl?: string;
    linkedinUrl?: string;
  }) => Promise<boolean>;
  toggleSelect: (id: string) => void;
  toggleTagFilter: (id: string) => void;
  clearTagFilters: () => void;
  setCampaignBrief: (brief: string) => void;
  enrichImportedBook: (count?: number) => Promise<boolean>;
  deepenTopProspects: (count?: number) => Promise<boolean>;
  appendProspectNote: (id: string, noteText: string) => Promise<boolean>;
  prepareCall: (id: string, force?: boolean) => Promise<boolean>;
  /** Prefetch call briefs for everyone on this week's list (sequential, background). */
  prefetchCampaignPreps: () => Promise<void>;
  logFreeformOutcome: (id: string, freeText: string) => Promise<boolean>;
  refreshPublicEvidence: (id: string) => Promise<void>;
  buildWeekPlan: (
    n?: WeekBudget,
    opts?: { nextWeek?: boolean; preferLeftovers?: boolean },
  ) => void;
  /** Enrich / curate with AI, then build the week list. */
  buildWeekWithAi: (
    n?: WeekBudget,
    opts?: {
      nextWeek?: boolean;
      preferLeftovers?: boolean;
      /** Override brief for this build only; "" forces default ranking. */
      forceBrief?: string;
    },
  ) => Promise<void>;
  buildNextWeek: (mode: NextWeekMode) => Promise<void>;
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

/** Serialize call-prep API work so background + open-call don't stampede the model. */
let prepChain: Promise<void> = Promise.resolve();
const inflightPreps = new Map<string, Promise<boolean>>();
let prefetchGeneration = 0;

function viewingCall(get: () => State, id: string) {
  const state = get();
  if (state.step !== "call") return false;
  return state.campaign?.prospectIds[state.callIndex] === id;
}

function normalizeAccess(access: AccessState): AccessState {
  return {
    ...emptyAccess(),
    ...access,
    sprintBooksUsed: access.sprintBooksUsed ?? 0,
    sprintWeeksUsed: access.sprintWeeksUsed ?? 0,
  };
}

function planClampBudget(n: number | undefined, access: AccessState) {
  const current = normalizeAccess(access);
  return clampWeekBudget(n ?? 10, maxWeekSizeForPlan(current));
}

function consumeSprintWeek(access: AccessState): AccessState {
  const current = normalizeAccess(access);
  if (current.plan !== "sprint") return current;
  return { ...current, sprintWeeksUsed: current.sprintWeeksUsed + 1 };
}

const SPRINT_WEEK_EXHAUSTED =
  "Sprint includes 3 polished weeks. Unlock Unlimited to keep building weeks, or enter promo UNLIMITED.";

function applyBook(
  prospects: Prospect[],
  sourceLabel: string,
  access: AccessState,
  priorThesis: PracticeThesis,
) {
  // Drop per-row CSV raw maps — they duplicate every field and blow storage/memory.
  const slim = prospects.map((p) => ({ ...p, raw: {} as Record<string, string> }));
  const ranked = rankProspects(slim, {});
  const current = normalizeAccess(access);
  const nextAccess =
    current.plan === "sprint" && canImportBook(current)
      ? { ...current, sprintBooksUsed: current.sprintBooksUsed + 1 }
      : current;
  const importSummary = buildImportSummary(prospects);
  // Keep prior thesis until the AI guess returns; popup starts in "reading" state.
  const prior = normalizeThesis(priorThesis);
  return {
    prospects: slim,
    sourceLabel,
    importSummary,
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
    preparingIds: [] as string[],
    weekPrep: { status: "idle" as const, done: 0, total: 0 },
    step: "diagnose" as WizardStep,
    callIndex: 0,
    access: nextAccess,
    practiceThesis: {
      ...prior,
      reviewedForSourceLabel: null,
    },
    bookInsights: [
      {
        id: "loading",
        text: `Reading ${importSummary.total} rows to guess who you sell to and what to reopen…`,
      },
    ],
    thesisReviewPending: true,
    thesisStatus: "running" as const,
    thesisError: null as string | null,
    allowedTags: allowedTagsForThesis(prior),
    tagPresetId: tagPresetForThesis(prior),
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
      practiceThesis: defaultPracticeThesis(),
      bookInsights: [],
      thesisReviewPending: false,
      thesisStatus: "idle",
      thesisError: null,
      campaignBrief: "",
      campaignInterpretedAs: null,
      enrichStatus: "idle",
      enrichError: null,
      noteStatus: "idle",
      noteError: null,
      prepStatus: "idle",
      prepError: null,
      preparingIds: [],
      weekPrep: { status: "idle", done: 0, total: 0 },
      loadDemoBook: () => {
        const access = normalizeAccess(get().access);
        if (!canImportBook(access) && access.plan !== "none") {
          set({
            analysisError:
              "Sprint book already used. Unlock Unlimited for another book, or enter promo UNLIMITED.",
          });
          return;
        }
        if (!canImportBook(access) && access.plan === "none") {
          set({ step: "import" });
          return;
        }
        set({
          ...applyBook(
            buildDemoAdvisorBook(),
            "Sample advisor book",
            access,
            get().practiceThesis,
          ),
          weekBudget: 10,
        });
        void get().guessThesisFromBook();
      },
      loadProspects: (prospects, sourceLabel) => {
        const access = normalizeAccess(get().access);
        if (!canImportBook(access)) {
          set({
            analysisError:
              access.plan === "sprint"
                ? "Sprint includes one book import. Unlock Unlimited for another book, or enter promo UNLIMITED."
                : "Unlock Sprint or Unlimited before importing.",
            step: "import",
          });
          return;
        }
        set({
          ...applyBook(prospects, sourceLabel, access, get().practiceThesis),
        });
        void get().guessThesisFromBook();
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
            sprintWeeksUsed: 0,
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
      clearAccess: () => {
        prefetchGeneration += 1;
        set({
          access: emptyAccess(),
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
          campaignBrief: "",
          campaignInterpretedAs: null,
          enrichStatus: "idle",
          enrichError: null,
          noteStatus: "idle",
          noteError: null,
          prepStatus: "idle",
          prepError: null,
          preparingIds: [],
          weekPrep: { status: "idle", done: 0, total: 0 },
          practiceThesis: defaultPracticeThesis(),
          thesisReviewPending: false,
          bookInsights: [],
          thesisStatus: "idle",
          thesisError: null,
          allowedTags: defaultPreset.tags,
          tagPresetId: defaultPreset.id,
        });
      },
      guessThesisFromBook: async () => {
        const prospects = get().prospects;
        const summary = get().importSummary;
        if (!prospects.length) {
          set({ thesisStatus: "idle" });
          return false;
        }
        set({ thesisStatus: "running", thesisError: null });
        try {
          const response = await fetch("/api/practice-thesis", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceLabel: get().sourceLabel,
              book: bookSampleForThesis(prospects, summary),
            }),
          });
          const body = (await response.json()) as {
            guess?: {
              audience: AudienceId;
              offers: OfferId[];
              customOffer: string;
              summary: string;
              insights: BookInsight[];
              rationale: string;
            };
            error?: string;
          };
          if (!response.ok || !body.guess) {
            throw new Error(body.error ?? `Thesis guess failed (${response.status})`);
          }
          const g = body.guess;
          const next = normalizeThesis({
            ...get().practiceThesis,
            audience: g.audience,
            offers: g.offers,
            customOffer: g.customOffer,
            summary: g.summary,
            confidence: "guessed",
            sources: [...new Set([...get().practiceThesis.sources, "book" as const])],
            updatedAt: new Date().toISOString(),
            reviewedForSourceLabel: null,
          });
          if (!g.summary.trim()) next.summary = thesisSummaryLine(next);
          set({
            practiceThesis: next,
            bookInsights: g.insights.length
              ? g.insights
              : [{ id: "rationale", text: g.rationale }],
            allowedTags: allowedTagsForThesis(next),
            tagPresetId: tagPresetForThesis(next),
            thesisStatus: "idle",
            thesisError: null,
            thesisReviewPending: true,
          });
          return true;
        } catch (error) {
          // Deterministic fallback if the model is unavailable.
          const { thesis, insights } = inferThesisFromBook(
            get().prospects,
            get().importSummary,
            get().practiceThesis,
          );
          set({
            practiceThesis: thesis,
            bookInsights: insights,
            allowedTags: allowedTagsForThesis(thesis),
            tagPresetId: tagPresetForThesis(thesis),
            thesisStatus: "idle",
            thesisError:
              error instanceof Error
                ? `${error.message} Showing a local guess instead — please corroborate.`
                : "AI guess unavailable. Showing a local guess — please corroborate.",
            thesisReviewPending: true,
          });
          return false;
        }
      },
      confirmThesisReview: async (input) => {
        const sourceLabel = get().sourceLabel;
        let next = applyAnswersToThesis(get().practiceThesis, {
          audience: input.audience,
          offers: input.offers,
          customOffer: input.customOffer,
        });
        next = {
          ...next,
          companyUrl: input.companyUrl,
          linkedinUrl: input.linkedinUrl,
          reviewedForSourceLabel: sourceLabel,
        };
        next.summary = thesisSummaryLine(next);
        set({
          practiceThesis: next,
          allowedTags: allowedTagsForThesis(next),
          tagPresetId: tagPresetForThesis(next),
          thesisError: null,
        });

        if (input.enrichFromUrls && (input.companyUrl || input.linkedinUrl)) {
          const ok = await get().enrichThesisFromUrls({
            companyUrl: input.companyUrl,
            linkedinUrl: input.linkedinUrl,
          });
          if (!ok) return;
        }

        set({
          thesisReviewPending: false,
          practiceThesis: {
            ...get().practiceThesis,
            reviewedForSourceLabel: sourceLabel,
            confidence: "confirmed",
          },
        });
      },
      skipThesisReview: () => {
        set({
          thesisReviewPending: false,
          practiceThesis: {
            ...get().practiceThesis,
            reviewedForSourceLabel: get().sourceLabel,
          },
        });
      },
      updatePracticeThesis: (patch) => {
        const next = normalizeThesis({
          ...get().practiceThesis,
          ...patch,
          confidence: "confirmed",
          sources: [...new Set([...get().practiceThesis.sources, "manual" as const])],
          updatedAt: new Date().toISOString(),
        });
        next.summary = patch.summary?.trim() || thesisSummaryLine(next);
        set({
          practiceThesis: next,
          allowedTags: allowedTagsForThesis(next),
          tagPresetId: tagPresetForThesis(next),
          thesisError: null,
        });
      },
      enrichThesisFromUrls: async (urls) => {
        const current = get().practiceThesis;
        const companyUrl = (urls?.companyUrl ?? current.companyUrl).trim();
        const linkedinUrl = (urls?.linkedinUrl ?? current.linkedinUrl).trim();
        if (!companyUrl && !linkedinUrl) {
          set({ thesisStatus: "error", thesisError: "Add a company or LinkedIn URL." });
          return false;
        }
        set({ thesisStatus: "running", thesisError: null });
        try {
          const response = await fetch("/api/practice-profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              companyUrl: companyUrl || null,
              linkedinUrl: linkedinUrl || null,
              bookHints: get().bookInsights.map((i) => i.text),
            }),
          });
          const body = (await response.json()) as {
            draft?: {
              audience: AudienceId;
              offers: OfferId[];
              customOffer: string;
              summary: string;
              rationale: string;
            };
            error?: string;
          };
          if (!response.ok || !body.draft) {
            throw new Error(body.error ?? `Profile enrich failed (${response.status})`);
          }
          const merged = mergeUrlDraftIntoThesis(
            {
              ...current,
              companyUrl,
              linkedinUrl,
            },
            body.draft,
          );
          set({
            practiceThesis: {
              ...merged,
              reviewedForSourceLabel:
                current.reviewedForSourceLabel ?? get().sourceLabel,
            },
            allowedTags: allowedTagsForThesis(merged),
            tagPresetId: tagPresetForThesis(merged),
            thesisStatus: "idle",
            thesisError: null,
            thesisReviewPending: false,
          });
          return true;
        } catch (error) {
          set({
            thesisStatus: "error",
            thesisError:
              error instanceof Error
                ? error.message
                : "Could not read those URLs. Try questions instead.",
          });
          return false;
        }
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
                  practiceThesis: thesisPromptBlock(get().practiceThesis),
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
      buildWeekWithAi: async (n, opts) => {
        const access = normalizeAccess(get().access);
        if (!canBuildWeek(access)) {
          set({
            enrichStatus: "error",
            enrichError:
              access.plan === "none"
                ? "Unlock Sprint or Unlimited before building a week."
                : SPRINT_WEEK_EXHAUSTED,
          });
          return;
        }
        const budget = planClampBudget(n ?? get().weekBudget, access);
        const nextWeek = Boolean(opts?.nextWeek);
        const preferLeftovers = Boolean(opts?.preferLeftovers) || nextWeek;
        const brief =
          opts?.forceBrief !== undefined
            ? opts.forceBrief.trim()
            : get().campaignBrief.trim();
        if (!brief) {
          const enrichCount = Math.min(
            maxWeekSizeForPlan(access),
            Math.max(budget * 3, 20),
          );
          await get().enrichImportedBook(enrichCount);
          get().buildWeekPlan(budget, { nextWeek, preferLeftovers });
          return;
        }

        // Campaign brief path: AI curates the week from a callable shortlist.
        const preferWarm = get().preferWarm;
        const previousWeekIds = get().campaign?.prospectIds ?? [];
        const outcomes = get().outcomes;
        let ranked = get()
          .ranked()
          .filter((p) => {
            if (p.silenceBucket === "do_not_cold_call") return false;
            if (!p.phone && !p.email) return false;
            if (nextWeek && isTerminalOutcome(outcomes[p.id] ?? p.outcome)) return false;
            return true;
          });
        if (preferWarm) {
          ranked = [
            ...ranked.filter((p) => p.silenceBucket === "safe_reopen"),
            ...ranked.filter((p) => p.silenceBucket === "handle_with_care"),
          ];
        }
        if (preferLeftovers) {
          ranked = orderForNextWeek(ranked, outcomes, previousWeekIds);
        }
        // Prefer people who match the brief text before plain rank order.
        let shortlist = shortlistForBrief(ranked, brief, 80);
        if (preferLeftovers) {
          const order = new Map(ranked.map((p, index) => [p.id, index]));
          shortlist = [...shortlist].sort(
            (a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999),
          );
        }
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
              practiceThesis: thesisPromptBlock(get().practiceThesis),
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
            if (
              nextWeek &&
              isTerminalOutcome(outcomes[pick.prospectId] ?? "queued")
            ) {
              return false;
            }
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

          const nextOutcomes = { ...get().outcomes };
          if (nextWeek) {
            for (const id of pickIds) nextOutcomes[id] = "queued";
          }

          set({
            prospects,
            outcomes: nextOutcomes,
            importSummary: buildImportSummary(prospects),
            analyses: analyzeBookLocally(rankProspects(prospects, nextOutcomes)),
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
            access: pickIds.length
              ? consumeSprintWeek(get().access)
              : normalizeAccess(get().access),
          });
          if (pickIds.length) void get().prefetchCampaignPreps();
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
      buildNextWeek: async (mode) => {
        const budget = planClampBudget(get().weekBudget, get().access);
        if (mode === "fresh") {
          await get().buildWeekWithAi(budget, {
            nextWeek: true,
            preferLeftovers: true,
            forceBrief: "",
          });
          return;
        }
        if (mode === "same_theme") {
          await get().buildWeekWithAi(budget, {
            nextWeek: true,
            preferLeftovers: true,
          });
          return;
        }
        get().buildWeekPlan(budget, { nextWeek: true, preferLeftovers: true });
      },
      openCall: (id) => {
        const campaign = get().campaign;
        if (!campaign) return;
        const index = campaign.prospectIds.indexOf(id);
        if (index < 0) return;
        set({ callIndex: index, step: "call", prepError: null });
        void get().prepareCall(id);
      },
      prefetchCampaignPreps: async () => {
        const gen = ++prefetchGeneration;
        const ids = [...(get().campaign?.prospectIds ?? [])];
        if (!ids.length) {
          set({ weekPrep: { status: "idle", done: 0, total: 0 } });
          return;
        }
        set({ weekPrep: { status: "running", done: 0, total: ids.length } });
        let done = 0;
        for (const id of ids) {
          if (gen !== prefetchGeneration) return;
          if (!get().campaign?.prospectIds.includes(id)) continue;
          await get().prepareCall(id, false);
          done += 1;
          if (gen !== prefetchGeneration) return;
          set({
            weekPrep: { status: "running", done, total: ids.length },
          });
        }
        if (gen === prefetchGeneration) {
          set({ weekPrep: { status: "complete", done, total: ids.length } });
        }
      },
      prepareCall: (id, force = false) => {
        const existing = get().callPreps[id];
        // Retry automatically when prior packet was a local fallback after AI failure.
        if (!force && existing && existing.source !== "fallback") {
          return Promise.resolve(true);
        }
        if (!force && inflightPreps.has(id)) {
          return inflightPreps.get(id)!;
        }

        const job = new Promise<boolean>((resolve) => {
          prepChain = prepChain
            .catch(() => undefined)
            .then(async () => {
              // Re-check after waiting in queue — another job may have finished.
              const ready = get().callPreps[id];
              if (!force && ready && ready.source !== "fallback") {
                resolve(true);
                return;
              }

              const ranked = get().ranked().find((p) => p.id === id);
              const prospect = get().prospects.find((p) => p.id === id);
              if (!prospect || !ranked) {
                resolve(false);
                return;
              }

              set({
                preparingIds: [
                  ...get().preparingIds.filter((x) => x !== id),
                  id,
                ],
                prepStatus: "running",
                prepError: viewingCall(get, id) ? null : get().prepError,
              });

              try {
                const response = await fetch("/api/call-prep", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    practiceThesis: thesisPromptBlock(get().practiceThesis),
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
                const packet = normalizeCallPrepPacket({
                  ...body.packet,
                  source: "ai",
                });
                const bullets = packet.talkBullets.join("\n");
                const priorTalk = get().talkEdits[id];
                const preparingIds = get().preparingIds.filter((x) => x !== id);
                set({
                  callPreps: { ...get().callPreps, [id]: packet },
                  talkEdits: {
                    ...get().talkEdits,
                    [id]: force || !priorTalk ? bullets : priorTalk,
                  },
                  preparingIds,
                  prepStatus: preparingIds.length ? "running" : "idle",
                  prepError: viewingCall(get, id) ? null : get().prepError,
                });
                resolve(true);
              } catch (error) {
                const fileDetails = [
                  prospect.title
                    ? {
                        text: `Title on file: ${prospect.title}`,
                        origin: "file" as const,
                        cite: "title",
                        url: "",
                      }
                    : null,
                  prospect.lastTouch
                    ? {
                        text: `Last touch: ${prospect.lastTouch}`,
                        origin: "file" as const,
                        cite: "last touch",
                        url: "",
                      }
                    : null,
                  prospect.estimatedValue
                    ? {
                        text: `Value signal: ${prospect.estimatedValue}`,
                        origin: "file" as const,
                        cite: "value",
                        url: "",
                      }
                    : null,
                ].filter(Boolean) as CallPrepPacket["person"]["details"];

                const fallback: CallPrepPacket = {
                  prospectId: id,
                  person: {
                    summary:
                      ranked.whyCall ||
                      (prospect.notes?.slice(0, 180) ??
                        "Limited file notes for this person."),
                    details: fileDetails,
                    sources: [],
                  },
                  company: {
                    summary: prospect.company
                      ? `${prospect.company} — public verify unavailable; using file only.`
                      : "No company on file.",
                    details: [],
                    sources: [],
                  },
                  saleHighlights: [],
                  leadWhy:
                    ranked.whyCall ||
                    "File shows a reopen candidate — confirm fit before pitching.",
                  offerFocus: `Explore conversations that fit: ${get().practiceThesis.summary} Do not invent demand.`,
                  approachNote:
                    "Open from the file reason only — public verify did not finish for this call.",
                  talkBullets: [
                    `Why now: ${ranked.whyCall || "Reopen from file notes"}`,
                    `Offer angle: explore ${get().practiceThesis.summary.replace(/^Curate for [^;]+; reopen for /i, "")}`,
                    "Ask: what changed in the business since we last spoke?",
                    prospect.company
                      ? `Caution: confirm role at ${prospect.company} before pitching`
                      : "Caution: confirm company and role before pitching",
                  ].filter(Boolean) as string[],
                  identityStatus: "file_only",
                  identityNote:
                    "Showing file brief only — AI verify did not finish.",
                  preparedAt: new Date().toISOString(),
                  source: "fallback",
                };
                const preparingIds = get().preparingIds.filter((x) => x !== id);
                const message =
                  error instanceof Error
                    ? error.message
                    : "AI call prep is temporarily unavailable.";
                set({
                  callPreps: { ...get().callPreps, [id]: fallback },
                  talkEdits: {
                    ...get().talkEdits,
                    [id]: get().talkEdits[id] || fallback.talkBullets.join("\n"),
                  },
                  preparingIds,
                  prepStatus: preparingIds.length
                    ? "running"
                    : viewingCall(get, id)
                      ? "error"
                      : "idle",
                  // Only surface errors for the call currently on screen.
                  prepError: viewingCall(get, id) ? message : get().prepError,
                });
                resolve(false);
              }
            });
        });

        inflightPreps.set(id, job);
        void job.finally(() => {
          if (inflightPreps.get(id) === job) inflightPreps.delete(id);
        });
        return job;
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
      buildWeekPlan: (n, opts) => {
        const access = normalizeAccess(get().access);
        if (!canBuildWeek(access)) {
          set({
            enrichStatus: "error",
            enrichError:
              access.plan === "none"
                ? "Unlock Sprint or Unlimited before building a week."
                : SPRINT_WEEK_EXHAUSTED,
          });
          return;
        }
        const budget = planClampBudget(n ?? get().weekBudget, access);
        const nextWeek = Boolean(opts?.nextWeek);
        const preferLeftovers = Boolean(opts?.preferLeftovers) || nextWeek;
        const previousWeekIds = get().campaign?.prospectIds ?? [];
        const outcomes = get().outcomes;
        const preferWarm = get().preferWarm;
        const byWarmth = (list: RankedProspect[]) => {
          if (!preferWarm) return list;
          return [
            ...list.filter((p) => p.silenceBucket === "safe_reopen"),
            ...list.filter((p) => p.silenceBucket === "handle_with_care"),
            ...list.filter((p) => p.silenceBucket === "do_not_cold_call"),
          ];
        };

        let ranked: RankedProspect[];
        if (preferLeftovers) {
          ranked = byWarmth(
            orderForNextWeek(get().ranked(), outcomes, previousWeekIds),
          );
        } else {
          ranked = get().ranked();
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
        }

        const top = preferLeftovers
          ? [...new Set(ranked.slice(0, budget).map((p) => p.id))]
          : [
              ...new Set(
                balancedCallable(ranked, get().analyses, budget).map((p) => p.id),
              ),
            ];

        const nextOutcomes = { ...outcomes };
        if (nextWeek) {
          for (const id of top) nextOutcomes[id] = "queued";
        }

        set({
          outcomes: nextOutcomes,
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
          campaignInterpretedAs: preferLeftovers
            ? "Next week: follow-ups and unfinished names first, then the best remaining callable people."
            : get().campaignInterpretedAs,
          step: "plan",
          callIndex: 0,
          access: top.length ? consumeSprintWeek(access) : access,
        });
        if (top.length) void get().prefetchCampaignPreps();
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
      setWeekBudget: (weekBudget) =>
        set({
          weekBudget: planClampBudget(weekBudget, get().access),
        }),
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
      resetAll: () => {
        prefetchGeneration += 1;
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
          preparingIds: [],
          weekPrep: { status: "idle", done: 0, total: 0 },
          // Keep access + tag vocabulary (+ optional campaign brief) across books.
        });
      },
    }),
    {
      // Only lightweight prefs survive reloads. Full books + AI packets stay in memory
      // so large CSVs (200–500+ rows) do not blow past localStorage quota (~5MB).
      name: "reactivation-desk-v10",
      partialize: (state) => ({
        access: state.access,
        allowedTags: state.allowedTags,
        tagPresetId: state.tagPresetId,
        weekBudget: state.weekBudget,
        preferWarm: state.preferWarm,
        campaignBrief: state.campaignBrief,
        practiceThesis: state.practiceThesis,
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
                "reactivation-desk-v8",
                "reactivation-desk-v9",
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
      merge: (persistedState, currentState) => {
        const partial = persistedState as Partial<State>;
        return {
        ...currentState,
        ...partial,
        access: normalizeAccess(partial.access ?? currentState.access),
        practiceThesis: normalizeThesis(
          partial.practiceThesis ?? currentState.practiceThesis,
        ),
        thesisReviewPending: false,
        bookInsights: [],
        thesisStatus: "idle" as const,
        thesisError: null,
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
        preparingIds: [],
        weekPrep: { status: "idle", done: 0, total: 0 },
        aiAnalyzedCount: 0,
      };
      },
      onRehydrateStorage: () => {
        // Drop legacy full-book caches that may already be filling the quota.
        for (const key of [
          "reactivation-desk-v5",
          "reactivation-desk-v6",
          "reactivation-desk-v7",
          "reactivation-desk-v8",
          "reactivation-desk-v9",
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
