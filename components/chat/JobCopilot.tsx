/**
 * AI 筛选聊天面板（Prompt G）—— CopilotKit 流式接入版。
 *
 * 工作流：用户自然语言提问 → CopilotKit Runtime(/api/copilotkit) 把当前职位 JSON 注入上下文 →
 * BuiltInAgent 经自定义 OpenAI 兼容接口流式作答（assistant 消息边生成边推送）→ 前端边收边渲染。
 * 助手回复按 Markdown 解析格式化为列表/表格/代码块等展示；大模型思考过程单独折叠展示。
 *
 * 兜底：当未配置大模型 key 时（/api/chat/status 探测），回退到原 /api/chat 的启发式回复，
 * 保证无 key 也能演示；推荐企业仍在「⭐ 推荐企业」区展示。
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useJobStore } from "@/store/jobStore";
import { useChatStore } from "@/store/chatStore";
import { useAgent, useFrontendTool, UseAgentUpdate } from "@copilotkit/react-core/v2/headless";
import { z } from "zod";
import type { Message } from "@ag-ui/client";
import Markdown from "@/components/markdown/Markdown";
import type { Job } from "@/types/job";

/** 注入到用户消息里的上下文分隔标记（展示用户气泡时据此还原干净的提问文本）。 */
const USER_Q_MARK = "\n\n用户问题：";

type Part = { kind: "text" | "thinking"; text: string };
type WeakMsg = { role?: string; content?: unknown; id?: string };
type Bubble = { id: string; role: "user" | "assistant"; text: string; parts?: Part[] };

const SUGGESTIONS = ["帮我筛选 2-3 个服务员的岗位", "整理 3 个月内发布的新岗位"];

let _uid = 0;
const uid = () => `m${Date.now().toString(36)}_${_uid++}`;

/** 将 AG-UI 消息 content（数组）拆成可渲染的文本/思考片段。 */
function toParts(content: unknown): Part[] {
  if (typeof content === "string") return [{ kind: "text", text: content }];
  if (!Array.isArray(content)) return [];
  const out: Part[] = [];
  for (const p of content as Record<string, unknown>[]) {
    if (!p || typeof p !== "object") continue;
    const t = p.type;
    if (t === "text" && typeof p.text === "string") {
      out.push({ kind: "text", text: p.text });
    } else if (
      (t === "thinking" || t === "reasoning" || t === "reasoning_text") &&
      typeof (p.thinking ?? p.text) === "string"
    ) {
      out.push({ kind: "thinking", text: (p.thinking as string) ?? (p.text as string) });
    }
  }
  return out;
}

function joinParts(parts: Part[]): string {
  return parts.filter((p) => p.kind === "text").map((p) => p.text).join("");
}

/** 还原用户气泡里的干净提问（去掉注入的职位上下文）。 */
function cleanUserText(raw: string): string {
  const idx = raw.indexOf(USER_Q_MARK);
  return idx >= 0 ? raw.slice(idx + USER_Q_MARK.length) : raw;
}

/** 组装发给模型的用户消息：职位上下文 + 过滤偏好 + 提问。 */
function buildUserBody(question: string, jobs: Job[], allowPR: boolean): string {
  const ctx =
    "以下为当前筛选出的职位：\n" + (jobs.length ? JSON.stringify(jobs.slice(0, 60)) : "（当前无职位数据）");
  return `${ctx}\n\n（默认优先不要求 PR，allowPR=${allowPR}）${USER_Q_MARK}${question}`;
}

/**
 * 兜底：把对话里已记录的 recommendJob 推荐职位写入「推荐企业」列表。
 *
 * CopilotKit 的 useFrontendTool 在部分自托管运行时可能不会把工具调用回传给前端执行，
 * 但模型发出的推荐仍会以两种形式出现在 agent.messages 里，这里都提取 jobId 并补写推荐：
 *   1. 工具调用片段（tool-call / function 的 args.jobId）；
 *   2. 工具结果消息（role:"tool"）里对 "/recommendedJobs/-" 的 JSON patch，
 *      即形如 {"success":true,"delta":[{"op":"add","path":"/recommendedJobs/-","value":{"jobId":"6027530"}}]}。
 * addRecommendation 内部按 id 去重，与前端 handler 直接写入不冲突，保证推荐列表始终刷新。
 */
function applyRecordedRecommendations(messages: WeakMsg[]) {
  const seen = new Set<string>();
  const collectId = (raw: unknown) => {
    if (raw == null || raw === "") return;
    const id = String(raw);
    if (seen.has(id)) return;
    seen.add(id);
    const job = useJobStore.getState().jobs.find((j: Job) => String(j.id) === id);
    if (job) useChatStore.getState().addRecommendation(job);
  };
  const collectJobIdFromValue = (value: unknown) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      collectId((value as Record<string, unknown>).jobId);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object") collectId((item as Record<string, unknown>).jobId);
      }
    }
  };

  for (const m of messages) {
    const content = m.content;
    if (Array.isArray(content)) {
      // 1) 工具调用片段 / 组件片段 / 结果片段
      for (const p of content as Record<string, unknown>[]) {
        if (!p || typeof p !== "object") continue;
        const t = p.type;
        if (t === "tool-call") {
          if (p.name === "recommendJob") {
            const args = (p.args ?? {}) as Record<string, unknown>;
            collectId(args.jobId);
          }
        } else if (t === "function") {
          const fn = p.function as Record<string, unknown> | undefined;
          if (fn?.name === "recommendJob") {
            const rawArgs = fn.arguments;
            if (typeof rawArgs === "string" && rawArgs.trim()) {
              try {
                collectId((JSON.parse(rawArgs) as Record<string, unknown>).jobId);
              } catch {
                /* 忽略无法解析的参数 */
              }
            } else if (rawArgs && typeof rawArgs === "object") {
              collectId((rawArgs as Record<string, unknown>).jobId);
            }
          }
        } else {
          // 某些运行时把工具结果放在 text/content/result 字符串里
          const s = p.text ?? p.content ?? p.result;
          if (typeof s === "string" && s.includes("recommendedJobs")) {
            try {
              const parsed = JSON.parse(s) as Record<string, unknown>;
              const delta = parsed?.delta;
              if (Array.isArray(delta)) {
                for (const patch of delta as Record<string, unknown>[]) {
                  const path = patch?.path;
                  if (typeof path !== "string" || !path.includes("recommendedJobs")) continue;
                  collectJobIdFromValue(patch?.value);
                }
              }
            } catch {
              /* 忽略非 JSON 内容 */
            }
          }
        }
      }
    } else if (typeof content === "string" && content.trim()) {
      // 2) 工具结果消息：JSON 里 delta 对 /recommendedJobs/ 的 add patch 携带 jobId
      try {
        const parsed = JSON.parse(content) as Record<string, unknown>;
        const delta = parsed?.delta;
        if (Array.isArray(delta)) {
          for (const patch of delta as Record<string, unknown>[]) {
            const path = patch?.path;
            if (typeof path !== "string" || !path.includes("recommendedJobs")) continue;
            collectJobIdFromValue(patch?.value);
          }
        }
      } catch {
        /* 忽略非 JSON 内容 */
      }
    }
  }
}

export default function JobCopilot() {
  const jobs = useJobStore((s) => s.jobs);
  const allowPR = useJobStore((s) => s.allowPR);
  const commentsEl = useRef<HTMLDivElement>(null);

  const lastSummary = useChatStore((s) => s.lastSummary);
  const setLastSummary = useChatStore((s) => s.setLastSummary);

  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [llmConfigured, setLlmConfigured] = useState<boolean | null>(null);
  const [heuristicMessages, setHeuristicMessages] = useState<Bubble[]>([]);
  const [localBusy, setLocalBusy] = useState(false);

  // 给 Copilot 助理注册一个“推荐职位”工具：效果与职位卡片上的“+ 推荐”按钮相同，
  // 把指定 jobId 的职位加入「推荐企业」列表（前端 handler 直接写入 chatStore）。
  useFrontendTool(
    {
      name: "recommendJob",
      description:
        "把给定职位加入「推荐企业」列表（与职位卡片上的“+ 推荐”按钮效果相同）。每次推荐一个职位调用一次，jobId 取职位数据里的 id 字段。",
      parameters: z.object({
        jobId: z.string().describe("要推荐的职位 id（来自当前职位数据里的 id 字段）"),
        title: z.string().optional().describe("职位标题，用于校验"),
      }),
      handler: async ({ jobId }: { jobId: string }) => {
        const job = useJobStore.getState().jobs.find((j: Job) => j.id === jobId);
        if (!job) return { ok: false, error: `未找到职位 ${jobId}` };
        useChatStore.getState().addRecommendation(job);
        return { ok: true, jobId, company: job.company, title: job.title, suburb: job.suburb };
      },
    },
    [],
  );

  // CopilotKit 流式 agent（绑定 default agent；消息/运行状态变化时触发重渲染 → 流式展示）
  const { agent } = useAgent({
    updates: [UseAgentUpdate.OnMessagesChanged, UseAgentUpdate.OnRunStatusChanged],
  });

  // 探测是否配置了 LLM key，决定走 CopilotKit 还是启发式兜底
  useEffect(() => {
    fetch("/api/chat/status")
      .then((r) => r.json())
      .then((d: { llmConfigured?: boolean }) => setLlmConfigured(Boolean(d.llmConfigured)))
      .catch(() => setLlmConfigured(false));
  }, []);

  const usingCopilot = llmConfigured === true;
  const busy = usingCopilot ? agent.isRunning : localBusy;

  const scroll = () =>
    requestAnimationFrame(() =>
      commentsEl.current?.scrollTo({ top: commentsEl.current.scrollHeight, behavior: "smooth" })
    );

  // 渲染源：CopilotKit 走 agent.messages（含流式），启发式走本地列表
  const bubbles: Bubble[] = useMemo(() => {
    if (!usingCopilot) return heuristicMessages;
    return (agent.messages as WeakMsg[])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => {
        const parts = toParts(m.content);
        const role = m.role === "user" ? "user" : "assistant";
        const text = joinParts(parts);
        return {
          id: m.id ?? uid(),
          role,
          // 用户气泡还原干净提问；助手气泡保留片段供思维折叠展示
          text: role === "user" ? cleanUserText(text) : text,
          parts: role === "assistant" ? parts : undefined,
        } satisfies Bubble;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usingCopilot, agent.messages, heuristicMessages, jobs]);

  // 会话结束后把最近一次完整回复存为 lastSummary
  useEffect(() => {
    if (busy) return;
    let text = "";
    if (usingCopilot) {
      const last = [...(agent.messages as WeakMsg[])].reverse().find((m) => m.role === "assistant");
      if (last) text = joinParts(toParts(last.content));
    } else {
      const last = [...heuristicMessages].reverse().find((m) => m.role === "assistant");
      if (last) text = last.text;
    }
    if (text) setLastSummary(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, bubbles.length]);

  // 兜底：从对话里已记录的 recommendJob 工具调用/工具结果补写推荐，保证推荐列表始终刷新
  // （addRecommendation 内部按 id 去重，与前端 handler 直接写入不冲突）
  useEffect(() => {
    if (!usingCopilot) return;
    applyRecordedRecommendations(agent.messages as WeakMsg[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.messages, usingCopilot]);

  useEffect(() => {
    if (bubbles.length) scroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, bubbles.length]);

  const sendHeuristic = async (content: string) => {
    setLocalBusy(true);
    setError(null);
    const next: Bubble[] = [...heuristicMessages, { id: uid(), role: "user", text: content }];
    setHeuristicMessages(next);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.text })),
          jobs,
          allowPR,
        }),
      });
      const body = (await res.json()) as { ok?: boolean; data?: { reply?: string }; error?: string };
      if (!body.ok || !body.data?.reply) throw new Error(body.error ?? "AI 无返回");
      setHeuristicMessages((m) => [...m, { id: uid(), role: "assistant", text: body.data!.reply! }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "请求失败");
    } finally {
      setLocalBusy(false);
      scroll();
    }
  };

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    setError(null);

    if (!usingCopilot) {
      await sendHeuristic(content);
      return;
    }
    // CopilotKit 流式：注入职位上下文后发起一次 run
    try {
      (agent as unknown as { addMessage: (m: Message) => void }).addMessage({
        id: uid(),
        role: "user",
        content: [{ type: "text", text: buildUserBody(content, jobs, allowPR) }],
      } as Message);
      await (agent as unknown as { runAgent: () => Promise<unknown> }).runAgent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI 请求失败（未配置大模型？）");
    }
  };

  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">🤖 AI 筛选助手</h3>
          <p className="text-xs text-slate-400">默认优先不要求 PR，结合当前职位数据推荐</p>
        </div>
        <span className="rounded-full bg-sky-50 px-2 py-1 text-xs text-sky-600">基于 {jobs.length} 条职位</span>
      </div>

      <div
        ref={commentsEl}
        className="flex max-h-[320px] min-h-[120px] flex-col gap-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3"
      >
        {bubbles.length === 0 && (
          <p className="m-auto text-center text-sm text-slate-400">问一句，帮你从当前职位里挑合适的企业 👍</p>
        )}

        {bubbles.map((m) => (
          <div key={m.id} className={m.role === "user" ? "text-right" : "text-left"}>
            <div
              className={
                "inline-block max-w-[95%] rounded-2xl px-3 py-2 text-sm leading-relaxed " +
                (m.role === "user"
                  ? "bg-gradient-to-br from-indigo-500 to-sky-500 text-white"
                  : "border border-slate-200 bg-white text-slate-700")
              }
            >
              {m.role === "user" ? (
                <span className="whitespace-pre-wrap">{m.text}</span>
              ) : m.parts && m.parts.length ? (
                <div className="flex flex-col gap-2">
                  {m.parts.map((p, i) =>
                    p.kind === "thinking" ? (
                      <details key={i} className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        <summary className="cursor-pointer select-none">💭 思考过程</summary>
                        <div className="mt-1 whitespace-pre-wrap text-amber-600">{p.text}</div>
                      </details>
                    ) : (
                      <Markdown key={i}>{p.text}</Markdown>
                    )
                  )}
                </div>
              ) : (
                <Markdown>{m.text}</Markdown>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2 px-1 text-sm text-slate-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
            AI 正在流式思考…
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            disabled={busy}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500 transition hover:border-sky-300 hover:text-sky-600"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="例：帮我选悉尼适合会计的、不要求 PR 的公司"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-base leading-relaxed outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 sm:text-sm"
        />
        <button
          onClick={() => send()}
          disabled={busy || !input.trim()}
          className="shrink-0 rounded-lg bg-gradient-to-r from-indigo-500 to-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          发送
        </button>
      </div>
    </div>
  );
}