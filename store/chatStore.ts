/**
 * chatStore —— AI 筛选推荐收藏（Prompt G）。
 * AI 挑选/推荐的企业与职位落到这里，可在页面其他区域（如“推荐企业列表”）展示。
 */
"use client";

import { create } from "zustand";
import type { Job } from "@/types/job";

interface ChatState {
  /** AI 推荐的企业/职位。 */
  recommendations: Job[];
  /** 「推荐企业」右侧抽屉是否打开。 */
  recsDrawerOpen: boolean;
  /** 最近一次对话最终推荐摘要。 */
  lastSummary: string | null;
  /** 对话是否进行中。 */
  busy: boolean;

  addRecommendation: (job: Job) => void;
  removeRecommendation: (id: string) => void;
  clearRecommendations: () => void;
  setLastSummary: (s: string | null) => void;
  setBusy: (v: boolean) => void;
  /** 打开/关闭「推荐企业」抽屉。 */
  setRecsDrawerOpen: (v: boolean) => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  recommendations: [],
  recsDrawerOpen: false,
  lastSummary: null,
  busy: false,

  addRecommendation: (job) =>
    set((s) => ({
      recommendations: s.recommendations.some((j) => j.id === job.id)
        ? s.recommendations
        : [job, ...s.recommendations],
    })),
  removeRecommendation: (id) =>
    set((s) => ({ recommendations: s.recommendations.filter((j) => j.id !== id) })),
  clearRecommendations: () => set({ recommendations: [] }),
  setLastSummary: (lastSummary) => set({ lastSummary }),
  setBusy: (busy) => set({ busy }),
  setRecsDrawerOpen: (recsDrawerOpen) => set({ recsDrawerOpen }),
}));