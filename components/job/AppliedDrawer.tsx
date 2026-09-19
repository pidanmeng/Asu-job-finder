"use client";

/**
 * 「已投递」侧边抽屉。
 * 展示所有已标记投递的职位（持久化），支持查看详情（来源弹窗）与撤销投递（恢复列表卡片）。
 */
import { useState } from "react";
import { useAppliedStore } from "@/store/appliedStore";
import type { Job } from "@/types/job";
import JobDetailModal from "@/components/job/JobDetailModal";

export default function AppliedDrawer() {
  const applied = useAppliedStore((s) => s.applied);
  const open = useAppliedStore((s) => s.drawerOpen);
  const setOpen = useAppliedStore((s) => s.setDrawerOpen);
  const removeApplied = useAppliedStore((s) => s.removeApplied);
  const [detailJob, setDetailJob] = useState<Job | null>(null);

  const close = () => setOpen(false);

  return (
    <>
      {/* 遮罩 */}
      <div
        className={`fixed inset-0 z-[55] bg-slate-900/40 transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={close}
        aria-hidden="true"
      />

      {/* 抽屉 */}
      <aside
        className={`fixed right-0 top-0 z-[60] flex h-full w-full max-w-md flex-col overflow-hidden bg-white shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-label="已投递职位"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">📥 已投递</h2>
            <p className="text-xs text-slate-400">共 {applied.length} 个职位</p>
          </div>
          <button
            onClick={close}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="关闭已投递抽屉"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {applied.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center text-sm text-slate-400">
              <span className="text-3xl">🗂</span>
              <p>还没有已投递的职位。</p>
              <p className="text-xs">在职位卡片上点「✓ 已投递」即可收藏到这里。</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {applied.map((item) => (
                <li key={item.job.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-slate-900" title={item.job.title}>
                        {item.job.title}
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{item.job.company}</p>
                    </div>
                    <button
                      onClick={() => removeApplied(item.job.id)}
                      title="撤销投递（卡片将重新出现在列表）"
                      className="shrink-0 rounded-lg px-2 py-1 text-xs text-rose-500 transition hover:bg-rose-50"
                    >
                      撤销
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5">💰 {item.job.salary}</span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5">{item.job.type}</span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5">📍 {item.job.suburb}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                    <span>投递于 {new Date(item.appliedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                    <button
                      onClick={() => setDetailJob(item.job)}
                      className="rounded-lg bg-slate-100 px-3 py-1 font-medium text-slate-600 transition hover:bg-slate-200"
                    >
                      查看详情
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <JobDetailModal job={detailJob} open={!!detailJob} onClose={() => setDetailJob(null)} />
    </>
  );
}