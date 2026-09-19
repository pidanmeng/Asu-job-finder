/**
 * 职位卡片（Prompt F）。展示标题、公司、薪资、类型、城区、PR 徽标、时间、来源链接。
 */
"use client";

import type { Job } from "@/types/job";

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
  const prBadge = job.requiresPR ? (
    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-600" title="要求 PR（R系统关键词判断）">
      要求 PR
    </span>
  ) : (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-600">
      不要求 PR
    </span>
  );

  return (
    <div className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md animate-fade-in-up">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-900">{job.title}</h3>
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

      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <span>{job.postedAt ? timeAgo(job.postedAt) : ""}</span>
        <div className="flex items-center gap-2">
          {onRecommend && (
            <button
              onClick={() => onRecommend(job)}
              className="rounded-md bg-indigo-50 px-2.5 py-1 font-medium text-indigo-600 transition hover:bg-indigo-100"
            >
              + 推荐
            </button>
          )}
          {job.applyUrl && job.applyUrl !== "#" && (
            <a
              href={job.applyUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md bg-slate-100 px-2.5 py-1 font-medium text-slate-600 transition hover:bg-slate-200"
            >
              查看来源 ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}