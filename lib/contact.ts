/**
 * lib/contact —— 从职位详情里抽取联系方式，并组合「立即联系」的短信文案。
 * （服务于 Feature 6: 立即联系短信 / Feature 7: VCard 二维码）
 */
import type { JobDetail } from "@/types/jobDetail";
import type { Job } from "@/types/job";
import type { SelfIntroProfile } from "@/store/profileStore";

/** 从联系方式数组里挑出第一处命中关键词的 value。 */
function pickContactValue(
  detail: JobDetail,
  re: RegExp,
): { label: string; value: string } | undefined {
  for (const c of detail.contact) {
    if (re.test(c.label) && c.value.trim()) return c;
  }
  return undefined;
}

/** 抽取出联系人的展示名称（姓名/联系人）。优先 detail.contact 里“姓名/联系人”字段，其次 author。 */
export function contactName(detail: JobDetail): string {
  if (!detail) return "";
  const c = pickContactValue(detail, /姓名|联系人|联系人姓名|称谓|称呼/i);
  if (c?.value) return c.value;
  return detail.author || "";
}

/** 抽出联系电话（数字字符串）。优先 detail.tel，其次 contact 里的电话/手机项。 */
export function extractPhone(detail: JobDetail): string {
  if (!detail) return "";
  if (detail.tel && detail.tel !== "0") return detail.tel.replace(/\D/g, "").trim();
  const c = pickContactValue(detail, /电话|手机|mobile|tel/i);
  if (c?.value) return c.value.replace(/\D/g, "").trim();
  return "";
}

/**
 * 组装「立即联系」短信文案：由自我介绍表单 + 当前岗位信息组成。
 * 参考文案风格：您好，我想应聘上茶boxhill店。我是whv签证，有效期到27年9月。……希望能有机会去店里试工或面试。谢谢！
 * @param detail 爬虫拿到的职位详情（联系人/正文等信息）。
 * @param job     列表里的 Job（标题/公司/城区）。
 * @param profile 用户在「自我介绍」抽屉填写的资料（intro 为自我介绍正文）。
 */
export function buildSmsText(
  detail: JobDetail,
  job: Job,
  profile: SelfIntroProfile | null,
): string {
  const intro = profile?.intro?.trim() ? profile.intro.trim() : "";
  const company = (job?.company || "").trim();
  const suburb = (job?.suburb || detail?.location || "").trim();
  // “上茶boxhill店”式目标：公司+城区，末尾加“店”；兜底用岗位标题
  const shopName = company && suburb ? `${company}${suburb}` : company || suburb;
  const target = shopName ? `${shopName}店` : job?.title || detail?.title || "该岗位";

  const text = [
    `您好，我想应聘${target}。`,
    intro,
    "希望能有机会去店里试工或面试。谢谢！",
  ]
    .filter(Boolean)
    .join(" ");
  return text.replace(/\s+/g, " ").trim();
}