import type { Metadata, Viewport } from "next";
import "./globals.css";
import CopilotProvider from "@/components/copilot/CopilotProvider";

export const metadata: Metadata = {
  title: "澳聘 · 澳洲找工作助手",
  description:
    "基于 YEEYI(亿忆) 求职数据 + AI 筛选的澳洲找工作应用：地图选址 → 位置解析 → 职位搜索 → AI 推荐。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen flex flex-col">
        <CopilotProvider>
          <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
              <a href="/" className="flex min-w-0 items-center gap-2 text-base font-bold text-slate-900 sm:text-lg">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 text-sm text-white">
                  澳
                </span>
                <span className="truncate">澳聘</span>
                <span className="hidden truncate text-sm font-normal text-slate-400 lg:inline">
                  澳洲找工作 AI 助手
                </span>
              </a>
              <nav className="flex shrink-0 items-center gap-1 text-sm text-slate-600 sm:gap-3">
                <a
                  href="/"
                  className="rounded-lg px-2.5 py-2 transition hover:bg-slate-100 hover:text-slate-900 sm:px-1 sm:py-0 sm:hover:bg-transparent"
                >
                  地图选址
                </a>
                <a
                  href="/jobs"
                  className="rounded-lg px-2.5 py-2 transition hover:bg-slate-100 hover:text-slate-900 sm:px-1 sm:py-0 sm:hover:bg-transparent"
                >
                  职位
                </a>
              </nav>
            </div>
          </header>
          <main className="flex-1 w-full">{children}</main>
          <footer className="border-t border-slate-200 bg-white px-4 py-4 pb-safe text-center text-xs text-slate-400">
            职位数据来源于 YEEYI(亿忆) 平台公开频道，本应用仅作聚合展示；「是否要求 PR」为系统关键词判断，请以帖子原文为准。
          </footer>
        </CopilotProvider>
      </body>
    </html>
  );
}