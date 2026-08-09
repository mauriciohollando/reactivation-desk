"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { buildDemoAdvisorBook } from "./demoBook";
import type { InsightTagId } from "./insightTags";
import {
  analyzeBookLocally,
  balancedCallable,
} from "./analysisEngine";
import type {
  ProspectAnalysis,
  WebEvidencePacket,
} from "./analysisTypes";
import {
  buildImportSummary,
  mergeProspects,
  rankProspects,
} from "./rank";
import type {
  Campaign,
  ImportSummary,
  Outcome,
  Prospect,
  RankedProspect,
  WeekBudget,
  WizardStep,
} from "./types";

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
  analysisStatus: "ready" | "running" | "complete" | "error";
  analysisError: string | null;
  aiAnalyzedCount: number;
  /** Analysis tags used to focus the week list (OR match). */
  tagFilters: InsightTagId[];
  loadDemoBook: () => void;
  loadProspects: (prospects: Prospect[], sourceLabel: string) => void;
  toggleSelect: (id: string) => void;
  toggleTagFilter: (id: InsightTagId) => void;
  clearTagFilters: () => void;
  deepenTopProspects: (count?: number) => Promise<void>;
  refreshPublicEvidence: (id: string) => Promise<void>;
  buildWeekPlan: (n?: WeekBudget) => void;
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

function applyBook(prospects: Prospect[], sourceLabel: string) {
  const ranked = rankProspects(prospects, {});
  return {
    prospects,
    sourceLabel,
    importSummary: buildImportSummary(prospects),
    selectedIds: [] as string[],
    campaign: null,
    outcomes: {} as Record<string, Outcome>,
    talkEdits: {} as Record<string, string>,
    reasonHeld: {} as Record<string, "yes" | "stale" | "">,
    tagFilters: [] as InsightTagId[],
    analyses: analyzeBookLocally(ranked),
    webEvidence: {} as Record<string, WebEvidencePacket>,
    analysisStatus: "ready" as const,
    analysisError: null as string | null,
    aiAnalyzedCount: 0,
    step: "diagnose" as WizardStep,
    callIndex: 0,
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
      analysisStatus: "ready",
      analysisError: null,
      aiAnalyzedCount: 0,
      loadDemoBook: () => {
        set({
          ...applyBook(
            buildDemoAdvisorBook(),
            "Sample advisor book (disclosed synthetic, Advisor A-like export)",
          ),
          weekBudget: 10,
        });
      },
      loadProspects: (prospects, sourceLabel) =>
        set({ ...applyBook(prospects, sourceLabel) }),
      toggleSelect: (id) => {
        const cur = get().selectedIds;
        set({
          selectedIds: cur.includes(id)
            ? cur.filter((x) => x !== id)
            : [...cur, id],
        });
      },
      toggleTagFilter: (id) => {
        const cur = get().tagFilters;
        set({
          tagFilters: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
        });
      },
      clearTagFilters: () => set({ tagFilters: [] }),
      deepenTopProspects: async (count = 25) => {
        const ranked = get()
          .ranked()
          .filter(
            (p) =>
              p.silenceBucket !== "do_not_cold_call" &&
              Boolean(p.phone || p.email),
          )
          .slice(0, count);
        if (!ranked.length) return;
        set({ analysisStatus: "running", analysisError: null });

        const batches: RankedProspect[][] = [];
        for (let i = 0; i < ranked.length; i += 5) {
          batches.push(ranked.slice(i, i + 5));
        }

        try {
          const results = await Promise.allSettled(
            batches.map(async (batch) => {
              const response = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
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
                const body = (await response.json().catch(() => ({}))) as {
                  error?: string;
                };
                throw new Error(body.error ?? `Analysis failed (${response.status})`);
              }
              return (await response.json()) as {
                analyses: Omit<ProspectAnalysis, "relationships">[];
              };
            }),
          );

          const responses = results
            .filter(
              (
                result,
              ): result is PromiseFulfilledResult<{
                analyses: Omit<ProspectAnalysis, "relationships">[];
              }> => result.status === "fulfilled",
            )
            .map((result) => result.value);
          const failures = results.filter((result) => result.status === "rejected");
          if (!responses.length) {
            const first = failures[0] as PromiseRejectedResult | undefined;
            throw first?.reason instanceof Error
              ? first.reason
              : new Error("All AI analysis batches failed.");
          }

          const next = { ...get().analyses };
          for (const response of responses) {
            for (const analysis of response.analyses) {
              const local = next[analysis.prospectId];
              next[analysis.prospectId] = {
                ...analysis,
                relationships: local?.relationships ?? [],
              };
            }
          }
          set({
            analyses: next,
            analysisStatus: "complete",
            aiAnalyzedCount: Object.values(next).filter((a) => a.mode === "ai").length,
            analysisError: failures.length
              ? `${failures.length} analysis batch${failures.length > 1 ? "es" : ""} failed; successful results were kept.`
              : null,
          });
        } catch (error) {
          set({
            analysisStatus: "error",
            analysisError:
              error instanceof Error
                ? error.message
                : "AI analysis failed. Local analysis remains available.",
          });
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
              error instanceof Error
                ? error.message
                : "Public evidence refresh failed.",
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
        const top = balancedCallable(ranked, get().analyses, budget).map((p) => p.id);
        set({
          weekBudget: budget,
          selectedIds: top,
          campaign: {
            id: `camp-${Date.now()}`,
            name: `Week of ${new Date().toISOString().slice(0, 10)}`,
            createdAt: new Date().toISOString(),
            prospectIds: top,
          },
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
          analysisStatus: "ready",
          analysisError: null,
          aiAnalyzedCount: 0,
        }),
    }),
    {
      name: "reactivation-desk-v5",
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<State>),
        analysisStatus: "ready",
        analysisError: null,
      }),
    },
  ),
);
