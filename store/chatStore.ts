/**
 * chatStore —— AI 筛选聊天的 UI/会话状态（Prompt G）。
 * 「推荐企业」列表已迁移到 localStorage（见 store/recsStore.ts，基于 useLocalStorage），
 * 这里只保留抽屉开关 / 最近摘要 / 忙碌等瞬时 UI 状态。
 */
"use client";

import { create } from "zustand";

interface ChatState {
  /** 「推荐企业」右侧抽屉是否打开。 */
  recsDrawerOpen: boolean;
  /** 最近一次对话最终推荐摘要。 */
  lastSummary: string | null;
  /** 对话是否进行中。 */
  busy: boolean;

  setLastSummary: (s: string | null) => void;
  setBusy: (v: boolean) => void;
  /** 打开/关闭「推荐企业」抽屉。 */
  setRecsDrawerOpen: (v: boolean) => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  recsDrawerOpen: false,
  lastSummary: null,
  busy: false,

  setLastSummary: (lastSummary) => set({ lastSummary }),
  setBusy: (busy) => set({ busy }),
  setRecsDrawerOpen: (recsDrawerOpen) => set({ recsDrawerOpen }),
}));