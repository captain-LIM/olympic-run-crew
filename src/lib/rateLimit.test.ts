import { describe, expect, it } from "vitest";
import { clientIp, LIMITS, secondsUntilWindowEnd, subjectKey, windowStart } from "./rateLimit";

describe("windowStart", () => {
  it("cuts time into fixed windows", () => {
    const t = new Date("2026-11-22T10:07:31.500Z");
    expect(windowStart(t, 600).toISOString()).toBe("2026-11-22T10:00:00.000Z"); // 10분
    expect(windowStart(t, 3600).toISOString()).toBe("2026-11-22T10:00:00.000Z"); // 1시간
    expect(windowStart(t, 60).toISOString()).toBe("2026-11-22T10:07:00.000Z"); // 1분
    expect(windowStart(t, 1).toISOString()).toBe("2026-11-22T10:07:31.000Z"); // 1초
  });

  it("tells how long until the window ends (at least 1s)", () => {
    expect(secondsUntilWindowEnd(new Date("2026-11-22T10:07:31.500Z"), 600)).toBe(149); // 10:10:00까지 148.5초 → 올림
    expect(secondsUntilWindowEnd(new Date("2026-11-22T10:09:59.999Z"), 600)).toBe(1);
  });
});

describe("clientIp", () => {
  const h = (xff?: string) => new Headers(xff === undefined ? {} : { "x-forwarded-for": xff });

  it("uses the first x-forwarded-for value (Vercel overwrites it with the client IP)", () => {
    expect(clientIp(h("203.0.113.7"))).toBe("203.0.113.7");
    expect(clientIp(h(" 203.0.113.7 , 10.0.0.1"))).toBe("203.0.113.7");
    expect(clientIp(h("2001:db8::1"))).toBe("2001:db8::1");
  });

  it("falls back to 'unknown' when the header is missing or empty", () => {
    expect(clientIp(h())).toBe("unknown");
    expect(clientIp(h(""))).toBe("unknown");
    expect(clientIp(h(" , 10.0.0.1"))).toBe("unknown");
  });
});

describe("subjectKey", () => {
  it("stores a 64-char hash instead of the raw email/IP, stable per input", () => {
    const k = subjectKey(["fan@example.com", "203.0.113.7"]);
    expect(k).toMatch(/^[0-9a-f]{64}$/);
    expect(k).not.toContain("fan@example.com");
    expect(subjectKey(["fan@example.com", "203.0.113.7"])).toBe(k);
  });

  it("does not mix up different splits of the same text", () => {
    expect(subjectKey(["ab", "c"])).not.toBe(subjectKey(["a", "bc"]));
  });
});

describe("LIMITS", () => {
  it("keeps the agreed limits", () => {
    expect(LIMITS.loginIp).toMatchObject({ max: 20, windowSec: 600 });
    expect(LIMITS.loginEmailIp).toMatchObject({ max: 5, windowSec: 600 });
    expect(LIMITS.loginEmail).toMatchObject({ max: 50, windowSec: 3600 });
    expect(LIMITS.signupIp).toMatchObject({ max: 5, windowSec: 3600 });
    expect(LIMITS.chatSecond).toMatchObject({ max: 1, windowSec: 1 });
    expect(LIMITS.chatMinute).toMatchObject({ max: 30, windowSec: 60 });
  });

  it("uses bucket names that fit the DB column (VARCHAR(32)) and are unique", () => {
    const buckets = Object.values(LIMITS).map((l) => l.bucket);
    expect(buckets.every((b) => b.length <= 32)).toBe(true);
    expect(new Set(buckets).size).toBe(buckets.length);
  });
});
