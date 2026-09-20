/**
 * lib/notifier —— 定时推送核心（Feature 3）。
 *
 * 职责（统一按「澳洲时间」判断时段，时间口径见 lib/time）：
 *   1) 按时段判断是否到点（8:00→近 12h，14:00/20:00→近 6h）；
 *   2) 按「关注城区」依次请求最新岗位；
 *   3) 过滤出“发帖时间在窗口内”的新岗位；
 *   4) 有新增则用 React Email 模板渲染后经 Resend 推送到邮箱；
 *   5) 把本次调用记录写回 Turso（email_runs）。
 *
 * 被 /api/cron/notify 与 scripts/run-notify.ts 复用；传入 now 也便于测试。
 */
import { render } from "@react-email/render";
import type { Job } from "@/types/job";
import type { FollowLocation } from "@/types/follow";
import { getSectionList } from "@/lib/yeeyi";
import { cleanJobs } from "@/lib/jobs";
import { findCityByKeyword, cityDisplayName } from "@/lib/geocode";
import { listFollowLocations, recordEmailRun, latestEmailRun } from "@/lib/turso";
import { sendMail, NOTIFY_EMAIL } from "@/lib/resend";
import { APP_TIME_ZONE, formatTz, getTzParts } from "@/lib/time";
import NotifyEmail from "@/emails/notify-email";

/** 三个定时推送时段：hour(澳洲 0-23)、窗口小时数。 */
export const NOTIFY_SLOTS = [
  { hour: 8, label: "早上 8 点", windowHours: 12 },
  { hour: 14, label: "下午 2 点", windowHours: 6 },
  { hour: 20, label: "晚上 8 点", windowHours: 6 },
] as const;

export type NotifySlot = (typeof NOTIFY_SLOTS)[number];

export function currentSlot(now: Date = new Date()): NotifySlot | null {
  const h = getTzParts(now, APP_TIME_ZONE).hour;
  return NOTIFY_SLOTS.find((s) => s.hour === h) ?? null;
}

/** 是否为“更新”（发帖/刷新时间在窗口内）。 */
function isFresh(job: Job, nowMs: number, windowHours: number): boolean {
  const ts = job.postedAt ?? job.refreshedAt;
  if (!ts) return false;
  return nowMs / 1000 - ts <= windowHours * 3600;
}

/** 按一个关注城区请求最新岗位（默认过滤 PR，与 App 口径一致）。 */
async function fetchFollowJobs(follow: FollowLocation, nowMs: number, windowHours: number): Promise<Job[]> {
  const city = findCityByKeyword(follow.mainCity)[0];
  const cityId = city ? String(city.id) : undefined;
  const cityName = city ? cityDisplayName(city.id) : follow.mainCity;
  try {
    const raw = await getSectionList({
      cityFilter: cityId && /^\d+$/.test(cityId) ? cityId : "0",
      suburbId: "0",
      nextPage: 1,
    });
    let jobs = cleanJobs(raw, { allowPR: false, cityName });
    // 只保留属于关注城区的岗位（名称包含匹配）
    if (follow.suburbs.length) {
      jobs = jobs.filter((j) =>
        follow.suburbs.some((s) => s.name && j.suburb.toUpperCase().includes(s.name.toUpperCase())),
      );
    }
    return jobs.filter((j) => isFresh(j, nowMs, windowHours));
  } catch (e) {
    console.warn(`[notifier] 拉取「${follow.mainCity}」岗位失败：`, e instanceof Error ? e.message : e);
    return [];
  }
}

export interface NotifyResult {
  ran: boolean;
  skipped?: boolean;
  slotLabel?: string;
  followedCount: number;
  newJobsCount: number;
  sentEmail: boolean;
  error?: string;
  message?: string;
}

/**
 * 执行一次定时推送。
 * @param opts.now 指定“当前时间”（默认最新，测试用）；force 忽略同窗去重。
 */
export async function runNotify(opts: { now?: Date; force?: boolean } = {}): Promise<NotifyResult> {
  const now = opts.now ?? new Date();
  const nowMs = now.getTime();
  const slot = currentSlot(now);
  const base: NotifyResult = { ran: false, followedCount: 0, newJobsCount: 0, sentEmail: false };

  if (!slot) {
    return { ...base, ran: false, skipped: true, message: `当前澳洲时间 ${formatTz(now)} 不在推送时段` };
  }

  // 同窗去重：同一时段 45 分钟内已跑过则跳过（防止重复触发/重复发信）
  if (!opts.force) {
    const last = await latestEmailRun();
    if (last && last.slot === slot.label && nowMs - last.runAt < 45 * 60 * 1000) {
      return { ...base, ran: false, skipped: true, message: "同一时段刚运行过，跳过" };
    }
  }

  const follows = await listFollowLocations();
  const baseMsg = `时段 ${slot.label}（${APP_TIME_ZONE}）`;
  if (follows.length === 0) {
    const message = `${baseMsg}，暂无关注城区`;
    await recordEmailRun({ slot: slot.label, followedCount: 0, newJobsCount: 0, success: true, message });
    return { ...base, ran: true, slotLabel: slot.label, message };
  }

  // 逐组请求最新岗位
  const groups: { mainCity: string; suburbNames: string; jobs: Job[] }[] = [];
  let newJobsCount = 0;
  for (const f of follows) {
    const jobs = await fetchFollowJobs(f, nowMs, slot.windowHours);
    if (jobs.length) {
      newJobsCount += jobs.length;
      groups.push({
        mainCity: f.mainCity,
        suburbNames: f.suburbs.map((s) => s.name).join("、"),
        jobs,
      });
    }
  }

  if (newJobsCount === 0) {
    const message = `${baseMsg}，无新增岗位`;
    await recordEmailRun({ slot: slot.label, followedCount: follows.length, newJobsCount: 0, success: true, message });
    return { ...base, ran: true, slotLabel: slot.label, followedCount: follows.length, message };
  }

  // 拼装并发送邮件
  const html = await render(
    NotifyEmail({
      slotLabel: slot.label,
      totalNew: newJobsCount,
      groups: groups.map((g) => ({
        mainCity: g.mainCity,
        suburbNames: g.suburbNames,
        jobs: g.jobs.map((j) => ({
          title: j.title,
          company: j.company,
          salary: j.salary,
          type: j.type,
          suburb: j.suburb,
          url: j.applyUrl ?? "",
        })),
      })),
      runAtLabel: formatTz(now),
      timezoneLabel: APP_TIME_ZONE,
    }),
  );

  const subject = `[澳聘] 澳洲${slot.label}：关注城区新增 ${newJobsCount} 个岗位`;
  const send = await sendMail({ subject, html, to: NOTIFY_EMAIL });

  const message = send.ok
    ? `${baseMsg}，发现 ${newJobsCount} 个新岗位并已推送到 ${NOTIFY_EMAIL}`
    : `${baseMsg}，发现 ${newJobsCount} 个新岗位，但邮件发送失败：${send.error}`;
  await recordEmailRun({
    slot: slot.label,
    followedCount: follows.length,
    newJobsCount,
    success: send.ok,
    message,
  });

  return {
    ...base,
    ran: true,
    slotLabel: slot.label,
    followedCount: follows.length,
    newJobsCount,
    sentEmail: send.ok,
    error: send.ok ? undefined : send.error,
    message,
  };
}