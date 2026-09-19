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

/* ---------------- suburb 坐标（城区域级，优先于邮编级） ---------------- */

export type Coord = { lat: number; lng: number };
export type CoordSource = "geonames" | "postcode" | "city";

/**
 * 从项目 data 目录读取一个 JSON 文件（带候选路径查找，缓存结果）。
 * 只在“能确定文件不存在”时才缓存空表，避免前一次读取失败导致永久空缓存。
 */
let dataJsonCache = new Map<string, unknown>();
function loadDataJson<T>(file: string): T | undefined {
  if (dataJsonCache.has(file)) return dataJsonCache.get(file) as T | undefined;
  const candidates = [
    process.cwd(),
    import.meta.dirname ? join(import.meta.dirname, "..") : "",
    join(import.meta.dirname ?? "", "..", ".."),
  ];
  for (const base of candidates) {
    if (!base) continue;
    try {
      const raw = readFileSync(join(base, "data", file), "utf-8");
      const parsed = JSON.parse(raw) as T;
      dataJsonCache.set(file, parsed);
      return parsed;
    } catch {
      /* 尝试下一个候选路径 */
    }
  }
  // 所有候选路径都失败：缓存 undefined，但仍允许下次重试（一旦文件被生成即可读到）。
  return undefined;
}

/**
 * 按 suburbId 的“城区域”坐标表（data/suburb-points.json，GeoNames 城区级）。
 * key = suburbId 字符串，value = { lat, lng }。这是最精确的一级。
 */
let suburbPointsCache: Map<string, { lat: number; lng: number; source: string }> | null = null;
export function loadSuburbPoints(): Map<string, { lat: number; lng: number; source: string }> {
  if (suburbPointsCache) return suburbPointsCache;
  const map = new Map<string, { lat: number; lng: number; source: string }>();
  const raw = loadDataJson<{ suburbs?: Record<string, Partial<Coord> & { source?: string }> }>("suburb-points.json");
  if (raw?.suburbs) {
    for (const [k, v] of Object.entries(raw.suburbs)) {
      if (v && typeof v.lat === "number" && typeof v.lng === "number")
        map.set(k, { lat: v.lat, lng: v.lng, source: v.source ?? "postcode" });
    }
  }
  suburbPointsCache = map;
  return map;
}

/**
 * 邮编中心点表（data/suburb-coords.json）。次精确一级，当作兜底。
 */
let coordMapCache: Map<string, Coord> | null = null;
export function loadCoordMap(): Map<string, Coord> {
  if (coordMapCache) return coordMapCache;
  const map = new Map<string, Coord>();
  const raw = loadDataJson<{ postcodes?: Record<string, Partial<Coord>> }>("suburb-coords.json");
  if (raw?.postcodes) {
    for (const [k, v] of Object.entries(raw.postcodes)) {
      if (v && typeof v.lat === "number" && typeof v.lng === "number") map.set(k, { lat: v.lat, lng: v.lng });
    }
  }
  coordMapCache = map;
  return map;
}

/**
 * 一批 YEEYI 特有、GeoNames 缺失的“城区占位名”（多是 CBD/市中心片区），
 * 手动整理其近似中心坐标。用于在「城区域级坐标缺失」时给出合理坐标，
 * 避免这些城区退回到“邮编级”而互相完全重合（距离全相同、排序错乱）。
 * key = `${name}|${state}`（精确匹配，避免跨城误配）。
 */
const CURATED_SUBURB_COORDS: Record<string, Coord> = {
  "Central Business District|NSW": { lat: -33.8688, lng: 151.2093 }, // 悉尼 CBD
  "Sydney City|NSW": { lat: -33.8688, lng: 151.2093 },
  "Sydney CBD|NSW": { lat: -33.8688, lng: 151.2093 },
  "Sydney South|NSW": { lat: -33.8785, lng: 151.207 }, // 悉尼市中心南侧
  "Parliament House|NSW": { lat: -33.8892, lng: 151.2154 }, // NSW 议会（Macquarie St）
  "Melbourne CBD|VIC": { lat: -37.8136, lng: 144.9631 },
  "Melbourne City|VIC": { lat: -37.8136, lng: 144.9631 },
  "Brisbane City|QLD": { lat: -27.4698, lng: 153.0251 },
  "Perth City|WA": { lat: -31.9523, lng: 115.8613 },
  "Adelaide CBD|SA": { lat: -34.9285, lng: 138.6007 },
};

/**
 * 取一个 suburb 的坐标，优先级：城区域级(GeoNames) > 手工整理占位名 > 邮编中心点 > 城市中心点。
 */
export function suburbCoord(
  suburb: { suburbId?: number | string; postCode?: string; name?: string; state?: string } = {},
  city?: SuburbCity,
): Coord {
  const sid = suburb.suburbId != null ? String(suburb.suburbId) : "";
  const point = sid ? loadSuburbPoints().get(sid) : undefined;
  // 1) GeoNames 城区级坐标最准，直接采用
  if (point?.source === "geonames") return { lat: point.lat, lng: point.lng };
  // 2) 手工整理的占位名坐标（GeoNames 缺失但常见的 CBD/市中心名）优先于邮编回退
  if (suburb.name && suburb.state) {
    const curated = CURATED_SUBURB_COORDS[`${suburb.name}|${suburb.state}`];
    if (curated) return curated;
  }
  // 3) 次精：GeoNames 缺失但已有坐标（邮编级来源）
  if (point) return { lat: point.lat, lng: point.lng };
  // 4) 邮编中心点兜底
  if (suburb.postCode) {
    const c = loadCoordMap().get(suburb.postCode);
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

  const scored = pool
    .map((s) => {
      // 优先城区域级坐标（GeoNames），其次邮编中心点，最后城市中心点 ——
      // 保证同一城市内不同城区有各自坐标，距离不再一律相同、排序不再退化为首字母序。
      const c = suburbCoord(s, city) ?? city?.center ?? { lat, lng };
      const d = haversine(lat, lng, c.lat, c.lng);
      return { s, c, d };
    })
    .filter((x) => Number.isFinite(x.d))
    .sort((a, b) => a.d - b.d);

  return scored.slice(0, limit).map(({ s, c, d }) => ({
    ...s,
    lat: c.lat,
    lng: c.lng,
    distKm: Math.round(d * 100) / 100,
  }));
}

/**
 * 按坐标返回「以圆心为中心、半径内」的城区，**无数量上限**（全部命中）。
 * 对给定城市（默认用最近城市）内的 suburb，用其坐标做距离计算，
 * 保留 distKm ≤ radiusKm 的所有城区，按距离升序。
 * @param opts.radiusKm 半径（km）。缺省则回退为就近 top-N（见 nearestSuburbs）。
 */
export function suburbsWithinRadius(
  lat: number,
  lng: number,
  opts: { cityId?: number; radiusKm?: number } = {},
): Array<Suburb & { lat: number; lng: number; distKm?: number }> {
  const radius = opts.radiusKm != null && opts.radiusKm > 0 ? opts.radiusKm : Infinity;
  const city = opts.cityId ? cityById(opts.cityId) : nearestCity(lat, lng);
  const pool = city?.suburbs ?? cities.flatMap((c) => c.suburbs);

  return pool
    .map((s) => {
      const c = suburbCoord(s, city) ?? city?.center ?? { lat, lng };
      const d = haversine(lat, lng, c.lat, c.lng);
      return { s, c, d };
    })
    .filter((x) => Number.isFinite(x.d) && x.d <= radius)
    .sort((a, b) => a.d - b.d)
    .map(({ s, c, d }) => ({
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