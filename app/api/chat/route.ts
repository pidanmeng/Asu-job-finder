/**
 * POST /api/chat —— AI 筛选助手（Prompt G）。
 * 入参：{ messages: {role,content}[], jobs: Job[], allowPR?: boolean }
 * Jobs 为当前页面已加载的职位（来自 /api/jobs），作为 AI 的“真实数据上下文”，
 * 让 AI 基于真实职位做筛选/总结推荐。
 *
 * 大模型走可配置的 OpenAI 兼容接口（lib/llm）。未配置 key 时返回启发式小结，
 * 保证前端聊天即使没有 LLM key 也有可用输出（Prompt G 约束：自带模型本地接入替代）。
 */
import { NextResponse } from "next/server";
import { chatCompletion, isLlmConfigured } from "@/lib/llm";
import type { Job } from "@/types/job";
import type { ApiEnvelope } from "@/types/geo";

export const runtime = "nodejs";
export const maxDuration = 60;

function buildSystem(allowPR: boolean): string {
  return `你是「澳聘」的澳洲求职顾问，帮用户在澳洲华人求职平台找工作。
你获得了一批当前的职位数据（JSON 数组）。请据此回答，规则：
- 默认优先推荐【不要求 PR】的职位${allowPR ? "；用户已开启“包含 PR”，也可提及要求 PR 的职位并提示风险" : ""}。
- 结合用户所在城市/城区(suburb)筛选。
- 每次给出 2~4 个推荐，每个要说明：职位标题、公司、城市/城区、薪资、以及【推荐理由】。
- 推荐理由要具体（岗位与背景匹配点、签名好的、薪资优、位置近等），不要泛泛而谈、不要编造职位里没有的信息。
- 一次别给太多；可追问用户偏好（薪资、工种、全职/兼职、地区）以细化。
- 用简练中文，markdown 排版，关键信息可用列表。
不要编造：只能基于提供的职位数据作答。若数据为空，说明当前没有可推荐的职位，并引导用户换城市/关键词后再试。`;
}

const PRIORITY_JOBS_PREFIX = "以下为当前筛选出的职位：\n";

export async function POST(req: Request) {
  let payload: { messages?: { role: string; content: string }[]; jobs?: Job[]; allowPR?: boolean };
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return NextResponse.json<ApiEnvelope<never>>({ ok: false, error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const allowPR = Boolean(payload.allowPR);
  const jobs = payload.jobs ?? [];

  // 组装上下文：把当前职位塞给 AI
  const jobCtx = PRIORITY_JOBS_PREFIX + (jobs.length ? JSON.stringify(jobs.slice(0, 60)) : "（当前无职位数据）");

  // 构建消息：system + 历史(除最后一条) + 最后用户消息(附职位上下文)
  const raw = (payload.messages ?? []).filter((m) => m && typeof m.content === "string");
  const last = raw[raw.length - 1];
  const history = raw.slice(0, -1).map((m) => ({
    role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
    content: m.content,
  }));

  if (isLlmConfigured()) {
    try {
      const messages = [
        { role: "system" as const, content: buildSystem(allowPR) },
        ...history,
        last
          ? { role: "user" as const, content: `${jobCtx}\n\n用户问题：${last.content}` }
          : { role: "user" as const, content: jobCtx },
      ];
      const { text } = await chatCompletion(messages, { temperature: 0.5 });
      return NextResponse.json<ApiEnvelope<{ reply: string; mode: "llm" }>>({ ok: true, data: { reply: text, mode: "llm" } });
    } catch (e) {
      console.warn("[chat] LLM 失败，回退启发式:", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json<ApiEnvelope<{ reply: string; mode: "heuristic" }>>({
    ok: true,
    data: { reply: heuristicReply(jobs, allowPR), mode: "heuristic" },
  });
}

/** 无 LLM 时的启发式回复：按不要求 PR、按城市要点式总结。 */
function heuristicReply(jobs: Job[], allowPR: boolean): string {
  const nonPr = jobs.filter((j) => !j.requiresPR);
  const pool = allowPR ? jobs : (nonPr.length ? nonPr : jobs);
  if (!pool.length) {
    return `当前筛选条件下暂无职位。建议：\n- 换一个更靠市区/更大的城市（如悉尼、墨尔本）\n- 换个更通用的关键词（如“店员、会计、IT”）\n- 关闭城区/城市限制后重试。`;
  }
  const top = pool.slice(0, 4);
  const lines = top
    .map((j, i) => `${i + 1}. **${j.title}**（${j.company} · ${j.suburb} · ${j.salary}）\n   - 推荐理由：${j.requiresPR ? "（要求 PR，请注意资格）" : "不要求 PR，背景与岗位较匹配"}`)
    .join("\n");
  const prNote = allowPR ? "" : "\n\n> 已默认过滤掉要求 PR 的职位；如需查看，可在页面打开“包含 PR”开关。";
  return `基于当前 ${pool.length} 个职位，为你快速筛选如下：\n\n${lines}\n${prNote}`;
}