/**
 * lib/time —— 时间口径统一为「澳洲时间」。
 *
 * 项目约定：展示与定时任务判断一律以澳洲本地时区为准，避免「发帖时间/推送窗口/日志」因
 * 服务器位于不同时区而产生偏差。默认使用 澳大利亚东部标准时间 Australia/Sydney
 * （自动跟随 AEDT/AEST 夏令时切换），可用环境变量 NEXT_PUBLIC_APP_TIME_ZONE 覆盖。
 * NEXT_PUBLIC_ 前缀让该常量同时可用于客户端与服务端。
 */

/** 应用统一使用的澳洲时区（IANA 名）。 */
export const APP_TIME_ZONE = process.env.NEXT_PUBLIC_APP_TIME_ZONE ?? "Australia/Sydney";

export interface TzParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 短英文星期，如 Mon。 */
  weekday: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * 把任意时间（时间戳 ms / Date / 可解析字符串）拆成「APP_TIME_ZONE」下的各字段。
 * 用 Intl.DateTimeFormat 的 formatToParts 完成时区换算（含夏令时）。
 */
export function getTzParts(
  date: Date | number | string = new Date(),
  tz: string = APP_TIME_ZONE,
): TzParts {
  const d = date instanceof Date ? date : new Date(date);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) parts[p.type] = p.value;

  let hour = Number(parts.hour ?? "0");
  if (hour === 24) hour = 0; // 部分运行环境夜 0 点返回 24
  return {
    year: Number(parts.year ?? d.getFullYear()),
    month: Number(parts.month ?? "1"),
    day: Number(parts.day ?? "1"),
    hour,
    minute: Number(parts.minute ?? "0"),
    second: Number(parts.second ?? "0"),
    weekday: parts.weekday ?? "",
  };
}

/** 澳洲时间格式化：YYYY-MM-DD HH:mm（可带秒）。 */
export function formatTz(
  date: Date | number | string = new Date(),
  withSeconds: boolean = false,
  tz: string = APP_TIME_ZONE,
): string {
  const p = getTzParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}${
    withSeconds ? `:${pad(p.second)}` : ""
  }`;
}

/** 仅日期：YYYY-MM-DD（澳洲时区）。 */
export function formatTzDate(
  date: Date | number | string = new Date(),
  tz: string = APP_TIME_ZONE,
): string {
  return formatTz(date, false, tz).slice(0, 10);
}

/** 当前「澳洲时间」的小时（0-23），用于定时任务按时段判断。 */
export function nowTzHour(tz: string = APP_TIME_ZONE): number {
  return getTzParts(new Date(), tz).hour;
}

/** 当前「澳洲时间」的“HH:mm”字符串。 */
export function nowTzTime(tz: string = APP_TIME_ZONE): string {
  const p = getTzParts(new Date(), tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * 把 Unix 秒（YEEYI 发帖时间）格式化为澳洲时间展示。
 * @param unixSeconds 可选；为 0/undefined 时返回 ''。
 */
export function formatTzFromUnix(unixSeconds?: number, tz: string = APP_TIME_ZONE): string {
  if (!unixSeconds) return "";
  return formatTz(unixSeconds * 1000, false, tz);
}

/**
 * 相对时间（“刚刚 / N小时前 / N天前”）。
 * 两个 Unix 时间戳的差值本身与时区无关；此处统一用「当前时间」与发帖时间的差。
 * （绝对时间的澳洲化展示见 formatTz / formatTzFromUnix。）
 */
export function timeAgoTz(unixSeconds?: number): string {
  if (!unixSeconds) return "";
  const diff = Math.max(0, Math.floor(Date.now() / 1000 - unixSeconds));
  const m = Math.floor(diff / 60);
  if (m < 1) return "刚刚";
  const h = Math.floor(m / 60);
  if (h < 1) return `${m}分钟前`;
  const d = Math.floor(h / 24);
  if (d < 1) return `${h}小时前`;
  if (d > 30) return `${Math.floor(d / 30)}个月前`;
  return `${d}天前`;
}