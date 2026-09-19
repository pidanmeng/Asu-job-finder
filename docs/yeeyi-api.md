# YEEYI(亿忆) 求职接口逆向文档

> 依据对 `yeeyi.com` 平台的真实网络抓包（`yeeii.postman_collection.json`）加多次实际调用验证得出。
> 覆盖 5 个接口的请求方式、URL、入参、出参结构与字段字典，并附可执行示例代码。
> 全部接口均为 **POST + application/json**，几乎都不需要登录鉴权即可低频访问（`authcode` 为可选）。
> 文中所有示例为实际调用去脱敏后整理，字段与真实返回一致。

---

## 1. 总览

| 接口名 | 方法 | 路径 | 用途 | 本项目使用 |
|---|---|---|---|---|
| `getPositionList` | POST | `/api/getPositionList/` | 职位/职业分类树 | 前端搜职位分类筛选用 |
| `getSectionList` | POST | `/api/getSectionList/` | **求职招聘帖子列表（核心）** | 职位列表页、AI 筛选数据源 |
| `getCityAndSuburb` | POST | `/api/getCityAndSuburb/` | 城市 + 各城市下城区列表 | suburb 数据、位置解析 |
| `getNavigatorCity` | POST | `/api/getNavigatorCity/` | 国家/城市导航（含热门城市） | 选址、城市下拉 |
| `getForumConfig` | POST | `/api/getForumConfig/` | 论坛配置（车型/举报等） | 暂不深度使用 |

统一响应外层：`{ status, message, data?, ... }`，`status === 0` 表示成功，其余为失败/异常。

所有请求都应携带浏览器风格请求头（见 §6）。一旦出现 `status != 0`、HTTP 4xx/5xx 或返回空，多为触发反爬/限流，需降频或换 User-Agent。

---

## 2. `getSectionList` —— 求职招聘职位列表（核心）

**URL:** `https://www.yeeyi.com/api/getSectionList/`
**Method:** POST
**Content-Type:** `application/json`

### 2.1 入参（body JSON）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `fid` | string | 是 | 频道 id，**求职招聘 = "161"** |
| `nextPage` | number | 是 | 页码（从 1 起）。翻页时递增，并配合 `start` |
| `start` | string | 是 | Unix 秒时间戳，翻页锚点。首屏填大值（如当前时间戳），接口按帖更新时间倒序返回该时间之前的帖子 |
| `cityFilter` | string | 是 | 城市 id（见「城市 code 表」）。`"0"` 表示全部 |
| `nearBy` | string | 是 | 是否按附近显示，传 `"1"` |
| `suburbId` | string/number | 是 | 城区 id（来自 `getCityAndSuburb`）。`0` 表示不限 |
| `devid` | string | 是 | 设备标识，形如 `"uuid|pc"`。可传任意匿名值 |
| `authcode` | string/null | 否 | 登录后才能拿到的鉴权串；无登录传 `null` 即可正常访问 |
| `countryFilter` | string | 是 | 国家 id，**澳大利亚 = "13"** |
| `positionId` | number | 否 | 职位分类 id（来自 `getPositionList`），可按工种过滤 |

**入参来源：** `cityFilter`/`suburbId` 来自 `getCityAndSuburb` 返回的 code；`fid`/`countryFilter` 为固定配置；`start`+`nextPage` 实现翻页。

### 2.2 真实请求样例

```bash
curl -X POST "https://www.yeeyi.com/api/getSectionList/" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0" \
  -H "Referer: https://www.yeeyi.com/" \
  -H "Origin: https://www.yeeyi.com" \
  -d '{
    "fid": "161",
    "nextPage": 1,
    "start": "1789791042",
    "cityFilter": "2",
    "nearBy": "1",
    "suburbId": "0",
    "devid": "f374255-1cf2-f1c6-6230-0173c4353f8|pc",
    "authcode": null,
    "countryFilter": "13"
  }'
```

### 2.3 出参结构（字段字典）

顶层：`{ status: 0, threadlist: YeeyiThreadItem[] }`。`threadlist` 为帖子(职位)数组，单条结构：

| 字段 | 类型 | 可空 | 说明 |
|---|---|---|---|
| `tid` | string | 否 | 帖子 id，可作职位唯一标识 |
| `company` | string | 是 | 公司/店铺名 |
| `subject` | string | 否 | **标题**（职位名称 + 描述，含薪资/要求等） |
| `suburb` | string | 否 | 城区展示名，如 `"Sydney, NSW 2000"`（含邮编） |
| `suburb_id` | string | 否 | 城区 id（对应 `getCityAndSuburb`） |
| `city` | string | 否 | 城市 id（见城市 code 表） |
| `salary_form` | string | 否 | 薪资形式：`1`=按时薪(可能含年薪)、`2`=按月、`3`=面议/薪资面议（实测最多） |
| `salary_hour_from/end` | string | 是 | 时薪区间（每小时） |
| `salary_month_from/end` | string | 是 | 月薪区间 |
| `salary_year_from/end` | string | 是 | 年薪区间 |
| `salary_day_from/to` | string | 是 | 日薪区间 |
| `property` | string | 否 | 全职性质：不限 / 全职 / 兼职 / 临时 / 合同工 / 实习 |
| `visa` | string | 是 | **签证要求：不限 / 工作签 / PR / 学生签 / 澳洲国籍（或空串）** —— 判断 PR 的关键 |
| `experience` | string | 否 | 经验要求：需要 / 不需要 / 不限 |
| `education` | string | 否 | 学历（数值编码） |
| `position_id` | string | 否 | 职位分类 id（对应 `getPositionList`） |
| `industry_id` | string | 否 | 行业 id |
| `author` / `authorid` | string | 否 | 发帖人昵称 / id |
| `dateline` | string | 否 | Unix 秒 —— 发帖时间 |
| `refresh` / `lastpost` | string | 否 | Unix 秒 —— 最近刷新时间 |
| `views` / `replies` | string | 否 | 浏览量 / 回复数 |
| `pic` / `bigpic` | string[] | 是 | 缩略图 / 大图 URL |
| `list_option` | string[] | 是 | 列表选项，如 `["不限","薪资面议"]` |
| `fname` | string | 否 | 频道名，如 `"求职招聘"` |
| `userface` | string | 是 | 发帖人头像 URL |

### 2.4 真实响应样例（脱敏摘录）

```json
{
  "status": 0,
  "threadlist": [
    {
      "fid": "161", "tid": "6016026",
      "company": "ausrecruitment",
      "subject": "仓库运营专员/Warehouse Officer",
      "suburb": "Sydney, NSW 2000", "suburb_id": "6726",
      "city": "2",
      "salary_form": "3", "salary": "0",
      "salary_hour_from": "0", "salary_hour_end": "0",
      "salary_month_from": "0", "salary_month_end": "0",
      "salary_year_from": "0", "salary_year_end": "0",
      "property": "全职", "visa": "不限", "experience": "需要", "education": "0",
      "position_id": "83", "industry_id": "9",
      "author": "AustraliaRecruitment", "authorid": "5655926",
      "dateline": "1784345001", "refresh": "1789798361",
      "views": "517", "replies": "0",
      "pic": ["https://resources.zhayieye.com/bbs/data/...jpg_thread.jpg"],
      "fname": "求职招聘", "list_option": ["不限", "薪资面议"]
    }
  ]
}
```

---

## 3. `getCityAndSuburb` —— 城市 + 城区

**URL:** `https://www.yeeyi.com/api/getCityAndSuburb/` **Method:** POST

**入参：** `{ cityFilter:1, devid, authcode:"", version:0, country:"AUS" }`

**出参：** `data = { nearBy, cityList: YeeyiCity[], suburbList: Record<"city_{id}", YeeyiSuburb[]> }`

- `cityList[].value` = 城市 id；`.name` = 中文城市名（墨尔本/悉尼/…）；`.state` = 州代码（VIC/NSW/…）。
- `suburbList["city_2"]` 为悉尼的城区数组，成员：
  `{ suburbId, state, name, showName:"Sydney, NSW 2000", postCode, cityId, hot }`

### 城市 code 表（AUS）

| value | 城市 | state | value | 城市 | state |
|---|---|---|---|---|---|
| 1 | 墨尔本 | VIC | 8 | 达尔文 | NT |
| 2 | 悉尼 | NSW | 10 | 霍巴特 | TAS |
| 3 | 黄金海岸 | QLD | 11 | 其他 | — |
| 4 | 布里斯班 | QLD | 12 | 卧龙岗 | NSW |
| 5 | 阿德莱德 | SA | 13 | 中央海岸 | NSW |
| 6 | 堪培拉 | ACT | 14 | 吉朗 | VIC |
| 7 | 珀斯 | WA | 15 | 巴拉瑞特 | VIC |

---

## 4. `getPositionList` —— 职位分类树

**URL:** `https://www.yeeyi.com/api/getPositionList/` **Method:** POST
**入参：** `{ cityFilter:"1", devid }`
**出参：** `data.position` = 分类数组 `{ id, name, position: [{id,name},…] }`。例如：
`[{id:1,name:"建筑与施工技能",position:[{id:13,name:"普工/小工/学徒"},{id:1,name:"砌砖工"},…]}, …]`。

该接口用于「按工种筛选」：先由 `getSectionList.position_id` 匹配到 `position.id`。

---

## 5. `getNavigatorCity` / `getForumConfig`

- `getNavigatorCity`：**入参 `{}`**。返回 `data.countryList`（国家下挂城市，含 `country_id/country_code/cityList`）与 `hotCityList`（热门城市）。用于选址、城市选择、属国判断（AUS → `country_id:13`）。
- `getForumConfig`：**入参 `{}`**。返回 `data.configList`（车型品牌、举报原因等），本求职项目暂不使用，保留接入。

---

## 6. 反爬 / 使用注意事项

1. **低频礼貌访问**：本项目通过服务端代理（Next.js Route Handler）统一拉取，缓解跨域；所有请求带一份浏览器风格的 `User-Agent`、`Referer: https://www.yeeyi.com/`、`Origin`。
2. **无登录可读**：`authcode` 传 `null` 即可访问全部 5 个接口；无需登录。
3. **失败处理**：`status != 0`、网络异常、超时（建议 15s）都应视为反爬/限流，前端给出友好错误 + 重试按钮，并可短暂退避。
4. **不做危险写操作**：本阶段只做 `POST` 读取类请求，绝不发帖/评论/批量爬取。

---

## 7. 关键结论：能否拿到「是否要求 PR」？

**能。** 判断方式：

1. **首选字段：`getSectionList` 返回的 `visa` 字段**。实测取值包含 `"PR"`，`visa === "PR"` 即为明确要求 PR。
2. **兜底启发式：对 `subject`（标题）做关键词匹配**，命中 `PR` / `永居` / `PR临签` / `需pr` 等即认为要求 PR。
3. `visa` 为 `"工作签"/"学生签"/"澳洲国籍"/"不限"` 均**不**视为要求 PR。

> 判定逻辑集中在 `lib/pr.ts`，为启发式，前端展示时注明“由系统关键词判断，请以帖子为准”。

---

## 8. 配套代码位置

- 类型定义：`types/yeeyi.ts`
- 服务端客户端：`lib/yeeyi.ts`
- 探活调试脚本：`scripts/yeeyi-probe.ts`（`npm run probe -- --city 2`）
- 统一职位模型 & 清洗：`types/job.ts` + `app/api/jobs/route.ts`