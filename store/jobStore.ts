/**
 * jobStore —— 职位列表与筛选条件状态（Prompt F）。
 * 职位接口一次性返回全部匹配结果，无分页。
 */
"use client";

import { create } from "zustand";
import type { Job, JobQuery, JobsResponse } from "@/types/job";

interface JobState {
  query: JobQuery;
  jobs: Job[];
  total: number;
  loading: boolean;
  error: string | null;
  source: "yeeyi" | "mock" | null;
  /** 是否展示要求 PR 的职位（默认 false）。 */
  allowPR: boolean;

  setQuery: (patch: Partial<JobQuery>) => void;
  setJobs: (res: JobsResponse) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  setAllowPR: (v: boolean) => void;
  reset: () => void;
}

const initialQuery: JobQuery = { allowPR: false };

export const useJobStore = create<JobState>()((set) => ({
  query: initialQuery,
  jobs: [],
  total: 0,
  loading: false,
  error: null,
  source: null,
  allowPR: false,

  setQuery: (patch) =>
    set((s) => ({ query: { ...s.query, ...patch } })),
  setJobs: (res) =>
    set({
      jobs: res.jobs,
      total: res.total,
      source: res.source,
      loading: false,
      error: res.error ?? null,
    }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
  setAllowPR: (allowPR) => set({ allowPR }),
  reset: () => set({ query: initialQuery, jobs: [], total: 0, loading: false, error: null, source: null, allowPR: false }),
}));