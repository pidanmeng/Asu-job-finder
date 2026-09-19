/**
 * GET /api/chat/status —— 轻量探针：告知前端大模型是否已配置。
 * 供 JobCopilot 决定走 CopilotKit 流式 还是 启发式兜底（未配置 key 时）。
 */
import { NextResponse } from "next/server";
import { isLlmConfigured } from "@/lib/llm";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({ ok: true, llmConfigured: isLlmConfigured() });
}