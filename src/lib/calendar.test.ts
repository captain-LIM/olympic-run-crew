import { describe, expect, it } from "vitest";
import { buildIcs, crewCalendarEvent, escapeIcsText, foldIcsLine, googleCalendarUrl, kakaoDirectionsUrl, toIcsDate, type CalendarEvent } from "./calendar";
import { getCourse } from "./park";

const unfold = (s: string) => s.replace(/\r\n /g, "");
const bytes = (s: string) => new TextEncoder().encode(s).length;

describe("toIcsDate / escapeIcsText", () => {
  it("formats UTC timestamps", () => {
    expect(toIcsDate(new Date("2026-11-28T17:30:00+09:00"))).toBe("20261128T083000Z");
  });

  it("escapes backslash, semicolon, comma and newlines", () => {
    expect(escapeIcsText("a\\b;c,d\ne\r\nf")).toBe("a\\\\b\\;c\\,d\\ne\\nf");
  });
});

describe("foldIcsLine", () => {
  it("keeps short lines as they are", () => {
    expect(foldIcsLine("SUMMARY:short")).toBe("SUMMARY:short");
  });

  it("folds long Korean lines to 75 bytes without splitting a character", () => {
    const line = "DESCRIPTION:" + "공연 전 한 바퀴 몽촌호수 산책 ".repeat(10);
    const folded = foldIcsLine(line);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => bytes(p) <= 75)).toBe(true);
    expect(parts.slice(1).every((p) => p.startsWith(" "))).toBe(true);
    expect(parts.every((p) => !p.includes("�"))).toBe(true); // 깨진 글자 없음
    expect(unfold(folded)).toBe(line);
  });
});

const event: CalendarEvent = {
  uid: "crew-abc@olympic-run-crew",
  title: "[공연 전 한 바퀴] 몽촌호수 한 바퀴 · 산책",
  start: new Date("2026-11-28T08:30:00Z"),
  end: new Date("2026-11-28T08:49:00Z"),
  location: "몽촌호수 수변무대 앞 (올림픽공원)",
  geo: { lat: 37.5209, lng: 127.1214 },
  description: "공연: 테스트, 콘서트\n크루방: https://example.com/crews/abc",
  url: "https://example.com/crews/abc",
  alarmMinutesBefore: 30,
};

describe("buildIcs", () => {
  const ics = buildIcs(event, new Date("2026-11-22T00:00:00Z"));
  const lines = unfold(ics).split("\r\n");

  it("uses CRLF line endings and wraps one event", () => {
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "").includes("\n")).toBe(false);
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(1);
    expect(lines).toContain("END:VCALENDAR");
  });

  it("includes times, place, escaped text and a 30-minute alarm", () => {
    expect(lines).toContain("DTSTART:20261128T083000Z");
    expect(lines).toContain("DTEND:20261128T084900Z");
    expect(lines).toContain("DTSTAMP:20261122T000000Z");
    expect(lines).toContain("GEO:37.5209;127.1214");
    expect(lines).toContain("DESCRIPTION:공연: 테스트\\, 콘서트\\n크루방: https://example.com/crews/abc");
    expect(lines).toContain("TRIGGER:-PT30M");
  });

  it("keeps every physical line within 75 bytes", () => {
    expect(ics.split("\r\n").every((l) => bytes(l) <= 75)).toBe(true);
  });

  it("omits the alarm when not requested", () => {
    expect(buildIcs({ ...event, alarmMinutesBefore: undefined })).not.toContain("BEGIN:VALARM");
  });
});

describe("links", () => {
  it("builds a Google Calendar template link", () => {
    const u = new URL(googleCalendarUrl(event));
    expect(u.origin + u.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(u.searchParams.get("action")).toBe("TEMPLATE");
    expect(u.searchParams.get("dates")).toBe("20261128T083000Z/20261128T084900Z");
    expect(u.searchParams.get("text")).toBe(event.title);
    expect(u.searchParams.get("location")).toBe(event.location);
  });

  it("builds a Kakao Map directions link as name,lat,lng", () => {
    expect(kakaoDirectionsUrl({ name: "88잔디마당 입구", lat: 37.5196, lng: 127.1229 })).toBe(
      `https://map.kakao.com/link/to/${encodeURIComponent("88잔디마당 입구")},37.5196,127.1229`,
    );
    // 이름 안의 쉼표는 구분자와 섞이지 않도록 공백으로
    expect(kakaoDirectionsUrl({ name: "A,B", lat: 1, lng: 2 })).toBe("https://map.kakao.com/link/to/A%20B,1,2");
  });
});

describe("crewCalendarEvent", () => {
  const course = getCourse("lake-loop")!; // 1.6km
  const e = crewCalendarEvent({
    crew: { id: "abc123", mode: "walk", paceMinPerKm: 12, startAt: "2026-11-28T08:30:00.000Z", eventStartAt: "2026-11-28T10:00:00.000Z" },
    course,
    show: { title: "테스트 콘서트" },
    origin: "https://example.com",
  });

  it("starts at departure and lasts the estimated course time", () => {
    expect(e.start.toISOString()).toBe("2026-11-28T08:30:00.000Z");
    expect(e.end.toISOString()).toBe("2026-11-28T08:49:00.000Z"); // 1.6km × 12분/km ≈ 19분
  });

  it("links the crew room and directions, without member nicknames", () => {
    expect(e.url).toBe("https://example.com/crews/abc123");
    expect(e.description).toContain("https://example.com/crews/abc123");
    expect(e.description).toContain("https://map.kakao.com/link/to/");
    expect(e.description).toContain("테스트 콘서트");
    expect(e.title).toBe("[공연 전 한 바퀴] 몽촌호수 한 바퀴 · 산책");
    expect(e.alarmMinutesBefore).toBe(30);
  });
});
