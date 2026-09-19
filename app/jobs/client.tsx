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
import SuburbFilterModal from "@/components/job/SuburbFilterModal";
import type { Job } from "@/types/job";

const JobCopilot = dynamic(() => import("@/components/chat/JobCopilot"), { ssr: false });

export default function JobsClient() {
  const sp = useSearchParams();
  const jobs = useJobStore((s) => s.jobs);
  const loading = useJobStore((s) => s.loading);
  const error = useJobStore((s) => s.error);
  const source = useJobStore((s) => s.source);
  const allowPR = useJobStore((s) => s.allowPR);
  const setJobs = useJobStore((s) => s.setJobs);
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
  // 城区可编辑：可移除某个城区，也可打开弹窗多选筛选
  const [suburbs, setSuburbs] = useState<string[]>(initSuburbs);
  const [suburbModalOpen, setSuburbModalOpen] = useState(false);

  // 移动端：AI 面板用底部抽屉承载；桌面端(≥1024px)用右侧栏。
  const [isDesktop, setIsDesktop] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const buildQuery = (opts: { allowPR?: boolean; kw?: string } = {}) => {
    const params = new URLSearchParams();
    if (initCityId) params.set("cityId", initCityId);
    else if (initCity) params.set("city", initCity);
    if (suburbs.length) params.set("suburbs", suburbs.join(","));
    if (opts.kw ?? appliedKeyword) params.set("keyword", opts.kw ?? appliedKeyword);
    params.set("allowPR", String(opts.allowPR ?? allowPR));
    return params.toString();
  };

  const load = async (opts: { allowPR?: boolean; kw?: string } = {}) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs?${buildQuery(opts)}`);
      const body = (await res.json()) as { ok?: boolean; data?: any; error?: string };
      if (!body.ok || !body.data) throw new Error(body.error ?? "拉取失败");
      setJobs(body.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "拉取职位失败");
    }
  };

  // 初始 + URL/城区变化时一次性加载全部职位
  useEffect(() => {
    load({ allowPR: allowPR });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initCity, initCityId, suburbs.join(",")]);

  const togglePR = () => {
    const next = !allowPR;
    setAllowPR(next);
    load({ allowPR: next, kw: appliedKeyword });
  };

  const doSearch = () => {
    setAppliedKeyword(keyword.trim());
    load({ kw: keyword.trim(), allowPR });
  };

  // 移除单个城区：直接编辑并刷新
  const removeSuburb = (name: string) => setSuburbs((prev) => prev.filter((s) => s !== name));

  // 弹窗确认：应用多选结果（空 = 全部城区）
  const applySuburbs = (selected: string[]) => {
    setSuburbs(selected);
    setSuburbModalOpen(false);
  };

  return (
    <>
    <div className="mx-auto grid max-w-6xl gap-4 px-3 py-6 sm:px-4 sm:py-8 lg:grid-cols-[1.55fr_1fr] lg:gap-6">
      {/* 左：结果列表 */}
      <section className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold text-slate-900">职位列表</h1>
          {source === "mock" ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">本地示例数据</span>
          ) : source === "yeeyi" ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">YEEYI 数据</span>
          ) : null}
          {initCity && <span className="text-sm text-slate-500">📍 {initCity}</span>}
          <div className="flex flex-wrap items-center gap-1.5">
            {suburbs.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700"
              >
                {s}
                <button
                  onClick={() => removeSuburb(s)}
                  className="text-sky-400 transition hover:text-rose-500"
                  aria-label={`移除城区 ${s}`}
                  title={`移除 ${s}`}
                >
                  ✕
                </button>
              </span>
            ))}
            {suburbs.length === 0 && <span className="text-sm text-slate-400">全部城区</span>}
            <button
              onClick={() => setSuburbModalOpen(true)}
              className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-500 transition hover:border-sky-300 hover:text-sky-600"
            >
              🗂 筛选城区{suburbs.length > 0 ? `（${suburbs.length}）` : ""}
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            placeholder="搜索职位 / 公司关键词"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-sky-400 sm:text-sm"
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
            <button onClick={() => load({ allowPR, kw: appliedKeyword })} className="mt-2 rounded-lg bg-rose-600 px-3 py-1 text-xs text-white">
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
      </section>

      {/* 桌面端：AI 筛选聊天侧栏（移动端改用底部抽屉唤起） */}
      {isDesktop && (
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <JobCopilot />
          </div>
        </aside>
      )}

      <SuburbFilterModal
        open={suburbModalOpen}
        cityName={initCity}
        cityId={initCityId || undefined}
        initialSelected={suburbs}
        onClose={() => setSuburbModalOpen(false)}
        onConfirm={applySuburbs}
      />
    </div>

      {/* 移动端：AI 助手悬浮按钮（点击唤起底部抽屉） */}
      {!isDesktop && (
        <button
          onClick={() => setMobileChatOpen(true)}
          className="fixed bottom-4 right-4 z-40 mb-safe flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition-transform active:scale-95 lg:hidden"
        >
          🤖 AI 筛选助手
        </button>
      )}

      {/* 移动端：AI 助手底部抽屉 */}
      {!isDesktop && mobileChatOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40 transition-opacity"
            onClick={() => setMobileChatOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl pb-safe-sub">
            <div className="flex shrink-0 items-center justify-between px-5 pt-2.5">
              <span className="mx-auto h-1 w-10 rounded-full bg-slate-300" />
              <button
                onClick={() => setMobileChatOpen(false)}
                className="absolute right-2 top-2 rounded-xl p-2.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="关闭 AI 助手"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 pt-1">
              <JobCopilot />
            </div>
          </div>
        </div>
      )}
    </>
  );
}