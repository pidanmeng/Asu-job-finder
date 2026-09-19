/**
 * YEEYI(亿忆 / yeeyi.com) 求职接口客户端。
 * 依据 docs/yeeyi-api.md（由抓包逆向得出）封装。仅用于服务端（安全 + 规避跨域）。
 *
 * 全部 5 个接口均为 POST + application/json（无 body 的调用也传 {}）。
 * 除非登录（authcode），否则无需鉴权即可低频访问。
 */

import type {
  YeeyiCityAndSuburb,
  YeeyiEnvelope,
  YeeyiNavigatorCity,
  YeeyiPositionCategory,
  YeeyiThreadItem,
} from "@/types/yeeyi";

const BASE = "https://www.yeeyi.com";

/** 求职招聘频道 fid（Prompt B 抓包中看到 161）。 */
export const YEEYI_FID = process.env.YEEYI_FID ?? "161";

/** 是否启用真实 YEEYI（false 时上层走 mock）。 */
export const YEEYI_ENABLED =
  (process.env.YEEYI_ENABLED ?? "true").toLowerCase() !== "false";

/** 国家代码：澳大利亚。 */
export const YEEYI_COUNTRY = "13";
/** 获取城市&城区时使用的国家 code（AUS）。 */
export const YEEYI_COUNTRY_CODE = "AUS";

/** 生成一个稳定的匿名 devid（接口接受任意字符串，形如 uuid|pc）。 */
export function defaultDevid(): string {
  if (process.env.YEEYI_DEVID) return process.env.YEEYI_DEVID;
  // 服务端进程内稳定生成，避免每次请求变化
  const g = (globalThis as { __yeeDevid?: string });
  if (!g.__yeeDevid) {
    g.__yeeDevid =
      `dsh-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}|pc`;
  }
  return g.__yeeDevid;
}

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    Referer: "https://www.yeeyi.com/",
    Origin: "https://www.yeeyi.com",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9",
  };
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`YEEYI ${path} HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export interface SectionListParams {
  /** 频道 id。 */
  fid?: string;
  /** 页码（从 1 起）。 */
  nextPage?: number;
  /** 起始时间戳（Unix 秒，用于翻页锚点；0/首屏可传大值）。 */
  start?: string | number;
  /** 城市 filter（YEEYI 城市 id）。 */
  cityFilter?: string | number;
  /** 是否按附近城区（nearBy=1）。 */
  nearBy?: string | number;
  /** 城区 id（0 表示不限）。 */
  suburbId?: string | number;
  /** 国家 filter（13 = AUS）。 */
  countryFilter?: string | number;
  /** 职位分类 id（可选，来自 getPositionList）。 */
  positionId?: string | number;
  /** 登录鉴权（无则 null）。 */
  authcode?: string | null;
}

/**
 * 求职招聘帖子列表（核心接口）。
 * 入参除上述字段外，还可通过 positionId 过滤职位分类。
 */
export async function getSectionList(
  params: SectionListParams = {},
): Promise<YeeyiThreadItem[]> {
  const { fid, nextPage, start, cityFilter, nearBy, suburbId, positionId, countryFilter, authcode } =
    params;
  const body: Record<string, unknown> = {
    fid: fid ?? YEEYI_FID,
    nextPage: nextPage ?? 1,
    start: start ?? "0",
    cityFilter: cityFilter ?? "0",
    nearBy: nearBy ?? "1",
    suburbId: suburbId ?? 0,
    devid: defaultDevid(),
    authcode: authcode ?? null,
    countryFilter: countryFilter ?? YEEYI_COUNTRY,
  };
  // 兼容：单独职位分类过滤
  if (positionId) body["positionId"] = positionId;
  console.log("YEEYI getSectionList 请求参数:", body);

  const env = await post<YeeyiEnvelope<YeeyiThreadItem[]>>("/api/getSectionList/", body);
  if (env.status !== 0) {
    throw new Error(`YEEYI getSectionList 失败 status=${env.status} ${env.message ?? ""}`);
  }
  return env.threadlist ?? [];
}

/** 职位/职业分类树（getPositionList）。 */
export async function getPositionList(cityFilter: string | number = "0"): Promise<YeeyiPositionCategory[]> {
  const env = await post<YeeyiEnvelope<{ position: YeeyiPositionCategory[] }>>(
    "/api/getPositionList/",
    { cityFilter: String(cityFilter), devid: defaultDevid() },
  );
  return env.data?.position ?? [];
}

/** 城市 + 城区（getCityAndSuburb）。country 传 AUS。 */
export async function getCityAndSuburb(country = YEEYI_COUNTRY_CODE): Promise<YeeyiCityAndSuburb> {
  const env = await post<YeeyiEnvelope<YeeyiCityAndSuburb>>("/api/getCityAndSuburb/", {
    cityFilter: 1,
    devid: defaultDevid(),
    authcode: "",
    version: 0,
    country,
  });
  if (env.status !== 0 || !env.data) throw new Error("YEEYI getCityAndSuburb 失败");
  return env.data;
}

/** 导航城市（getNavigatorCity）—— 含全国家与热门城市，用于选址/城市选择。 */
export async function getNavigatorCity(): Promise<YeeyiNavigatorCity> {
  const env = await post<YeeyiEnvelope<YeeyiNavigatorCity>>("/api/getNavigatorCity/", {});
  if (env.status !== 0 || !env.data) throw new Error("YEEYI getNavigatorCity 失败");
  return env.data;
}

/** 论坛配置（getForumConfig）—— 辅助数据，本项目暂不深度使用。 */
export async function getForumConfig(): Promise<unknown> {
  const env = await post<YeeyiEnvelope<unknown>>("/api/getForumConfig/", {});
  if (env.status !== 0 || !env.data) throw new Error("YEEYI getForumConfig 失败");
  return env.data;
}

/** 帖子详情跳转地址。 */
export function threadUrl(tid: string): string {
  return `https://www.yeeyi.com/bbs/forum.php?mod=viewthread&tid=${tid}`;
}