import { resolveVenue, VENUES } from "../park";
import { kstDateString } from "../time";
import type { PerformanceEvent, VenueId } from "../types";
import { normalizeDate, parseItems, parseResultCode, pick } from "./xml";

/**
 * 한국체육산업개발_올림픽공원 대관정보 (data.go.kr 15015212, XML)
 * 제공 필드: 행사명, 행사기간, 장소 (시작 시각 없음 → 공연장별 기본값으로 추정)
 */
const DEFAULT_START: Partial<Record<VenueId, string>> = {
  "kspo-dome": "18:00",
  handball: "18:00",
  "olympic-hall": "19:30",
  "woori-art-hall": "19:30",
};

function estimateStart(venueId: VenueId, date: string): string {
  const day = new Date(`${date}T12:00:00+09:00`).getUTCDay();
  const weekend = day === 0 || day === 6;
  return DEFAULT_START[venueId] ?? (weekend ? "17:00" : "19:00");
}

/** 목록 순서가 바뀌어도 같은 공연은 같은 ID를 갖도록 (FNV-1a) */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

export async function getEvents(): Promise<{ events: PerformanceEvent[]; source: "api" | "mock"; error?: string }> {
  const url = process.env.KSPO_RENTAL_API_URL;
  const key = process.env.KSPO_SERVICE_KEY;
  if (!url || !key) return { events: mockEvents(), source: "mock" };

  try {
    const qs = new URLSearchParams({ pageNo: "1", numOfRows: "200" });
    const res = await fetch(`${url}?serviceKey=${key}&${qs}`, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const rc = parseResultCode(xml);
    if (rc && !["00", "0", "INFO-000"].includes(rc.code)) throw new Error(`${rc.code} ${rc.msg}`);

    const today = kstDateString();
    const events = parseItems(xml)
      .map((rec): PerformanceEvent | null => {
        const title = pick(rec, ["eventNm", "evtNm", "title", /행사명|nm$|name/i]);
        const place = pick(rec, ["place", "plcNm", "facilityNm", /장소|place|fclt/i]) ?? "";
        const period = pick(rec, ["eventPeriod", /기간|period/i]);
        const startDate = normalizeDate(pick(rec, ["startDate", "bgnDe", /시작|start|bgn/i]) ?? period?.split(/~|-(?=\s*\d{4})/)[0]);
        const endDate = normalizeDate(pick(rec, ["endDate", "endDe", /종료|end/i]) ?? period?.split("~")[1]) ?? startDate;
        if (!title || !startDate || !endDate) return null;
        const venueId = resolveVenue(place);
        return {
          id: `rent-${startDate}-${hash(`${title}|${place}|${endDate}`)}`,
          title,
          venueId,
          venueName: place || VENUES[venueId].name,
          startDate,
          endDate,
          estimatedStartTime: estimateStart(venueId, startDate),
          source: "api",
        };
      })
      .filter((e): e is PerformanceEvent => e !== null && e.endDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));

    return { events, source: "api" };
  } catch (e) {
    console.error("[rentals] API 실패, 목 데이터로 대체:", e);
    return { events: mockEvents(), source: "mock", error: String(e) };
  }
}

export async function getEvent(id: string): Promise<PerformanceEvent | undefined> {
  const { events } = await getEvents();
  return events.find((e) => e.id === id);
}

/** 오늘 기준 상대 날짜로 생성되는 데모 공연(가상) */
export function mockEvents(): PerformanceEvent[] {
  const rows: [number, string, VenueId][] = [
    [0, "윈터 라이트 라이브 2026", "kspo-dome"],
    [0, "어쿠스틱 나이트 in 아트홀", "woori-art-hall"],
    [1, "인디 밴드 페스타 2026", "handball"],
    [2, "윈터 라이트 라이브 2026 (2회차)", "kspo-dome"],
    [3, "재즈 인 더 파크", "olympic-hall"],
  ];
  return rows.map(([offset, title, venueId], i) => {
    const date = kstDateString(new Date(), offset);
    return {
      id: `mock-${i + 1}`,
      title,
      venueId,
      venueName: VENUES[venueId].name,
      startDate: date,
      endDate: date,
      estimatedStartTime: estimateStart(venueId, date),
      source: "mock",
    };
  });
}
