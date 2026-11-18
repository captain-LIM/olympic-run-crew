import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;

/** scrypt 파라미터 (OWASP 권장 수준) */
const PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 64;

/** 저장 형식: scrypt$N$r$p$saltB64$hashB64 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, KEYLEN, PARAMS);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, saltB64, hashB64] = stored.split("$");
  if (alg !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: PARAMS.maxmem,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** DB에는 토큰 원문이 아니라 해시만 저장 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface PasswordCheck {
  ok: boolean;
  reason?: string;
}

export function checkPasswordPolicy(password: string): PasswordCheck {
  if (password.length < 8) return { ok: false, reason: "비밀번호는 8자 이상이어야 합니다." };
  if (password.length > 72) return { ok: false, reason: "비밀번호는 72자 이하로 입력하세요." };
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return { ok: false, reason: "비밀번호에 영문과 숫자를 함께 넣어 주세요." };
  return { ok: true };
}

export function normalizeEmail(email: string): string | null {
  const e = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 255 ? e : null;
}
