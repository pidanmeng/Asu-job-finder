/**
 * /api/follow-locations —— 关注城区（Feature 2）的服务端接口。
 * GET  列出已关注的城区（最多 10 组，按创建时间倒序）
 * POST 新增关注；返回是否重复；超过 10 组或未配置 Turso 时返回错误。
 * 该接口在服务端调用 lib/turso（存取 Turso），不向前端暴露数据库凭据。
 */
import { NextResponse } from "next/server";
import type { ApiEnvelope } from "@/types/geo";
import type { FollowLocation } from "@/types/follow";
import {
  listFollowLocations,
  addFollowLocation,
  isTursoConfigured,
} from "@/lib/turso";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  if (!isTursoConfigured()) {
    return NextResponse.json<ApiEnvelope<FollowLocation[]>>({
      ok: false,
      error: "Turso 未配置（需要 TURSO_DATABASE_URL 与 TURSO_AUTH_TOKEN）",
    });
  }
  const data = await listFollowLocations();
  return NextResponse.json<ApiEnvelope<FollowLocation[]>>({ ok: true, data });
}

export async function POST(req: Request) {
  if (!isTursoConfigured()) {
    return NextResponse.json<ApiEnvelope<never>>({
      ok: false,
      error: "Turso 未配置（需要 TURSO_DATABASE_URL 与 TURSO_AUTH_TOKEN）",
    });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiEnvelope<never>>({ ok: false, error: "请求体不是合法 JSON" }, { status: 400 });
  }
  const { mainCity, suburbs, label, lat, lng, radiusKm, placeName } = (body ?? {}) as {
    mainCity?: string;
    suburbs?: FollowLocation["suburbs"];
    label?: string;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    placeName?: string;
  };
  const result = await addFollowLocation({
    mainCity: mainCity ?? "",
    suburbs: suburbs ?? [],
    label,
    lat,
    lng,
    radiusKm,
    placeName,
  });
  if (!result.ok) {
    return NextResponse.json<ApiEnvelope<never>>({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json<ApiEnvelope<{ follow: FollowLocation; duplicate: boolean }>>({
    ok: true,
    data: { follow: result.follow, duplicate: result.duplicate },
  });
}