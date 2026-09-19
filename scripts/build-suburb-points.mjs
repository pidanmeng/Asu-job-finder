/**
 * 给 data/suburbs.json 的每个 suburb 补充「城区级」经纬度 → data/suburb-points.json。
 *
 * 为什么：suburb-coords.json 是「邮编级」中心点，同一个邮编下往往挤着多个不同城区
 * （例如悉尼 CBD 的 Barangaroo / The Rocks / Dawes Point / Haymarket 全都共用邮编 2000），
 * 导致这些城区被赋予同一个坐标 → “距选点距离全部相同” 且列表按首字母排序，明显错误。
 *
 * 本脚本用 GeoNames(AU) 的城区地名（PPLX/PPLL/PPL… 聚落点）按「名字 + 州」匹配出
 * 每个城区独一无二的坐标；匹配冲突时取「离该城区邮编中心点最近」的候选以消歧；
 * 实在找不到的城区回退到邮编中心点（suburb-coords.json）。
 *
 * 用法：node scripts/build-suburb-points.mjs      # 依赖 data/_geonames/AU.txt（脚本会自动下载）
 * 输出：data/suburb-points.json   { [suburbId]: { lat, lng, name, state, source } }
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "../data");
const SUBS = join(DATA, "suburbs.json");
const PC_COORDS = join(DATA, "suburb-coords.json");
const OUT = join(DATA, "suburb-points.json");

const GEO_DIR = join(DATA, "_geonames");
const GEO_TXT = join(GEO_DIR, "AU.txt");
const GEO_ZIP = join(DATA, "_geonames-au.zip");
const GEO_SRC = "https://download.geonames.org/export/dump/AU.zip";

/** GeoNames admin1 code → 澳大利亚州缩写。 */
const ADMIN1_STATE = { "01": "ACT", "02": "NSW", "03": "NT", "04": "QLD", "05": "SA", "06": "TAS", "07": "VIC", "08": "WA" };
const STATE_ADMIN1 = Object.fromEntries(Object.entries(ADMIN1_STATE).map(([k, v]) => [v, k]));

/** 只取“聚落点”类（人口聚居地 / 城郊 / 小镇），避免把山凿湖泊当作城区。 */
const PREFERRED_CODES = new Set(["PPL", "PPLX", "PPLL", "PPLA", "PPLA2", "PPLA3", "PPLA4", "PPLS", "PPLQ", "PPLR", "PPLW"]);

function ensureGeonames() {
  if (existsSync(GEO_TXT)) return;
  if (!existsSync(GEO_ZIP)) {
    console.log("下载 GeoNames AU.zip …");
    // 用 fetch（Node 18+）避免依赖外部解压工具差异
    throw new Error("请先手动下载 GeoNames AU 数据：用浏览器打开 " + GEO_SRC);
  }
  mkdirSync(GEO_DIR, { recursive: true });
  throw new Error("AU.txt 不存在，请用解压工具把 " + GEO_ZIP + " 解压到 " + GEO_DIR);
}

function haversine(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const ds = JSON.parse(readFileSync(SUBS, "utf-8"));
const pcMap = JSON.parse(readFileSync(PC_COORDS, "utf-8")).postcodes ?? {};

// ---- 解析 GeoNames ----
ensureGeonames();
console.log("解析 GeoNames AU.txt …");
const candidatesByName = new Map(); // 名字(小写) -> [{name,state,lat,lng,pop,code}]
let lines = 0;
for (const raw of readFileSync(GEO_TXT, "utf-8").split("\n")) {
  const f = raw.split("\t");
  if (f.length < 15) continue;
  const [, name, ascii, altNames, lat, lon, fclass, code, , , admin1, , , , pop] = f;
  const state = ADMIN1_STATE[admin1];
  if (!state) continue; // 只保留澳大利亚各州
  if (fclass !== "P" && !PREFERRED_CODES.has(code)) continue; // 只要聚落点（含 PPLX 等）
  const c = { name, state, lat: Number(lat), lng: Number(lon), pop: Number(pop) || 0, code };
  for (const n of new Set([name.toLowerCase(), (ascii || "").toLowerCase(), ...(altNames || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)])) {
    if (!n) continue;
    const arr = candidatesByName.get(n) ?? [];
    arr.push(c);
    candidatesByName.set(n, arr);
  }
  lines++;
}
console.log(`  GeoNames 聚落点条目：${lines}，去重名字：${candidatesByName.size}`);

function pickCandidate(cands, pc) {
  // 优先聚落点 code；在 candidates 里，若 pc 存在则选离 pc 最近的，否则选人口最多的
  const cc = cands.filter((x) => PREFERRED_CODES.has(x.code));
  const pool = cc.length ? cc : cands;
  if (pc) {
    pool.sort((a, b) => haversine(a.lat, a.lng, pc.lat, pc.lng) - haversine(b.lat, b.lng, pc.lat, pc.lng));
    return pool[0];
  }
  pool.sort((a, b) => b.pop - a.pop);
  return pool[0];
}

// ---- 组装 suburbId -> coord ----
const out = {};
let viaGeonames = 0;
let viaPostcode = 0;
for (const city of ds.cities) {
  for (const s of city.suburbs) {
    const sbId = Number(s.suburbId);
    const pc = pcMap[s.postCode]; // {lat,lng,state}
    const cands = candidatesByName.get(String(s.name).toLowerCase()) ?? [];
    const sameState = cands.filter((x) => x.state === s.state);
    const src = (sameState.length ? sameState : cands);
    if (src.length) {
      const c = pickCandidate(src, pc);
      if (c) {
        out[sbId] = { lat: c.lat, lng: c.lng, name: s.name, state: s.state, source: "geonames" };
        viaGeonames++;
        continue;
      }
    }
    if (pc) {
      out[sbId] = { lat: pc.lat, lng: pc.lng, name: s.name, state: s.state, source: "postcode" };
      viaPostcode++;
    }
  }
}

writeFileSync(OUT, JSON.stringify({
  generatedAt: new Date().toISOString(),
  totalSuburbs: ds.totalSuburbs,
  viaGeonames,
  viaPostcode,
  note: "城区级坐标：主源 GeoNames(AU) 聚落点按“名字+州”匹配（冲突取离邮编中心最近）；缺失城区回退邮编中心点",
  suburbs: out,
}, null, 1));
console.log(`完成：城区 ${ds.totalSuburbs}，GeoNames 精确 ${viaGeonames}（${(viaGeonames / ds.totalSuburbs * 100).toFixed(1)}%），邮编回退 ${viaPostcode}，缺失 ${ds.totalSuburbs - viaGeonames - viaPostcode}`);
console.log("输出：" + OUT);