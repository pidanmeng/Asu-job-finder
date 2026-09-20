/**
 * lib/turso —— Turso (libSQL) 客户端封装 + 建表 + 关注城区 / 推送运行记录的读写。
 *
 * 环境变量（兼容两种命名，见 .env 里已有的 TURSO_API_URL / TURSO_API_SECRET）：
 *   TURSO_DATABASE_URL / TURSO_API_URL     例如 libsql://xxx.turso.io
 *   TURSO_AUTH_TOKEN  / TURSO_API_SECRET   Turso 数据库访问令牌
 * 未配置时 isTursoConfigured() 返回 false，相关接口返回友好错误（本地/无数据库演示降级）。
 * 仅在服务端使用（避免把令牌暴露给前端）。
 */
import { createClient } from "@libsql/client";
import type { Client } from "@libsql/client";
import type { FollowLocation } from "@/types/follow";

export const TURSO_URL =
  process.env.TURSO_DATABASE_URL || process.env.TURSO_API_URL || "";
export const TURSO_TOKEN =
  process.env.TURSO_AUTH_TOKEN || process.env.TURSO_API_SECRET || "";

export function isTursoConfigured(): boolean {
  return Boolean(TURSO_URL && TURSO_TOKEN);
}

let client: Client | null = null;

/** 惰性初始化 libsql 客户端。未配置则返回 null。 */
export function getDb(): Client | null {
  if (!isTursoConfigured()) return null;
  if (!client) {
    client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
  }
  return client;
}

/** 幂等建表（关注城区 + 推送运行记录）。同时为已存在的旧表补列（label / radius_km）。 */
export async function ensureSchema(): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS follow_locations (
      id            TEXT PRIMARY KEY,
      main_city     TEXT NOT NULL,
      suburbs       TEXT NOT NULL,
      lat           REAL,
      lng           REAL,
      radius_km     REAL,
      label         TEXT DEFAULT '',
      place_name    TEXT DEFAULT '',
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS email_runs (
      id            TEXT PRIMARY KEY,
      run_at        INTEGER NOT NULL,
      slot          TEXT NOT NULL,
      followed_count INTEGER DEFAULT 0,
      new_jobs_count INTEGER DEFAULT 0,
      success       INTEGER NOT NULL DEFAULT 0,
      message       TEXT DEFAULT ''
    );
  `);
  // 迁移：给早期 schema（无 label / radius_km）的表补列
  try {
    const cols = await db.execute("PRAGMA table_info(follow_locations)");
    const names = new Set((cols.rows as unknown as Row[]).map((r) => String(r.name)));
    if (!names.has("label")) await db.execute("ALTER TABLE follow_locations ADD COLUMN label TEXT DEFAULT ''");
    if (!names.has("radius_km")) await db.execute("ALTER TABLE follow_locations ADD COLUMN radius_km REAL");
  } catch {
    /* 列已存在等场景忽略 */
  }
}

type Row = Record<string, unknown>;

function toFollow(row: Row): FollowLocation {
  let suburbs: FollowLocation["suburbs"] = [];
  try {
    const parsed = JSON.parse(String(row.suburbs ?? "[]"));
    if (Array.isArray(parsed)) suburbs = parsed as FollowLocation["suburbs"];
  } catch {
    suburbs = [];
  }
  return {
    id: String(row.id),
    mainCity: String(row.main_city ?? ""),
    suburbs,
    label: row.label ? String(row.label) : "",
    lat: typeof row.lat === "number" ? row.lat : Number(row.lat) || undefined,
    lng: typeof row.lng === "number" ? row.lng : Number(row.lng) || undefined,
    radiusKm: typeof row.radius_km === "number" ? row.radius_km : Number(row.radius_km) || undefined,
    placeName: row.place_name ? String(row.place_name) : "",
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

/* ---------------- 关注城区（Feature 2） ---------------- */

export async function listFollowLocations(): Promise<FollowLocation[]> {
  const db = getDb();
  if (!db) return [];
  await ensureSchema();
  const res = await db.execute("SELECT * FROM follow_locations ORDER BY created_at DESC LIMIT 10");
  return (res.rows as unknown as Row[]).map(toFollow);
}

/**
 * 新增一个关注（城市 + 城区）。最多允许 MAX_FOLLOWS=10 组；
 * 若相同 城市+城区 已存在则直接返回现有记录（幂等）。
 */
export async function addFollowLocation(input: {
  mainCity: string;
  suburbs: FollowLocation["suburbs"];
  label?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  placeName?: string;
}): Promise<{ ok: true; follow: FollowLocation; duplicate: boolean } | { ok: false; error: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: "Turso 未配置（TURSO_DATABASE_URL / TURSO_AUTH_TOKEN）" };
  await ensureSchema();

  const mainCity = (input.mainCity || "未知城市").trim();
  const suburbs = input.suburbs ?? [];
  if (!mainCity && suburbs.length === 0) {
    return { ok: false, error: "缺少可关注的城区" };
  }

  const existing = (await listFollowLocations()).find(
    (f) =>
      f.mainCity === mainCity &&
      f.suburbs.map((s) => s.name).join(",") === suburbs.map((s) => s.name).join(","),
  );
  if (existing) return { ok: true, follow: existing, duplicate: true };

  const count = (await listFollowLocations()).length;
  if (count >= 10) return { ok: false, error: "最多只能关注 10 组城区" };

  const id = `fl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const label = (input.label ?? "").trim() || mainCity;
  await db.execute({
    sql: "INSERT INTO follow_locations (id, main_city, suburbs, label, lat, lng, radius_km, place_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    args: [
      id,
      mainCity,
      JSON.stringify(suburbs.map((s) => ({ name: s.name, lat: s.lat, lng: s.lng }))),
      label,
      input.lat ?? null,
      input.lng ?? null,
      input.radiusKm ?? null,
      input.placeName ?? "",
      now,
      now,
    ],
  });
  const follow: FollowLocation = {
    id,
    mainCity,
    suburbs,
    label,
    lat: input.lat,
    lng: input.lng,
    radiusKm: input.radiusKm,
    placeName: input.placeName ?? "",
    createdAt: now,
    updatedAt: now,
  };
  return { ok: true, follow, duplicate: false };
}

export async function removeFollowLocation(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  await ensureSchema();
  const res = await db.execute({ sql: "DELETE FROM follow_locations WHERE id = ?", args: [id] });
  return (res.rowsAffected ?? 0) > 0;
}

/* ---------------- 推送运行记录（Feature 3 回写 Turso） ---------------- */

export interface EmailRunRecord {
  id: string;
  runAt: number;
  slot: string;
  followedCount: number;
  newJobsCount: number;
  success: boolean;
  message: string;
}

/** 记录一次定时推送运行（无论是否真的发信）。 */
export async function recordEmailRun(r: {
  slot: string;
  followedCount: number;
  newJobsCount: number;
  success: boolean;
  message: string;
}): Promise<void> {
  const db = getDb();
  if (!db) return;
  await ensureSchema();
  await db.execute({
    sql: "INSERT INTO email_runs (id, run_at, slot, followed_count, new_jobs_count, success, message) VALUES (?, ?, ?, ?, ?, ?, ?)",
    args: [
      `er-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      Date.now(),
      r.slot,
      r.followedCount,
      r.newJobsCount,
      r.success ? 1 : 0,
      r.message,
    ],
  });
}

/** 取最近一次运行记录（用于同窗去重 / 展示）。 */
export async function latestEmailRun(): Promise<EmailRunRecord | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const res = await db.execute("SELECT * FROM email_runs ORDER BY run_at DESC LIMIT 1");
  const rows = res.rows as unknown as Row[];
  if (!rows.length) return null;
  const r = rows[0]!;
  return {
    id: String(r.id),
    runAt: Number(r.run_at),
    slot: String(r.slot ?? ""),
    followedCount: Number(r.followed_count ?? 0),
    newJobsCount: Number(r.new_jobs_count ?? 0),
    success: Boolean(r.success && Number(r.success) === 1),
    message: String(r.message ?? ""),
  };
}