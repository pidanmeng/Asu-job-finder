/**
 * YEEYI(亿忆) 平台接口的 TypeScript 类型定义。
 * 依据 docs/yeeyi-api.md 的逆向分析整理，与真实抓包返回结构保持一致。
 */

/** 所有 YEEYI 接口的标准响应外层包裹。status===0 表示成功。 */
export interface YeeyiEnvelope<T> {
  status: number;
  message?: string;
  /** 数据本体（具体结构随接口不同而不同）。 */
  data?: T;
  /** 某些列表接口直接把结果放在顶层 threadlist。 */
  threadlist?: YeeyiThreadItem[];
  /** getCityAndSuburb / getNavigatorCity 返回的版本时间戳，可带回来做增量缓存。 */
  version?: string;
}

/** 职位/职业分类（getPositionList 返回）。position 内嵌其下细类。 */
export interface YeeyiPositionCategory {
  id: number;
  name: string;
  position: YeeyiPosition[];
}

export interface YeeyiPosition {
  id: number;
  name: string;
}

/** 城市（getNavigatorCity / getCityAndSuburb 返回）。 */
export interface YeeyiCity {
  id: number;
  name: string;
  /** 州代码，如 NSW / VIC / QLD / SA / WA / ACT / NT / TAS。 */
  state?: string;
  /** 热门标记。 */
  is_popular?: number;
  /** 展示排序。 */
  sort?: number;
  /** 在城市分组中的展示值（getCityAndSuburb 专用）。 */
  value?: number;
  /** 所属国家 id（getNavigatorCity 专用）。 */
  country_id?: number;
  /** 所属国家代码（getNavigatorCity 专用）。 */
  country_code?: string;
}

/** 城区（suburb）—— getCityAndSuburb 的 suburbList 成员。 */
export interface YeeyiSuburb {
  suburbId: number;
  /** 州代码，如 NSW。 */
  state: string;
  /** 城区名，如 "Sydney" / "Chatswood"。 */
  name: string;
  /** 展示名："{name}, {state} {postcode}"。 */
  showName: string;
  /** 邮编，字符串。 */
  postCode: string;
  /** 所属城市 id，对应 YeeyiCity.id。 */
  cityId: number;
  /** 热门城区标记。 */
  hot: number;
}

/** getCityAndSuburb 的 data 结构：城市 + 每个城市下的城区列表。 */
export interface YeeyiCityAndSuburb {
  nearBy: number;
  cityList: YeeyiCity[];
  /** key 形如 "city_{id}"，value 是该城市下的城区数组。 */
  suburbList: Record<string, YeeyiSuburb[]>;
}

/** getNavigatorCity 的 data 结构。 */
export interface YeeyiNavigatorCity {
  countryList: {
    country_id: number;
    country_code: string;
    country_name: string;
    country_timezone: string;
    phone_prefix: string;
    cityList: YeeyiCity[];
  }[];
  hotCityList: {
    id: number;
    name: string;
    country_id: number;
    country_code: string;
    country_name: string;
    sort: number;
    pc_sort: number;
  }[];
}

/**
 * 求职招聘帖子（getSectionList 返回的 threadlist 成员）。
 * 字段已按真实抓包内容全部记录。
 */
export interface YeeyiThreadItem {
  /** 频道 id（求职招聘 = 161）。 */
  fid: string;
  iftopad: string;
  likes: string;
  /** 帖子 id，可作为职位唯一标识。 */
  tid: string;
  /** 公司/店铺名。 */
  company: string;
  /** 城区展示名，如 "Sydney, NSW 2000"（含邮编）。 */
  suburb: string;
  /** 城区 id，对应 YeeyiSuburb.suburbId。 */
  suburb_id: string;
  /** 薪资形式：1=按小时/可能含年薪, 2=按月(?)，3=面议/薪资面议。 */
  salary_form: string;
  salary: string;
  salary_hour_from: string;
  salary_hour_end: string;
  salary_month_from: string;
  salary_month_end: string;
  salary_year_from: string;
  salary_year_end: string;
  salary_day_from: string;
  salary_day_to: string;
  /** 职位分类 id，对应 getPositionList 的 YeeyiPositionCategory.position[].id。 */
  position_id: string;
  /** 行业 id。 */
  industry_id: string;
  /** 全职性质：不限 / 全职 / 兼职 / 临时 / 合同工 / 实习。 */
  property: string;
  /**
   * 签证要求 —— 判断是否要求 PR 的关键字段。
   * 实测可取值：不限 / 工作签 / PR / 学生签 / 澳洲国籍（另有空串）。
   * requiresPR = visa === "PR" 或 subject 中出现 PR/永居 类关键词。
   */
  visa: string;
  /** 经验要求：需要 / 不需要 / 不限 等。 */
  experience: string;
  /** 学历要求（数值编码）。 */
  education: string;
  /** 城市 id，对应 YeeyiCity.id。 */
  city: string;
  ext_data: string | null;
  /** 发帖人。 */
  author: string;
  authorid: string;
  /** 帖子标题（职位名称 + 描述片段）。 */
  subject: string;
  /** Unix 时间戳（秒）—— 发帖时间。 */
  dateline: string;
  /** Unix 时间戳（秒）—— 最近刷新时间。 */
  refresh: string;
  views: string;
  replies: string;
  cover: number;
  lastpost: string;
  bolder: unknown;
  subjectStyle: { isBold: number; isTilt: number; isUnderline: number; color: string };
  /** 缩略图 URL 列表。 */
  pic: string[];
  type: string;
  typeid: number;
  /** 频道名，如 "求职招聘"。 */
  fname: string;
  replyCount: number;
  is_favorite: number;
  /** 大图 URL 列表。 */
  bigpic: string[];
  /** 列表选项，如 ["不限","薪资面议"] / ["兼职","薪资面议"]。 */
  list_option: string[];
  userface: string;
}