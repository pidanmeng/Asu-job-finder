"use client";

/**
 * 顶栏右侧操作按钮（替代原来的“职位”链接）。
 * 「已投递」与「推荐企业」均从右侧弹出抽屉；对应抽屉由 layout 全局挂载。
 */
import { useAppliedStore } from "@/store/appliedStore";
import { useChatStore } from "@/store/chatStore";
import { useRecommendations } from "@/store/recsStore";

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-white/20 px-1.5 text-xs font-bold">
      {count}
    </span>
  );
}

export default function TopBarNav() {
  const appliedCount = useAppliedStore((s) => s.applied.length);
  const recsCount = useRecommendations().recommendations.length;
  const openApplied = useAppliedStore((s) => s.setDrawerOpen);
  const openRecs = useChatStore((s) => s.setRecsDrawerOpen);

  return (
    <nav className="flex shrink-0 items-center gap-1 text-sm text-slate-600 sm:gap-3">
      <button
        onClick={() => openApplied(true)}
        title="查看已投递职位"
        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700 transition hover:bg-emerald-100"
      >
        📥 已投递
        <CountBadge count={appliedCount} />
      </button>
      <button
        onClick={() => openRecs(true)}
        title="查看 AI 推荐企业"
        className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 font-medium text-indigo-700 transition hover:bg-indigo-100"
      >
        ⭐ 推荐企业
        <CountBadge count={recsCount} />
      </button>
    </nav>
  );
}