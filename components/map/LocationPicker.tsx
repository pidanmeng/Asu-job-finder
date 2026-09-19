/**
 * 地图选址组件（Prompt D）。
 * 方案选型：Leaflet + OpenStreetMap。
 *   - 理由：免费、无需 API key、澳洲覆盖完整；保证“无 key 也能正常渲染”的降级要求。
 *   - 反向地理编码用 OSM Nominatim（免费）；失败时仅留坐标、placeName 为空，不影响主流程。
 * 交互：
 *   1) 单击圆心落标记（Emoji 图标）→ 反向地理编码出可读地名 → 写入 mapStore；
 *   2) 以圆心为圆心、radiusKm 为半径画圆（L.circle）；
 *   3) 每次解析结果更新后，把半径圆内的城区以 POI 点标在地图上；
 *   4) 半径滑块实时改半径并触发重新解析。
 * 保持「单点 + 半径」的数据模型，避开多边形绘制及其多边形-面匹配复杂度。
 * 由于 Leaflet 依赖浏览器 DOM，这里用客户端组件 + 动态 import（规避 Next 服务端渲染报错）。
 */
"use client";

import { useEffect, useRef, useState } from "react";
import type * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useMapStore } from "@/store/mapStore";

const AUSTRALIA = { lat: -25.27, lng: 133.78, zoom: 4 };
const DEFAULT_RADIUS_KM = 10; // 默认圆形选区半径

/** 用 Emoji 文本标记替代 Leaflet 默认图片图标（marker-icon.png / marker-shadow.png）。 */
function buildEmojiIcon(L: typeof import("leaflet")): L.DivIcon {
  return L.divIcon({
    html: '<span style="font-size:30px;line-height:1;filter:drop-shadow(0 2px 2px rgba(0,0,0,.4));margin-left:-6px">📍</span>',
    className: "", // 清空 Leaflet 默认 divIcon 样式，避免额外背景
    iconSize: [30, 30],
    iconAnchor: [15, 30], // 尖端指向坐标点
  });
}

/** 城区 POI 的圆点图标（带城区名 Tooltip）。 */
function buildPoiIcon(L: typeof import("leaflet")): L.DivIcon {
  return L.divIcon({
    html: '<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#0ea5e9;border:2px solid #fff;box-shadow:0 0 2px rgba(0,0,0,.5);"></span>',
    className: "",
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

export default function LocationPicker() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const centerMarkerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const poiLayerRef = useRef<L.LayerGroup | null>(null);
  const radiusRef = useRef<number>(DEFAULT_RADIUS_KM);

  const [ready, setReady] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_RADIUS_KM);

  const picked = useMapStore((s) => s.picked);
  const setPicked = useMapStore((s) => s.setPicked);
  const resolved = useMapStore((s) => s.resolved);

  // 初始化地图 + 单击事件（只负责落点写 store，marker/圆/POI 由下面 effect 统一渲染）
  useEffect(() => {
    let map: L.Map | null = null;
    let cancelled = false;
    (async () => {
      if (!containerRef.current) return;
      const L = await import("leaflet");
      if (cancelled) return;
      leafletRef.current = L;

      map = L.map(containerRef.current, { zoomControl: true }).setView(
        [AUSTRALIA.lat, AUSTRALIA.lng],
        AUSTRALIA.zoom,
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);

      poiLayerRef.current = L.layerGroup().addTo(map);

      map.on("click", async (e: L.LeafletMouseEvent) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
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
          setPicked({ lat, lng, placeName: placeName || undefined, city: cityName, radiusKm: radiusRef.current });
        } catch {
          setPicked({ lat, lng, radiusKm: radiusRef.current });
        }
      });

      mapRef.current = map;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      if (map) map.remove();
    };
  }, [setPicked]);

  // 圆心 marker
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !ready) return;
    if (!picked) {
      if (centerMarkerRef.current) {
        centerMarkerRef.current.remove();
        centerMarkerRef.current = null;
      }
      return;
    }
    if (centerMarkerRef.current) {
      centerMarkerRef.current.setLatLng([picked.lat, picked.lng]);
    } else {
      centerMarkerRef.current = L.marker([picked.lat, picked.lng], { icon: buildEmojiIcon(L) }).addTo(map);
    }
  }, [picked, ready]);

  // 圆形选区（半径实时变化）
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !ready) return;
    if (!picked) {
      if (circleRef.current) {
        circleRef.current.remove();
        circleRef.current = null;
      }
      return;
    }
    const radiusMeters = radiusKm * 1000;
    if (circleRef.current) {
      circleRef.current.setLatLng([picked.lat, picked.lng]).setRadius(radiusMeters);
    } else {
      circleRef.current = L.circle([picked.lat, picked.lng], {
        radius: radiusMeters,
        color: "#0ea5e9",
        weight: 2,
        fillColor: "#0ea5e9",
        fillOpacity: 0.12,
      }).addTo(map);
    }
  }, [picked, radiusKm, ready]);

  // 半径圆内城区的 POI 点
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !ready) return;
    const layer = poiLayerRef.current ?? (poiLayerRef.current = L.layerGroup().addTo(map));
    layer.clearLayers();
    (resolved?.suburbs ?? []).forEach((s) => {
      if (typeof s.lat !== "number" || typeof s.lng !== "number") return;
      L.marker([s.lat, s.lng], { icon: buildPoiIcon(L) })
        .bindTooltip(`${s.name}${s.distKm != null ? ` · ${s.distKm}km` : ""}`, {
          direction: "top",
          offset: [0, -6],
        })
        .addTo(layer);
    });
  }, [resolved, ready]);

  const handleRadiusChange = (v: number) => {
    radiusRef.current = v;
    setRadiusKm(v);
    // 把新半径写回 store，触发 page 里“选点变化自动重新解析”
    const cur = useMapStore.getState().picked;
    if (cur) useMapStore.getState().setPicked({ ...cur, radiusKm: v });
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={containerRef}
        className="h-[280px] w-full overflow-hidden rounded-xl border border-slate-200 shadow-sm sm:h-[380px]"
        style={{ background: "#e4ecef" }}
      />
      {picked && (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
          <span className="shrink-0 font-medium text-slate-800">半径 {radiusKm} km</span>
          <input
            type="range"
            min={0.5}
            max={10}
            step={0.5}
            value={radiusKm}
            onChange={(e) => handleRadiusChange(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer accent-sky-500"
            aria-label="圆形选区半径（km）"
          />
          <span className="shrink-0 text-slate-400">圆圈内全部城区</span>
        </div>
      )}
      <div className="text-xs text-slate-500">
        {!ready && "正在加载地图…"}
        {picked ? (
          <>
            已选：<span className="font-medium text-slate-800">{picked.placeName || `坐标 ${picked.lat.toFixed(4)}, ${picked.lng.toFixed(4)}`}</span>
            <span className="ml-2 text-slate-400">({picked.lat.toFixed(4)}, {picked.lng.toFixed(4)})</span>
            <span className="ml-2 text-sky-600">· 半径 {radiusKm}km 内 {resolved?.suburbs?.length ?? 0} 个城区</span>
          </>
        ) : (
          "点击地图选择圆心位置，将画出搜索半径并标出范围内的城区"
        )}
      </div>
    </div>
  );
}