"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  buildImportSummary,
  mergeProspects,
  rankProspects,
  topCallable,
} from "./rank";
import { buildSyntheticBook } from "./syntheticBook";
import type {
  Campaign,
  ImportSummary,
  Outcome,
  Prospect,
  RankedProspect,
  WizardStep,
} from "./types";

type State = {
  prospects: Prospect[];
  outcomes: Record<string, Outcome>;
  talkEdits: Record<string, string>;
  campaign: Campaign | null;
  selectedIds: string[];
  sourceLabel: string;
  importSummary: ImportSummary | null;
  step: WizardStep;
  callIndex: number;
  loadSynthetic: () => void;
  runDemoAutopilot: () => void;
  loadProspects: (prospects: Prospect[], sourceLabel: string) => void;
  toggleSelect: (id: string) => void;
  selectTopCallable: (n: number) => void;
  clearSelection: () => void;
  setOutcome: (id: string, outcome: Outcome) => void;
  setTalkEdit: (id: string, text: string) => void;
  createCampaignFromSelection: () => void;
  setStep: (step: WizardStep) => void;
  setCallIndex: (i: number) => void;
  mergeDuplicatePair: (keepId: string, dropId: string) => void;
  ranked: () => RankedProspect[];
  resetAll: () => void;
};

export const useDesk = create<State>()(
  persist(
    (set, get) => ({
      prospects: [],
      outcomes: {},
      talkEdits: {},
      campaign: null,
      selectedIds: [],
      sourceLabel: "none",
      importSummary: null,
      step: "import",
      callIndex: 0,
      loadSynthetic: () => {
        const prospects = buildSyntheticBook(120);
        set({
          prospects,
          sourceLabel: "Disclosed synthetic book (120), Advisor A-like messy export",
          importSummary: buildImportSummary(prospects),
          selectedIds: [],
          campaign: null,
          outcomes: {},
          talkEdits: {},
          step: "rank",
          callIndex: 0,
        });
      },
      runDemoAutopilot: () => {
        const prospects = buildSyntheticBook(120);
        const ranked = rankProspects(prospects, {});
        const top = topCallable(ranked, 10).map((p) => p.id);
        set({
          prospects,
          sourceLabel: "Demo autopilot: synthetic book, top 10 callable",
          importSummary: buildImportSummary(prospects),
          selectedIds: top,
          outcomes: {},
          talkEdits: {},
          callIndex: 0,
          campaign: {
            id: `camp-${Date.now()}`,
            name: `Week of ${new Date().toISOString().slice(0, 10)}`,
            createdAt: new Date().toISOString(),
            prospectIds: top,
          },
          step: "call",
        });
      },
      loadProspects: (prospects, sourceLabel) =>
        set({
          prospects,
          sourceLabel,
          importSummary: buildImportSummary(prospects),
          selectedIds: [],
          campaign: null,
          outcomes: {},
          talkEdits: {},
          step: "rank",
          callIndex: 0,
        }),
      toggleSelect: (id) => {
        const cur = get().selectedIds;
        set({
          selectedIds: cur.includes(id)
            ? cur.filter((x) => x !== id)
            : [...cur, id],
        });
      },
      selectTopCallable: (n) => {
        const top = topCallable(get().ranked(), n).map((p) => p.id);
        set({ selectedIds: top });
      },
      clearSelection: () => set({ selectedIds: [] }),
      setOutcome: (id, outcome) =>
        set({ outcomes: { ...get().outcomes, [id]: outcome } }),
      setTalkEdit: (id, text) =>
        set({ talkEdits: { ...get().talkEdits, [id]: text } }),
      createCampaignFromSelection: () => {
        const ids = get().selectedIds;
        if (!ids.length) return;
        set({
          campaign: {
            id: `camp-${Date.now()}`,
            name: `Week of ${new Date().toISOString().slice(0, 10)}`,
            createdAt: new Date().toISOString(),
            prospectIds: ids,
          },
          step: "call",
          callIndex: 0,
        });
      },
      setStep: (step) => set({ step }),
      setCallIndex: (callIndex) => set({ callIndex }),
      mergeDuplicatePair: (keepId, dropId) => {
        const list = get().prospects;
        const keep = list.find((p) => p.id === keepId);
        const drop = list.find((p) => p.id === dropId);
        if (!keep || !drop) return;
        const merged = mergeProspects(keep, drop);
        set({
          prospects: list
            .filter((p) => p.id !== dropId)
            .map((p) => (p.id === keepId ? merged : p)),
          selectedIds: get().selectedIds.filter((id) => id !== dropId),
          importSummary: buildImportSummary(
            list.filter((p) => p.id !== dropId).map((p) => (p.id === keepId ? merged : p)),
          ),
        });
      },
      ranked: () => rankProspects(get().prospects, get().outcomes),
      resetAll: () =>
        set({
          prospects: [],
          outcomes: {},
          talkEdits: {},
          campaign: null,
          selectedIds: [],
          sourceLabel: "none",
          importSummary: null,
          step: "import",
          callIndex: 0,
        }),
    }),
    { name: "reactivation-desk-v2" },
  ),
);
