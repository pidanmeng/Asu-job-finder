# Suburb 数据说明（Prompt C）

## 数据来源与授权

- **来源**：`www.yeeyi.com` 的 `getCityAndSuburb/` 接口（澳大利亚 AUS 数据），通过 `scripts/gen-suburbs.mjs` 一次拉取生成静态快照。
- **授权**：城市名/城区名/邮编均为公开地理常识信息（suburb 名称与邮编在澳洲政府/开源数据中普遍公开），不涉及受版权保护的私有内容，可自由用于本项目。
- **更新**：以 `data/suburbs.json` 内 `generatedAt` 标记生成时间；可重新运行 `npm run gen:suburbs` 刷新。

## 覆盖范围

覆盖 14 个澳洲城市及其城区，共 **16,393** 个 suburb：

| 城市 | 城市 id | 州 | 城区数 |
|---|---|---|---|
| 墨尔本 Melbourne | 1 | VIC | 3171 |
| 悉尼 Sydney | 2 | NSW | 4481 |
| 黄金海岸 Gold Coast | 3 | QLD | 81 |
| 布里斯班 Brisbane | 4 | QLD | 3315 |
| 阿德莱德 Adelaide | 5 | SA | 1939 |
| 堪培拉 Canberra | 6 | ACT | 149 |
| 珀斯 Perth | 7 | WA | 1729 |
| 达尔文 Darwin | 8 | NT | 360 |
| 霍巴特 Hobart | 10 | TAS | 789 |
| 卧龙岗 Wollongong | 12 | NSW | 110 |
| 中央海岸 Central Coast | 13 | NSW | 152 |
| 吉朗 Geelong | 14 | VIC | 64 |
| 巴拉瑞特 Ballarat | 15 | VIC | 52 |
| 其他 Other | 11 | — | 1 |

> 城市 id 与 YEEYI `getSectionList` 的 `cityFilter` / `getCityAndSuburb` 的 `value` 对齐，可直接用于职位查询。

## 文件结构与字段

文件：`data/suburbs.json`

```jsonc
{
  "generatedAt": "ISO 时间戳",
  "source": "yeeyi.com /api/getCityAndSuburb/ (AUS)",
  "totalSuburbs": 16393,
  "cities": [
    {
      "id": 2,                 // 城市 id（对齐 YEEYI）
      "name": "悉尼",           // 中文名
      "nameEn": "Sydney",      // 英文名
      "state": "NSW",          // 州
      "center": { "lat": -33.8688, "lng": 151.2093 },  // 城市中心（手工整理）
      "suburbs": [
        {
          "suburbId": 6726,     // 城区 id（对齐 YEEYI suburb_id）
          "name": "Sydney",
          "state": "NSW",
          "postCode": "2000",
          "cityId": 2
        }
      ]
    }
  ]
}
```

> **坐标增强**：suburb 本身不绝对坐标，但每个都带邮编。`data/suburb-coords.json`（由 `scripts/enrich-suburb-coords.mjs` 用 OSM Nominatim，邮编级近似中心点生成）为多数编译补上了坐标；`lib/geocode.ts` 的 `nearestSuburbs()` / `nearestSuburb()` 据此按坐标就近返回城区，找不到时回退城市中心。可用 `npm run enrich:coords` 手动/续跑。

## 位置 → 城市/suburb 解析约定（Prompt E 输入输出）

**LLM 调用约定**（`lib/geocode.ts` 提供辅助）：

- **输入**：地图点选坐标 `{lat, lng}` 与可读地名 `placeName`（来自 App D）。
- **预处理（本地粗筛）**：先用 `nearestCity(lat, lng)` 选出最近城市；再用 `buildSuburbContext()` 把该城最多 `limit≈120` 个 suburb 名打包成紧凑上下文注给 LLM。
- **LLM 输出（JSON）**：
  ```json
  {
    "mainCity": "悉尼",
    "country": "Australia",
    "suburbs": ["Chatswood", "Hurstville"],
    "confidence": 0.92,
    "reasoning": "用户点选点在悉尼 CBD 附近，Chatswood 与 Hurstville 为通勤可达的就业城区"
  }
  ```
- **兜底**：LLM 失败/无 key 时回退 `nearestCity(lat,lng)` 得出的城市作为 `mainCity`，并把该城热门 suburb 作为候选，`confidence` 降低并标记 `mode:"heuristic"`。

**核心函数**（`lib/geocode.ts`）：

| 函数 | 作用 |
|---|---|
| `nearestCity(lat, lng)` | 经纬度 → 最近城市（城市中心约算） |
| `nearestSuburbs(lat,lng,{cityId,limit})` | **按邮编级坐标就近返回城区**（带 lat/lng/distKm；找不到坐标回退城市中心） |
| `nearestSuburb(lat,lng)` | 经纬度 → 最近的单个城区 |
| `suburbCoord(suburb, city)` / `loadCoordMap()` | suburb → 坐标（邮编中心点）或城市中心 |
| `findCityByKeyword(keyword)` | 中英文 → 城市 |
| `findSuburbsByKeyword(kw, cityId)` | 城区名/邮编模糊匹配 |
| `matchSuburbExactly(name, cityId)` | 精确匹配城区（映射回 suburbId） |
| `findSuburbById(suburbId)` | suburbId → 城区+所在城市 |
| `buildSuburbContext({cityId, lat, lng, limit})` | 生成喂给 LLM 的紧凑 suburb 上下文 |
| `cityDisplayName(cityId)` / `cityEnName(cityId)` | id → 中/英文城市名 |

这些函数同时被：
- `app/api/resolve-location/route.ts`（App E，启发式用 `nearestSuburbs`）
- `app/api/jobs/route.ts`（App F，suburb→suburbId 映射）
- 前端城市/城区下拉（App F）复用。

## suburb 坐标（邮编级）

- 文件：`data/suburb-coords.json`（key=邮编，value=`{lat,lng,state}`），覆盖率 **100%**（2659/2659 邮编）。
- 生成：`npm run enrich:coords` → `scripts/build-suburb-coords.mjs`。
- 主数据源：[joelkoen/postcodes-au](https://github.com/joelkoen/postcodes-au)（社区维护，CC 授权，澳邮邮编级人口加权中心点）；缺失邮编用 OSM Nominatim 兜底。
- 精度：邮编级中心，多个共享邮编的相邻城区坐标相同（如 2000 → Sydney CBD 一带）。对“就近”判定足够；如需逐城区精确界限，可升级到该数据集 `localities-au.csv`（逐 locality 坐标）。
- 兜底：`lib/geocode.ts` 找不到某个邮编时回退到所属城市中心点（次优但不会崩）。