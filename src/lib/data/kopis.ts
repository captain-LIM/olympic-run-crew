import { XMLParser } from "fast-xml-parser";
import { resolveVenue, VENUES } from "../park";
import { fromKstLocalInput, kstDateString } from "../time";
import type { Show, VenueId } from "../types";
import { normalizeDate } from "./xml";

/**
 * KOPIS(공연예술통합전산망) 공연 목록·상세 응답 해석. 네트워크 호출은 kopisFetch.ts에 있다.
 * 응답 형식은 2026-11-24 실제 응답(fixtures/kopis)과 개발가이드 v5.0 기준.
 */

/** KOPIS 공연시설 코드: 올림픽공원 (공연장 12곳) */
export const KOPIS_FACILITY_ID = "FC001247";
/** 대관정보 공연 ID와 겹치지 않게 KOPIS 공연 ID(PF…) 앞에 붙인다 */
export const KOPIS_ID_PREFIX = "k-";
const KOPIS_SHOW_ID = /^PF\d{1,12}$/;

/** 공연장 코드(FC001247-NN)의 NN → 이 앱의 공연장. 없는 번호(벨로드롬, 평화광장 등)는 other */
const HALL_VENUE: Record<string, VenueId> = {
  "01": "kspo-dome", // KSPO DOME(체조경기장)
  "02": "handball", // 티켓링크 라이브 아레나(핸드볼경기장)
  "03": "olympic-hall", // 올림픽홀
  "04": "olympic-hall", // 뮤즈라이브 (올림픽홀 안)
  "05": "woori-art-hall", // 우리금융아트홀(역도경기장)
  "07": "88-lawn", // 야외(88잔디마당)
  "08": "waterside", // 야외(수변무대)
};

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
  isArray: (name) => name === "db",
});

type Rec = Record<string, unknown>;

export interface KopisListItem {
  id: string; // PF…
  title: string;
}

export interface KopisDetail {
  id: string; // PF…
  title: string;
  facilityId: string; // mt10id
  hallId: string; // mt13id (FC001247-01)
  facilityName: string; // fcltynm: "올림픽공원 (KSPO DOME(체조경기장))"
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  runtime: string; // prfruntime: "2시간 10분"
  schedule: string; // dtguidance: "금요일(19:00), 토요일 ~ 일요일(16:00)"
}

const text = (rec: Rec, key: string): string => {
  const v = rec[key];
  return typeof v === "string" ? v.trim() : "";
};

/** <dbs><db>…</db></dbs> 의 db 목록. 오류 응답(returncode)은 '데이터 없음'(04)이면 빈 목록, 그 밖에는 예외 */
function records(xml: string): Rec[] {
  const doc = parser.parse(xml) as { dbs?: { db?: Rec[] } | "" };
  const dbs = doc.dbs && typeof doc.dbs === "object" ? (doc.dbs.db ?? []) : [];
  const err = dbs.find((d) => d.returncode !== undefined);
  if (err) {
    if (text(err, "returncode") === "04") return [];
    throw new Error(`KOPIS 오류 ${text(err, "returncode")} ${text(err, "errmsg")}`);
  }
  return dbs;
}

export function parseKopisList(xml: string): KopisListItem[] {
  return records(xml)
    .map((d) => ({ id: text(d, "mt20id"), title: text(d, "prfnm") }))
    .filter((d) => KOPIS_SHOW_ID.test(d.id));
}

export function parseKopisDetail(xml: string): KopisDetail | null {
  const d = records(xml)[0];
  if (!d) return null;
  const id = text(d, "mt20id");
  const from = normalizeDate(text(d, "prfpdfrom"));
  const to = normalizeDate(text(d, "prfpdto"));
  if (!KOPIS_SHOW_ID.test(id) || !from || !to) return null;
  return {
    id,
    title: text(d, "prfnm").replace(/\s+/g, " "),
    facilityId: text(d, "mt10id"),
    hallId: text(d, "mt13id"),
    facilityName: text(d, "fcltynm"),
    from,
    to,
    runtime: text(d, "prfruntime"),
    schedule: text(d, "dtguidance"),
  };
}

const DAY_NAMES = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

export interface WeeklySchedule {
  /** 요일(0=일요일)별 시작 시각 HH:mm */
  byDay: string[][];
  /** HOL(…) 공휴일 회차 시각. 어느 날이 공휴일인지는 응답에 없다 */
  holiday: string[];
}

/**
 * dtguidance → 요일별 시작 시각. 실제로 본 형식:
 *   "금요일(19:30), 토요일(18:00), 일요일(17:00)"
 *   "수요일 ~ 금요일(19:30), 토요일(15:00,19:00), 일요일(14:00)"
 *   "토요일 ~ 일요일(14:00), HOL(14:00)"
 * 모르는 형식이 하나라도 섞이면 null (화면은 직접 입력으로 대체한다).
 */
export function parseDtGuidance(raw: string): WeeklySchedule | null {
  const s = raw.trim();
  if (!s) return null;
  const byDay: string[][] = DAY_NAMES.map(() => []);
  const holiday: string[] = [];
  const group = /([^()]*)\(([^()]*)\)/g;
  let consumed = "";
  for (const m of s.matchAll(group)) {
    consumed += m[0];
    const times = m[2].split(",").map((t) => t.trim());
    if (times.length === 0 || !times.every((t) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(t))) return null;
    const hhmm = times.map((t) => t.padStart(5, "0"));
    // 앞 그룹과의 구분자(", ")가 이 그룹의 요일 부분 앞에 붙어 온다
    for (const spec of m[1].split(",").map((x) => x.trim()).filter(Boolean)) {
      if (spec === "HOL") {
        holiday.push(...hhmm);
        continue;
      }
      const range = spec.split("~").map((x) => DAY_NAMES.indexOf(x.trim()));
      if (range.some((i) => i < 0) || range.length > 2) return null;
      const [a, b = a] = range;
      for (let i = a; ; i = (i + 1) % 7) {
        byDay[i].push(...hhmm);
        if (i === b) break;
      }
    }
  }
  // 괄호 그룹 밖에 남은 글자가 있으면 모르는 형식
  if (s.replace(group, "").replace(/[\s,]/g, "") !== "" || consumed === "") return null;
  if (byDay.every((t) => t.length === 0) && holiday.length === 0) return null;
  for (const t of byDay) t.sort();
  return { byDay: byDay.map((t) => [...new Set(t)]), holiday: [...new Set(holiday)].sort() };
}

function addDays(ymd: string, days: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * 공연 기간 안에서 요일별 시각을 날짜로 펼친 회차 (KST, <input type="datetime-local"> 형식 YYYY-MM-DDTHH:mm).
 * 지금 이후 horizonDays 안의 회차만, 최대 max개. 공휴일 회차(HOL)는 날짜를 알 수 없어 넣지 않는다.
 */
export function expandSessions(
  schedule: WeeklySchedule,
  period: { from: string; to: string },
  now: Date,
  { horizonDays = 90, max = 150 }: { horizonDays?: number; max?: number } = {},
): string[] {
  const today = kstDateString(now);
  const last = [period.to, addDays(today, horizonDays)].sort()[0];
  const out: string[] = [];
  for (let day = period.from > today ? period.from : today; day <= last && out.length < max; day = addDays(day, 1)) {
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    for (const t of schedule.byDay[weekday]) {
      const local = `${day}T${t}`;
      if (fromKstLocalInput(local).getTime() > now.getTime() && out.length < max) out.push(local);
    }
  }
  return out;
}

/** "올림픽공원 (KSPO DOME(체조경기장))" → "KSPO DOME(체조경기장)" */
function hallName(facilityName: string): string {
  return facilityName.match(/^올림픽공원\s*\((.+)\)$/)?.[1].trim() || facilityName || "올림픽공원";
}

export function kopisVenue(hallId: string, place: string): VenueId {
  const no = hallId.match(/^FC\d+-(\d+)$/)?.[1];
  return no ? (HALL_VENUE[no] ?? "other") : resolveVenue(place);
}

export function kopisShowId(kopisId: string): string {
  return `${KOPIS_ID_PREFIX}${kopisId}`;
}

/** "k-PF123" → "PF123". 형식이 아니면 undefined (외부 API 주소에 그대로 넣지 않도록) */
export function parseKopisShowId(id: string): string | undefined {
  if (!id.startsWith(KOPIS_ID_PREFIX)) return undefined;
  const raw = id.slice(KOPIS_ID_PREFIX.length);
  return KOPIS_SHOW_ID.test(raw) ? raw : undefined;
}

export function toKopisShow(d: KopisDetail, now: Date): Show {
  const place = hallName(d.facilityName);
  const venueId = kopisVenue(d.hallId, place);
  const weekly = parseDtGuidance(d.schedule);
  return {
    id: kopisShowId(d.id),
    title: d.title,
    place,
    venueId,
    venueName: venueId === "other" ? place : VENUES[venueId].name,
    kopis: {
      from: d.from,
      to: d.to,
      runtime: d.runtime,
      schedule: d.schedule,
      scheduleKnown: weekly !== null,
      holidaySessions: (weekly?.holiday.length ?? 0) > 0,
      sessions: weekly ? expandSessions(weekly, d, now) : [],
    },
  };
}
