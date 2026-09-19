/**
 * POST /api/resolve-location —— 位置解析（Prompt E）。
 * 入参：{ lat, lng, placeName? }
 * 流程：本地 suburb 粗筛（nearestCity + buildSuburbContext）→ LLM 结合 suburb 数据推断
 *       { mainCity, suburbs[], confidence, reasoning }；LLM 失败/未配置时回退启发式。
 */
import { NextResponse } from "next/server";
import { buildSuburbContext, findCityByKeyword, nearestCity, nearestSuburbs } from "@/lib/geocode";
import { chatCompletion, isLlmConfigured } from "@/lib/llm";
import type { ApiEnvelope, ResolveLocationRequest, ResolveLocationResult } from "@/types/geo";

export const runtime = "nodejs";
export const maxDuration = 30;

const SYSTEM_PROMPT = `你是一个帮助用户在澳大利亚找工作的位置解析助手。
用户在地图上点选了某个位置，给出了经纬度和(可能有的)地名。你要结合给定的 suburb 数据，
推断出「用户所在的主要城市」和「物理上接近该位置、可用于职位筛选的城区(suburb)」。
规则：
- mainCity 使用中文城市名（如"悉尼"、"墨尔本"），必须是给定城市列表中的城市。
- country 固定为 "Australia"。
- suburbs 只从给定的城区列表里选取 1~6 个与点选位置最近的城区名（原文，不含邮编）。
- confidence 是 0~1 的数值。
- reasoning 用一句话中文解释判断依据。
只输出 JSON 对象，不要任何额外文字。schema: {"mainCity":string,"country":"Australia","suburbs":string[],"confidence":number,"reasoning":string}`;

export async function POST(req: Request) {
  let payload: ResolveLocationRequest;
  try {
    payload = (await req.json()) as ResolveLocationRequest;
  } catch {
    return NextResponse.json<ApiEnvelope<never>>({ ok: false, error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const { lat, lng, placeName, useLlm } = payload;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json<ApiEnvelope<never>>({ ok: false, error: "缺少有效的 lat/lng" }, { status: 400 });
  }

  // 1) 本地粗筛：先拿到最近的城市与 suburb 子集
  const nearby = nearestCity(lat, lng);
  if (!nearby) {
    return NextResponse.json<ApiEnvelope<never>>({ ok: false, error: "无法匹配到澳洲城市" }, { status: 422 });
  }
  const ctx = buildSuburbContext({ cityId: nearby.id, lat, lng, limit: 120 });

  // 2) 尝试 LLM（仅当开关开启且配置了 LLM key）
  if (useLlm && isLlmConfigured()) {
    try {
      const suburbNames = ctx.suburbs.map((s) => s.name).join("、");
      const user = `经纬度: ${lat.toFixed(5)}, ${lng.toFixed(5)}\n地名: ${placeName ?? "(无)"}\n所在城市候选: ${nearby.name}(${nearby.nameEn}, ${nearby.state})\n城区列表: ${suburbNames}`;
      const { json } = await chatCompletion(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: user },
        ],
        { json: true },
      );
      const r = json as Partial<ResolveLocationResult> | null;
      if (r && typeof r.mainCity === "string" && Array.isArray(r.suburbs)) {
        const mainCity = findCityByKeyword(r.mainCity)[0]?.name ?? r.mainCity;
        return NextResponse.json<ApiEnvelope<ResolveLocationResult>>({
          ok: true,
          data: {
            mainCity,
            country: "Australia",
            suburbs: r.suburbs.slice(0, 6),
            confidence: typeof r.confidence === "number" ? r.confidence : 0.5,
            reasoning: typeof r.reasoning === "string" ? r.reasoning : "",
            mode: "llm",
          },
        });
      }
      // 结构不对 → 落到启发式
    } catch (e) {
      console.warn("[resolve-location] LLM 调用失败，回退启发式:", e instanceof Error ? e.message : e);
    }
  }

  // 3) 启发式兜底：按坐标就近返回 suburb（邮编级近似）
  const nearbySuburbs = nearestSuburbs(lat, lng, { cityId: nearby.id, limit: 5 });
  const fallback: ResolveLocationResult = {
    mainCity: nearby.name,
    country: "Australia",
    suburbs: nearbySuburbs.map((s) => s.name),
    confidence: 0.6,
    reasoning: `已按坐标就近匹配到「${nearby.name}」的城区（${nearbySuburbs.map((s) => `${s.name}约${s.distKm ?? "?"}km`).join("、")}），未使用大模型。`,
    mode: "heuristic",
  };
  return NextResponse.json<ApiEnvelope<ResolveLocationResult>>({ ok: true, data: fallback });
}