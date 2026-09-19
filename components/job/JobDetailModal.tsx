"use client";

/**
 * 职位详情弹窗。
 * 打开时向 /api/jobs/[tid] 发起请求，由服务端爬取来源网页 __NEXT_DATA__ 并解析，
 * 前端把结构化详情（岗位属性 + 联系方式 + 正文）以弹窗展示。不再跳转平台详情页。
 */
import { useEffect, useRef, useState } from "react";
import type { Job } from "@/types/job";
import type { JobDetail } from "@/types/jobDetail";

interface Props {
  job: Job | null;
  open: boolean;
  onClose: () => void;
}

/** 把 HTML 片段安全地转为纯文本。 */
function htmlToText(html: string): string {
  if (!html) return "";
  if (typeof document !== "undefined") {
    const el = document.createElement("div");
    el.innerHTML = html;
    return (el.textContent ?? el.innerText ?? "").replace(/\s+/g, " ").trim();
  }
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

function formatTime(unixSeconds?: number): string {
  if (!unixSeconds) return "";
  const d = new Date(unixSeconds * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function JobDetailModal({ job, open, onClose }: Props) {
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openedTid = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !job) return;
    setDetail(null);
    setError(null);
    if (!/^\d+$/.test(job.id)) {
      // mock 职位没有可爬取来源页
      setDetail(null);
      setLoading(false);
      return;
    }
    openedTid.current = job.id;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/jobs/${encodeURIComponent(job.id)}`, { cache: "no-store" });
        const body = (await res.json()) as { ok?: boolean; data?: JobDetail; error?: string };
        if (openedTid.current !== job.id) return; // 已切换/关闭
        if (!body.ok || !body.data) {
          setError(body.error ?? "拉取详情失败");
        } else {
          setDetail(body.data);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "拉取详情失败");
      } finally {
        if (openedTid.current === job.id) setLoading(false);
      }
    })();
    return () => {
      openedTid.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, job?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const text = detail?.message ? htmlToText(detail.message) : "";
  const isMock = !job || !/^\d+$/.test(job.id);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex h-[92dvh] w-full max-w-2xl flex-col overflow-hidden bg-white shadow-xl sm:h-auto sm:max-h-[85vh] sm:rounded-2xl rounded-t-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900 sm:text-lg">
              {detail?.title || job?.title || "职位详情"}
            </h3>
            {job?.company && <p className="mt-0.5 text-sm text-slate-500">{job.company}</p>}
            {detail?.author && (
              <p className="mt-0.5 text-xs text-slate-400">
                发布者：{detail.author}
                {detail.postedAtStr ? ` · ${detail.postedAtStr}` : " · "}
                {detail.views ? `${detail.views} 次浏览` : ""}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading && <p className="py-10 text-center text-sm text-slate-400">正在抓取职位详情…</p>}

          {!loading && error && (
            <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-600">{error}</p>
          )}

          {!loading && isMock && !detail?.ok && (
            <div className="py-6 text-center text-sm text-slate-500">
              本地示例职位，无来源网页可抓取。可点击下方「前往平台」查看。
            </div>
          )}

          {!loading && detail && (!detail.ok ? (
            <div className="py-6 text-center text-sm text-slate-500">
              未能从来源网页解析到详情，可能已被删除或触发了平台反爬。可点击下方「前往平台」查看原帖。
            </div>
          ) : (
            <div className="space-y-4">
              {/* 联系方式（用户关心的部分），高亮 */}
              {(detail.contact.length > 0 || detail.tel) && (
                <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <h4 className="text-sm font-semibold text-emerald-800">📞 联系方式</h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(detail.contact.length > 0 ? detail.contact : (detail.tel ? [{ label: "电话", value: detail.tel }] : [])).map(
                      (c) => (
                        <span
                          key={c.label}
                          className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-sm font-medium text-emerald-700 shadow-sm"
                        >
                          {c.label}：{c.value}
                        </span>
                      ),
                    )}
                    {!detail.contact.some((c) => /电话|手机.*$/.test(c.label)) && detail.tel && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-sm font-medium text-emerald-700 shadow-sm">
                        联系电话：{detail.tel}
                      </span>
                    )}
                  </div>
                </section>
              )}

              {/* 岗位属性 */}
              {detail.attributes.length > 0 && (
                <section className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
                  {detail.attributes.map((a, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="shrink-0 text-slate-400">{a.label}：</span>
                      <span className="text-slate-800">{a.value}</span>
                    </div>
                  ))}
                </section>
              )}

              {detail.location && (
                <p className="text-sm text-slate-600">📍 {detail.location}</p>
              )}

              {/* 正文 */}
              {text && (
                <section>
                  <h4 className="text-sm font-semibold text-slate-900">职位描述</h4>
                  <p className="mt-1.5 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                    {text}
                  </p>
                </section>
              )}

              {/* 图片 */}
              {detail.images.length > 0 && (
                <section>
                  <h4 className="text-sm font-semibold text-slate-900">图片</h4>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {detail.images.map((src, i) => (
                      <img key={i} src={src} alt={`职位图片 ${i + 1}`} className="aspect-square w-full rounded-lg object-cover" loading="lazy" referrerPolicy="no-referrer" />
                    ))}
                  </div>
                </section>
              )}
            </div>
          ))}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 px-4 py-3">
          <span className="text-xs text-slate-400">
            {detail?.ok ? "已抓取来源网页信息" : "信息来源：YEEYI"}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              关闭
            </button>
            {job?.applyUrl && job.applyUrl !== "#" && (
              <a
                href={job.applyUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                前往平台 →
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}