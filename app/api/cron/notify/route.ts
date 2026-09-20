/**
 * GET/POST /api/cron/notify —— 定时推送入口（Feature 3）。
 *
 * 由定时调度器触发：Vercel Cron（见 vercel.json，每小时调用一次）+ scripts/run-notify.ts（本地/自建调度）。
 * 端点内按「澳洲时间」判断当前是否处于 8/14/20 点时段，到点才真正拉取与发信，
 * 从而天然适配澳洲夏令时切换（无论调度器的 cron 用哪个时区）。
 * 鉴权：要求请求头 Authorization: Bearer <CRON_SECRET> 或 x-cron-secret 与 CRON_SECRET 一致。
 */
import { NextRequest, NextResponse } from "next/server";
import { runNotify } from "@/lib/notifier";

export const runtime = "nodejs";
export const maxDuration = 120;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const h =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    req.headers.get("x-cron-secret") ||
    req.nextUrl.searchParams.get("secret");
  return h === secret;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "未授权（缺少正确的 CRON_SECRET）" }, { status: 401 });
  }
  const force = ["1", "true", "yes"].includes((req.nextUrl.searchParams.get("force") ?? "").toLowerCase());
  try {
    const res = await runNotify({ force });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "推送失败" },
      { status: 500 },
    );
  }
}

export function GET(req: NextRequest) {
  return handle(req);
}
export function POST(req: NextRequest) {
  return handle(req);
}