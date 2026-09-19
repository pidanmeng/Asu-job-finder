/**
 * 用 OSM Nominatim 补齐 data/suburb-points.json 中缺失(非 geonames)的城区坐标。
 * 只在“同一城市内与其它城区共用邮编（即会坍塌为同一坐标）”→ 影响就近匹配与距离展示的城区上执行，
 * 避免为所有非必要城区发请求。礼貌限速 ~1 rps，带 User-Agent，可中断续跑（每 20 条写一次进度）。
 *
 * 用法：node scripts/enrich-points-nominatim.mjs [--force]
 * 输出：就地合并进 data/suburb-points.json；进度存 data/_nominatim-progress.json
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "../data");
const POINTS = join(DATA, "suburb-points.json");
const PROGRESS = join(DATA, "_nominatim-progress.json");
const FORCE = process.argv.includes("--force");
const SLEEP_MS = process.env.NOMINATIM_SLEEP_MS ? Number(process.env.NOMINATIM_SLEEP_MS) : 1100;
const UA = "aus-job-search/1.0 (suburb coordinate enrichment; contact: dev@example.com)";

const suburbs = JSON.parse(readFileSync(join(DATA, "suburbs.json"), "utf8"));
const pointsDoc = JSON.parse(readFileSync(POINTS, "utf8"));
let doc = pointsDoc.suburbs;

// 需要补的：source 缺失或为 postcode，且其邮编在同城内被 ≥2 个城区共用（会坍塌）
const pcFreqInCity = new Map(); // `${cityId}:${postCode}` -> count
for (const c of suburbs.cities)
  for (const s of c.suburbs)
    pcFreqInCity.set(`${c.id}:${s.postCode}`, (pcFreqInCity.get(`${c.id}:${s.postCode}`) ?? 0) + 1);

const need = [];
for (const c of suburbs.cities) {
  for (const s of c.suburbs) {
    const p = doc[String(s.suburbId)];
    const isGeonames = p && p.source === "geonames";
    if (FORCE ? isGeonames : false) continue;
    if (!FORCE && (isGeonames || (pcFreqInCity.get(`${c.id}:${s.postCode}`) ?? 0) <= 1)) continue;
    need.push({ id: s.suburbId, name: s.name, state: s.state, cityId: c.id, postCode: s.postCode });
  }
}
// 按 (name,state) 去重，避免重复请求
const uniq = new Map();
for (const n of need) {
  const k = `${n.name}|${n.state}`;
  if (!uniq.has(k)) uniq.set(k, n);
}
const queue = [...uniq.values()];
console.log(`待补齐城区：${need.length}，去重后 ${queue.length}；强制模式=${FORCE}`);

// 续跑：跳过已在进度里成功/已处理过的
let skip = 0;
if (existsSync(PROGRESS)) {
  const prev = JSON.parse(readFileSync(PROGRESS, "utf8"));
  skip = prev.done ?? 0;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geocode(n) {
  const queries = [
    `${n.name}, ${n.state}, Australia`,
    `${n.name} ${n.postCode}, ${n.state}, Australia`,
  ];
  for (const q of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=au&q=${encodeURIComponent(q)}`;
      const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12000) });
      if (r.ok) {
        const arr = (await r.json()) ?? [];
        if (arr[0] && arr[0].lat && arr[0].lon) {
          return { lat: Number(arr[0].lat), lng: Number(arr[0].lon) };
        }
      }
    } catch { /* next */ }
  }
  return null;
}

let done = 0;
let okCount = 0;
let progress = existsSync(PROGRESS) ? JSON.parse(readFileSync(PROGRESS, "utf8")) : { done: 0, applied: [], at: 0 };
for (let i = progress.at ?? 0; i < queue.length; i++) {
  const n = queue[i];
  const c = await geocode(n);
  done++;
  if (c) {
    // 应用到该名字下所有同 (name,state) 的城区
    for (const t of need) {
      if (t.name === n.name && t.state === n.state) {
        doc[String(t.id)] = { ...c, name: t.name, state: t.state, source: "nominatim" };
        okCount++;
      }
    }
  }
  if (i % 20 === 0 || i === queue.length - 1) {
    writeFileSync(PROGRESS, JSON.stringify({ done, applied: okCount, at: i + 1 }, null, 1));
    const note = (pointsDoc.note || "").includes("Nominatim") ? pointsDoc.note : `${pointsDoc.note || ""}；Nominatim 补齐缺失城区坐标`;
    writeFileSync(POINTS, JSON.stringify({ ...pointsDoc, note, suburbs: doc }, null, 1));
    console.log(`[${i + 1}/${queue.length}] 已处理，命中 ${okCount}`);
  }
  await sleep(SLEEP_MS);
}
writeFileSync(POINTS, JSON.stringify({ ...pointsDoc, suburbs: doc }, null, 1));
console.log(`完成：命中 ${okCount} / 处理 ${queue.length}`);