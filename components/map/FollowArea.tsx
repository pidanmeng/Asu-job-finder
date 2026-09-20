"use client";

/**
 * 关注城区（Feature 2）—— 地图选点界面下方的「关注 + 卡片列表」。
 * 解析出 城市 + 城区 后，点「关注」把当前坐标覆盖的城市、城区、经纬度、半径一起持久化到 Turso；
 * 可为每组关注命名（默认取地图地点名/城市名）；点击关注卡片可把坐标/半径回填到地图重新解析。
 * 卡片列表最多 10 组。
 */
import { useCallback, useEffect, useState } from "react";
import type { ResolveLocationResult } from "@/types/geo";
import type { FollowLocation } from "@/types/follow";
import { useMapStore } from "@/store/mapStore";
import { formatTz } from "@/lib/time";

interface Props {
  resolved: ResolveLocationResult | null;
}

export default function FollowArea({ resolved }: Props) {
  const picked = useMapStore((s) => s.picked);
  const [follows, setFollows] = useState<FollowLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // 关注命名：默认取地图地点名 / 城市名，可手动修改
  const [label, setLabel] = useState("");

  // 默认命名跟随当前选点/解析结果（仅当用户未手工输入时自动填充）
  useEffect(() => {
    if (label) return;
    setLabel(picked?.placeName || resolved?.mainCity || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked?.placeName, resolved?.mainCity]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/follow-locations", { cache: "no-store" });
      const body = (await res.json()) as { ok?: boolean; data?: FollowLocation[]; error?: string };
      if (body.ok && body.data) {
        setFollows(body.data);
        setError(null);
      } else {
        setError(body.error ?? "获取关注列表失败");
      }
    } catch {
      setError("获取关注列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const handleFollow = async () => {
    if (!resolved || resolved.suburbs.length === 0) return;
    const name = label.trim() || picked?.placeName || resolved.mainCity;
    setAdding(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/follow-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mainCity: resolved.mainCity,
          suburbs: resolved.suburbs.map((s) => ({ name: s.name, lat: s.lat, lng: s.lng })),
          label: name,
          lat: picked?.lat,
          lng: picked?.lng,
          radiusKm: picked?.radiusKm,
          placeName: picked?.placeName ?? "",
        }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        data?: { follow: FollowLocation; duplicate: boolean };
        error?: string;
      };
      if (body.ok && body.data) {
        setNotice(body.data.duplicate ? "该城市与城区已在关注列表中。" : "已关注当前城市与城区。");
        await refresh();
      } else {
        setError(body.error ?? "关注失败");
      }
    } catch {
      setError("关注失败");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await fetch(`/api/follow-locations/${encodeURIComponent(id)}`, { method: "DELETE" });
      setFollows((prev) => prev.filter((f) => f.id !== id));
    } catch {
      setError("取消失败");
    }
  };

  /** 点击卡片：把该关注记录的坐标/半径回填到地图（setPicked 会触发自动重新解析）。 */
  const applyToMap = (f: FollowLocation) => {
    if (typeof f.lat !== "number" || typeof f.lng !== "number") return;
    useMapStore.getState().setPicked({
      lat: f.lat,
      lng: f.lng,
      radiusKm: f.radiusKm,
      placeName: f.placeName || f.mainCity,
      city: f.mainCity,
    });
    document.getElementById("map-area")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const canFollow = Boolean(resolved && resolved.suburbs.length > 0);

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">⭐ 关注城区</h3>
          <p className="text-xs text-slate-400">
            关注后可按澳洲时间定时推送最新岗位（8:00 / 14:00 / 20:00）；点卡片可回填到地图
          </p>
        </div>
        {follows.length > 0 && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            {follows.length} / 10 组
          </span>
        )}
      </div>

      {canFollow && (
        <div className="flex flex-col gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="为这组关注命名（默认取地图地点名）"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          />
          {picked && (
            <p className="text-[11px] text-slate-400">
              坐标 {picked.lat.toFixed(4)}, {picked.lng.toFixed(4)}
              {typeof picked.radiusKm === "number" ? ` · 半径 ${picked.radiusKm}km` : ""}
            </p>
          )}
        </div>
      )}

      <button
        onClick={handleFollow}
        disabled={!canFollow || adding}
        className="w-full rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {!canFollow
          ? "选点解析出城区后才能关注"
          : adding
            ? "正在关注…"
            : `❤ 关注「${label.trim() || (picked?.placeName ?? resolved!.mainCity)}」`}
      </button>

      {notice && <p className="text-xs text-emerald-600">✓ {notice}</p>}
      {error && <p className="text-xs text-rose-500">{error}</p>}
      {loading && <p className="text-xs text-slate-400">加载关注列表…</p>}

      {follows.length === 0 ? (
        !loading && (
          <p className="text-sm text-slate-400">
            还没有关注的城区。在地图上选点、解析出城区后点击上方「关注」。
          </p>
        )
      ) : (
        <ul className="flex flex-col gap-2">
          {follows.map((f) => (
            <li key={f.id} className="group relative rounded-xl border border-slate-200 bg-slate-50 p-3">
              {/* 整卡可点击回填地图 */}
              <button
                onClick={() => applyToMap(f)}
                className="w-full text-left"
                title={typeof f.lat === "number" ? "点击回填到地图" : "记录缺少坐标，无法回填"}
              >
                <p className="text-sm font-medium text-slate-800">
                  📍 {f.label || f.mainCity}
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    {f.mainCity} · {f.suburbs.length} 个城区
                    {typeof f.radiusKm === "number" && ` · ${f.radiusKm}km`}
                  </span>
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                  {f.suburbs.map((s) => s.name).join("、")}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">关注于 {formatTz(f.createdAt)}</p>
              </button>
              <button
                onClick={() => handleRemove(f.id)}
                className="absolute right-2 top-2 rounded-lg px-1.5 py-0.5 text-xs text-slate-400 transition hover:bg-slate-100 hover:text-rose-500"
                aria-label={`取消关注 ${f.label || f.mainCity}`}
                title="取消关注"
              >
                取消
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}