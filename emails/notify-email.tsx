/**
 * emails/notify-email.tsx —— 新岗位推送邮件模板（React Email）。
 * 用 @react-email/components 组装 HTML 邮件（内联样式），
 * 服务端通过 @react-email/render 的 render() 渲染成 html 后交给 Resend 发送。
 */
import React from "react";
import type { CSSProperties } from "react";
import {
  Body,
  Container,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export interface NotifyJobItem {
  title: string;
  company: string;
  salary: string;
  type: string;
  suburb: string;
  url: string;
}

export interface NotifyGroup {
  mainCity: string;
  suburbNames: string;
  jobs: NotifyJobItem[];
}

export interface NotifyEmailProps {
  /** 时段文案，如“早上 8 点”。 */
  slotLabel: string;
  /** 本次新增职位总数。 */
  totalNew: number;
  /** 按关注的城区分组。 */
  groups: NotifyGroup[];
  /** 本次任务运行时间（澳洲时间展示）。 */
  runAtLabel: string;
  /** 时区区名，如 Australia/Sydney。 */
  timezoneLabel: string;
}

export default function NotifyEmail(props: NotifyEmailProps) {
  const { slotLabel, totalNew, groups, runAtLabel, timezoneLabel } = props;
  return (
    <Html>
      <Preview>{String(totalNew)} 个新岗位：澳洲「{slotLabel}」新岗位提醒</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>🦘 澳洲新岗位提醒</Heading>
          <Text style={meta}>
            时段：{slotLabel}（澳洲时间） · 运行于 {runAtLabel}（{timezoneLabel}）
          </Text>
          <Text style={lead}>
            你关注的城区有 <strong>{String(totalNew)}</strong> 个新招聘岗位，快去看看：
          </Text>
          <Hr style={hr} />

          {groups.length === 0 ? (
            <Text style={empty}>本次没有基于关注城区拉取到岗位明细。</Text>
          ) : (
            groups.map((g, gi) => (
              <Section key={gi} style={group}>
                <Heading style={h2}>
                  📍 {g.mainCity}
                  <span style={subMeta}>{g.suburbNames}</span>
                </Heading>
                <ul style={list}>
                  {g.jobs.map((j, ji) => (
                    <li key={ji} style={item}>
                      <Link href={j.url} style={jobTitleLink}>
                        {j.title}
                      </Link>
                      <div style={jobMeta}>
                        {j.company}
                        {j.salary ? ` · ${j.salary}` : ""}
                        {j.type ? ` · ${j.type}` : ""}
                        {j.suburb ? ` · ${j.suburb}` : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              </Section>
            ))
          )}

          <Hr style={hr} />
          <Text style={footer}>
            本邮件由「澳聘 · 澳洲找工作助手」定时推送。如需取消关注或调整时段，请回到应用里的「关注城区」设置。
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body: CSSProperties = { backgroundColor: "#f6f8fb", fontFamily: "system-ui, sans-serif", padding: "24px 12px" };
const container: CSSProperties = { maxWidth: 560, margin: "0 auto", background: "#ffffff", borderRadius: 12, padding: "24px 28px" };
const h1: CSSProperties = { fontSize: 20, lineHeight: "1.3", color: "#0f172a", margin: "0 0 8px" };
const meta: CSSProperties = { fontSize: 12, color: "#64748b", margin: "0 0 12px" };
const lead: CSSProperties = { fontSize: 14, color: "#1e293b", margin: "0 0 16px" };
const hr: CSSProperties = { border: "none", borderTop: "1px solid #e2e8f0", margin: "16px 0" };
const group: CSSProperties = { margin: "0 0 16px" };
const h2: CSSProperties = { fontSize: 15, fontWeight: 600, color: "#0f172a", margin: "0 0 6px" };
const subMeta: CSSProperties = { fontWeight: 400, fontSize: 12, color: "#64748b", marginLeft: 8 };
const list: CSSProperties = { margin: 0, padding: 0, listStyle: "none" };
const item: CSSProperties = { margin: "0 0 8px", fontSize: 14, color: "#1e293b" };
const jobTitleLink: CSSProperties = { color: "#0ea5e9", fontWeight: 600, textDecoration: "none" };
const jobMeta: CSSProperties = { fontSize: 12, color: "#475569", marginTop: 2 };
const empty: CSSProperties = { fontSize: 14, color: "#475569" };
const footer: CSSProperties = { fontSize: 11, color: "#94a3b8", margin: 0 };