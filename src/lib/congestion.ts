import type { CongestionLevel, CongestionRecord, CongestionSnapshot, DayType, HourlyPoint, ZoneCongestion, ZoneStatus } from "./types";

/**
 * 한국체육산업개발_주차장 혼잡도 정보 (data.go.kr 15164156, CSV)
 * 컬럼: 일련번호, 주차장아이디, 주차구역, 혼잡도(원활/혼잡/만차), 등록일, 등록시간
 * 주의: 원본 등록시간의 분:초 자리에 월:일 값이 들어가 있어 '시'만 사용한다.
 *
 * 순수 함수만 두어 서버/클라이언트 양쪽에서 쓴다. 파일 로딩은 lib/data/congestion.ts.
 */

const WEIGHT: Record<ZoneStatus, number> = { 원활: 0, 혼잡: 0.6, 만차: 1 };
export const HOURS = Array.from({ length: 15 }, (_, i) => i + 8); // 08~22시
const WINDOW = 1; // ±1시간

export function parseCongestionCsv(text: string): CongestionRecord[] {
  const lines = text.replace(/^﻿/, "").trim().split(/\r?\n/).slice(1);
  const out: CongestionRecord[] = [];
  for (const line of lines) {
    const cols = line.split(",").map((c) => c.replace(/"/g, "").trim());
    const [, , zone, status, date, time] = cols;
    if (!zone || !(status in WEIGHT) || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) continue;
    const hour = Number((time ?? "").slice(0, 2));
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) continue;
    out.push({ zone, status: status as ZoneStatus, date, hour });
  }
  return out;
}

export function dayTypeOf(date: string): DayType {
  const d = new Date(`${date}T12:00:00+09:00`).getUTCDay();
  return d === 0 || d === 6 ? "weekend" : "weekday";
}

export function levelFromIndex(index: number): CongestionLevel {
  if (index < 0.25) return "여유";
  if (index < 0.5) return "보통";
  if (index < 0.75) return "혼잡";
  return "매우혼잡";
}

/**
 * 시간대별 혼잡 이력 지수.
 * (해당 요일유형·시간대 ±1h 기록의 혼잡 가중치 합) / (해당 요일유형 관측일 수)
 * 를 전체 최댓값으로 나눠 0~1로 정규화한다.
 */
export function buildCurves(records: CongestionRecord[]): Record<DayType, HourlyPoint[]> {
  const days: Record<DayType, Set<string>> = { weekend: new Set(), weekday: new Set() };
  for (const r of records) days[dayTypeOf(r.date)].add(r.date);

  const raw: Record<DayType, number[]> = { weekend: [], weekday: [] };
  for (const dt of ["weekend", "weekday"] as DayType[]) {
    const recs = records.filter((r) => dayTypeOf(r.date) === dt);
    const n = Math.max(days[dt].size, 1);
    raw[dt] = HOURS.map((h) => recs.filter((r) => Math.abs(r.hour - h) <= WINDOW).reduce((s, r) => s + WEIGHT[r.status], 0) / n);
  }
  const max = Math.max(...raw.weekend, ...raw.weekday, 1e-9);
  const toPoints = (arr: number[]) => arr.map((v, i) => {
    const index = Math.round((v / max) * 100) / 100;
    return { hour: HOURS[i], index, level: levelFromIndex(index) };
  });
  return { weekend: toPoints(raw.weekend), weekday: toPoints(raw.weekday) };
}

export function indexAt(curves: Record<DayType, HourlyPoint[]>, dayType: DayType, hour: number): number {
  const clamped = Math.min(Math.max(hour, HOURS[0]), HOURS[HOURS.length - 1]);
  return curves[dayType].find((p) => p.hour === clamped)?.index ?? 0;
}

/** 구역별: 같은 요일유형·시간대 기록의 평균 혼잡 가중치 */
export function zoneCongestion(records: CongestionRecord[], dayType: DayType, hour: number): ZoneCongestion[] {
  const zones = [...new Set(records.map((r) => r.zone))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return zones.map((zone) => {
    const recs = records.filter((r) => r.zone === zone && dayTypeOf(r.date) === dayType && Math.abs(r.hour - hour) <= WINDOW);
    const counts: Record<ZoneStatus, number> = { 원활: 0, 혼잡: 0, 만차: 0 };
    for (const r of recs) counts[r.status]++;
    const index = recs.length ? recs.reduce((s, r) => s + WEIGHT[r.status], 0) / recs.length : 0;
    return { zone, index: Math.round(index * 100) / 100, level: levelFromIndex(index), counts };
  });
}

export function snapshot(records: CongestionRecord[], dayType: DayType, hour: number): CongestionSnapshot {
  const curves = buildCurves(records);
  const index = indexAt(curves, dayType, hour);
  const dates = records.map((r) => r.date).sort();
  return {
    dayType,
    hour,
    index,
    level: levelFromIndex(index),
    zones: zoneCongestion(records, dayType, hour),
    curves,
    period: { from: dates[0] ?? "", to: dates[dates.length - 1] ?? "" },
    total: records.length,
  };
}
