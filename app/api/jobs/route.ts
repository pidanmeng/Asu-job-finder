/**
 * GET /api/jobs —— 职位查询服务端代理（Prompt F）。
 * 作用：
 *   - 接收 { city, cityId, suburbs, keyword, allowPR, page }
 *   - 把 城市名/suburb 名 解析成 YEEYI code（经 lib/geocode）
 *   - 服务端调 YEEYI getSectionList（规避跨域、保护鉴权），统一清洗为 Job[]
 *   - 分页抓取：每一次请求只拉取当前页（page），前端滚动到底部再请求下一页
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

/** YEEYI 单页约 20 条（分页的基准大小，mock 亦按此切片）。 */
const YEEYI_PAGE_SIZE = 20;
/** 翻页安全上限：防止外部接口异常导致无限翻页；达到上限即视为已到底。 */
const MAX_YEEYI_PAGES = 8;

/** 把 page 入参解析到 [1, MAX_YEEYI_PAGES]，非法值回退为 1。 */
function clampPage(raw: string | null): number {
  const n = parseInt(raw ?? "1", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_YEEYI_PAGES);
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
  const page = clampPage(sp.get("page"));

  // 1) 解析城市 id
  let cityId: string | undefined = cityIdRaw ?? undefined;
  if (!cityId && cityRaw) cityId = String(findCityByKeyword(cityRaw)[0]?.id ?? "") || undefined;
  const cityName = cityId ? cityDisplayName(cityId) : cityRaw;
  const suburbs = suburbsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // 多 suburb 限制：接口单次只能传一个 suburbId，故取第一个精确匹配的；其余在本地过滤
  let suburbId = "0";
  if (suburbs.length) {
    const allSuburbsIds = suburbs.map((s) => matchSuburbExactly(s, cityId ? Number(cityId) : undefined)?.suburbId ?? "0");
    suburbId = allSuburbsIds.join(",");
  }

  // 2) YEEYI 按页拉取（失败回退 mock）
  if (YEEYI_ENABLED) {
    try {
      const raw: YeeyiThreadItem[] = await getSectionList({
        cityFilter: cityId && /^\d+$/.test(cityId) ? cityId : "0",
        suburbId,
        nextPage: page,
      });
      // hasMore 以原始帖子的数量为准（过滤可能把整页职位滤光，但仍有后续页）
      const hasMore = raw.length > 0 && page < MAX_YEEYI_PAGES;
      let jobs = cleanJobs(raw, { allowPR, cityName });

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
        page,
        hasMore,
        source: "yeeyi",
      };
      return NextResponse.json<ApiEnvelope<JobsResponse>>({ ok: true, data: res });
    } catch (e) {
      console.warn("[jobs] YEEYI 拉取失败，回退 mock:", e instanceof Error ? e.message : e);
    }
  }

  // 3) Mock 兜底（同样按页切片）
  const mockAll = buildMockJobs({ cityId, cityName, keyword, allowPR });
  const start = (page - 1) * YEEYI_PAGE_SIZE;
  const res: JobsResponse = {
    jobs: mockAll.slice(start, start + YEEYI_PAGE_SIZE),
    total: mockAll.length,
    page,
    hasMore: start + YEEYI_PAGE_SIZE < mockAll.length,
    source: "mock",
    error: "YEEYI 接口暂不可用，当前为本地示例数据",
  };
  return NextResponse.json<ApiEnvelope<JobsResponse>>({ ok: true, data: res });
}