import { createHash } from "node:crypto";
import { exec } from "./db";

/**
 * 요청 횟수 제한 (로그인·회원가입·채팅).
 *
 * 서버 메모리가 아니라 MySQL(rate_limits)에 기록한다. Vercel 서버리스에서는 요청마다
 * 인스턴스가 따로 뜰 수 있어 메모리 기록은 공유되지 않기 때문이다.
 * 시간을 고정 구간(windowSec)으로 잘라 세고, 구간마다 한 행을 쓴다.
 */

export interface Limit {
  /** 무엇을 세는지 (DB의 bucket 열) */
  bucket: string;
  /** 구간 하나에서 허용하는 최대 횟수 */
  max: number;
  /** 구간 길이(초) */
  windowSec: number;
}

/** 한도는 이곳에서만 바꾼다 */
export const LIMITS = {
  /** 한 IP의 로그인 시도: 이메일을 바꿔 가며 흔한 비밀번호를 넣어 보는 공격 */
  loginIp: { bucket: "login:ip", max: 20, windowSec: 600 },
  /** 같은 IP에서 같은 이메일: 한 계정 집중 공격. 다른 IP의 진짜 사용자는 막지 않는다 */
  loginEmailIp: { bucket: "login:email-ip", max: 5, windowSec: 600 },
  /** 이메일 전체: 여러 IP에서 한 계정을 노리는 분산 공격 */
  loginEmail: { bucket: "login:email", max: 50, windowSec: 3600 },
  /** 한 IP의 회원가입: 비밀번호 해시(scrypt) 계산 폭주 방지 */
  signupIp: { bucket: "signup:ip", max: 5, windowSec: 3600 },
  /** 채팅: 1초에 1건, 1분에 30건 */
  chatSecond: { bucket: "chat:1s", max: 1, windowSec: 1 },
  chatMinute: { bucket: "chat:1m", max: 30, windowSec: 60 },
} as const satisfies Record<string, Limit>;

/** now가 속한 구간의 시작 시각 */
export function windowStart(now: Date, windowSec: number): Date {
  const ms = windowSec * 1000;
  return new Date(Math.floor(now.getTime() / ms) * ms);
}

/** 이 구간이 끝날 때까지 남은 초 (Retry-After에 쓴다) */
export function secondsUntilWindowEnd(now: Date, windowSec: number): number {
  const end = windowStart(now, windowSec).getTime() + windowSec * 1000;
  return Math.max(1, Math.ceil((end - now.getTime()) / 1000));
}

/**
 * 요청한 사람의 IP.
 * Vercel은 x-forwarded-for를 실제 접속 IP로 덮어쓰고 바깥에서 보낸 값은 넘기지 않는다
 * (https://vercel.com/docs/headers/request-headers). 그래서 첫 값을 믿는다.
 * 주의: Vercel 앞에 다른 CDN·프록시를 두면 이 값이 그 프록시의 IP가 되고,
 * 앞단 없이 next start를 바로 노출하면 사용자가 이 헤더를 조작할 수 있다.
 */
export function clientIp(headers: Headers): string {
  const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first || "unknown";
}

/** DB에는 이메일·IP 원문 대신 해시를 저장한다 */
export function subjectKey(parts: (string | number)[]): string {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex");
}

export interface HitResult {
  ok: boolean;
  hits: number;
  retryAfterSec: number;
}

/**
 * 횟수를 1 올리고 한도 안인지 돌려준다.
 * INSERT … ON DUPLICATE KEY UPDATE 한 문장이라 동시 요청에도 정확히 센다.
 * LAST_INSERT_ID(expr)로 이 요청이 올린 뒤의 값을 바로 돌려받는다.
 */
export async function hit(limit: Limit, subject: (string | number)[], now: Date = new Date()): Promise<HitResult> {
  maybeCleanup(now);
  const res = await exec(
    `INSERT INTO rate_limits (bucket, subject, window_start, hits) VALUES (?, ?, ?, LAST_INSERT_ID(1))
     ON DUPLICATE KEY UPDATE hits = LAST_INSERT_ID(hits + 1)`,
    [limit.bucket, subjectKey(subject), windowStart(now, limit.windowSec)],
  );
  const hits = Number(res.insertId);
  return { ok: hits <= limit.max, hits, retryAfterSec: secondsUntilWindowEnd(now, limit.windowSec) };
}

/** 여러 한도를 한꺼번에 센다. 하나라도 넘으면 ok=false, 기다릴 시간은 가장 긴 것 */
export async function hitAll(entries: [Limit, (string | number)[]][], now: Date = new Date()): Promise<HitResult> {
  const results = await Promise.all(entries.map(([limit, subject]) => hit(limit, subject, now)));
  const blocked = results.filter((r) => !r.ok);
  return {
    ok: blocked.length === 0,
    hits: Math.max(...results.map((r) => r.hits)),
    retryAfterSec: blocked.length ? Math.max(...blocked.map((r) => r.retryAfterSec)) : 0,
  };
}

/** 방금 센 1회를 되돌린다 (예: 로그인 성공은 실패 횟수에 넣지 않는다) */
export async function undo(limit: Limit, subject: (string | number)[], now: Date = new Date()): Promise<void> {
  await exec(
    "UPDATE rate_limits SET hits = GREATEST(hits, 1) - 1 WHERE bucket = ? AND subject = ? AND window_start = ?",
    [limit.bucket, subjectKey(subject), windowStart(now, limit.windowSec)],
  );
}

/** 이 대상의 기록을 모두 지운다 (예: 로그인 성공 시 같은 IP·같은 이메일의 실패 기록) */
export async function clear(limit: Limit, subject: (string | number)[]): Promise<void> {
  await exec("DELETE FROM rate_limits WHERE bucket = ? AND subject = ?", [limit.bucket, subjectKey(subject)]);
}

/** 요청 100번에 한 번 정도, 하루 넘은 기록을 지운다 (가장 긴 구간이 1시간) */
function maybeCleanup(now: Date): void {
  if (Math.random() >= 0.01) return;
  exec("DELETE FROM rate_limits WHERE window_start < ?", [new Date(now.getTime() - 86_400_000)]).catch((e) =>
    console.error("[rateLimit] 오래된 기록 정리 실패:", e),
  );
}
