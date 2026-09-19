/**
 * POST /api/resolve-location —— 位置解析（Prompt E）。
 * 入参：{ lat, lng, placeName?, radiusKm? }
 * 流程：本地 suburb 粗筛（nearestCity + 半径内城区）→ 启发式就近匹配
 *       radiusKm 有值：返回该半径圆内的**全部**城区（无数量上限，带坐标）；
 *       否则回退为就近 top-N。
 * 返回 { mainCity, suburbs[], confidence, reasoning }。不使用大模型。
 */
import { NextResponse } from "next/server";
import { nearestCity, nearestSuburbs, suburbsWithinRadius } from "@/lib/geocode";
import type { ApiEnvelope, ResolveLocationRequest, ResolveLocationResult, ResolvedSuburb } from "@/types/geo";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  let payload: ResolveLocationRequest;
  try {
    payload = (await req.json()) as ResolveLocationRequest;
  } catch {
    return NextResponse.json<ApiEnvelope<never>>({ ok: false, error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const { lat, lng, placeName, radiusKm } = payload;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json<ApiEnvelope<never>>({ ok: false, error: "缺少有效的 lat/lng" }, { status: 400 });
  }

  // 1) 本地粗筛：先拿到最近的城市
  const nearby = nearestCity(lat, lng);
  if (!nearby) {
    return NextResponse.json<ApiEnvelope<never>>({ ok: false, error: "无法匹配到澳洲城市" }, { status: 422 });
  }

  // 2) 启发式：半径内全部城区（无数量上限，带坐标）；未设半径则就近 top-N
  const hasRadius = typeof radiusKm === "number" && radiusKm > 0;
  const nearbySuburbs = hasRadius
    ? suburbsWithinRadius(lat, lng, { cityId: nearby.id, radiusKm })
    : nearestSuburbs(lat, lng, { cityId: nearby.id, limit: 5 });

  const suburbs: ResolvedSuburb[] = nearbySuburbs
    .map((s): ResolvedSuburb | null => {
      if (typeof s.lat !== "number" || typeof s.lng !== "number") return null;
      return { name: s.name, lat: s.lat, lng: s.lng, distKm: s.distKm };
    })
    .filter((s): s is ResolvedSuburb => s !== null);
  const scopeText = hasRadius
    ? `以坐标为中心、半径约${radiusKm}km`
    : "按坐标就近";
  const result: ResolveLocationResult = {
    mainCity: nearby.name,
    country: "Australia",
    suburbs,
    confidence: hasRadius ? 0.8 : 0.6,
    reasoning: `已${scopeText}匹配到「${nearby.name}」的 ${suburbs.length} 个城区（${suburbs.map((s) => `${s.name}约${s.distKm ?? "?"}km`).join("、")}）。`,
    mode: "heuristic",
  };
  return NextResponse.json<ApiEnvelope<ResolveLocationResult>>({ ok: true, data: result });
}