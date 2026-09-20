/**
 * lib/resend —— Resend 邮件客户端封装（Feature 3）。
 * 环境变量：RESEND_API_KEY。未配置时 isResendConfigured() 返回 false，定时任务跳过发信（仍记录运行）。
 * Html 由 @react-email/render 生成后通过 resend.send({ ..., html }) 发送。
 */
import { Resend } from "resend";

export const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
/** 收件人邮箱（默认给到任务指定地址）。 */
export const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL ?? "544286176@qq.com";
/** 发件地址（需为 Resend 已验证的域名，如 onboarding@resend.dev / noreply@yourDomain.com）。 */
export const FROM_EMAIL = process.env.FROM_EMAIL ?? "";

export function isResendConfigured(): boolean {
  return Boolean(RESEND_API_KEY) && Boolean(FROM_EMAIL);
}

let _resend: Resend | null = null;
export function getResend(): Resend | null {
  if (!isResendConfigured()) return null;
  if (!_resend) _resend = new Resend(RESEND_API_KEY);
  return _resend;
}

export interface SendMailInput {
  subject: string;
  html: string;
  to?: string;
}

/** 发送一封邮件；返回是否成功。 */
export async function sendMail({ subject, html, to }: SendMailInput): Promise<{ ok: boolean; error?: string }> {
  const client = getResend();
  if (!client) return { ok: false, error: "Resend 未配置（RESEND_API_KEY / FROM_EMAIL）" };
  try {
    const res = await client.emails.send({
      from: FROM_EMAIL,
      to: to ?? NOTIFY_EMAIL,
      subject,
      html,
    });
    if (res.error) return { ok: false, error: res.error.message ?? "Resend 发送失败" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Resend 发送失败" };
  }
}