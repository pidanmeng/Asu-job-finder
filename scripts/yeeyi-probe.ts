/**
 * YEEYI 接口调试/探活脚本。
 * 用法：
 *   npm run probe -- --city 2            # 悉尼职位列表
 *   npm run probe -- --city 2 --keyword 会计
 *   npm run probe -- --city 2 --position 74
 *   npm run probe -- --positions        # 只打印职位分类树
 *   npm run probe -- --cities           # 只打印城市+城区(悉尼)
 *
 * 运行：pnpm tsx scripts/yeeyi-probe.ts 或 npm run probe。
 * 依赖 tsx（见 devDependencies），无需构建。
 */

import { getCityAndSuburb, getPositionList, getNavigatorCity, getSectionList } from "../lib/yeeyi";

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a) continue;
    if (a.startsWith("--")) {
      const key = a.replace(/^--/, "");
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        out[key] = next;
        i++;
      } else {
        out[key] = "true";
      }
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const city = args["city"] ?? "2";
  const keyword = args["keyword"] ?? "";
  const position = args["position"];

  if (args["positions"] === "true") {
    const tree = await getPositionList();
    console.log("===== getPositionList 职位分类 =====");
    for (const cat of tree) {
      console.log(`[${cat.id}] ${cat.name}`);
      for (const p of cat.position) console.log(`    ${p.id}  ${p.name}`);
    }
    return;
  }

  if (args["cities"] === "true") {
    const nav = await getNavigatorCity();
    console.log("===== getNavigatorCity 国家/城市 =====");
    for (const c of nav.countryList) {
      console.log(`# ${c.country_name}(${c.country_code})`);
      for (const city of c.cityList) console.log(`   ${city.id}  ${city.name}`);
    }
    const citySub = await getCityAndSuburb();
    console.log("\n===== getCityAndSuburb 城市 + 悉尼城区(前20) =====");
    for (const c of citySub.cityList) console.log(`city ${c.value}  ${c.name}  ${c.state}`);
    const syd = citySub.suburbList["city_2"] ?? [];
    for (const s of syd.slice(0, 20)) console.log(`   ${s.suburbId}  ${s.showName}`);
    console.log(`...悉尼城区总数 ${syd.length}`);
    return;
  }

  // 默认：拉取职位列表
  console.log(`===== getSectionList city=${city}${keyword ? ` keyword=${keyword}` : ""}${position ? ` position=${position}` : ""} =====`);
  const list = await getSectionList({
    cityFilter: city,
    suburbId: "0",
    positionId: position ? Number(position) : undefined,
  });
  console.log(`共 ${list.length} 条\n`);
  const filtered = keyword ? list.filter((t) => t.subject.includes(keyword) || t.company.includes(keyword)) : list;
  for (const t of filtered.slice(0, 15)) {
    console.log(`- [${t.tid}] ${t.subject}`);
    console.log(`  公司=${t.company} | 城区=${t.suburb} | 性质=${t.property} | 签证=${t.visa || "(空)"} | 分类=${t.position_id}`);
    console.log(`  薪资form=${t.salary_form} 时薪[${t.salary_hour_from}-${t.salary_hour_end}] 月薪[${t.salary_month_from}-${t.salary_month_end}] 年薪[${t.salary_year_from}-${t.salary_year_end}]`);
    console.log(`  发布时间=${dateStr(t.dateline)} 刷新=${dateStr(t.refresh)} 浏览=${t.views}`);
    console.log("");
  }
  if (filtered.length === 0) console.log("(无匹配结果)");
  console.log(`过滤后 ${filtered.length} 条 / 原始 ${list.length} 条`);
}

function dateStr(unixSeconds: string): string {
  const n = Number(unixSeconds);
  if (!n) return unixSeconds;
  return new Date(n * 1000).toISOString();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("探活失败:", e.message ?? e);
    process.exit(1);
  });