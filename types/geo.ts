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
  /** 圆形选区半径（km）。为空则以圆心点就近匹配少量城区。 */
  radiusKm?: number;
}

/** /api/resolve-location 的入参。 */
export interface ResolveLocationRequest {
  lat: number;
  lng: number;
  placeName?: string;
  radiusKm?: number;
}

/** 解析结果中的单个城区（带坐标，便于地图展示 POI）。 */
export interface ResolvedSuburb {
  name: string;
  lat: number;
  lng: number;
  /** 距点选圆心的距离（km）。 */
  distKm?: number;
}

/** /api/resolve-location 的结构化解析结果。 */
export interface ResolveLocationResult {
  mainCity: string;
  /** 物理上接近选中点的可用于职位筛选的城区（带坐标）。 */
  suburbs: ResolvedSuburb[];
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