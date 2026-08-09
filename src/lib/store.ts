"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { rankProspects } from "./rank";
import { buildSyntheticBook } from "./syntheticBook";
import type { Campaign, Outcome, Prospect, RankedProspect } from "./types";

type State = {
  prospects: Prospect[];
  outcomes: Record<string, Outcome>;
  talkEdits: Record<string, string>;
  campaign: Campaign | null;
  selectedIds: string[];
  sourceLabel: string;
  loadSynthetic: () => void;
  loadProspects: (prospects: Prospect[], sourceLabel: string) => void;
  toggleSelect: (id: string) => void;
  selectTop: (n: number) => void;
  clearSelection: () => void;
  setOutcome: (id: string, outcome: Outcome) => void;
  setTalkEdit: (id: string, text: string) => void;
  createCampaignFromSelection: () => void;
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
      loadSynthetic: () =>
        set({
          prospects: buildSyntheticBook(120),
          sourceLabel: "Disclosed synthetic book (120) — Advisor A–like messy CRM/export",
          selectedIds: [],
          campaign: null,
          outcomes: {},
          talkEdits: {},
        }),
      loadProspects: (prospects, sourceLabel) =>
        set({
          prospects,
          sourceLabel,
          selectedIds: [],
          campaign: null,
          outcomes: {},
          talkEdits: {},
        }),
      toggleSelect: (id) => {
        const cur = get().selectedIds;
        set({
          selectedIds: cur.includes(id)
            ? cur.filter((x) => x !== id)
            : [...cur, id],
        });
      },
      selectTop: (n) => {
        const top = get()
          .ranked()
          .slice(0, n)
          .map((p) => p.id);
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
        }),
    }),
    { name: "reactivation-desk-v1" },
  ),
);
