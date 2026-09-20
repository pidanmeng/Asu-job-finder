/**
 * useLocalStorage —— 通用 localStorage 双向绑定 hook。
 *
 * 与 window.localStorage 双向同步：
 *   - 读取：首次挂载时从 localStorage 反序列化（带 try/catch 兜底、JSON 解析失败回退初始值）；
 *   - 写入：value 每次变化自动写回 localStorage；
 *   - 跨标签页同步：监听 window 的 `storage` 事件（其他标签页改动 key 时本页自动刷新）；
 *   - 本页内同步：可传入 `opts.syncEvent`，当窗口派发该自定义事件时重新从 localStorage
 *     读取并刷新状态 —— 用于「非 React 代码（如工具函数）直接改 localStorage 后，让 hook 跟着刷新」，
 *     这也是“双向绑定 + recommendJobs 工具也修改 localStorage”的关键。
 *
 * @param initialValue 首次（或 localStorage 无值/解析失败）时的默认值。
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseLocalStorageOptions {
  /** 非 React 代码直接写 localStorage 后派发的自定义事件名。 */
  syncEvent?: string;
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  opts: UseLocalStorageOptions = {},
) {
  const { syncEvent } = opts;
  const initialRef = useRef<T>(initialValue);

  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialRef.current;
    try {
      const raw = window.localStorage.getItem(key);
      return raw != null ? (JSON.parse(raw) as T) : initialRef.current;
    } catch {
      return initialRef.current;
    }
  });

  // 值变化 → 写回 localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* 存储满 / 隐私模式等场景静默失败 */
    }
  }, [key, value]);

  // 跨标签页同步（其他标签页写了同一 key）
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      try {
        setValue(e.newValue != null ? (JSON.parse(e.newValue) as T) : initialRef.current);
      } catch {
        /* 忽略无法解析的外部写入 */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  // 本页内自定义事件同步（工具函数直接写 localStorage 后派发）
  useEffect(() => {
    if (typeof window === "undefined" || !syncEvent) return;
    const onSync = () => {
      try {
        const raw = window.localStorage.getItem(key);
        setValue(raw != null ? (JSON.parse(raw) as T) : initialRef.current);
      } catch {
        /* 忽略 */
      }
    };
    window.addEventListener(syncEvent, onSync);
    return () => window.removeEventListener(syncEvent, onSync);
  }, [key, syncEvent]);

  const set = useCallback((v: T | ((prev: T) => T)) => {
    setValue((prev) => (typeof v === "function" ? (v as (p: T) => T)(prev) : v));
  }, []);

  return [value, set] as const;
}