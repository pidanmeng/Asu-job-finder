/**
 * jobStore —— 职位列表与筛选条件状态（Prompt F）。
 */
"use client";

import { create } from "zustand";
import type { Job, JobQuery, JobsResponse } from "@/types/job";

interface JobState {
  query: JobQuery;
  jobs: Job[];
  page: number;
  total: number;
  loading: boolean;
  error: string | null;
  source: "yeeyi" | "mock" | null;
  /** 是否展示要求 PR 的职位（默认 false）。 */
  allowPR: boolean;

  setQuery: (patch: Partial<JobQuery>) => void;
  setJobs: (res: JobsResponse) => void;
  appendJobs: (res: JobsResponse) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  setAllowPR: (v: boolean) => void;
  reset: () => void;
}

const initialQuery: JobQuery = { page: 1, pageSize: 20, allowPR: false };

export const useJobStore = create<JobState>()((set) => ({
  query: initialQuery,
  jobs: [],
  page: 1,
  total: 0,
  loading: false,
  error: null,
  source: null,
  allowPR: false,

  setQuery: (patch) =>
    set((s) => ({ query: { ...s.query, ...patch, page: 1 } })),
  setJobs: (res) =>
    set({
      jobs: res.jobs,
      page: res.page,
      total: res.total,
      source: res.source,
      loading: false,
      error: res.error ?? null,
    }),
  appendJobs: (res) =>
    set((s) => ({
      jobs: [...s.jobs, ...res.jobs],
      page: res.page,
      total: res.total,
      source: res.source,
      loading: false,
      error: res.error ?? null,
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
  setAllowPR: (allowPR) => set({ allowPR }),
  reset: () => set({ query: initialQuery, jobs: [], page: 1, total: 0, loading: false, error: null, source: null, allowPR: false }),
}));