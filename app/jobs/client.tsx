/**
 * 职位列表页客户端逻辑（Prompt F 页面 + 状态串联）。
 * 读取 URL 的 city/suburbs/cityId → 拉取 /api/jobs → 展示卡片，默认过滤 PR；
 * 右侧为 AI 筛选聊天面板（Prompt G）。
 */
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useJobStore } from "@/store/jobStore";
import { useChatStore } from "@/store/chatStore";
import JobCard from "@/components/job/JobCard";
import type { Job } from "@/types/job";

const JobCopilot = dynamic(() => import("@/components/chat/JobCopilot"), { ssr: false });

export default function JobsClient() {
  const sp = useSearchParams();
  const jobs = useJobStore((s) => s.jobs);
  const total = useJobStore((s) => s.total);
  const page = useJobStore((s) => s.page);
  const loading = useJobStore((s) => s.loading);
  const error = useJobStore((s) => s.error);
  const source = useJobStore((s) => s.source);
  const allowPR = useJobStore((s) => s.allowPR);
  const setJobs = useJobStore((s) => s.setJobs);
  const appendJobs = useJobStore((s) => s.appendJobs);
  const setLoading = useJobStore((s) => s.setLoading);
  const setError = useJobStore((s) => s.setError);
  const setAllowPR = useJobStore((s) => s.setAllowPR);
  const addRec = useChatStore((s) => s.addRecommendation);

  // URL 初始化参数
  const initCity = sp.get("city") ?? "";
  const initSuburbs = (sp.get("suburbs") ?? "").split(",").filter(Boolean);
  const initCityId = sp.get("cityId") ?? "";

  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");

  const buildQuery = (pageNo: number, opts: { allowPR?: boolean; kw?: string } = {}) => {
    const params = new URLSearchParams();
    if (initCityId) params.set("cityId", initCityId);
    else if (initCity) params.set("city", initCity);
    if (initSuburbs.length) params.set("suburbs", initSuburbs.join(","));
    if (opts.kw ?? appliedKeyword) params.set("keyword", opts.kw ?? appliedKeyword);
    params.set("page", String(pageNo));
    params.set("pageSize", "20");
    params.set("allowPR", String(opts.allowPR ?? allowPR));
    return params.toString();
  };

  const load = async (pageNo: number, opts: { allowPR?: boolean; kw?: string } = {}) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs?${buildQuery(pageNo, opts)}`);
      const body = (await res.json()) as { ok?: boolean; data?: any; error?: string };
      if (!body.ok || !body.data) throw new Error(body.error ?? "拉取失败");
      if (pageNo === 1) setJobs(body.data);
      else appendJobs(body.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "拉取职位失败");
    }
  };

  // 初始 + URL 变化时加载第一页
  useEffect(() => {
    load(1, { allowPR: allowPR });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initCity, initCityId, initSuburbs.join(",")]);

  const togglePR = () => {
    const next = !allowPR;
    setAllowPR(next);
    load(1, { allowPR: next, kw: appliedKeyword });
  };

  const doSearch = () => {
    setAppliedKeyword(keyword.trim());
    load(1, { kw: keyword.trim(), allowPR });
  };

  const loadMore = () => load(page + 1, { allowPR, kw: appliedKeyword });

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1.55fr_1fr]">
      {/* 左：结果列表 */}
      <section>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold text-slate-900">职位列表</h1>
          {source === "mock" ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">本地示例数据</span>
          ) : source === "yeeyi" ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">YEEYI 数据</span>
          ) : null}
          {initCity && <span className="text-sm text-slate-500">📍 {initCity}</span>}
          {initSuburbs.length > 0 && (
            <span className="text-sm text-slate-500">城区：{initSuburbs.join("、")}</span>
          )}
        </div>

        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            placeholder="搜索职位 / 公司关键词"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-400"
          />
          <button
            onClick={doSearch}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            搜索
          </button>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={allowPR} onChange={togglePR} className="h-4 w-4 accent-sky-500" />
            包含要求 PR 的职位
          </label>
        </div>

        {/* 提示当前是否过滤 PR */}
        <p className="mb-3 text-xs text-slate-400">
          {allowPR ? "已开启「包含 PR」，将展示全部职位（含要求 PR）。" : "默认已过滤掉要求 PR 的职位。"}
        </p>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <p>{error}</p>
            <button onClick={() => load(1, { allowPR, kw: appliedKeyword })} className="mt-2 rounded-lg bg-rose-600 px-3 py-1 text-xs text-white">
              重试
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {jobs.length === 0 && !loading && !error && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
              暂无职位。换个城市/城区，或清空关键词后再试。
            </div>
          )}
          {jobs.map((j: Job) => (
            <JobCard key={j.id} job={j} onRecommend={(job) => addRec(job)} />
          ))}
        </div>

        {loading && <p className="mt-4 text-center text-sm text-slate-400">加载中…</p>}

        {!loading && jobs.length > 0 && jobs.length < total && (
          <div className="mt-6 text-center">
            <button
              onClick={loadMore}
              className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-600 transition hover:border-sky-300 hover:text-sky-600"
            >
              加载更多（已显示 {jobs.length}/{total}）
            </button>
          </div>
        )}
      </section>

      {/* 右：AI 筛选聊天 */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <JobCopilot />
        </div>
      </aside>
    </div>
  );
}