import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // YEEYI 接口允许我们通过服务端代理拉取，无需在此配置 CORS。
  // CopilotKit runtime（自建 LLM 后端）依赖较重的 node 模块，交由 Next 在服务端外置处理。
  serverExternalPackages: [
    "leaflet",
    "@copilotkit/runtime",
    "@ai-sdk/openai",
    "@ai-sdk/provider",
    "@ai-sdk/provider-utils",
    "ai",
    "openai",
  ],
  // 关闭 webpack 持久化文件缓存：本环境下后台 dev 进程可能被随时中断，
  // 残留的 .next/cache 会损坏（ENOENT vendor-chunks / invalid stored block lengths）
  // 并在下一次 dev/build 时崩溃。关掉缓存可彻底规避该问题（代价是冷编译略慢）。
  webpack: (config) => {
    config.cache = false;
    return config;
  },
};

export default nextConfig;