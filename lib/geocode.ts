/**
 * “位置 → 城市/suburb” 匹配辅助库（Prompt C）。
 * 供下列场景复用：
 *   1) App E 位置解析：地图点选坐标/地名 → 城市 + 候选 suburb（可先做本地粗筛再给 LLM）；
 *   2) App F 职位筛选：把用户输入/解析出的城市与 suburb 映射到 YEEYI 的 cityId/suburbId；
 *   3) 前端下拉、热词、自动补全。
 *
 * 数据源：data/suburbs.json（由 scripts/gen-suburbs.mjs 从 YEEYI getCityAndSuburb 生成）。
 * suburb 无坐标，故“就近”判断以城市中心点距离 + 名称匹配为主，亦可供 LLM 参考。
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import dataset from "@/data/suburbs.json";
import type { Suburb, SuburbCity } from "@/types/suburb";

/** 全部城市（按 YEEYI 城市 id 排序）。 */
export const cities: SuburbCity[] = (dataset.cities as SuburbCity[]).slice();

/** 城市 id → 城市。 */
export function cityById(id: number | string): SuburbCity | undefined {
  const n = Number(id);
  return cities.find((c) => c.id === n);
}

/** 城市名（中/英/州）→ 城市。宽松匹配。 */
export function findCityByKeyword(keyword: string): SuburbCity[] {
  const kw = (keyword ?? "").trim().toLowerCase();
  if (!kw) return [];
  return cities.filter(
    (c) =>
      c.name.toLowerCase().includes(kw) ||
      c.nameEn.toLowerCase().includes(kw) ||
      c.state.toLowerCase() === kw ||
      c.state.toLowerCase().includes(kw),
  );
}

/** 城市名中文 → 城市（选第一个）。 */
export function findCityByName(name?: string | null): SuburbCity | undefined {
  if (!name) return undefined;
  return findCityByKeyword(name)[0];
}

/** 城区名 → 城区（可限制在某个城市，或全城）。模糊匹配前缀包含。 */
export function findSuburbsByKeyword(keyword: string, cityId?: number, limit = 10): SuburbCity["suburbs"] {
  const kw = (keyword ?? "").trim().toLowerCase();
  const pool = cityId ? cityById(cityId)?.suburbs ?? [] : cities.flatMap((c) => c.suburbs);
  if (!kw) return pool.slice(0, limit);
  return pool
    .filter((s) => s.name.toLowerCase().includes(kw) || s.postCode.includes(kw))
    .slice(0, limit);
}

/** 按 suburbId 查城区（全城）。 */
export function findSuburbById(suburbId: number): (SuburbCity & { suburb: SuburbCity["suburbs"][number] }) | undefined {
  for (const c of cities) {
    const s = c.suburbs.find((x) => x.suburbId === suburbId);
    if (s) return { ...c, suburb: s };
  }
  return undefined;
}

/** 城区名精确匹配（用于把筛选关键词映射回 suburbId）。 */
export function matchSuburbExactly(name: string, cityId?: number): SuburbCity["suburbs"][number] | undefined {
  const kw = name.trim().toLowerCase();
  const pool = cityId ? cityById(cityId)?.suburbs ?? [] : cities.flatMap((c) => c.suburbs);
  return pool.find((s) => s.name.toLowerCase() === kw);
}

/** 经纬度 → 最近城市（用城市中心点欧氏/球面近似）。没有坐标则回退名字。 */
export function nearestCity(lat: number, lng: number): SuburbCity | undefined {
  let best: SuburbCity | undefined;
  let bestDist = Infinity;
  for (const c of cities) {
    const ctr = c.center as { lat: number; lng: number } | undefined;
    if (!ctr) continue;
    const d = haversine(lat, lng, ctr.lat, ctr.lng);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* ---------------- suburb 坐标（邮编级近似） ---------------- */

export type Coord = { lat: number; lng: number };

/**
 * 加载 data/suburb-coords.json（邮编 -> 中心点）。文件不存在/未生成完时返回空表，
 * 上层回退到城市中心。结果缓存，只读一次。
 * 注：该文件由 scripts/enrich-suburb-coords.mjs 生成（OSM Nominatim 邮编级近似）。
 */
let coordMapCache: Map<string, Coord> | null = null;
export function loadCoordMap(): Map<string, Coord> {
  if (coordMapCache) return coordMapCache;
  const map = new Map<string, Coord>();
  const candidates = [process.cwd(), import.meta.dirname ? join(import.meta.dirname, "..") : ""];
  for (const base of candidates) {
    if (!base) continue;
    try {
      const raw = readFileSync(join(base, "data", "suburb-coords.json"), "utf-8");
      const postcodes = JSON.parse(raw).postcodes ?? {};
      for (const [k, v] of Object.entries(postcodes)) {
        const c = v as Partial<Coord>;
        if (c && typeof c.lat === "number" && typeof c.lng === "number") map.set(k, c as Coord);
      }
      break;
    } catch {
      /* 尝试下一个候选路径 */
    }
  }
  coordMapCache = map;
  return map;
}

/**
 * 取一个 suburb 的近似坐标：优先用其邮编中心点，否则用所在城市中心点。
 */
export function suburbCoord(suburb: { postCode?: string }, city?: SuburbCity): Coord {
  const map = loadCoordMap();
  if (suburb.postCode) {
    const c = map.get(suburb.postCode);
    if (c) return c;
  }
  return city?.center ?? { lat: -25.27, lng: 133.78 };
}

/**
 * 按坐标就近返回“物理上最近”的 suburb（Prompt D→E 的核心升级）。
 * 对给定城市（默认用最近城市）内的 suburb，按其坐标（邮编级近似）做距离排序。
 * 返回带 lat/lng 的城区，便于展示与后续定位。
 */
export function nearestSuburbs(
  lat: number,
  lng: number,
  opts: { cityId?: number; limit?: number } = {},
): Array<Suburb & { distKm?: number }> {
  const limit = opts.limit ?? 5;
  const city = opts.cityId ? cityById(opts.cityId) : nearestCity(lat, lng);
  const pool = city?.suburbs ?? cities.flatMap((c) => c.suburbs);
  const map = loadCoordMap();

  const scored = pool
    .map((s) => {
      const c = map.get(s.postCode) ?? city?.center ?? { lat, lng };
      const d = haversine(lat, lng, c.lat, c.lng);
      return { s, c, d };
    })
    .sort((a, b) => a.d - b.d);

  return scored.slice(0, limit).map(({ s, c, d }) => ({
    ...s,
    lat: c.lat,
    lng: c.lng,
    distKm: Math.round(d * 100) / 100,
  }));
}

/** 经纬度 -> 最近的单个 suburb（含坐标）。 */
export function nearestSuburb(
  lat: number,
  lng: number,
): (Suburb & { distKm?: number }) | undefined {
  return nearestSuburbs(lat, lng, { limit: 1 })[0];
}

/**
 * 构造一段“紧凑可喂给 LLM 的 suburb 上下文”。
 * 只挑指定城市（默认离给出坐标最近的城市）的 suburb，控制 token 量。
 * @param opts.limit 每城最多抄多少条城区名。
 */
export function buildSuburbContext(
  opts: { cityId?: number; lat?: number; lng?: number; limit?: number } = {},
): { city: SuburbCity; suburbs: SuburbCity["suburbs"] } {
  const limit = opts.limit ?? 120;
  let city = opts.cityId ? cityById(opts.cityId) : undefined;
  if (!city && opts.lat != null && opts.lng != null) city = nearestCity(opts.lat, opts.lng);
  const resolvedCity = city ?? cities[0]!;
  const suburbs = resolvedCity.suburbs.slice(0, limit);
  return { city: resolvedCity, suburbs };
}

/** 中文城市名（供展示）。 */
export function cityDisplayName(cityId: number | string): string {
  return cityById(cityId)?.name ?? String(cityId);
}

/** 把 YEEYI 城市 id 转成英文名（给 LLM/地图）。 */
export function cityEnName(cityId: number | string): string {
  return cityById(cityId)?.nameEn ?? "";
}