/**
 * 职位列表页（Prompt F/G）。服务端壳 → 客户端逻辑（需 Suspense 包裹以便 useSearchParams）。
 */
import { Suspense } from "react";
import JobsClient from "./client";

export default function JobsPage() {
  return (
    <Suspense
      fallback={<div className="mx-auto max-w-6xl px-4 py-8 text-slate-400">加载职位…</div>}
    >
      <JobsClient />
    </Suspense>
  );
}