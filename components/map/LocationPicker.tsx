/**
 * 地图选址组件（Prompt D）。
 * 方案选型：Leaflet + OpenStreetMap。
 *   - 理由：免费、无需 API key、澳洲覆盖完整；保证“无 key 也能正常渲染”的降级要求。
 *   - 反向地理编码用 OSM Nominatim（免费）；失败时仅留坐标、placeName 为空，不影响主流程。
 * 交互：以澳洲为中心 → 单击点位落标记 → 反向地理编码出可读地名 → 写入 mapStore。
 * 由于 Leaflet 依赖浏览器 DOM，这里用客户端组件 + 动态 import（规避 Next 服务端渲染报错）。
 */
"use client";

import { useEffect, useRef, useState } from "react";
import type * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useMapStore } from "@/store/mapStore";

const AUSTRALIA = { lat: -25.27, lng: 133.78, zoom: 4 };

/** 用 Emoji 文本标记替代 Leaflet 默认图片图标（marker-icon.png / marker-shadow.png）。 */
function buildEmojiIcon(L: typeof import("leaflet")): L.DivIcon {
  return L.divIcon({
    html: '<span style="font-size:30px;line-height:1;filter:drop-shadow(0 2px 2px rgba(0,0,0,.4))">📍</span>',
    className: "", // 清空 Leaflet 默认 divIcon 样式，避免额外背景
    iconSize: [30, 30],
    iconAnchor: [15, 30], // 尖端指向坐标点
  });
}

export default function LocationPicker() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const picked = useMapStore((s) => s.picked);
  const setPicked = useMapStore((s) => s.setPicked);

  useEffect(() => {
    let map: L.Map | null = null;
    let marker: L.Marker | null = null;

    let cancelled = false;
    (async () => {
      if (!containerRef.current) return;
      const L = await import("leaflet");
      if (cancelled) return;

      map = L.map(containerRef.current, { zoomControl: true }).setView(
        [AUSTRALIA.lat, AUSTRALIA.lng],
        AUSTRALIA.zoom,
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);

      // 若已有选点（来自 store），先落标记（Emoji 图标）
      const prev = useMapStore.getState().picked;
      if (prev) {
        marker = L.marker([prev.lat, prev.lng], { icon: buildEmojiIcon(L) }).addTo(map);
      }

      map.on("click", async (e: L.LeafletMouseEvent) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        if (marker) marker.setLatLng([lat, lng]);
        else marker = L.marker([lat, lng], { icon: buildEmojiIcon(L) }).addTo(map!);
        map!.setView([lat, lng], Math.max(map!.getZoom(), 11));

        // 反向地理编码（尽力而为）
        let placeName: string | undefined;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=zh,en&zoom=14`,
            { headers: { "User-Agent": "aus-job-search/1.0" }, signal: AbortSignal.timeout(8000) },
          );
          const d = (await res.json()) as { display_name?: string; address?: { city?: string; town?: string; state?: string } };
          placeName = d.display_name ?? "";
          const cityName = (d.address && (d.address.city ?? d.address.town ?? d.address.state)) || "";
          setPicked({ lat, lng, placeName: placeName || undefined, city: cityName });
        } catch {
          setPicked({ lat, lng });
        }
      });

      setReady(true);
    })();

    return () => {
      cancelled = true;
      if (map) map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={containerRef}
        className="h-[280px] w-full overflow-hidden rounded-xl border border-slate-200 shadow-sm sm:h-[420px]"
        style={{ background: "#e4ecef" }}
      />
      <div className="text-xs text-slate-500">
        {!ready && "正在加载地图…"}
        {picked ? (
          <>
            已选：<span className="font-medium text-slate-800">{picked.placeName || `坐标 ${picked.lat.toFixed(4)}, ${picked.lng.toFixed(4)}`}</span>
            <span className="ml-2 text-slate-400">({picked.lat.toFixed(4)}, {picked.lng.toFixed(4)})</span>
          </>
        ) : (
          "点击地图选择一个澳洲位置"
        )}
      </div>
    </div>
  );
}