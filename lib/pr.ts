/**
 * 是否“要求 PR(永久居留)”的启发式判定。
 *
 * YEEYI 的 getSectionList 返回了一个独立的 `visa` 字段，实测取值包括：
 *   "不限"、"工作签"、"PR"、"学生签"、"澳洲国籍"（偶有空串）。
 * 因此可以相对可靠地判断：
 *   - visa === "PR"          → 明确要求 PR
 *   - subject 命中关键词      → 兜底（标题里写“需PR/需永居/PR临签”等）
 *
 * 注意：该判定为启发式，不保证 100% 准确，前端展示时应注明。
 */

const PR_KEYWORDS = [
  "PR",
  "pr",
  "永居",
  "永久居留",
  "PR临签",
  "需PR",
  "要求PR",
  "citizen required",
  "需citizen",
  "本地PR",
];

/**
 * 判断一条职位是否要求 PR。
 * @param visa YEEYI 的 visa 字段原文（可能为空/undefined）。
 * @param title 标题文本（用于关键词兜底）。
 */
export function requiresPR(visa: string | null | undefined, title?: string): boolean {
  const visaVal = (visa ?? "").trim();
  if (!visaVal || visaVal === "不限") {
    // visa 未明确要求 PR → 只看标题关键词兜底
    return hasPRKeyword(title);
  }
  if (visaVal === "PR") return true;
  return hasPRKeyword(title);
}

/** 仅在正文里出现 PR 类关键词时判定为要求 PR（弱信号）。 */
export function hasPRKeyword(text?: string): boolean {
  if (!text) return false;
  return PR_KEYWORDS.some((kw) => text.includes(kw));
}

/** 提取用于展示的签证标签。 */
export function visaLabel(visa: string | null | undefined): string {
  const v = (visa ?? "").trim();
  if (!v || v === "不限") return "签证不限";
  return v;
}