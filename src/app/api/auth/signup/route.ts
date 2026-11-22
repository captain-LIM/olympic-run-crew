import { NextResponse } from "next/server";
import { jsonError, readJson, tooManyRequests } from "@/lib/api";
import { createSession, createUser } from "@/lib/auth";
import { checkPasswordPolicy, hashPassword, normalizeEmail } from "@/lib/password";
import { clientIp, hit, LIMITS } from "@/lib/rateLimit";
import { parseProfile } from "@/lib/validate";

export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return jsonError("잘못된 요청입니다.", 400);

  const email = normalizeEmail(String(body.email ?? ""));
  if (!email) return jsonError("이메일 형식을 확인하세요.", 400);
  const password = String(body.password ?? "");
  if (password !== String(body.passwordConfirm ?? "")) return jsonError("비밀번호가 서로 일치하지 않아요.", 400);
  const policy = checkPasswordPolicy(password);
  if (!policy.ok) return jsonError(policy.reason!, 400);
  const profile = parseProfile(body);
  if (!profile.ok) return jsonError(profile.error, 400);

  // 입력 형식 검사(가벼움)를 통과한 요청만 센다. 오타로 횟수를 쓰지 않게 하고,
  // 무거운 scrypt 계산 전에 막는다. 이미 가입된 이메일(409)도 계산을 하므로 센다.
  const limited = await hit(LIMITS.signupIp, [clientIp(req.headers)]);
  if (!limited.ok) {
    const minutes = Math.ceil(limited.retryAfterSec / 60);
    return tooManyRequests(`가입 시도가 너무 많습니다. ${minutes}분 후 다시 시도하세요.`, limited.retryAfterSec);
  }

  try {
    const user = await createUser({ email, passwordHash: await hashPassword(password), ...profile.value });
    await createSession(user.id);
    return NextResponse.json({ user: { id: user.id, nickname: user.nickname, ageGroup: user.ageGroup } }, { status: 201 });
  } catch (e) {
    if ((e as { code?: string }).code === "ER_DUP_ENTRY") return jsonError("이미 가입된 이메일입니다.", 409);
    throw e;
  }
}
