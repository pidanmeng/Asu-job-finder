/**
 * useLocation —— 读取“已选位置”的 hook（Prompt D 要求导出）。
 * 实现复用了 mapStore 中的同名 hook，保证单一数据源。
 */
"use client";

export { useLocation } from "@/store/mapStore";