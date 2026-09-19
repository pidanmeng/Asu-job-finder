# 澳聘 · 澳洲找工作 AI 助手

一个基于 **Next.js (App Router) + TypeScript + Tailwind CSS + Zustand** 的澳洲找工作 Web 应用。
用户在地图上点选位置 → 解析城市/城区 → 从 **YEEYI(亿忆, yeeyi.com)** 抓取职位（默认过滤要求 PR 的）→ 用 AI 聊天式筛选与推荐。

> 项目按 `prompts/项目提示词集.md` 的 A–H 八个阶段实现。逆向数据来自 `yeeii.postman_collection.json` 抓包。

---

## ✨ 功能

| 阶段 | 能力 |
|---|---|
| D | 地图选址（Leaflet + OpenStreetMap，无需 key），点选落标记 + 反向地理编码；按「城区域级坐标」就近匹配城区 |
| E | 位置解析：`/api/resolve-location` 结合 suburb 数据由 LLM 推断城市+城区（无 key 自动回退启发式） |
| F | 职位获取：`/api/jobs` 服务端代理 YEEYI，统一清洗，「是否要求 PR」判定，默认过滤 PR，支持关键词/城区/分页/含PR开关 |
| G | AI 筛选：`/api/chat` Chatbot 式推荐，默认优先不要求 PR，可收藏推荐企业 |
| H | 职位详情：点击卡片「查看详情」不再跳转平台，而是 `/api/jobs/[tid]` 爬取来源页 `__NEXT_DATA__` 以弹窗展示；「✓ 已投递」持久化并隐藏卡片，侧边抽屉可查看/撤销 |
| B | YEEYI 接口逆向文档 `docs/yeeyi-api.md` + 类型 `types/yeeyi.ts` + 探活脚本 |
| C | suburb 静态数据 `data/suburbs.json`（16393 城区，来自 YEEYI 真实接口）+ `lib/geocode.ts` |

---

## 🚀 本地启动

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（不配 key 也能跑，会自动进入“启发式兜底”模式）
cp .env.local.example .env.local   # 按需填写 LLM key / YEEYI 配置

# 3. 启动开发服务器
npm run dev            # 访问 http://localhost:3000

# 或生产模式
npm run build && npm run start
```

> **网络代理说明**：若运行环境需要走代理（如本机 127.0.0.1:7890），启动前设置：
> ```bash
> # PowerShell
> $env:HTTPS_PROXY="http://127.0.0.1:7890"; $env:HTTP_PROXY="http://127.0.0.1:7890"; $env:NODE_OPTIONS="--use-env-proxy"
> # bash/zsh
> export HTTPS_PROXY=http://127.0.0.1:7890 HTTP_PROXY=http://127.0.0.1:7890 NODE_OPTIONS=--use-env-proxy
> ```

### 环境变量（`.env.local`）

| 变量 | 说明 | 默认 |
|---|---|---|
| `YEEYI_ENABLED` | 是否启用真实 YEEYI 抓取 | `true` |
| `YEEYI_FID` | 求职招聘频道 fid | `161` |
| `YEEYI_DEFAULT_CITY` | 默认城市 id | `2`（悉尼） |
| `YEEYI_DEVID` | 匿名设备标识（留空自动生成） | — |
| `LLM_BASE_URL` | OpenAI 兼容接口地址（OpenAI/DeepSeek/Moonshot…） | `https://api.openai.com/v1` |
| `LLM_MODEL` | 模型名 | `deepseek-chat` |
| `LLM_API_KEY` | **模型 API Key（勿提交）** | — |
| `LLM_FALLBACK_ENABLED` | 无 key 时是否用启发式兜底 | `true` |
| `MAPBOX_ACCESS_TOKEN` | 预留（当前用免费 OSM，无需） | — |

未配置 `LLM_API_KEY` 时，位置解析与筛选自动使用启发式结果，主流程仍可完整跑通（适合本地演示）。

---

## 🧭 完整用户路径（端到端）

1. 首页地图点选澳洲位置（如悉尼 CBD）→ 显示坐标与地名。
2. 点「② 解析所在城市/城区」→ `/api/resolve-location` 返回 `{mainCity, suburbs, confidence}`。
3. 点「③ 搜索该区域职位」→ 跳转 `/jobs?city=悉尼&suburbs=…`，显示职位卡片（默认不含 PR）。
4. 打开右侧「AI 筛选助手」→ 用自然语言让 AI 基于真实职位筛选/总结出合适企业并附理由。
5. 点职位卡片「+ 推荐」或在对话中被认可的企业进入「⭐ 推荐企业」列表展示。

---

## 📁 目录结构

```
app/
  layout.tsx, page.tsx          首页（地图选址 + 位置解析）
  globals.css                   Tailwind 全局样式
  jobs/page.tsx, client.tsx     职位列表 + AI 聊天 + 已投递抽屉
  api/resolve-location/route.ts 位置解析（LLM + 兜底）
  api/jobs/route.ts             YEEYI 代理 + 清洗 + PR 过滤（mock 兜底）
  api/jobs/[tid]/route.ts       职称详情快取：爬来源页 __NEXT_DATA__ 解析（联系方式等）
  api/chat/route.ts             AI 筛选聊天（启发式兜底，CopilotKit 未配置时使用）
  api/chat/status/route.ts      LLM 是否配置探针
  api/copilotkit/[[...slug]]/route.ts  CopilotKit Runtime（流式聊天后端，Prompt G）
components/map/LocationPicker.tsx  地图选址（Prompt D，Leaflet/OSM）
components/job/JobCard.tsx         职位卡片（Prompt F + 查看详情/已投递）
components/job/JobDetailModal.tsx  职位详情弹窗（来源网页 __NEXT_DATA__）
components/job/AppliedDrawer.tsx   「已投递」侧边抽屉（查看/撤销）
components/job/SuburbFilterModal.tsx 城区筛选弹窗
components/chat/JobCopilot.tsx     聊天面板（CopilotKit 流式 + Markdown 展示）
components/copilot/CopilotProvider.tsx  CopilotKit 提供者（根布局挂载）
components/markdown/Markdown.tsx   模型输出 Markdown 格式化渲染
lib/yeeyi.ts                  YEEYI 客户端（Prompt B）
lib/pr.ts                     PR 判定（visa 字段 + 关键词）
lib/jobs.ts                   职位清洗与薪资格式化
lib/geocode.ts                位置→城市/suburb 匹配（Prompt C，城区域级坐标）
lib/threadDetail.ts           来源页 __NEXT_DATA__ 解析
lib/llm.ts                    大模型客户端（OpenAI 兼容）
lib/mock.ts                   YEEYI 不可用时的本地示例数据
store/mapStore.ts, jobStore.ts, chatStore.ts, appliedStore.ts   Zustand 状态
hooks/useLocation.ts          读取位置 hook
types/                        公共类型（yeeyi/job/jobDetail/geo/suburb）
data/suburbs.json             澳洲 14 城市 16393 城区（Prompt C）
data/suburb-coords.json       邮编级坐标（兜底）
data/suburb-points.json       城区域级坐标（GeoNames 主源，Nominatim 补齐）
docs/yeeyi-api.md, suburb-data.md, architecture.md
scripts/yeeyi-probe.ts         YEEYI 接口探活脚本
scripts/gen-suburbs.mjs        suburb 数据生成器
scripts/build-suburb-coords.mjs  suburb 坐标生成器（邮编级，主源 joelkoen/postcodes-au）
scripts/build-suburb-points.mjs  城区域级坐标生成器（GeoNames(AU) 按名字+州匹配）
scripts/enrich-points-nominatim.mjs  Nominatim 补齐缺失城区坐标（可断续）
```

常用脚本：

```bash
npm run probe -- --city 2              # 探活：拉悉尼职位
npm run probe -- --city 2 --keyword 会计
npm run probe -- --positions           # 打印职位分类树
npm run gen:suburbs                    # 重新生成 data/suburbs.json
npm run enrich:coords                  # 生成 data/suburb-coords.json（邮编级坐标）
npm run enrich:points                  # 生成 data/suburb-points.json（城区域级坐标，GeoNames）
npm run enrich:points:nominatim        # 用 Nominatim 补齐缺失城区坐标（可断续续跑）
npm run test:geo                       # geocode/就近匹配自测
npm run typecheck                      # tsx 类型检查
npm run build                          # 生产构建
```

> **坐标说明**：`data/suburb-points.json` 为「城区域级」近似坐标（主源 GeoNames AU 聚落点，按「名字+州」匹配、冲突取距邮编中心最近者，缺失用 OSM Nominatim 补齐），供 `nearestSuburbs()` 按坐标就近匹配。此前用邮编级 `data/suburb-coords.json` 会导致同一邮编下多个城区共享坐标（如悉尼 CBD 十余个城区共用一个邮编），从而出现「距选点距离全部相同、列表按首字母排序」的错误；现以城区域级坐标为主，邮编坐标仅作兜底。地图选点默认走该就近匹配。需用 `npm run enrich:points`（GeoNames）与 `npm run enrich:points:nominatim`（可选补齐）重新生成该文件。

---

## 🤖 关于 CopilotKit（Prompt G — 流式）

本项目已接入 **CopilotKit v2** 自托管 Runtime 实现 AI 筛选助手的**流式输出**：

- **后端**：`app/api/copilotkit/[[...slug]]/route.ts` 用 `@copilotkit/runtime/v2` 的 `BuiltInAgent`，
  通过 `@ai-sdk/openai` 的 `createOpenAI` 指向自定义 OpenAI 兼容接口（`LLM_BASE_URL`）。
  注意必须用 `provider.chat(model)`（走 `/chat/completions`）；默认 `provider(model)` 走 `/responses`，
  多数兼容接口（包含本项目）不支持会 404。
- **前端**：`components/copilot/CopilotProvider.tsx` 在根布局挂 `<CopilotKit runtimeUrl="/api/copilotkit">`；
  `components/chat/JobCopilot.tsx` 用 `useAgent` 绑定 default agent，assistant 消息**边生成边推送、边收边渲染**。
- **工具/上下文**：把当前职位 JSON 注入用户消息作为真实数据上下文，默认偏好【优先不要求 PR】。
- **Markdown 展示**：`components/markdown/Markdown.tsx` 用 `react-markdown + remark-gfm` 把模型输出的
  Markdown 解析为列表/表格/代码块等格式化展示；若有思考片段（thinking/reasoning）会折叠成「💭 思考过程」。
- **兜底**：未配置 `LLM_API_KEY` 时，`/api/chat/status` 探测后回退到原 `/api/chat` 启发式回复（仍走 Markdown 渲染），
  保证无 key 也能演示。推荐企业仍落进 `chatStore` 展示。

---

## 🔍 YEEYI 逆向结论摘要（详见 `docs/yeeyi-api.md`）

- 5 个接口全部 `POST + JSON`，读类请求无需登录（`authcode` 传 `null`）。
- 职位列表核心接口：`POST https://www.yeeyi.com/api/getSectionList/`（求职频道 `fid=161`）。
- 城市/城区：`POST /api/getCityAndSuburb/`（country=`AUS`），返回 `cityList` + `suburbList`。
- **“是否要求 PR”可直接判定**：`getSectionList` 返回独立 `visa` 字段（取值含 `PR`/`工作签`/`学生签`/`澳洲国籍`），叠加标题关键词（PR/永居/PR临签）启发式兜底。逻辑见 `lib/pr.ts`。

---

## 💰 成本与订阅

| 项 | 方案 | 成本 |
|---|---|---|
| 地图 | Leaflet + OSM | 免费，无需 key |
| 职位数据 | YEEYI 公开频道抓取 | 免费（低频、礼貌访问，勿批量） |
| 大模型 | OpenAI 兼容 API（DeepSeek/Moonshot/OpenAI） | 按 token 计费；不配 key 则用启发式，免费 |

---

## ⚠️ 免责声明

职位聚合自 YEEYI(亿忆) 社区公开频道；「是否要求 PR」为系统关键词判断，可能不准确，请以帖子原文为准。本项目仅供学习与研究用途，请遵守平台使用规则、保持低频访问。