/**
 * jobStore —— 职位列表与筛选条件状态（Prompt F）。
 * 职位接口按页抓取：前端滚动到底部请求下一页并追加（append），直到 hasMore=false。
 */
"use client";

import { create } from "zustand";
import type { Job, JobQuery, JobsResponse } from "@/types/job";

interface JobState {
  query: JobQuery;
  jobs: Job[];
  total: number;
  /** 当前已加载到的页号。 */
  page: number;
  /** 是否还有下一页（滚动到底部继续加载）。 */
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  source: "yeeyi" | "mock" | null;
  /** 是否展示要求 PR 的职位（默认 false）。 */
  allowPR: boolean;

  setQuery: (patch: Partial<JobQuery>) => void;
  /** append=false 时用 res 整体替换（首页/刷新）；append=true 时追加到已有列表（下一页）。 */
  setJobs: (res: JobsResponse, append?: boolean) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null, loading?: boolean) => void;
  setAllowPR: (v: boolean) => void;
  reset: () => void;
}

const initialQuery: JobQuery = { allowPR: false };

export const useJobStore = create<JobState>()((set) => ({
  query: initialQuery,
  jobs: [],
  total: 0,
  page: 0,
  hasMore: true,
  loading: false,
  error: null,
  source: null,
  allowPR: false,

  setQuery: (patch) =>
    set((s) => ({ query: { ...s.query, ...patch } })),
  setJobs: (res, append = false) =>
    set((s) => ({
      jobs: append ? [...s.jobs, ...res.jobs] : res.jobs,
      total: res.total,
      page: res.page,
      hasMore: res.hasMore,
      source: res.source,
      loading: false,
      error: res.error ?? null,
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error, loading = false) => set({ error, loading }),
  setAllowPR: (allowPR) => set({ allowPR }),
  reset: () =>
    set({
      query: initialQuery,
      jobs: [],
      total: 0,
      page: 0,
      hasMore: true,
      loading: false,
      error: null,
      source: null,
      allowPR: false,
    }),
}));