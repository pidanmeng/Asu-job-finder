/**
 * GET /api/jobs —— 职位查询服务端代理（Prompt F）。
 * 作用：
 *   - 接收 { city, cityId, suburbs, keyword, page, pageSize, allowPR }
 *   - 把 城市名/suburb 名 解析成 YEEYI code（经 lib/geocode）
 *   - 服务端调 YEEYI getSectionList（规避跨域、保护鉴权），统一清洗为 Job[]
 *   - 默认过滤 requiresPR=true 的职位（除非 allowPR=1）
 *   - YEEYI 不可用/被反爬时回退本地 mock
 */
import { NextRequest, NextResponse } from "next/server";
import { getSectionList, YEEYI_ENABLED } from "@/lib/yeeyi";
import { cleanJobs } from "@/lib/jobs";
import { findCityByKeyword, matchSuburbExactly, cityDisplayName } from "@/lib/geocode";
import { buildMockJobs, mockTotal } from "@/lib/mock";
import type { Job, JobsResponse } from "@/types/job";
import type { ApiEnvelope } from "@/types/geo";

export const runtime = "nodejs";
export const maxDuration = 20;

function bool(v: string | null): boolean {
  return v === "1" || v === "true" || v === "yes";
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const cityIdRaw = sp.get("cityId");
  const cityRaw = sp.get("city") ?? "";
  const suburbsRaw = sp.get("suburbs") ?? "";
  const keyword = sp.get("keyword") ?? "";
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(sp.get("pageSize")) || 20));
  const allowPR = bool(sp.get("allowPR"));

  // 1) 解析城市 id
  let cityId: string | undefined = cityIdRaw ?? undefined;
  if (!cityId && cityRaw) cityId = String(findCityByKeyword(cityRaw)[0]?.id ?? "") || undefined;
  const cityName = cityId ? cityDisplayName(cityId) : cityRaw;
  const suburbs = suburbsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // 2) YEEYI 拉取（失败回退 mock）
  if (YEEYI_ENABLED) {
    try {
      // 多 suburb 限制：接口单次只能传一个 suburbId，故取第一个精确匹配的；其余在本地过滤
      let suburbId = "0";
      if (suburbs.length) {
        const allSuburbsIds = suburbs.map((s) => matchSuburbExactly(s, cityId ? Number(cityId) : undefined)?.suburbId ?? "0");
        const allSuburbsIdsStr = allSuburbsIds.join(",");
        suburbId = allSuburbsIdsStr;
      }
      const threads = await getSectionList({
        cityFilter: cityId && /^\d+$/.test(cityId) ? cityId : "0",
        suburbId,
        nextPage: page,
      });
      let jobs = cleanJobs(threads, { allowPR, cityName });

      // 多 suburb 本地过滤
      if (suburbs.length) {
        jobs = jobs.filter((j) =>
          suburbs.some((s) => j.suburb.toLowerCase().includes(s.toLowerCase())),
        );
      }
      // 关键词本地过滤（该接口无服务端全文检索入参）
      if (keyword) {
        const kw = keyword.toLowerCase();
        jobs = jobs.filter(
          (j) => j.title.toLowerCase().includes(kw) || j.company.toLowerCase().includes(kw),
        );
      }
      const total = jobs.length;
      const sliced = jobs.slice((page - 1) * pageSize, page * pageSize);
      const res: JobsResponse = {
        jobs: sliced.length ? sliced : jobs,
        page,
        pageSize,
        total,
        source: "yeeyi",
      };
      return NextResponse.json<ApiEnvelope<JobsResponse>>({ ok: true, data: res });
    } catch (e) {
      console.warn("[jobs] YEEYI 拉取失败，回退 mock:", e instanceof Error ? e.message : e);
    }
  }

  // 3) Mock 兜底
  const mockJobs = buildMockJobs({
    cityId,
    cityName,
    keyword,
    allowPR,
    page,
    pageSize,
  });
  const res: JobsResponse = {
    jobs: mockJobs,
    page,
    pageSize,
    total: mockTotal(),
    source: "mock",
    error: "YEEYI 接口暂不可用，当前为本地示例数据",
  };
  return NextResponse.json<ApiEnvelope<JobsResponse>>({ ok: true, data: res });
}