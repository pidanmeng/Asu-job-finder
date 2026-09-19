/**
 * 本地 Mock 职位数据 —— 当 YEEYI 接口不可用 / 被反爬 / 或 YEEYI_ENABLED=false 时的降级数据，
 * 用于本地演示与开发（Prompt F 约束：接口异常时仍能展示）。
 */
import type { Job } from "@/types/job";
import { cityDisplayName } from "@/lib/geocode";

const SAMPLES: Array<Pick<Job, "title" | "company" | "type" | "requiresPR" | "salary">> = [
  { title: "中餐厅招服务员（可培训）", company: "Golden Dragon 中餐", type: "全职", requiresPR: false, salary: "$26-$32 时薪" },
  { title: "仓库操作员 W/H Officer", company: "AUS Recruitment", type: "全职", requiresPR: true, salary: "年薪 $60k-$75k" },
  { title: "会计助理 / Junior Accountant", company: "Sydney CPA 事务所", type: "全职", requiresPR: false, salary: "$55k-$70k 年薪" },
  { title: "咖啡师 Barista（CBD）", company: "Blue Mountain Café", type: "兼职", requiresPR: false, salary: "$30-$35 时薪" },
  { title: "按摩师（$1500+ 保底）", company: "Sunshine Spa", type: "全职", requiresPR: false, salary: "$1500+ 每周" },
  { title: "IT 技术支持 Helpdesk", company: "TechCare AU", type: "合同工", requiresPR: false, salary: "$45-$60 时薪" },
  { title: "护理员 Aged Care（需 Cert）", company: "Community Care Co.", type: "全职", requiresPR: true, salary: "$32-$38 时薪" },
  { title: "销售代表（移民行业）", company: "VisaHub", type: "全职", requiresPR: false, salary: "底薪+佣金" },
  { title: "幼教老师 ECE（VIC）", company: "Little Stars 幼教", type: "全职", requiresPR: false, salary: "$70k-$90k 年薪" },
  { title: "房产租赁顾问（需 PR）", company: "Metro Realty", type: "全职", requiresPR: true, salary: "底薪+提成" },
];

/** 生成 Mock 职位（按城市/关键词做细腻化）。 */
export function buildMockJobs(opts: { cityId?: string; cityName?: string; keyword?: string; allowPR?: boolean; page?: number; pageSize?: number }): Job[] {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const allowPR = opts.allowPR ?? false;
  const cityName = opts.cityName ?? (opts.cityId ? cityDisplayName(opts.cityId) : "悉尼");

  let list: Job[] = SAMPLES.map((s, i) => ({
    ...s,
    id: `mock-${i + 1}`,
    suburb: `${opts.cityName ? suggestSuburb(opts.cityName) : "Sydney CBD"}, NSW 2000`,
    cityId: opts.cityId ?? "2",
    city: cityName,
    description: s.title,
    applyUrl: "#",
    images: [],
  }));

  // 关键词过滤（mock 场景）
  if (opts.keyword) {
    const kw = opts.keyword.toLowerCase();
    list = list.filter(
      (j) => j.title.toLowerCase().includes(kw) || j.company.toLowerCase().includes(kw),
    );
  }
  // PR 过滤
  if (!allowPR) list = list.filter((j) => !j.requiresPR);

  const start = (page - 1) * pageSize;
  return list.slice(start, start + pageSize);
}

function suggestSuburb(cityName: string): string {
  const map: Record<string, string> = {
    悉尼: "Chatswood",
    墨尔本: "Box Hill",
    布里斯班: "Sunnybank",
    阿德莱德: "Adelaide CBD",
    珀斯: "Perth CBD",
    堪培拉: "Belconnen",
    黄金海岸: "Southport",
  };
  return map[cityName] ?? "CBD";
}

export function mockTotal(): number {
  return SAMPLES.length;
}