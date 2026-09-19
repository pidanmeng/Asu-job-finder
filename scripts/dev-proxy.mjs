/**
 * 带代理启动 next dev 的跨平台脚本（Windows/Linux/macOS 通用）。
 * 用法：npm run dev:proxy
 *
 * 说明：某些沙箱/内网环境里浏览器级代理（如 127.0.0.1:7890）默认不会被 Node 的
 * undici/fetch 使用，导致 Next 项目里访问外部 API（YEEYI / LLM / OSM）超时。
 * 本脚本在拉起 next dev 前设置 HTTPS_PROXY/HTTP_PROXY，并开启 Node 的
 * --use-env-proxy / NODE_USE_ENV_PROXY，约等于 README 里那段手动设置。
 *
 * 代理地址可通过环境变量 DEV_PROXY 覆盖，默认 http://127.0.0.1:7890。
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const proxy = process.env.DEV_PROXY || "http://127.0.0.1:7890";

const env = {
  ...process.env,
  HTTPS_PROXY: proxy,
  HTTP_PROXY: proxy,
  // 任务参数（主机/端口）默认走 next，不设 NO_PROXY；如需本地直连可加：
  NO_PROXY: process.env.NO_PROXY || "localhost,127.0.0.1,::1",
  NODE_USE_ENV_PROXY: "1",
  NODE_OPTIONS: process.env.NODE_OPTIONS
    ? process.env.NODE_OPTIONS.includes("--use-env-proxy")
      ? process.env.NODE_OPTIONS
      : `${process.env.NODE_OPTIONS} --use-env-proxy`
    : "--use-env-proxy",
};

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

console.log(`[dev:proxy] 使用代理 ${proxy}，启动 next dev …`);

const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(`${npxCmd} next dev`, {
  cwd: root,
  env,
  stdio: "inherit",
  shell: true,
});

child.on("error", (e) => {
  console.error("[dev:proxy] 启动失败:", e.message);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

// 转发中断信号（Ctrl+C）
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => process.exit(0));
}