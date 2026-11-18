import { NextResponse } from "next/server";
import { currentUser, type User } from "./auth";

export const jsonError = (error: string, status: number) => NextResponse.json({ error }, { status });

/** 로그인 필요 API에서 사용: 사용자 또는 401 응답 */
export async function requireUser(): Promise<{ user: User; res?: never } | { user?: never; res: NextResponse }> {
  const user = await currentUser();
  return user ? { user } : { res: jsonError("로그인이 필요합니다.", 401) };
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
