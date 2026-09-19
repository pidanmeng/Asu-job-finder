/**
 * 地理位置解析相关类型。
 * 对应 Prompt E：地图选点 → 大模型 + suburb 数据 → { mainCity, suburbs }。
 */

/** 地图选点结果（存于 mapStore / 接口入参）。 */
export interface PickedLocation {
  lat: number;
  lng: number;
  /** 可读地名（正向地理编码结果，可能为空）。 */
  placeName?: string;
  /** 推测城市（可选，来自 LLM 解析）。 */
  city?: string;
}

/** /api/resolve-location 的入参。 */
export interface ResolveLocationRequest {
  lat: number;
  lng: number;
  placeName?: string;
  /** 是否使用大模型解析。默认 false（自动/启发式就近解析）；true 且配置了 LLM key 时走大模型。 */
  useLlm?: boolean;
}

/** /api/resolve-location 的结构化解析结果。 */
export interface ResolveLocationResult {
  mainCity: string;
  /** 物理上接近选中点的可用于职位筛选的城区名。 */
  suburbs: string[];
  country: "Australia";
  /** 0-1 置信度。 */
  confidence: number;
  /** 理由说明。 */
  reasoning: string;
  /** 解析来源：LLM 或是启发式兜底。 */
  mode: "llm" | "heuristic";
}

/** 统一 API 响应外层。 */
export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}