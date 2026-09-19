/**
 * 职位详情抓取/解析（来源网站 Next.js SSR 的 __NEXT_DATA__）。
 * 纯函数解析放这里（可测试），网络请求由 app/api/jobs/[tid]/route.ts 负责。
 */
import type { JobDetail, JobAttribute } from "@/types/jobDetail";

/** 从 HTML 里提取 __NEXT_DATA__ 的 JSON 对象；找不到返回 null。 */
export function extractNextData(html: string): Record<string, unknown> | null {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json"[^>]*>([\s\S]*?)<\/script>/i);
  if (!m?.[1]) return null;
  try {
    return JSON.parse(m[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** 数组到属性的安全转换（<script> 里的 section_3/section_5 都是 [label, value]）。 */
function toAttributes(rows: unknown): JobAttribute[] {
  if (!Array.isArray(rows)) return [];
  const out: JobAttribute[] = [];
  for (const r of rows) {
    if (!Array.isArray(r) || r.length < 2) continue;
    const label = String(r[0] ?? "").trim();
    const value = String(r[1] ?? "").trim();
    if (label && value) out.push({ label, value });
  }
  return out;
}

/** 从已解析的 __NEXT_DATA__ 中取出职位详情。 */
export function parseThreadDetail(
  tid: string,
  nextData: Record<string, unknown>,
  url: string,
): JobDetail | null {
  const props = (nextData.props ?? {}) as Record<string, unknown>;
  const pageProps = (props.pageProps ?? {}) as Record<string, unknown>;
  const rent = (pageProps.houseRentDetails ?? {}) as Record<string, unknown>;
  const threadInfo = (rent.threadInfo ?? {}) as Record<string, unknown>;
  if (!threadInfo.section_2 && !threadInfo.section_3) return null;

  const section2 = (threadInfo.section_2 ?? {}) as Record<string, unknown>;
  const section3Rows = threadInfo.section_3;
  const section5Rows = threadInfo.section_5;
  const section4 = (threadInfo.section_4 ?? {}) as Record<string, unknown>;
  const section6 = (threadInfo.section_6 ?? {}) as Record<string, unknown>;

  const attributes = toAttributes(section3Rows);
  const contact = toAttributes(section5Rows);

  // 从 section_2 或 section_3 提取地址/城市
  let location = "";
  let cityId: string | undefined;
  const s2Addr = section2.address ? String(section2.address) : "";
  const attrsLoc = attributes.find((a) => /工作地点|地址|region|location/i.test(a.label))?.value ?? "";
  location = s2Addr || attrsLoc;
  if (section2.city != null) cityId = String(section2.city);

  const images: string[] = [];
  const sec6Pics = (section6.pic ?? []) as unknown[];
  if (Array.isArray(sec6Pics)) images.push(...sec6Pics.map((p) => String(p)).filter(Boolean));

  const views = section2.views != null ? String(section2.views) : undefined;
  const postedAt = section2.dateline ? Number(section2.dateline) : undefined;
  const postedAtStr =
    section2.datelinestr != null ? String(section2.datelinestr) : undefined;
  const title = String(section2.subject ?? section4.title ?? "").trim();
  const author = String(section2.author ?? "").trim();
  const authorid = section2.authorid != null ? String(section2.authorid) : undefined;
  const tel = section2.tel != null && String(section2.tel) !== "0" ? String(section2.tel) : undefined;
  const message = typeof section4.message === "string" ? section4.message : "";

  return {
    tid,
    title: title || "（无标题）",
    author,
    authorid,
    postedAt,
    postedAtStr,
    views,
    location,
    cityId,
    attributes,
    contact,
    tel,
    message,
    images,
    url,
    ok: true,
    source: "yeeyi-detail",
  };
}

/** 结果兜底：当解析失败时返回一个带 ok:false 的空详情，前端友好提示。 */
export function emptyFallback(tid: string, url: string): JobDetail {
  return {
    tid,
    title: "",
    author: "",
    location: "",
    attributes: [],
    contact: [],
    message: "",
    images: [],
    url,
    ok: false,
    source: "fallback",
  };
}