/**
 * 从 YEEYI 真实接口生成 data/suburbs.json（Prompt C）。
 * 用法：npm run gen:suburbs  （node scripts/gen-suburbs.mjs）
 *
 * 数据来源：www.yeeyi.com/api/getCityAndSuburb/ + getNavigatorCity/（POST + JSON）。
 * suburb 不提供经纬度，因此仅记录：suburbId/name/showName/state/postCode/cityId。
 * 城市级中心坐标为手工整理（公开常识坐标），供 map/LLM 做远近粗筛。
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../data/suburbs.json");

const CITIES_EN = {
  1: { nameEn: "Melbourne", state: "VIC", center: { lat: -37.8136, lng: 144.9631 } },
  2: { nameEn: "Sydney", state: "NSW", center: { lat: -33.8688, lng: 151.2093 } },
  3: { nameEn: "Gold Coast", state: "QLD", center: { lat: -28.0167, lng: 153.4 } },
  4: { nameEn: "Brisbane", state: "QLD", center: { lat: -27.4698, lng: 153.0251 } },
  5: { nameEn: "Adelaide", state: "SA", center: { lat: -34.9285, lng: 138.6007 } },
  6: { nameEn: "Canberra", state: "ACT", center: { lat: -35.2809, lng: 149.13 } },
  7: { nameEn: "Perth", state: "WA", center: { lat: -31.9523, lng: 115.8613 } },
  8: { nameEn: "Darwin", state: "NT", center: { lat: -12.4634, lng: 130.8456 } },
  10: { nameEn: "Hobart", state: "TAS", center: { lat: -42.8821, lng: 147.3272 } },
  12: { nameEn: "Wollongong", state: "NSW", center: { lat: -34.4278, lng: 150.8931 } },
  13: { nameEn: "Central Coast", state: "NSW", center: { lat: -33.4231, lng: 151.3425 } },
  14: { nameEn: "Geelong", state: "VIC", center: { lat: -38.1485, lng: 144.3607 } },
  15: { nameEn: "Ballarat", state: "VIC", center: { lat: -37.5622, lng: 143.8503 } },
  11: { nameEn: "Other", state: "", center: { lat: -25.27, lng: 133.78 } },
};

const H = {
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36",
  Referer: "https://www.yeeyi.com/",
  Origin: "https://www.yeeyi.com",
};

async function post(path, body) {
  const res = await fetch(`https://www.yeeyi.com${path}`, {
    method: "POST",
    headers: H,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const devid = `gen-${Date.now()}|pc`;
  const citySub = await post("/api/getCityAndSuburb/", {
    cityFilter: 1, devid, authcode: "", version: 0, country: "AUS",
  });
  if (citySub.status !== 0 || !citySub.data) throw new Error("getCityAndSuburb failed");

  const cities = [];
  for (const c of citySub.data.cityList) {
    const id = Number(c.value ?? c.id);
    const meta = CITIES_EN[id] ?? { nameEn: c.name, state: c.state ?? "", center: null };
    const suburbRows = citySub.data.suburbList[`city_${id}`] ?? [];
    cities.push({
      id,
      name: c.name,
      nameEn: meta.nameEn,
      state: meta.state,
      ...(meta.center ? { center: meta.center } : {}),
      suburbs: suburbRows.map((s) => ({
        suburbId: s.suburbId,
        name: s.name,
        state: s.state,
        postCode: s.postCode,
        cityId: Number(s.cityId) || id,
      })),
    });
  }

  const dataset = {
    generatedAt: new Date().toISOString(),
    source: "yeeyi.com /api/getCityAndSuburb/ (AUS) 抓取，" + "城市中心坐标为手工整理",
    totalSuburbs: cities.reduce((n, c) => n + c.suburbs.length, 0),
    cities,
  };

  writeFileSync(OUT, JSON.stringify(dataset, null, 1), "utf-8");
  console.log(`已生成 ${OUT}`);
  console.log(`  城市 ${dataset.cities.length} 个，城区共 ${dataset.totalSuburbs} 条`);
  for (const c of cities) console.log(`  - ${c.name}(${c.nameEn}, ${c.state}) 城区 ${c.suburbs.length}`);
}

main().catch((e) => { console.error("失败:", e?.message ?? e); process.exit(1); });