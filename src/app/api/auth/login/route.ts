import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { clearAttempts, createSession, findUserForLogin, recordFailedAttempt, tooManyAttempts } from "@/lib/auth";
import { normalizeEmail, verifyPassword } from "@/lib/password";

export async function POST(req: Request) {
  const body = await readJson(req);
  const email = normalizeEmail(String(body?.email ?? ""));
  const password = String(body?.password ?? "");
  if (!email || !password) return jsonError("이메일과 비밀번호를 입력하세요.", 400);

  if (tooManyAttempts(email)) return jsonError("로그인 시도가 너무 많습니다. 10분 후 다시 시도하세요.", 429);

  const user = await findUserForLogin(email);
  // 계정 존재 여부를 드러내지 않도록 같은 메시지 사용
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    recordFailedAttempt(email);
    return jsonError("이메일 또는 비밀번호가 올바르지 않습니다.", 401);
  }
  clearAttempts(email);
  await createSession(user.id);
  return NextResponse.json({ user: { id: user.id, nickname: user.nickname, ageGroup: user.ageGroup } });
}
