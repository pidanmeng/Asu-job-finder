/**
 * DELETE /api/follow-locations/[id] —— 取消关注（Feature 2）。
 */
import { NextResponse } from "next/server";
import type { ApiEnvelope } from "@/types/geo";
import { removeFollowLocation, isTursoConfigured } from "@/lib/turso";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isTursoConfigured()) {
    return NextResponse.json<ApiEnvelope<never>>({
      ok: false,
      error: "Turso 未配置（需要 TURSO_DATABASE_URL 与 TURSO_AUTH_TOKEN）",
    });
  }
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json<ApiEnvelope<never>>({ ok: false, error: "缺少 id" }, { status: 400 });
  }
  const ok = await removeFollowLocation(id);
  return NextResponse.json<ApiEnvelope<boolean>>({ ok, data: ok });
}