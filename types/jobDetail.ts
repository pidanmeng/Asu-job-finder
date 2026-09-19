/**
 * 职位详情（爬取自来源网站 __NEXT_DATA__）类型。
 * 来源网站是 Next.js SSR，关键信息都放在 <script id="__NEXT_DATA__"> 里：
 *   props.pageProps.houseRentDetails.threadInfo
 *     - section_2 —— 帖子主信息（subject / author / tel / address / dateline / views）
 *     - section_3 —— 岗位属性表 [[label, value], …]（工作地点/公司/招聘类型/签证/薪资…）
 *     - section_4 —— 正文（message，HTML）
 *     - section_5 —— 联系信息表 [[label, value], …]（姓名/电话/微信 —— 用户最关心的）
 *     - section_6 —— 图片
 */

export interface JobAttribute {
  label: string;
  value: string;
}

export interface JobDetail {
  tid: string;
  /** 职位标题。 */
  title: string;
  /** 发帖者昵称。 */
  author: string;
  /** 发帖者 id（可拼头像/主页）。 */
  authorid?: string;
  /** 发帖时间（Unix 秒）。 */
  postedAt?: number;
  /** 发帖时间展示串，如 2026-07-26。 */
  postedAtStr?: string;
  /** 浏览数（字符串）。 */
  views?: string;
  /** 职位/公司地址。 */
  location: string;
  /** 城市 id（YEEYI code）。 */
  cityId?: string;
  /** 岗位属性（键值对，来自 section_3）。 */
  attributes: JobAttribute[];
  /** 联系方式（键值对，来自 section_5）—— 通常含 电话/微信 等。 */
  contact: JobAttribute[];
  /** 详情页里的联系电话（section_2.tel 兜底）。 */
  tel?: string;
  /** 正文（HTML 片段）。 */
  message: string;
  /** 图片 URL 列表。 */
  images: string[];
  /** 来源网页 url。 */
  url: string;
  /** 抓取/解析是否成功。 */
  ok: boolean;
  /** 数据来源标识。 */
  source: "yeeyi-detail" | "fallback";
}