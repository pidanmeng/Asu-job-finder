/**
 * 职位数据清洗与统一（Prompt F）。
 * 把 YEEYI 的 YeeyiThreadItem 清洗成统一 Job 类型，并做薪资格式化、PR 判定。
 */
import type { Job } from "@/types/job";
import type { YeeyiThreadItem } from "@/types/yeeyi";
import { requiresPR } from "@/lib/pr";
import { threadUrl } from "@/lib/yeeyi";

/** 薪资 form → 展示后缀。1=按小时, 2=按月, 3=面议。 */
function salaryFormLabel(form: string): string {
  switch (form) {
    case "1":
      return "每小时";
    case "2":
      return "每月";
    default:
      return "";
  }
}

function num(v: string): number | 0 {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** 从小时/月/年薪字段合成可读薪资字符串。 */
export function formatSalary(t: YeeyiThreadItem): string {
  const isNegotiable = t.salary_form === "3";
  const ranges: Array<[number, number, string]> = [
    [num(t.salary_hour_from), num(t.salary_hour_end), "时薪"],
    [num(t.salary_month_from), num(t.salary_month_end), "月薪"],
    [num(t.salary_year_from), num(t.salary_year_end), "年薪"],
    [num(t.salary_day_from), num(t.salary_day_to), "日薪"],
  ];
  for (const [from, to, label] of ranges) {
    if (from > 0 || to > 0) {
      if (from > 0 && to > 0) return `$${from}-$${to} ${label}`;
      if (from > 0) return `$${from}+ ${label}`;
      return `最高 $${to} ${label}`;
    }
  }
  const form = salaryFormLabel(t.salary_form);
  if (form) return `按${form.replace("每", "")}面议`;
  return isNegotiable ? "薪资面议" : "薪资面议";
}

/** 把 YEEYI 帖子清洗成统一 Job。 */
export function toJob(t: YeeyiThreadItem, opts: { cityName?: string } = {}): Job {
  const RequiresPR = requiresPR(t.visa, t.subject);
  return {
    id: t.tid,
    title: t.subject,
    company: t.company,
    salary: formatSalary(t),
    type: t.property || "不限",
    suburb: t.suburb,
    suburbId: t.suburb_id,
    cityId: t.city,
    city: opts.cityName,
    requiresPR: RequiresPR,
    description: t.subject,
    postedAt: num(t.dateline) || undefined,
    refreshedAt: num(t.refresh) || undefined,
    views: num(t.views) || undefined,
    applyUrl: threadUrl(t.tid),
    images: t.pic ?? [],
    positionId: t.position_id,
  };
}

/** 端到端：把原始 posts 数组清洗 + 按是否包含 PR 过滤。 */
export function cleanJobs(
  threads: YeeyiThreadItem[],
  opts: { allowPR?: boolean; cityName?: string } = {},
): Job[] {
  const allowPR = opts.allowPR ?? false;
  return threads.map((t) => toJob(t, opts)).filter((j) => allowPR || !j.requiresPR);
}