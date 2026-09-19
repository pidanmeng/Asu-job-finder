/**
 * 大模型客户端 —— OpenAI 兼容的 Chat Completions 协议。
 * 用于：位置解析（Prompt E）、AI 筛选聊天（Prompt G）。
 * 配置走环境变量（见 .env.local.example）：LLM_BASE_URL / LLM_MODEL / LLM_API_KEY。
 * 未配置 key 时调用方应回退到启发式方案（LLM_FALLBACK_ENABLED）。
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmConfig {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
}

/** 是否配置了可用的 LLM。 */
export function isLlmConfigured(): boolean {
  return Boolean(process.env.LLM_API_KEY) && Boolean(process.env.LLM_BASE_URL);
}

function baseUrl(): string {
  return (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
}

function model(): string {
  return process.env.LLM_MODEL ?? "gpt-4o-mini";
}

/**
 * 调一次 Chat Completions，返回文本（非流式）。
 * @param json 置 true 时期望模型输出 JSON，返回解析后的对象（否则原样文本）。
 */
export async function chatCompletion(
  messages: ChatMessage[],
  opts: { json?: boolean; temperature?: number; llm?: LlmConfig } = {},
): Promise<{ text: string; json?: unknown }> {
  const { json = false, temperature = 0.3, llm } = opts;
  const cfg: LlmConfig = {
    baseUrl: llm?.baseUrl ?? baseUrl(),
    model: llm?.model ?? model(),
    apiKey: llm?.apiKey ?? process.env.LLM_API_KEY,
  };
  if (!cfg.apiKey) throw new Error("未配置 LLM_API_KEY（见 .env.local.example）");

  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    temperature,
  };
  if (json) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`LLM HTTP ${res.status}: ${txt.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!json) return { text };

  // 宽松解析 JSON（模型偶尔会包 markdown 代码块）
  let parsed: unknown;
  try {
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    // 尝试从中抽取第一个 {...} 块
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]);
      } catch {
        parsed = null;
      }
    }
  }
  return { text, json: parsed };
}