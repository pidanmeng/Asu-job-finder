/**
 * GET /api/jobs/[tid] —— 爬取单个职位详情（来源网站 Next.js SSR 的 __NEXT_DATA__）。
 * 不再让前端直接跳转平台详情页，而是服务端 GET 来源网页 → 解析 __NEXT_DATA__ →
 * 返回结构化详情（含联系人电话等），前端以弹窗展示。
 */
import { NextResponse } from "next/server";
import type { ApiEnvelope } from "@/types/geo";
import type { JobDetail } from "@/types/jobDetail";
import { extractNextData, parseThreadDetail, emptyFallback } from "@/lib/threadDetail";
import { threadUrl } from "@/lib/yeeyi";

export const runtime = "nodejs";
export const maxDuration = 20;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

/** 从 YEEYI 帖子页抓取并解析详情；失败返回 ok:false 的兜底。 */
async function crawlDetail(tid: string): Promise<JobDetail> {
  const url = threadUrl(tid);
  const fallback = emptyFallback(tid, url);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "zh-CN,zh;q=0.9",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Referer: "https://www.yeeyi.com/",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return fallback;
    const html = await res.text();
    const nextData = extractNextData(html);
    if (!nextData) return fallback;
    const detail = parseThreadDetail(tid, nextData, url);
    return detail ?? fallback;
  } catch {
    return fallback;
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ tid: string }> }) {
  const params = await ctx.params;
  const tid = String(params.tid ?? "").trim();
  if (!/^\d+$/.test(tid)) {
    // 非纯数字（如 mock-xxx）没有可爬取的来源页
    return NextResponse.json<ApiEnvelope<JobDetail>>({
      ok: true,
      data: emptyFallback(tid, "#"),
    });
  }
  const detail = await crawlDetail(tid);
  return NextResponse.json<ApiEnvelope<JobDetail>>({ ok: true, data: detail });
}