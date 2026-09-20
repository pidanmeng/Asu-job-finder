/**
 * 首页 / 选址页（Prompt A 占位 → Prompt D/E 完整版）。
 * 主流程第 1~2 步：地图点选 → 解析位置（选点改变时自动） → 跳转职位搜索。
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useMapStore } from '@/store/mapStore';
import FollowArea from '@/components/map/FollowArea';

// Leaflet 仅客户端加载
const LocationPicker = dynamic(
  () => import('@/components/map/LocationPicker'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] items-center justify-center text-slate-400">
        加载地图…
      </div>
    ),
  },
);

export default function HomePage() {
  const router = useRouter();
  const picked = useMapStore((s) => s.picked);
  const resolved = useMapStore((s) => s.resolved);
  const highlightSuburbName = useMapStore((s) => s.highlightSuburbName);
  const setHighlightSuburbName = useMapStore((s) => s.setHighlightSuburbName);
  const resetHighlightSuburbName = useMapStore(
    (s) => s.resetHighlightSuburbName,
  );
  const resolving = useMapStore((s) => s.resolving);
  const resolveError = useMapStore((s) => s.resolveError);
  const [busy, setBusy] = useState(false);

  /** 解析当前位置 → { mainCity, suburbs }（始终走启发式就近匹配，不使用大模型）。 */
  const resolve = useCallback(async () => {
    const cur = useMapStore.getState().picked;
    if (!cur || useMapStore.getState().resolving) return;
    useMapStore.setState({ resolving: true, resolveError: null });
    try {
      const res = await fetch('/api/resolve-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: cur.lat,
          lng: cur.lng,
          placeName: cur.placeName,
          radiusKm: cur.radiusKm,
        }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        data?: any;
        error?: string;
      };
      if (!body.ok || !body.data) throw new Error(body.error ?? '解析失败');
      useMapStore.getState().setResolved(body.data);
    } catch (e) {
      useMapStore
        .getState()
        .setResolveError(e instanceof Error ? e.message : '解析失败');
    }
  }, []);

  // 每次选点改变时自动筛选城区（选点后无需手动点击解析按钮）
  useEffect(() => {
    if (picked) resolve();
  }, [picked, resolve]);

  const goSearch = () => {
    if (!resolved) return;
    setBusy(true);
    const params = new URLSearchParams();
    params.set('city', resolved.mainCity);
    if (resolved.suburbs?.length)
      params.set('suburbs', resolved.suburbs.map((s) => s.name).join(','));
    router.push(`/jobs?${params.toString()}`);
  };

  return (
    <div className="mx-auto flex flex-col-reverse max-w-6xl gap-4 px-3 py-6 sm:px-4 sm:py-8 md:flex-row md:gap-6">
      <section id="map-area">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          在地图上选择你的位置
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          点选一个澳洲位置，我们会自动解析出你所在的城市与城区，再为你搜索职位。
        </p>
        <div className="mt-4">
          <LocationPicker />
        </div>
        <FollowArea resolved={resolved} />
      </section>

      <aside className="flex flex-col gap-4 md:w-1/2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">
            城区筛选结果
          </h2>
          {resolving ? (
            <p className="mt-3 text-sm text-slate-400">正在自动筛选城区…</p>
          ) : resolved ? (
            <div className="mt-3 space-y-2 text-sm">
              <p className="text-slate-700">
                主城市：
                <span className="font-semibold text-slate-900">
                  {resolved.mainCity}
                </span>
                {typeof resolved.confidence === 'number' && (
                  <span className="ml-2 text-xs text-slate-400">
                    置信度 {(resolved.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </p>
              <p>
                候选城区：
              </p>

              <p className="text-slate-600 whitespace-nowrap overflow-x-auto md:whitespace-normal md:overflow-auto">
                {resolved.suburbs
                  ?.map((s) => s.name)
                  .map((n) => (
                    <span
                      key={n}
                      className={['mt-1', 'inline-block', 'whitespace-nowrap', 'rounded-md', 'cursor-pointer', 'bg-blue-50 text-blue-600 mr-2 px-2', highlightSuburbName === n ? 'font-bold' : ''].join(' ')}
                      onMouseEnter={() => setHighlightSuburbName(n)}
                      onMouseLeave={() => resetHighlightSuburbName()}
                    >
                      {n}
                    </span>
                  )) || '—'}
              </p>
              {/* {resolved.reasoning && (
                <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-500">
                  💬 {resolved.reasoning}
                </p>
              )} */}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">
              选点后自动显示城区筛选结果。
            </p>
          )}

          {resolveError && (
            <p className="mt-2 text-xs text-rose-500">{resolveError}</p>
          )}

          <button
            onClick={goSearch}
            disabled={resolving || !resolved || busy}
            className="mt-4 w-full rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {resolving
              ? '正在筛选城区…'
              : busy
                ? '跳转中…'
                : '搜索该区域职位（默认过滤 PR）'}
          </button>
        </div>
      </aside>
    </div>
  );
}
