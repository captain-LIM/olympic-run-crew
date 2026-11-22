import { estimateDurationMin, MODE_LABEL } from "./matching";
import { formatKstDate, formatKstTime, kstDateString } from "./time";
import type { Course, Crew, LatLng, Show } from "./types";

/**
 * 크루 일정을 캘린더에 넣기 위한 순수 함수 모음.
 * - .ics 파일 (RFC 5545): 휴대폰 기본 캘린더 등
 * - Google 캘린더 일정 추가 링크
 * - 카카오맵 길찾기 링크
 */

export interface CalendarEvent {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  location: string;
  geo?: LatLng;
  description: string;
  url?: string;
  /** 시작 몇 분 전에 알릴지 (없으면 알림 없음) */
  alarmMinutesBefore?: number;
}

/** 출발 몇 분 전에 알릴지 */
export const CALENDAR_ALARM_MIN = 30;

/** 2026-11-28T08:30:00.000Z → 20261128T083000Z (UTC) */
export function toIcsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** .ics 텍스트 값 이스케이프: \ ; , 줄바꿈 */
export function escapeIcsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/**
 * 한 줄을 75바이트(UTF-8) 이하로 접는다. 이어지는 줄은 공백 한 칸으로 시작한다.
 * 한글처럼 여러 바이트인 글자가 중간에 잘리지 않도록 글자 단위로 자른다.
 */
export function foldIcsLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // 이어지는 줄은 맨 앞 공백 1바이트 포함 75
    if (bytes + n > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function buildIcs(e: CalendarEvent, now: Date = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//olympic-run-crew//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${toIcsDate(now)}`,
    `DTSTART:${toIcsDate(e.start)}`,
    `DTEND:${toIcsDate(e.end)}`,
    `SUMMARY:${escapeIcsText(e.title)}`,
    `LOCATION:${escapeIcsText(e.location)}`,
    ...(e.geo ? [`GEO:${e.geo.lat};${e.geo.lng}`] : []),
    `DESCRIPTION:${escapeIcsText(e.description)}`,
    ...(e.url ? [`URL:${e.url}`] : []),
    ...(e.alarmMinutesBefore
      ? ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeIcsText(e.title)}`, `TRIGGER:-PT${e.alarmMinutesBefore}M`, "END:VALARM"]
      : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

/**
 * Google 캘린더 일정 추가 화면 링크.
 * 공식 문서는 없고 널리 쓰이는 형식이다: render?action=TEMPLATE&text&dates=시작/끝(UTC)&details&location
 */
export function googleCalendarUrl(e: CalendarEvent): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${toIcsDate(e.start)}/${toIcsDate(e.end)}`,
    details: e.description,
    location: e.location,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/**
 * 카카오맵 길찾기 링크 (https://developers.kakao.com/docs/latest/ko/kakaomap/common)
 * 형식: https://map.kakao.com/link/to/이름,위도,경도 — 이름 안의 쉼표는 구분자와 섞이므로 공백으로 바꾼다.
 */
export function kakaoDirectionsUrl(place: LatLng & { name: string }): string {
  const name = place.name.replace(/,/g, " ");
  return `https://map.kakao.com/link/to/${encodeURIComponent(name)},${place.lat},${place.lng}`;
}

/** 크루 일정. 닉네임 등 크루원 정보는 넣지 않는다 */
export function crewCalendarEvent(params: {
  crew: Pick<Crew, "id" | "mode" | "paceMinPerKm" | "startAt" | "eventStartAt">;
  course: Course;
  show: Pick<Show, "title">;
  /** 사이트 주소 (예: https://example.vercel.app) — 크루방 링크에 쓴다 */
  origin: string;
}): CalendarEvent {
  const { crew, course, show, origin } = params;
  const start = new Date(crew.startAt);
  const end = new Date(start.getTime() + Math.max(estimateDurationMin(course, crew.paceMinPerKm), 10) * 60_000);
  const crewUrl = `${origin}/crews/${crew.id}`;
  const showDate = formatKstDate(kstDateString(new Date(crew.eventStartAt)));
  return {
    uid: `crew-${crew.id}@olympic-run-crew`,
    title: `[공연 전 한 바퀴] ${course.name} · ${MODE_LABEL[crew.mode]}`,
    start,
    end,
    location: `${course.meetingPoint.name} (올림픽공원)`,
    geo: { lat: course.meetingPoint.lat, lng: course.meetingPoint.lng },
    description: [
      `공연: ${show.title}`,
      `공연 시작: ${showDate} ${formatKstTime(crew.eventStartAt)}`,
      `집결지: ${course.meetingPoint.name}`,
      `코스: ${course.name} ${course.distanceKm}km, ${crew.paceMinPerKm}분/km`,
      `크루방: ${crewUrl}`,
      `길찾기: ${kakaoDirectionsUrl(course.meetingPoint)}`,
      "공개된 장소에서 만나고, 개인 연락처 교환은 자제하세요.",
    ].join("\n"),
    url: crewUrl,
    alarmMinutesBefore: CALENDAR_ALARM_MIN,
  };
}
