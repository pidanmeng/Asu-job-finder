/**
 * POST /api/resolve-location —— 位置解析（Prompt E）。
 * 入参：{ lat, lng, placeName? }
 * 流程：本地 suburb 粗筛（nearestCity + nearestSuburbs）→ 启发式就近匹配
 *       返回 { mainCity, suburbs[], confidence, reasoning }。不使用大模型。
 */
import { NextResponse } from "next/server";
import { nearestCity, nearestSuburbs } from "@/lib/geocode";
import type { ApiEnvelope, ResolveLocationRequest, ResolveLocationResult } from "@/types/geo";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  let payload: ResolveLocationRequest;
  try {
    payload = (await req.json()) as ResolveLocationRequest;
  } catch {
    return NextResponse.json<ApiEnvelope<never>>({ ok: false, error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const { lat, lng, placeName } = payload;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json<ApiEnvelope<never>>({ ok: false, error: "缺少有效的 lat/lng" }, { status: 400 });
  }

  // 1) 本地粗筛：先拿到最近的城市
  const nearby = nearestCity(lat, lng);
  if (!nearby) {
    return NextResponse.json<ApiEnvelope<never>>({ ok: false, error: "无法匹配到澳洲城市" }, { status: 422 });
  }

  // 2) 启发式：按坐标就近返回 suburb（邮编级近似）
  const nearbySuburbs = nearestSuburbs(lat, lng, { cityId: nearby.id, limit: 5 });
  const result: ResolveLocationResult = {
    mainCity: nearby.name,
    country: "Australia",
    suburbs: nearbySuburbs.map((s) => s.name),
    confidence: 0.6,
    reasoning: `已按坐标就近匹配到「${nearby.name}」的城区（${nearbySuburbs.map((s) => `${s.name}约${s.distKm ?? "?"}km`).join("、")}）。`,
    mode: "heuristic",
  };
  return NextResponse.json<ApiEnvelope<ResolveLocationResult>>({ ok: true, data: result });
}