/**
 * lib/vcard —— 根据「当前联系人 + 岗位信息」生成 VCard 3.0 文本（Feature 7）。
 * 生成的是招聘方/联系人的名片卡：姓名、电话、公司、职位、地点、链接、备注。
 * 前端用 qrcode 库把这段文本转成二维码，并可下载 .vcf 文件。
 */
import type { JobDetail } from "@/types/jobDetail";
import type { Job } from "@/types/job";
import { contactName, extractPhone } from "@/lib/contact";

/** VCard 值转义：反斜杠、逗号、分号、换行。 */
function escapeV(v: string): string {
  return (v ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, " ")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** 生成 VCard 3.0 文本（CRLF 行分隔，符合规范）。 */
export function buildVCard(detail: JobDetail, job: Job): string {
  const name = escapeV(contactName(detail) || (job?.company ? "招聘联系人" : "联系人"));
  const phone = extractPhone(detail);
  const org = escapeV(job?.company || "");
  const title = escapeV(job?.title || detail?.title || "");
  const loc = escapeV(job?.suburb || detail?.location || "");
  const url = job?.applyUrl && job.applyUrl !== "#" ? job.applyUrl : detail?.url || "";
  const note = escapeV(
    `职位：${job?.title || ""}${job?.salary ? `｜薪资：${job.salary}` : ""}${
      job?.type ? `｜${job.type}` : ""
    }${loc ? `｜地点：${loc}` : ""}`,
  );

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${name}`,
    `N:${name};;;;`,
  ];
  if (org) lines.push(`ORG:${org}`);
  if (title) lines.push(`TITLE:${title}`);
  if (phone) lines.push(`TEL;TYPE=CELL:${phone}`);
  if (loc) lines.push(`ADR;TYPE=WORK:;;;${loc};;;;`);
  if (url) lines.push(`URL:${url}`);
  if (note) lines.push(`NOTE:${note}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

/** 把 VCard 文本封装成可下载的 .vcf 文件（前端 blob 下载）。 */
export function vCardBlob(vcard: string): Blob {
  return new Blob([vcard], { type: "text/vcard;charset=utf-8" });
}