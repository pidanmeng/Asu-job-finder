/**
 * Suburb 静态数据（data/suburbs.json）的类型结构。
 * 对应 Prompt C。
 */

/** 城区条目。 */
export interface Suburb {
  /** 城区 id（与 YEEYI suburbId 对齐）。 */
  suburbId: number;
  name: string;
  /** 州代码，如 NSW。 */
  state: string;
  /** 邮编。 */
  postCode: string;
  /** 所属城市 id（对齐 YEEYI 城市 code）。 */
  cityId: number;
  /** (可选) 近似坐标。 */
  lat?: number;
  lng?: number;
}

/** 城市条目。 */
export interface SuburbCity {
  /** 城市 id（对齐 YEEYI 城市 code）。 */
  id: number;
  /** 中文城市名。 */
  name: string;
  /** 英文城市名（用于 LLM/地图）。 */
  nameEn: string;
  /** 州代码。 */
  state: string;
  /** 中心点坐标（城市级）。 */
  center: { lat: number; lng: number };
  suburbs: Suburb[];
}

/** data/suburbs.json 根结构。 */
export interface SuburbsDataset {
  generatedAt: string;
  source: string;
  cities: SuburbCity[];
}