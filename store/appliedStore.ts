/**
 * appliedStore —— 「已投递」职位状态（Prompt 新功能）。
 * 点击职位卡片的「已投递」→ 把该职位快照存进（持久化到 localStorage）；
 * 卡片随即隐藏；“已投递”侧边抽屉可查看/移除（移除即恢复卡片）。
 */
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Job } from "@/types/job";

export interface AppliedItem {
  /** 职位本身快照（离开列表后仍可展示）。 */
  job: Job;
  /** 投递时间（Unix 毫秒）。 */
  appliedAt: number;
}

interface AppliedState {
  applied: AppliedItem[];
  /** 「已投递」侧边抽屉是否打开。 */
  drawerOpen: boolean;

  /** 标记一个职位为已投递（重复时不重复添加，但可刷新时间）。 */
  addApplied: (job: Job) => void;
  /** 从已投递中移除（等价于撤销投递，卡片恢复显示）。 */
  removeApplied: (id: string) => void;
  /** 判断某职位是否已投递。 */
  isApplied: (id: string) => boolean;
  /** 打开/关闭抽屉，或强制设置。 */
  toggleDrawer: () => void;
  setDrawerOpen: (v: boolean) => void;
}

export const useAppliedStore = create<AppliedState>()(
  persist(
    (set, get) => ({
      applied: [],
      drawerOpen: false,

      addApplied: (job) =>
        set((s) => {
          const existing = s.applied.some((i) => i.job.id === job.id);
          if (existing) return s;
          return { applied: [{ job, appliedAt: Date.now() }, ...s.applied] };
        }),

      removeApplied: (id) =>
        set((s) => ({ applied: s.applied.filter((i) => i.job.id !== id) })),

      isApplied: (id) => get().applied.some((i) => i.job.id === id),

      toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
      setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
    }),
    {
      name: "applied-store",
      partialize: (s) => ({ applied: s.applied }),
    },
  ),
);