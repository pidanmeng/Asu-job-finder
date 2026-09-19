/**
 * 城区筛选弹窗（Prompt F 扩展）。
 * 点击职位列表里的「筛选城区」后弹出：列出当前城市中的所有城区，允许多选。
 * 城区候选来自本地静态数据 data/suburbs.json（动态 import，避免常驻首屏体积）。
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import type { SuburbsDataset } from "@/types/suburb";

interface SuburbFilterModalProps {
  open: boolean;
  /** 当前城市中文名（展示用）。 */
  cityName: string;
  /** 当前城市 id（YEEYI code，可能为空）。 */
  cityId?: string;
  /** 已选中的城区名。 */
  initialSelected: string[];
  onClose: () => void;
  onConfirm: (selected: string[]) => void;
}

/** 展示上限：避免一次性渲染数千个城区导致卡顿，更多请用搜索。 */
const DISPLAY_LIMIT = 300;

export default function SuburbFilterModal({
  open,
  cityName,
  cityId,
  initialSelected,
  onClose,
  onConfirm,
}: SuburbFilterModalProps) {
  const [districts, setDistricts] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // 打开时重置草稿 + 按需加载当前城市的城区列表
  useEffect(() => {
    if (!open) return;
    setSelected(initialSelected);
    setSearch("");
    setLoading(true);
    (async () => {
      try {
        const mod = (await import("@/data/suburbs.json")) as { default?: SuburbsDataset };
        const cities = mod.default?.cities ?? (mod as unknown as SuburbsDataset).cities ?? [];
        const cityIdNum = cityId ? Number(cityId) : NaN;
        const city =
          cities.find((c) => c.id === cityIdNum) ||
          cities.find((c) => c.name === cityName || c.nameEn === cityName) ||
          cities.find((c) => c.name && cityName && c.name.includes(cityName));
        const names = city ? Array.from(new Set(city.suburbs.map((s) => s.name))) : [];
        names.sort((a, b) => a.localeCompare(b));
        setDistricts(names);
      } catch {
        setDistricts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, cityName, cityId, initialSelected]);

  // 关闭或滚轮/遮罩交互
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return districts.slice(0, DISPLAY_LIMIT);
    return districts.filter((d) => d.toLowerCase().includes(kw)).slice(0, DISPLAY_LIMIT);
  }, [districts, search]);

  const toggle = (name: string) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name],
    );
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-xl sm:h-auto sm:max-h-[80vh] sm:rounded-2xl rounded-t-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">筛选城区 · {cityName || "全部"}</h3>
            <p className="text-xs text-slate-400">
              已选 {selected.length} 个城区（可多选）
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-slate-100 px-4 py-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索城区…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-sky-400 sm:text-sm"
          />
        </div>

        <div className="flex items-center justify-between gap-2 px-4 py-2 text-xs">
          <div className="flex gap-2">
            <button
              onClick={() => setSelected(districts.slice(0, DISPLAY_LIMIT))}
              className="rounded-full border border-slate-200 px-2.5 py-1 text-slate-500 transition hover:border-sky-300 hover:text-sky-600"
            >
              全选
            </button>
            <button
              onClick={() => setSelected([])}
              className="rounded-full border border-slate-200 px-2.5 py-1 text-slate-500 transition hover:border-sky-300 hover:text-sky-600"
            >
              清空
            </button>
          </div>
          {districts.length > DISPLAY_LIMIT && (
            <span className="text-slate-400">共 {districts.length} 个城区，输入关键词可搜索更多</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          {loading && <p className="py-6 text-center text-sm text-slate-400">加载城区…</p>}
          {!loading && filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">
              该城市暂无城区数据，或未匹配到关键词。
            </p>
          )}
          {!loading &&
            filtered.map((name) => {
              const checked = selected.includes(name);
              return (
                <label
                  key={name}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(name)}
                    className="h-5 w-5 accent-sky-500"
                  />
                  <span className={checked ? "font-medium text-sky-700" : ""}>{name}</span>
                </label>
              );
            })}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 pb-safe">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            取消
          </button>
          <button
            onClick={() => onConfirm(selected)}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            应用筛选（{selected.length}）
          </button>
        </div>
      </div>
    </div>
  );
}