"use client";

/**
 * 「自我介绍」抽屉表单（Feature 5）。
 * 在职业筛选页面点击「自我介绍」按钮唤起；包括 姓名 / 电话 / 微信 / 邮箱 / 期望岗位 /
 * 期望地区 / 自我介绍 等字段，保存后持久化到 localStorage（经 store/profileStore）。
 * 该资料会在职位详情的「立即联系」拼短信与生成 VCard 时被复用。
 */
import { useState } from "react";
import { emptyProfile, useProfile } from "@/store/profileStore";
import type { SelfIntroProfile } from "@/store/profileStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ProfileDrawer({ open, onClose }: Props) {
  const { profile, saveProfile } = useProfile();
  const [form, setForm] = useState<SelfIntroProfile>(
    () => profile ?? emptyProfile(),
  );

  if (!open) return null;

  const set = (k: keyof SelfIntroProfile, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
  };

  const handleSave = () => {
    saveProfile(form);
    onClose(); // 保存后直接关闭弹窗（验收要求）
  };

  const field =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100";
  const label = "mb-1 block text-xs font-medium text-slate-500";

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">💁 自我介绍</h3>
            <p className="text-xs text-slate-400">
              保存后会用于「立即联系」短信文案与名片（VCard）生成
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <div>
            <label className={label}>姓名 *</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="你的姓名" className={field} />
          </div>
          <div>
            <label className={label}>电话 *</label>
            <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="澳洲手机 / 联系电话" inputMode="tel" className={field} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={label}>微信</label>
              <input value={form.wechat} onChange={(e) => set("wechat", e.target.value)} placeholder="微信号（可选）" className={field} />
            </div>
            <div>
              <label className={label}>邮箱</label>
              <input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="邮箱（可选）" type="email" className={field} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={label}>期望岗位</label>
              <input value={form.desiredRole} onChange={(e) => set("desiredRole", e.target.value)} placeholder="如：服务员 / 会计" className={field} />
            </div>
            <div>
              <label className={label}>期望地区</label>
              <input value={form.region} onChange={(e) => set("region", e.target.value)} placeholder="如：悉尼 / CBD" className={field} />
            </div>
          </div>
          <div>
            <label className={label}>自我介绍 *</label>
            <textarea
              value={form.intro}
              onChange={(e) => set("intro", e.target.value)}
              placeholder="一句话介绍自己：如 我叫…，有 3 年餐饮经验，能吃苦，可立即到岗，持合法工作签证。"
              rows={4}
              className={field}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 px-4 py-3">
          <span className="text-xs text-slate-400">
            {profile ? "上次保存于 " + new Date(profile.updatedAt).toLocaleString() : "尚未保存过"}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              关闭
            </button>
            <button
              onClick={handleSave}
              disabled={!form.name.trim() || !form.phone.trim() || !form.intro.trim()}
              className="rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}