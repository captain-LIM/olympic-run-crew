import { NextResponse } from "next/server";
import { jsonError, readJson, tooManyRequests } from "@/lib/api";
import { createSession, findUserForLogin } from "@/lib/auth";
import { normalizeEmail, verifyPassword } from "@/lib/password";
import { clear, clientIp, hitAll, LIMITS, undo } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const body = await readJson(req);
  const email = normalizeEmail(String(body?.email ?? ""));
  const password = String(body?.password ?? "");
  if (!email || !password) return jsonError("이메일과 비밀번호를 입력하세요.", 400);

  // 비밀번호를 확인하기 전에 먼저 센다. 확인 후에 세면 동시에 몰려온 요청이 모두 검사를 통과하고,
  // 막힌 요청도 무거운 scrypt 계산을 하게 된다. 로그인에 성공하면 아래에서 되돌린다.
  const ip = clientIp(req.headers);
  const now = new Date();
  const limited = await hitAll(
    [
      [LIMITS.loginIp, [ip]],
      [LIMITS.loginEmailIp, [email, ip]],
      [LIMITS.loginEmail, [email]],
    ],
    now,
  );
  if (!limited.ok) {
    const minutes = Math.ceil(limited.retryAfterSec / 60);
    return tooManyRequests(`로그인 시도가 너무 많습니다. ${minutes}분 후 다시 시도하세요.`, limited.retryAfterSec);
  }

  const user = await findUserForLogin(email);
  // 계정 존재 여부를 드러내지 않도록 같은 메시지 사용
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return jsonError("이메일 또는 비밀번호가 올바르지 않습니다.", 401);
  }

  // 성공한 시도는 실패 횟수에 넣지 않는다. 같은 IP·같은 이메일의 실패 기록은 지운다
  await Promise.all([
    undo(LIMITS.loginIp, [ip], now),
    undo(LIMITS.loginEmail, [email], now),
    clear(LIMITS.loginEmailIp, [email, ip]),
  ]);
  await createSession(user.id);
  return NextResponse.json({ user: { id: user.id, nickname: user.nickname, ageGroup: user.ageGroup } });
}
