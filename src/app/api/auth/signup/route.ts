import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { createSession, createUser } from "@/lib/auth";
import { checkPasswordPolicy, hashPassword, normalizeEmail } from "@/lib/password";
import { parseProfile } from "@/lib/validate";

export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return jsonError("잘못된 요청입니다.", 400);

  const email = normalizeEmail(String(body.email ?? ""));
  if (!email) return jsonError("이메일 형식을 확인하세요.", 400);
  const password = String(body.password ?? "");
  const policy = checkPasswordPolicy(password);
  if (!policy.ok) return jsonError(policy.reason!, 400);
  const profile = parseProfile(body);
  if (!profile.ok) return jsonError(profile.error, 400);

  try {
    const user = await createUser({ email, passwordHash: await hashPassword(password), ...profile.value });
    await createSession(user.id);
    return NextResponse.json({ user: { id: user.id, nickname: user.nickname, ageGroup: user.ageGroup } }, { status: 201 });
  } catch (e) {
    if ((e as { code?: string }).code === "ER_DUP_ENTRY") return jsonError("이미 가입된 이메일입니다.", 409);
    throw e;
  }
}
