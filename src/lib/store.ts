"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { buildDemoAdvisorBook } from "./demoBook";
import {
  buildImportSummary,
  mergeProspects,
  rankProspects,
  topCallable,
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
  loadDemoBook: () => void;
  runPanelDemo: () => void;
  loadProspects: (prospects: Prospect[], sourceLabel: string) => void;
  toggleSelect: (id: string) => void;
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
  return {
    prospects,
    sourceLabel,
    importSummary: buildImportSummary(prospects),
    selectedIds: [] as string[],
    campaign: null,
    outcomes: {} as Record<string, Outcome>,
    talkEdits: {} as Record<string, string>,
    reasonHeld: {} as Record<string, "yes" | "stale" | "">,
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
      loadDemoBook: () => {
        set({
          ...applyBook(
            buildDemoAdvisorBook(),
            "Panel sample book (disclosed synthetic, Advisor A-like export)",
          ),
          weekBudget: 10,
        });
      },
      runPanelDemo: () => {
        const prospects = buildDemoAdvisorBook();
        const ranked = rankProspects(prospects, {});
        const top = topCallable(ranked, 10).map((p) => p.id);
        set({
          ...applyBook(prospects, "Panel demo: sample book + this week’s 10 ready"),
          selectedIds: top,
          weekBudget: 10,
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
      buildWeekPlan: (n) => {
        const budget = n ?? get().weekBudget;
        let ranked = get().ranked();
        if (get().preferWarm) {
          const warm = ranked.filter((p) => p.silenceBucket === "safe_reopen");
          const careful = ranked.filter((p) => p.silenceBucket === "handle_with_care");
          ranked = [...warm, ...careful, ...ranked.filter((p) => p.silenceBucket === "do_not_cold_call")];
        }
        const top = topCallable(ranked, budget).map((p) => p.id);
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
        }),
    }),
    { name: "reactivation-desk-v3" },
  ),
);
