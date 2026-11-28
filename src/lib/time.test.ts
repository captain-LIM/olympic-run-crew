import { describe, expect, it } from "vitest";
import { formatKstSession, formatPeriod } from "./time";

describe("회차·기간 표기", () => {
  it("회차: 월·일·요일·시각", () => {
    expect(formatKstSession("2026-12-18T19:30")).toBe("12월 18일 (금) 19:30");
    expect(formatKstSession("2027-01-03T14:00")).toBe("1월 3일 (일) 14:00");
  });

  it("기간: 올해 안이면 연도 생략, 해를 넘기면 연도 포함, 하루면 한 번만", () => {
    const now = new Date("2026-11-24T12:00:00+09:00");
    expect(formatPeriod("2026-12-18", "2026-12-20", now)).toBe("12.18 ~ 12.20");
    expect(formatPeriod("2026-11-28", "2027-01-03", now)).toBe("2026.11.28 ~ 2027.01.03");
    expect(formatPeriod("2027-02-04", "2027-02-04", now)).toBe("2027.02.04");
    expect(formatPeriod("2026-12-05", "2026-12-05", now)).toBe("12.5");
  });
});
