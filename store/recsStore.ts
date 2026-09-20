/**
 * recsStore —— 「推荐企业」列表的 localStorage 持久化封装（基于 useLocalStorage）。
 *
 * 此前推荐列表存放在 chatStore 内存里，刷新即丢失。这里改用 localStorage 持久化：
 *   - React 侧：useRecommendations() 基于 useLocalStorage(RECS_STORAGE_KEY, [])，双向绑定；
 *   - 非 React 侧（recommendJobs 工具 / 工具结果兜底解析）：addRecLocal / removeRecLocal /
 *     clearRecsLocal 直接读写 localStorage，并派发 RECS_CHANGED_EVENT，
 *     让所有订阅的 hook 跟着刷新 —— 即“recommendJobs 工具也修改 localStorage”。
 */
"use client";

import { useCallback } from "react";
import type { Job } from "@/types/job";
import { useLocalStorage } from "@/hooks/useLocalStorage";

export const RECS_STORAGE_KEY = "aus-recommendations";
/** 非 React 代码直接改 localStorage 后派发的事件，让 useRecommendations 刷新。 */
export const RECS_CHANGED_EVENT = "aus-recs-changed";

/* ---------------- 底层读 / 写（可被非 React 代码调用） ---------------- */

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw != null ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 忽略存储异常 */
  }
}

export function loadRecs(): Job[] {
  return readJson<Job[]>(RECS_STORAGE_KEY) ?? [];
}

function emitChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(RECS_CHANGED_EVENT));
}

/** recommendJobs 工具侧写入：去重 + 新推荐放最前 + 持久化 + 派发事件。 */
export function addRecLocal(job: Job): Job[] {
  const next = loadRecs();
  if (!next.some((j) => j.id === job.id)) {
    next.unshift(job);
    writeJson(RECS_STORAGE_KEY, next);
    emitChanged();
  }
  return next;
}

export function removeRecLocal(id: string): Job[] {
  const prev = loadRecs();
  const next = prev.filter((j) => j.id !== id);
  writeJson(RECS_STORAGE_KEY, next);
  emitChanged();
  return next;
}

export function clearRecsLocal(): Job[] {
  writeJson(RECS_STORAGE_KEY, []);
  emitChanged();
  return [];
}

/* ---------------- React hook（双向绑定） ---------------- */

export function useRecommendations() {
  const [recommendations, setRecommendations] = useLocalStorage<Job[]>(
    RECS_STORAGE_KEY,
    [],
    { syncEvent: RECS_CHANGED_EVENT },
  );

  const add = useCallback(
    (job: Job) => {
      setRecommendations((prev) =>
        prev.some((j) => j.id === job.id) ? prev : [job, ...prev],
      );
    },
    [setRecommendations],
  );

  const remove = useCallback(
    (id: string) =>
      setRecommendations((prev) => prev.filter((j) => j.id !== id)),
    [setRecommendations],
  );

  const clear = useCallback(() => setRecommendations([]), [setRecommendations]);

  return { recommendations, add, remove, clear, set: setRecommendations };
}