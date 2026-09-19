/**
 * lib/geocode.ts 的功能自测（Prompt C：提供简单测试/样例）。
 * 运行：npx tsx scripts/test-geocode.ts
 */
import {
  nearestCity,
  nearestSuburbs,
  nearestSuburb,
  findCityByKeyword,
  findSuburbsByKeyword,
  matchSuburbExactly,
  findSuburbById,
  buildSuburbContext,
  cityDisplayName,
} from "../lib/geocode";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`, extra ?? "");
  }
}

console.log("=== geocode 自测 ===\n");

const sydney = nearestCity(-33.8688, 151.2093);
check("nearestCity 悉尼坐标 → 悉尼", sydney?.name === "悉尼", sydney?.name);

const mel = findCityByKeyword("Melbourne")[0];
check("findCityByKeyword('Melbourne') → 墨尔本", mel?.name === "墨尔本", mel?.name);

const sydSub = findSuburbsByKeyword("Chatswood", 2);
check("findSuburbsByKeyword('Chatswood', 悉尼) → 命中", sydSub.some((s) => s.name === "Chatswood"), sydSub[0]);

const exact = matchSuburbExactly("Sydney", 2);
check("matchSuburbExactly('Sydney', 2)", exact?.postCode === "2000", exact?.name);

const byId = findSuburbById(6726);
check("findSuburbById(6726) → 悉尼/Sydney", byId?.name === "悉尼", byId?.suburb.name);

const ctx = buildSuburbContext({ cityId: 2, limit: 20 });
check("buildSuburbContext(city_2) → city 悉尼", ctx.city.name === "悉尼");
check("buildSuburbContext 城区数<=20", ctx.suburbs.length === 20, ctx.suburbs.length);

check("cityDisplayName(1) → 墨尔本", cityDisplayName(1) === "墨尔本");

// nearestSuburbs / nearestSuburb（邮编级坐标；即使坐标表未生成也会用城市中心兜底）
const near = nearestSuburbs(-33.8688, 151.2093, { cityId: 2, limit: 3 });
check("nearestSuburbs(悉尼CBD) 返回 3 条", near.length === 3, near.map((x) => x.name).join(","));
check("nearestSuburbs 返回坐标与距离", near.every((x) => typeof x.lat === "number" && typeof x.distKm === "number"));
const first = near[0];
check("nearestSuburbs 第一条最近(<=3km)", typeof first?.distKm === "number" && first.distKm < 3, first?.distKm);

const one = nearestSuburb(-33.8688, 151.2093);
check("nearestSuburb(悉尼CBD) → 有结果", !!one, one?.name);
check("nearestSuburb 结果带坐标", typeof one?.lat === "number", one?.lat);

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);