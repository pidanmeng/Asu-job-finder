/**
 * POST/GET /api/copilotkit/[...slug] —— CopilotKit Runtime（自托管后端，Prompt G）。
 *
 * 用 CopilotKit 官方 v2 Runtime 把「自带模型 key 的本地 OpenAI 兼容接口」暴露给前端：
 *  - BuiltInAgent 通过 @ai-sdk/openai 的 createOpenAI 指向自定义 baseURL（LLM_BASE_URL）与模型（LLM_MODEL）。
 *  - 前端 <CopilotKit runtimeUrl="/api/copilotkit"> 使用 useAgent / useCopilotChat 即可获得流式输出。
 *  - 未配置 LLM key 时不注册 agent，仅返回空能力列表；前端会走启发式兜底（/api/chat）。
 *
 * 参考：https://docs.copilotkit.ai/backend/copilot-runtime
 */
import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
  InMemoryAgentRunner,
  BuiltInAgent,
} from "@copilotkit/runtime/v2";
import { createOpenAI } from "@ai-sdk/openai";

/** AI 顾问的系统提示（对应原 /api/chat 的 buildSystem，含默认过滤 PR 偏好）。 */
const JOB_ADVISOR_SYSTEM_PROMPT = `你是「澳聘」的澳洲求职顾问，帮用户在澳洲华人求职平台找工作。
用户消息里会附带一批「当前筛选出的职位」JSON 数组以及 allowPR 标志。请据此回答，规则：
- 默认优先推荐【不要求 PR】的职位。
- 结合用户所在城市/城区(suburb)筛选。
- 每次给出 2~4 个推荐，每个要说明：职位标题、公司、城市/城区、薪资、以及【推荐理由】。
- 推荐理由要具体（岗位与背景匹配点、薪资优、位置近等），不要泛泛而谈、不要编造职位里没有的信息。
- 一次别给太多；可追问用户偏好（薪资、工种、全职/兼职、地区）以细化。
- 用简练中文，用 Markdown 排版，关键信息（推荐列表）可用列表或小表格呈现。
【重要：使用工具】当你向用户推荐某(几)个职位时，请针对【每一个被推荐的职位】调用一次工具 \`recommendJob\`，
参数 jobId 取该职位数据里的 id 字段。工具会把职位加入「推荐企业」列表（与职位卡片上的“+ 推荐”按钮效果相同），
让用户能直接在推荐列表里点开来源页面。不要编造不存在的职位。
不要编造：只能基于提供的职位数据作答。若数据为空，说明当前没有可推荐的职位，并引导用户换城市/关键词后再试。`;

function buildAgent() {
  const baseUrl = (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env.LLM_MODEL ?? "deepseek-chat";
  const apiKey = process.env.LLM_API_KEY;

  const provider = createOpenAI({ apiKey, baseURL: baseUrl });
  // 必须用 provider.chat() 走 Chat Completions(/chat/completions)；
  // 默认 provider(model) 会走 Responses API(/responses)，多数 OpenAI 兼容接口（含本项目的）
  // 并不支持 /responses，会 404。
  return new BuiltInAgent({
    model: provider.chat(model),
    temperature: 0.5,
    prompt: JOB_ADVISOR_SYSTEM_PROMPT,
  });
}

function createRuntime(): CopilotRuntime {
  // 用 BuiltInAgent 类型（与运行时来自同一个 @copilotkit/runtime，避免与顶层
  // @ag-ui/client 版本不一致导致的 AbstractAgent 类型冲突）。
  const agents: Record<string, BuiltInAgent> = {};
  if (Boolean(process.env.LLM_API_KEY) && Boolean(process.env.LLM_BASE_URL)) {
    agents.default = buildAgent();
  }
  // 未配置 key 时“default”为空，前端检测到未配置会走启发式兜底（不崩路由）。
  return new CopilotRuntime({
    agents,
    runner: new InMemoryAgentRunner(),
  });
}

// 单例 runtime（本地/单用户演示场景安全；多并发场景需按请求创建，见官方文档）
const runtime = createRuntime();

const handler = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit",
});

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;