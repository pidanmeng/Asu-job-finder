"use client";

/**
 * 「推荐企业」右侧抽屉。
 * 订阅 useRecommendations()（localStorage 持久化的推荐列表）：
 * 只要 AI 调用 recommendJob（或职位卡片“+ 推荐”）写入，抽屉内容就会即时刷新。
 * 卡片复用列表中的 JobCard（不传 onRecommend，因此不展示「+ 推荐」按钮）；
 * 已投递的职位通过 hideWhenApplied=false 仍会展示，便于查看。
 */
import { useChatStore } from "@/store/chatStore";
import { useRecommendations } from "@/store/recsStore";
import JobCard from "@/components/job/JobCard";

export default function RecommendationsDrawer() {
  const { recommendations, clear: clearRecs } = useRecommendations();
  const open = useChatStore((s) => s.recsDrawerOpen);
  const setOpen = useChatStore((s) => s.setRecsDrawerOpen);

  const close = () => setOpen(false);

  return (
    <>
      {/* 遮罩 */}
      <div
        className={`fixed inset-0 z-[55] bg-slate-900/40 transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={close}
        aria-hidden="true"
      />

      {/* 抽屉 */}
      <aside
        className={`fixed right-0 top-0 z-[60] flex h-full w-full max-w-3xl flex-col overflow-hidden bg-slate-50 shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-label="推荐企业"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">⭐ 推荐企业</h2>
            <p className="text-xs text-slate-400">AI 挑选 / 你收藏的推荐职位，共 {recommendations.length} 个</p>
          </div>
          <button
            onClick={close}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="关闭推荐企业抽屉"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {recommendations.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center text-sm text-slate-400">
              <span className="text-3xl">⭐</span>
              <p>还没有推荐的企业。</p>
              <p className="text-xs">让 AI 帮你筛选岗位，或在职位卡片上点「+ 推荐」即可收藏到这里。</p>
            </div>
          ) : (
            <>
              <div className="mb-2 flex justify-end">
                <button
                  onClick={clearRecs}
                  className="rounded-lg px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-100 hover:text-rose-500"
                >
                  清空
                </button>
              </div>
              <ul className="flex flex-col gap-3">
                {recommendations.map((j) => (
                  <li key={j.id}>
                    {/* 复用列表卡片；不传 onRecommend 即不展示「+ 推荐」按钮 */}
                    <JobCard job={j} hideWhenApplied={false} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </aside>
    </>
  );
}