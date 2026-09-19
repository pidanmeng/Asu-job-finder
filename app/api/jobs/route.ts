/**
 * GET /api/jobs —— 职位查询服务端代理（Prompt F）。
 * 作用：
 *   - 接收 { city, cityId, suburbs, keyword, allowPR }
 *   - 把 城市名/suburb 名 解析成 YEEYI code（经 lib/geocode）
 *   - 服务端调 YEEYI getSectionList（规避跨域、保护鉴权），统一清洗为 Job[]
 *   - 一次性批量拉取全部职位并返回（不再按页分页下发）
 *   - 默认过滤 requiresPR=true 的职位（除非 allowPR=1）
 *   - YEEYI 不可用/被反爬时回退本地 mock
 */
import { NextRequest, NextResponse } from "next/server";
import { getSectionList, YEEYI_ENABLED } from "@/lib/yeeyi";
import { cleanJobs } from "@/lib/jobs";
import { findCityByKeyword, matchSuburbExactly, cityDisplayName } from "@/lib/geocode";
import { buildMockJobs } from "@/lib/mock";
import type { Job, JobsResponse } from "@/types/job";
import type { YeeyiThreadItem } from "@/types/yeeyi";
import type { ApiEnvelope } from "@/types/geo";

export const runtime = "nodejs";
export const maxDuration = 20;

/**
 * 批量拉取上限：YEEYI 单页约 20 条，翻页至多取 MAX_YEEYI_PAGES 页后合并、去重，一次性返回。
 * 上限用于避免外部接口慢/反爬导致超时；实际以拿到数据为准，结果不足一页即提前停止。
 */
const MAX_YEEYI_PAGES = 8;

async function fetchAllThreads(params: {
  cityFilter: string;
  suburbId: string;
}): Promise<YeeyiThreadItem[]> {
  const all: YeeyiThreadItem[] = [];
  const seen = new Set<string>();
  for (let nextPage = 1; nextPage <= MAX_YEEYI_PAGES; nextPage++) {
    const pageThreads = await getSectionList({
      cityFilter: params.cityFilter,
      suburbId: params.suburbId,
      nextPage,
    });
    let added = 0;
    for (const t of pageThreads) {
      if (!seen.has(String(t.tid))) {
        seen.add(String(t.tid));
        all.push(t);
        added++;
      }
    }
    // 已翻到底（返回空或与上页重复），提前结束
    if (pageThreads.length === 0 || added === 0) break;
  }
  return all;
}

function bool(v: string | null): boolean {
  return v === "1" || v === "true" || v === "yes";
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const cityIdRaw = sp.get("cityId");
  const cityRaw = sp.get("city") ?? "";
  const suburbsRaw = sp.get("suburbs") ?? "";
  const keyword = sp.get("keyword") ?? "";
  const allowPR = bool(sp.get("allowPR"));

  // 1) 解析城市 id
  let cityId: string | undefined = cityIdRaw ?? undefined;
  if (!cityId && cityRaw) cityId = String(findCityByKeyword(cityRaw)[0]?.id ?? "") || undefined;
  const cityName = cityId ? cityDisplayName(cityId) : cityRaw;
  const suburbs = suburbsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // 2) YEEYI 一次拉取全部（失败回退 mock）
  if (YEEYI_ENABLED) {
    try {
      // 多 suburb 限制：接口单次只能传一个 suburbId，故取第一个精确匹配的；其余在本地过滤
      let suburbId = "0";
      if (suburbs.length) {
        const allSuburbsIds = suburbs.map((s) => matchSuburbExactly(s, cityId ? Number(cityId) : undefined)?.suburbId ?? "0");
        suburbId = allSuburbsIds.join(",");
      }
      const threads = await fetchAllThreads({
        cityFilter: cityId && /^\d+$/.test(cityId) ? cityId : "0",
        suburbId,
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
      const res: JobsResponse = {
        jobs,
        total: jobs.length,
        source: "yeeyi",
      };
      return NextResponse.json<ApiEnvelope<JobsResponse>>({ ok: true, data: res });
    } catch (e) {
      console.warn("[jobs] YEEYI 拉取失败，回退 mock:", e instanceof Error ? e.message : e);
    }
  }

  // 3) Mock 兜底（一次性返回全部）
  const mockJobs = buildMockJobs({ cityId, cityName, keyword, allowPR });
  const res: JobsResponse = {
    jobs: mockJobs,
    total: mockJobs.length,
    source: "mock",
    error: "YEEYI 接口暂不可用，当前为本地示例数据",
  };
  return NextResponse.json<ApiEnvelope<JobsResponse>>({ ok: true, data: res });
}