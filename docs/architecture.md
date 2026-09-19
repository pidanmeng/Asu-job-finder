# 架构说明

## 概览

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Browser (Next.js)                            │
│  页面: / (地图选址) · /jobs (职位列表 + AI 聊天)                        │
│  状态: mapStore · jobStore · chatStore (Zustand)                      │
└────────────┬───────────────────────────────┬────────────────────────┘
             │                               │
        /api/resolve-location           /api/jobs · /api/chat
             │                               │
┌────────────▼───────────────┐   ┌───────────▼─────────────────────────┐
│ 位置解析                    │   │ 职位/AI                             │
│  lib/geocode(suburb数据)    │   │  lib/yeeyi → YEEYI(getSectionList)  │
│  lib/llm (LLM 推断+兜底)     │   │  lib/jobs 清洗 + PR 过滤            │
│  data/suburbs.json          │   │  lib/llm (AI 筛选 + 启发式)          │
└────────────────────────────┘   └────────────────────────────────────┘
         数据基础(两端复用)               外部服务(全部走服务端, 规避跨域)
    lib/geocode · data/suburbs.json   YEEYI(yeeyi.com) · LLM(OpenAI兼容)
```

## 设计要点

1. **服务端代理隔绝外部平台**：YEEYI 与 LLM 的调用全部集中在 Next.js Route Handler（`app/api/*`），
   前端不持有第三方鉴权、不遭遇跨域，外部接口反爬/故障时可降级。
2. **数据流**：`地图选点(mapStore.picked) → resolve-location(resolved) → /jobs 查询(jobStore) → /api/chat 上下文 → chatStore 收藏`。
3. **PR 判定**：`lib/pr.ts` 用 `getSectionList.visa === "PR"` 为主 + 标题关键词兜底；`/api/jobs` 默认 `allowPR=false` 过滤，前端有开关。
4. **降级路径**：
   - YEEYI 不可用 → `lib/mock.ts` 本地示例数据（标记 `source:"mock"`）。
   - LLM 无 key/失败 → 位置解析用 `nearestCity` 启发式、聊天用 `heuristicReply`（`mode:"heuristic"`）。
   - 地图反向编码失败 → 仅保留坐标，`placeName` 为空。
5. **suburb 数据**：`data/suburbs.json` 由脚本从 YEEYI 真实接口生成（Prompt C），
   suburb 无经纬度，通过城市中心距离 + 名称匹配就近判断；LLM 解析前先本地粗筛控制 token。

## 目录职责

| 目录 | 职责 |
|---|---|
| `app/` | 页面与 API 路由（App Router） |
| `components/` | 地图 / 职位卡片 / 聊天 等 UI |
| `store/` | Zustand 全局状态 |
| `hooks/` | 复用 hooks（如 useLocation） |
| `lib/` | 业务逻辑：yeeyi / jobs / pr / geocode / llm / mock |
| `types/` | 公共类型定义 |
| `data/` | suburb 静态数据 |
| `docs/` | 逆向文档 / suburb 数据说明 / 本文档 |
| `scripts/` | 探活与数据生成脚本 |