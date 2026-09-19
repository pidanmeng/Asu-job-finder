/**
 * 首页 / 选址页（Prompt A 占位 → Prompt D/E 完整版）。
 * 主流程第 1~2 步：地图点选 → 解析位置 → 跳转职位搜索。
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useMapStore } from "@/store/mapStore";

// Leaflet 仅客户端加载
const LocationPicker = dynamic(() => import("@/components/map/LocationPicker"), {
  ssr: false,
  loading: () => <div className="flex h-[420px] items-center justify-center text-slate-400">加载地图…</div>,
});

/** 位置解析方式开关。默认关闭（自动解析），开启时使用大模型解析。 */
function ParseModeSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
      <span className="text-sm text-slate-600">
        <span className="font-medium text-slate-800">大模型解析城区</span>
        <span className="ml-1 text-xs text-slate-400">开启后使用 LLM 推断城市/城区</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={(e) => {
          e.preventDefault();
          onChange(!value);
        }}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          value ? "bg-emerald-500" : "bg-slate-300"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

export default function HomePage() {
  const router = useRouter();
  const picked = useMapStore((s) => s.picked);
  const resolved = useMapStore((s) => s.resolved);
  const resolving = useMapStore((s) => s.resolving);
  const resolveError = useMapStore((s) => s.resolveError);
  const [busy, setBusy] = useState(false);
  const [useLlm, setUseLlm] = useState(false);

  const resolve = async () => {
    if (!picked || resolving) return;
    useMapStore.setState({ resolving: true, resolveError: null });
    try {
      const res = await fetch("/api/resolve-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: picked.lat, lng: picked.lng, placeName: picked.placeName, useLlm }),
      });
      const body = (await res.json()) as { ok?: boolean; data?: any; error?: string };
      if (!body.ok || !body.data) throw new Error(body.error ?? "解析失败");
      useMapStore.getState().setResolved(body.data);
    } catch (e) {
      useMapStore.getState().setResolveError(e instanceof Error ? e.message : "解析失败");
    }
  };

  const goSearch = () => {
    if (!resolved) return;
    setBusy(true);
    const params = new URLSearchParams();
    params.set("city", resolved.mainCity);
    if (resolved.suburbs?.length) params.set("suburbs", resolved.suburbs.join(","));
    router.push(`/jobs?${params.toString()}`);
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:grid-cols-[1.4fr_1fr]">
      <section>
        <h1 className="text-2xl font-bold text-slate-900">在地图上选择你的位置</h1>
        <p className="mt-1 text-sm text-slate-500">
          点选一个澳洲位置，我们会解析出你所在的城市与城区，再为你搜索职位。
        </p>
        <div className="mt-4">
          <LocationPicker />
        </div>
      </section>

      <aside className="flex flex-col gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">① 你的位置</h2>
          {picked ? (
            <div className="mt-3 space-y-1 text-sm text-slate-600">
              <p>📍 {picked.placeName || "（未返回地名）"}</p>
              <p className="text-slate-400">
                坐标：{picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">尚未选点，请在地图上单击。</p>
          )}

          <ParseModeSwitch value={useLlm} onChange={setUseLlm} />

          <button
            onClick={resolve}
            disabled={!picked || resolving}
            className="mt-4 w-full rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {resolving ? "解析中…" : "② 解析所在城市/城区"}
          </button>
          {resolveError && <p className="mt-2 text-xs text-rose-500">{resolveError}</p>}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">② 解析结果</h2>
          {resolved ? (
            <div className="mt-3 space-y-2 text-sm">
              <p className="text-slate-700">
                主城市：<span className="font-semibold text-slate-900">{resolved.mainCity}</span>
                {typeof resolved.confidence === "number" && (
                  <span className="ml-2 text-xs text-slate-400">置信度 {(resolved.confidence * 100).toFixed(0)}%</span>
                )}
              </p>
              <p className="text-slate-600">
                候选城区：<span className="text-slate-800">{resolved.suburbs?.join("、") || "—"}</span>
              </p>
              <p className="text-xs text-slate-400">
                {resolved.mode === "llm"
                  ? "由大模型解析"
                  : useLlm
                    ? "大模型开关已开启但未配置 LLM key，已自动回退到启发式就近匹配"
                    : "自动解析（启发式就近匹配）"}
              </p>
              {resolved.reasoning && (
                <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-500">💬 {resolved.reasoning}</p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">点击上方「解析」后显示。</p>
          )}

          <button
            onClick={goSearch}
            disabled={!resolved || busy}
            className="mt-4 w-full rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "跳转中…" : "③ 搜索该区域职位（默认过滤 PR）"}
          </button>
        </div>
      </aside>
    </div>
  );
}