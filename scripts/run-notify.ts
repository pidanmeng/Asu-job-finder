/**
 * scripts/run-notify.ts —— 本地 / 自建调度器跑一次定时推送（Feature 3）。
 *
 * 用法（先配置 .env：TURSO_DATABASE_URL、TURSO_AUTH_TOKEN、RESEND_API_KEY、FROM_EMAIL 等）：
 *   tsx scripts/run-notify.ts            # 按当前澳洲时间判断是否到点再执行
 *   tsx scripts/run-notify.ts --force    # 忽略同窗去重
 *   tsx scripts/run-notify.ts --now=2026-07-26T08:00:00   # 指定“当前时间”（便于手动测试各时段）
 *
 * 也可直接配置操作系统计划任务/云 cron 每小时调用本脚本。
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { runNotify, NOTIFY_SLOTS, currentSlot } from "../lib/notifier";

// 手动加载 .env / .env.local（脚本环境不会像 Next 那样自动注入）
function loadEnvFile(p: string) {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1]!;
    if (process.env[key] !== undefined) continue;
    const v = m[2]!.replace(/^["']|["']$/g, "");
    process.env[key] = v;
  }
}
loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const nowArg = args.find((a) => a.startsWith("--now="))?.slice("--now=".length);

  let now: Date | undefined;
  if (nowArg) now = new Date(nowArg);

  console.log("== 定时推送（Feature 3） ==");
  console.log("时段定义：", NOTIFY_SLOTS.map((s) => `${s.label}(近${s.windowHours}h)`).join("，"));
  console.log("当前时间（过时区）：", now ? now.toISOString() : new Date().toISOString());
  if (nowArg) console.log("当前澳洲时段：", currentSlot(now!)?.label ?? "不在推送时段");

  const res = await runNotify({ now, force });
  console.log("结果：", JSON.stringify(res, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});