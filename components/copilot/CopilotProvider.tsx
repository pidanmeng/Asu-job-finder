/**
 * CopilotKit 前端提供者（Prompt G）。
 * 挂载自托管 Runtime（/api/copilotkit），使子组件可用 useAgent/useCopilotChat 的流式对话。
 * 用 useSingleEndpoint={false} 对应 v2 的多路由 handler。
 */
"use client";

import { CopilotKit } from "@copilotkit/react-core/v2";

export default function CopilotProvider({ children }: { children: React.ReactNode }) {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" useSingleEndpoint={false}>
      {children}
    </CopilotKit>
  );
}