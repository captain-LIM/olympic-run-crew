import { cookies } from "next/headers";
import { exec, query } from "./db";
import { hashToken, newSessionToken } from "./password";
import type { AgeGroup } from "./types";

export const SESSION_COOKIE = "orc_session";
const SESSION_DAYS = 30;

export interface User {
  id: number;
  email: string;
  nickname: string;
  ageGroup: AgeGroup;
}

interface UserRow {
  id: number;
  email: string;
  nickname: string;
  age_group: AgeGroup;
}

const toUser = (r: UserRow): User => ({ id: Number(r.id), email: r.email, nickname: r.nickname, ageGroup: r.age_group });

export async function createSession(userId: number): Promise<void> {
  const token = newSessionToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await exec("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [hashToken(token), userId, expires]);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await exec("DELETE FROM sessions WHERE id = ?", [hashToken(token)]);
  jar.delete(SESSION_COOKIE);
}

/** 현재 요청의 로그인 사용자 (없거나 만료되면 null) */
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await query<UserRow>(
    `SELECT u.id, u.email, u.nickname, u.age_group
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > UTC_TIMESTAMP(3)`,
    [hashToken(token)],
  );
  return rows[0] ? toUser(rows[0]) : null;
}

export async function findUserForLogin(email: string): Promise<(User & { passwordHash: string }) | null> {
  const rows = await query<UserRow & { password_hash: string }>(
    "SELECT id, email, nickname, age_group, password_hash FROM users WHERE email = ?",
    [email],
  );
  return rows[0] ? { ...toUser(rows[0]), passwordHash: rows[0].password_hash } : null;
}

export async function createUser(input: { email: string; passwordHash: string; nickname: string; ageGroup: AgeGroup }): Promise<User> {
  const res = await exec("INSERT INTO users (email, password_hash, nickname, age_group) VALUES (?, ?, ?, ?)", [
    input.email, input.passwordHash, input.nickname, input.ageGroup,
  ]);
  return { id: res.insertId, email: input.email, nickname: input.nickname, ageGroup: input.ageGroup };
}
// 로그인 시도 제한은 lib/rateLimit.ts (DB 기록)로 옮겼다
