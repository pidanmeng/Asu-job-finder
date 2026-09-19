/**
 * 给 data/suburbs.json 的每个 suburb 补充经纬度（邮编级中心点）。
 *
 * 主数据源：joelkoen/postcodes-au（社区维护、CC 授权）的 postcodes-au.csv，
 *           给出每个（州,邮编）的人口加权中心点 lat/lng —— 一份下载即覆盖 ~99% 邮编。
 * 兜底：对数据集中缺失的邮编，可选走 OSM Nominatim（--fallback）按邮编解析。
 *
 * 输出：data/suburb-coords.json 的 postcodes 表（key=邮编, value={lat,lng,state}）。
 * 覆盖：几乎全部 suburb（共享邮编者共用同一中心点，精度到邮编级，足够“就近”判定）。
 *
 * 用法：
 *   npm run enrich:coords              # 默认：用 postcodes-au 数据集生成（快）
 *   node scripts/build-suburb-coords.mjs --fallback   # 额外用 Nominatim 补齐缺失邮编
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "../data");
const SUBS = join(DATA, "suburbs.json");
const OUT = join(DATA, "suburb-coords.json");
const CSV_CACHE = join(DATA, "_postcodes-au.csv");
const SRC = "https://raw.githubusercontent.com/joelkoen/postcodes-au/master/data/postcodes-au.csv";

const args = process.argv.slice(2);
const useFallback = args.includes("--fallback");

// ---- 读 suburb 数据：收集 邮编 -> 该邮编内出现的州(取众数) ----
const ds = JSON.parse(readFileSync(SUBS, "utf-8"));
const pcState = new Map(); // pc -> 州名分布
const pcTotal = new Map();
for (const c of ds.cities) {
  for (const s of c.suburbs) {
    if (!/^\d{4}$/.test(s.postCode)) continue;
    pcTotal.set(s.postCode, (pcTotal.get(s.postCode) ?? 0) + 1);
    const cur = pcState.get(s.postCode) ?? new Map();
    cur.set(s.state, (cur.get(s.state) ?? 0) + 1);
    pcState.set(s.postCode, cur);
  }
}
function majorityState(pc) {
  const m = pcState.get(pc) ?? new Map();
  let best = "", bestN = -1;
  for (const [st, n] of m) if (n > bestN) { bestN = n; best = st; }
  return best;
}

// ---- 下载 / 读取 postcodes-au.csv ----
let csvText;
if (existsSync(CSV_CACHE)) {
  csvText = readFileSync(CSV_CACHE, "utf-8");
} else {
  try {
    const res = await fetch(SRC, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    csvText = await res.text();
    writeFileSync(CSV_CACHE, csvText);
  } catch (e) {
    console.error("下载 postcodes-au.csv 失败（请确认可访问外网或先用代理运行）:", e.message);
    process.exit(1);
  }
}
const pcCentroid = new Map(); // `${pc}:${state}` -> [lat,lng]
for (const line of csvText.split("\n").slice(1)) {
  const cols = line.trim().split(",");
  if (cols.length < 5) continue;
  const [state, pc, , lat, lng] = cols;
  if (/^\d{4}$/.test(pc) && Number(lat) && Number(lng)) pcCentroid.set(`${pc}:${state}`, [Number(lat), Number(lng)]);
}

// ---- 组装：postcode -> {lat,lng,state} ----
const outPosts = {};
let covered = 0;
const missing = [];
for (const pc of pcTotal.keys()) {
  const st = majorityState(pc);
  const c = pcCentroid.get(`${pc}:${st}`)
    ?? [...pcCentroid.entries()].find(([k]) => k.startsWith(`${pc}:`))?.[1];
  if (c) {
    outPosts[pc] = { lat: c[0], lng: c[1], state: st };
    covered++;
  } else {
    missing.push(pc);
  }
}

// ---- 可选 Nominatim 兜底（限速）----
if (useFallback && missing.length) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let done = 0;
  for (const pc of missing) {
    const st = majorityState(pc);
    for (const q of [`${pc}, ${st}, Australia`, `${pc}, Australia`]) {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=au&q=${encodeURIComponent(q)}`;
        const r = await fetch(url, { headers: { "User-Agent": "aus-job-search/1.0" }, signal: AbortSignal.timeout(12000) });
        if (r.ok) {
          const arr = (await r.json()) ?? [];
          if (arr[0] && arr[0].lat && arr[0].lon) {
            outPosts[pc] = { lat: Number(arr[0].lat), lng: Number(arr[0].lon), state: st };
            covered++;
            break;
          }
        }
      } catch { /* next */ }
      await sleep(1100); // Nominatim 政策约 1 rps
    }
    if (++done % 20 === 0) console.log(`[fallback] ${done}/${missing.length}`);
  }
}

// 兜底后重算真正缺失的邮编
const trulyMissing = [...pcTotal.keys()].filter((pc) => !outPosts[pc]);

writeFileSync(OUT, JSON.stringify({
  generatedAt: new Date().toISOString(),
  totalPostcodes: pcTotal.size,
  resolvedPostcodes: covered,
  missingPostcodes: trulyMissing,
  note: "邮编级近似的 suburb 中心点；主源 joelkoen/postcodes-au（CC 授权），兜底 OSM Nominatim",
  postcodes: outPosts,
}));

console.log(`完成：唯一邮编 ${pcTotal.size}，已解析 ${covered}/${pcTotal.size}（${(covered / pcTotal.size * 100).toFixed(1)}%）`);
console.log(`缺失 ${trulyMissing.length}：${trulyMissing.join(", ") || "无"}`);
console.log(`输出：${OUT}`);