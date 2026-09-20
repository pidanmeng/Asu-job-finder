/**
 * profileStore —— 「自我介绍」个人信息表单的 localStorage 持久化（基于 useLocalStorage）。
 * 用户在职位筛选页的「自我介绍」抽屉里填写 姓名/电话/自我介绍 等字段，保存后写回 localStorage；
 * 「立即联系」拼短信与生成 VCard 时都会读取这份资料。
 */
"use client";

import { useCallback } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

export const PROFILE_STORAGE_KEY = "aus-self-intro";

export interface SelfIntroProfile {
  /** 姓名。 */
  name: string;
  /** 电话。 */
  phone: string;
  /** 微信（可选）。 */
  wechat: string;
  /** 邮箱（可选）。 */
  email: string;
  /** 期望职位 / 意向岗位（可选）。 */
  desiredRole: string;
  /** 期望地区（可选）。 */
  region: string;
  /** 自我介绍正文。 */
  intro: string;
  /** 最近保存时间（Unix 毫秒）。 */
  updatedAt: number;
}

export function emptyProfile(): SelfIntroProfile {
  return { name: "", phone: "", wechat: "", email: "", desiredRole: "", region: "", intro: "", updatedAt: 0 };
}

export function loadProfile(): SelfIntroProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SelfIntroProfile) : null;
  } catch {
    return null;
  }
}

export function useProfile() {
  const [profile, setProfile] = useLocalStorage<SelfIntroProfile | null>(
    PROFILE_STORAGE_KEY,
    null,
  );

  const saveProfile = useCallback(
    (p: SelfIntroProfile) => setProfile({ ...p, updatedAt: Date.now() }),
    [setProfile],
  );

  return { profile, saveProfile };
}