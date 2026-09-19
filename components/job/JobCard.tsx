/**
 * 职位卡片（Prompt F）。展示标题、公司、薪资、类型、城区、PR 徽标、时间。
 * 交互：
 *   - 「查看详情」：不再跳转平台详情页，而是打开弹窗（服务端爬取 __NEXT_DATA__ 展示）。
 *   - 「已投递」：标记为已投递（持久化），卡片自动隐藏；“已投递”抽屉可查看/移除。
 */
"use client";

import { useState } from "react";
import type { Job } from "@/types/job";
import { useAppliedStore } from "@/store/appliedStore";
import JobDetailModal from "@/components/job/JobDetailModal";

function timeAgo(unixSeconds?: number): string {
  if (!unixSeconds) return "";
  const s = Math.max(0, Math.floor(Date.now() / 1000 - unixSeconds));
  const d = Math.floor(s / 86400);
  if (d > 30) return `${Math.floor(d / 30)}个月前`;
  if (d > 0) return `${d}天前`;
  const h = Math.floor(s / 3600);
  if (h > 0) return `${h}小时前`;
  return "刚刚";
}

export default function JobCard({ job, onRecommend }: { job: Job; onRecommend?: (job: Job) => void }) {
  const applied = useAppliedStore((s) => s.applied);
  const addApplied = useAppliedStore((s) => s.addApplied);
  const [detailOpen, setDetailOpen] = useState(false);

  const isApplied = applied.some((i) => i.job.id === job.id);

  const prBadge = job.requiresPR ? (
    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-600" title="要求 PR（系统关键词判断）">
      要求 PR
    </span>
  ) : (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-600">
      不要求 PR
    </span>
  );

  // 已投递：卡片自动隐藏（可在“已投递”抽屉中撤销）
  if (isApplied) return null;

  return (
    <div className="group min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md animate-fade-in-up">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-900" title={job.title}>{job.title}</h3>
          <p className="mt-0.5 text-sm text-slate-500">{job.company}</p>
        </div>
        {prBadge}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-slate-600">
          💰 {job.salary}
        </span>
        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-slate-600">
          {job.type}
        </span>
        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-slate-600">
          📍 {job.suburb}
        </span>
      </div>

      {job.matchedKeywords && job.matchedKeywords.length > 0 && (
        <p className="mt-2 text-xs text-sky-600">关键词命中：{job.matchedKeywords.join("、")}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span>{job.postedAt ? timeAgo(job.postedAt) : ""}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            onClick={() => addApplied(job)}
            title="标记为已投递，卡片将从列表隐藏"
            className="rounded-lg bg-emerald-50 px-3 py-1.5 font-medium text-emerald-600 transition hover:bg-emerald-100 active:bg-emerald-200"
          >
            ✓ 已投递
          </button>
          {onRecommend && (
            <button
              onClick={() => onRecommend(job)}
              className="rounded-lg bg-indigo-50 px-3 py-1.5 font-medium text-indigo-600 transition hover:bg-indigo-100 active:bg-indigo-200"
            >
              + 推荐
            </button>
          )}
          <button
            onClick={() => setDetailOpen(true)}
            title="查看职位详情（抓取来源网页）"
            className="rounded-lg bg-slate-100 px-3 py-1.5 font-medium text-slate-600 transition hover:bg-slate-200 active:bg-slate-300"
          >
            查看详情 ↗
          </button>
        </div>
      </div>

      <JobDetailModal job={job} open={detailOpen} onClose={() => setDetailOpen(false)} />
    </div>
  );
}