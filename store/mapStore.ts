/**
 * mapStore —— 地图选址 + 位置解析结果（Prompt D & E）。
 * 保存：用户点选的坐标/地名，以及“城市 + suburbs”解析结果。
 */
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PickedLocation, ResolveLocationResult } from '@/types/geo';

interface MapState {
  /** 用户点选的位置。 */
  picked: PickedLocation | null;
  /** 位置解析结果（来自 /api/resolve-location）。 */
  resolved: ResolveLocationResult | null;
  /** 是否正在解析。 */
  resolving: boolean;
  /** 解析是否失败。 */
  resolveError: string | null;
  /** 高亮显示的城区。 */
  highlightSuburbName?: string;

  setPicked: (picked: PickedLocation) => void;
  setResolved: (r: ResolveLocationResult | null) => void;
  setResolving: (v: boolean) => void;
  setResolveError: (e: string | null) => void;
  setHighlightSuburbName: (name?: string) => void;
  resetHighlightSuburbName: () => void;
  reset: () => void;
}

export const useMapStore = create<MapState>()(
  persist(
    (set) => ({
      picked: null,
      resolved: null,
      resolving: false,
      resolveError: null,
      highlightSuburbName: undefined,

      // 选点即解除“解析中断”状态：若上次会话在请求未完成时关闭，resolving 被持久化
      // 为 true，若不在此重置，page.tsx 的 resolve() 会因 `if (resolving) return` 永远短路，
      // 导致本地再也无法自动调用 /api/resolve-location。
      setPicked: (picked) =>
        set({ picked, resolving: false, resolveError: null }),
      setResolved: (resolved) => {
        // resolved 根据 name 去重
        const duplicatedResolved: ResolveLocationResult = {
          mainCity: resolved?.mainCity || '',
          country: resolved?.country || 'Australia',
          confidence: resolved?.confidence || 0,
          reasoning: resolved?.reasoning || '',
          mode: resolved?.mode || 'heuristic',
          suburbs:
            resolved?.suburbs?.filter(
              (s, index, arr) =>
                arr.findIndex((t) => t.name === s.name) === index,
            ) ?? [],
        };
        set({
          resolved: duplicatedResolved,
          resolving: false,
          resolveError: null,
        });
      },
      setResolving: (resolving) => set({ resolving }),
      setResolveError: (resolveError) =>
        set({ resolveError, resolving: false }),
      setHighlightSuburbName: (name) => set({ highlightSuburbName: name }),
      resetHighlightSuburbName: () => set({ highlightSuburbName: undefined }),
      reset: () =>
        set({
          picked: null,
          resolved: null,
          resolving: false,
          resolveError: null,
        }),
    }),
    {
      name: 'map-store',
      // 只持久化用户选点；resolving/resolved/resolveError 是瞬时/易失效状态，
      // 持久化它们会带来脏状态（如被卡在 resolving:true）且不应跨会话复用解析结果。
      partialize: (s) => ({ picked: s.picked }),
    },
  ),
);

/** 供其他组件读取“当前位置”的便捷 hook（Prompt D 要求）。 */
export function useLocation() {
  return useMapStore((s) => s.picked);
}
