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
};

export default nextConfig;