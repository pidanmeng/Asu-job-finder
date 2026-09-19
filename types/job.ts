/**
 * 统一职位数据类型 —— 服务端代理（app/api/jobs）把 YEEYI 原始字段清洗后输出此类型，
 * 前端页面与 AI 筛选都消费它。与 docs/yeeyi-api.md 的「字段字典」保持一致。
 */

export interface Job {
  /** 职位唯一 id（取自 YEEYI tid）。 */
  id: string;
  /** 职位标题（取自 subject）。 */
  title: string;
  /** 公司 / 店铺名。 */
  company: string;
  /** 薪资展示（清洗后），如 "$50-$70 每小时" / "薪资面议"。 */
  salary: string;
  /** 工作性质：全职 / 兼职 / 临时 / 合同工 / 实习 / 不限。 */
  type: string;
  /** 城区展示名称，如 "Sydney, NSW 2000"。 */
  suburb: string;
  /** 城区 id（可回查 YEEYI）。 */
  suburbId?: string;
  /** 城市 id（YEEYI 城市 code）。 */
  cityId?: string;
  /** 城市名（中文），由解析阶段映射。 */
  city?: string;
  /**
   * 是否要求 PR（永久居留）。
   * YEEYI 有独立的 visa 字段：visa==="PR" 即为真；
   * 同时叠加对 subject 的关键词启发式匹配（PR / 永居 / PR临签）作为兜底。
   * 判定逻辑见 lib/pr.ts，属“启发式”，可能有不精确之处。
   */
  requiresPR: boolean;
  /** 职位描述摘录（多为标题本身）。 */
  description: string;
  /** 发帖时间（Unix 秒）。 */
  postedAt?: number;
  /** 最近刷新时间（Unix 秒）。 */
  refreshedAt?: number;
  /** 浏览量。 */
  views?: number;
  /** 详情/跳转来源 URL（YEEYI 帖子页）。 */
  applyUrl?: string;
  /** 封面图 URL。 */
  images: string[];
  /** 职位分类 id（可选）。 */
  positionId?: string;
  /* ---------- 以下为 AI 筛选阶段填充的字段（可选） ---------- */

  /** AI 推荐理由（筛选后写入）。 */
  aiReason?: string;
  /** 命中关键词（用于排序/高亮）。 */
  matchedKeywords?: string[];
}

/** 职位筛选条件（前端表单 + 分页参数）。 */
export interface JobQuery {
  /** 城市（中文名或 id 字符串）。 */
  city?: string;
  /** 城市 id（直接使用 YEEYI code）。 */
  cityId?: string;
  /** 要过滤的城区名列表 / suburbIds。 */
  suburbs?: string[];
  /** 关键词。 */
  keyword?: string;
  /** 是否包含要求 PR 的职位（默认 false —— 前端默认过滤掉 PR）。 */
  allowPR?: boolean;
  /** 页码（从 1 起）。 */
  page?: number;
  /** 每页条数。 */
  pageSize?: number;
}

/** /api/jobs 的统一响应。 */
export interface JobsResponse {
  jobs: Job[];
  page: number;
  pageSize: number;
  total: number;
  /** YEEYI 原始接口是否成功。 */
  source: "yeeyi" | "mock";
  error?: string;
}