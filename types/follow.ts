/**
 * 关注城区（地图选点 → 城市 + 城区，持久化到 Turso）类型（Feature 2）。
 */

export interface FollowSuburb {
  name: string;
  lat?: number;
  lng?: number;
}

export interface FollowLocation {
  /** 记录 id。 */
  id: string;
  /** 主城市名（中文）。 */
  mainCity: string;
  /** 覆盖的城区列表。 */
  suburbs: FollowSuburb[];
  /** 用户为这组关注起的名字（默认取地图地点名/城市名）。 */
  label: string;
  /** 关注时的圆心坐标（可选）。 */
  lat?: number;
  /** 关注时的圆心坐标（可选）。 */
  lng?: number;
  /** 关注时的圆选半径（km，可选）。 */
  radiusKm?: number;
  /** 关注时的可读地名（可选）。 */
  placeName?: string;
  createdAt: number;
  updatedAt: number;
}