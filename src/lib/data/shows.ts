import { resolveVenue, VENUES } from "../park";
import type { Show } from "../types";
import { KOPIS_ID_PREFIX } from "./kopis";
import { getKopisShow, getKopisShows, type KopisStatus } from "./kopisFetch";
import { parseItems, parseResultCode, pick } from "./xml";

/**
 * 한국체육산업개발(주)_올림픽공원대관정보 — 한국문화정보원 API
 * GET https://api.kcisa.kr/openapi/service/rest/meta12/getKSCD0803?serviceKey=&numOfRows=&pageNo=
 * 유효 필드: title(행사명), spatial(대관장소). 행사 날짜 필드는 비어 있으므로
 * 공연 날짜·시각은 사용자가 티켓 기준으로 입력한다.
 */
const DEFAULT_URL = "https://api.kcisa.kr/openapi/service/rest/meta12/getKSCD0803";
const OK_CODES = ["0000", "00", "0"];

/** 목록 순서가 바뀌어도 같은 공연은 같은 ID (FNV-1a) */
export function showId(title: string, place: string): string {
  let h = 0x811c9dc5;
  const s = `${title}|${place}`;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

function makeShow(title: string, place: string): Show {
  const venueId = resolveVenue(place);
  return { id: showId(title, place), title, place, venueId, venueName: venueId === "other" ? place : VENUES[venueId].name };
}

export function toShows(xml: string): Show[] {
  const seen = new Set<string>();
  const shows: Show[] = [];
  for (const rec of parseItems(xml)) {
    const title = pick(rec, ["title"])?.replace(/\s+/g, " ").trim();
    const place = pick(rec, ["spatial"])?.trim() || "올림픽공원 내";
    if (!title) continue;
    const show = makeShow(title, place);
    if (seen.has(show.id)) continue;
    seen.add(show.id);
    shows.push(show);
  }
  // API는 오래된 공연부터 반환 → 최근 공연이 먼저 보이도록 뒤집는다
  return shows.reverse();
}

/** API 장애 시 최소 동작용 (실제 API 응답에 포함된 공연 일부) */
const FALLBACK: Show[] = [
  makeShow("2022 스트릿 우먼 파이터 리유니온 콘서트 ［THE NEXT ERA］", "핸드볼경기장"),
  makeShow("2022 (G)I-DLE WORLD TOUR ［JUST ME ( )I-DLE］ IN SEOUL", "올림픽홀"),
  makeShow("2022 서울파크뮤직페스티벌", "올림픽공원 내"),
  makeShow("신비아파트 뮤지컬 시즌5 : 감염된 도시의 비밀 - 서울", "우리금융아트홀"),
];

async function getRentalShows(): Promise<{ shows: Show[]; source: "api" | "fallback"; error?: string }> {
  const key = process.env.KSPO_RENTAL_SERVICE_KEY;
  if (!key) return { shows: FALLBACK, source: "fallback", error: "KSPO_RENTAL_SERVICE_KEY 미설정" };
  const url = process.env.KSPO_RENTAL_API_URL || DEFAULT_URL;
  try {
    const res = await fetch(`${url}?serviceKey=${encodeURIComponent(key)}&numOfRows=1000&pageNo=1`, { next: { revalidate: 86400 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const rc = parseResultCode(xml);
    if (rc && !OK_CODES.includes(rc.code)) throw new Error(`${rc.code} ${rc.msg}`);
    const shows = toShows(xml);
    if (shows.length === 0) throw new Error("빈 응답");
    return { shows, source: "api" };
  } catch (e) {
    console.error("[shows] 대관정보 API 실패, 기본 목록으로 대체:", e);
    return { shows: FALLBACK, source: "fallback", error: String(e) };
  }
}

/**
 * 공연 목록: KOPIS 예정 공연(가까운 회차 순) 다음에 대관정보 공연.
 * source는 대관정보 상태, kopis는 KOPIS 상태 (off: 키 없음, error: 호출 실패 → KOPIS 공연 없이 동작)
 */
export async function getShows(): Promise<{ shows: Show[]; source: "api" | "fallback"; kopis: KopisStatus; kopisCount: number; error?: string }> {
  const [rental, kopis] = await Promise.all([getRentalShows(), getKopisShows()]);
  return { ...rental, shows: [...kopis.shows, ...rental.shows], kopis: kopis.status, kopisCount: kopis.shows.length };
}

export async function getShow(id: string): Promise<Show | undefined> {
  if (id.startsWith(KOPIS_ID_PREFIX)) return getKopisShow(id);
  return (await getRentalShows()).shows.find((s) => s.id === id);
}

/** 이미 열린 번개의 공연을 지금 찾을 수 없을 때(API 장애, 키 없음) 화면에 대신 쓰는 값 */
export function unknownShow(id: string): Show {
  return { id, title: "공연 정보를 불러오지 못했어요", place: "올림픽공원", venueId: "other", venueName: "올림픽공원" };
}
