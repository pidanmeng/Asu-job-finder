/**
 * mapStore —— 地图选址 + 位置解析结果（Prompt D & E）。
 * 保存：用户点选的坐标/地名，以及“城市 + suburbs”解析结果。
 */
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PickedLocation, ResolveLocationResult } from "@/types/geo";

interface MapState {
  /** 用户点选的位置。 */
  picked: PickedLocation | null;
  /** 位置解析结果（来自 /api/resolve-location）。 */
  resolved: ResolveLocationResult | null;
  /** 是否正在解析。 */
  resolving: boolean;
  /** 解析是否失败。 */
  resolveError: string | null;

  setPicked: (picked: PickedLocation) => void;
  setResolved: (r: ResolveLocationResult | null) => void;
  setResolving: (v: boolean) => void;
  setResolveError: (e: string | null) => void;
  reset: () => void;
}

export const useMapStore = create<MapState>()(
  persist(
    (set) => ({
      picked: null,
      resolved: null,
      resolving: false,
      resolveError: null,

      setPicked: (picked) => set({ picked, resolveError: null }),
      setResolved: (resolved) => set({ resolved, resolving: false, resolveError: null }),
      setResolving: (resolving) => set({ resolving }),
      setResolveError: (resolveError) => set({ resolveError, resolving: false }),
      reset: () =>
        set({ picked: null, resolved: null, resolving: false, resolveError: null }),
    }),
    { name: "map-store" },
  ),
);

/** 供其他组件读取“当前位置”的便捷 hook（Prompt D 要求）。 */
export function useLocation() {
  return useMapStore((s) => s.picked);
}