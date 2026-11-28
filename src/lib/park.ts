import { COURSE_GEO } from "./parkGeo";
import type { Course, LatLng, Venue, VenueId } from "./types";

/**
 * 공연장 좌표: OpenStreetMap의 각 시설 위치(2026-11-28 확인). 지도 데이터 © OpenStreetMap 기여자.
 * 수변무대는 몽촌호가 아니라 88호수 남쪽에 있다.
 */
export const VENUES: Record<VenueId, Venue> = {
  "kspo-dome": { id: "kspo-dome", name: "KSPO DOME", lat: 37.5192, lng: 127.1275 },
  handball: { id: "handball", name: "SK핸드볼경기장", lat: 37.5173, lng: 127.1264 },
  "woori-art-hall": { id: "woori-art-hall", name: "우리금융아트홀", lat: 37.5167, lng: 127.1251 },
  "olympic-hall": { id: "olympic-hall", name: "올림픽홀", lat: 37.5147, lng: 127.1276 },
  waterside: { id: "waterside", name: "수변무대", lat: 37.5212, lng: 127.1254 },
  "88-lawn": { id: "88-lawn", name: "88잔디마당", lat: 37.519, lng: 127.125 },
  other: { id: "other", name: "올림픽공원", lat: 37.519, lng: 127.1224 },
};

const VENUE_PATTERNS: [RegExp, VenueId][] = [
  [/kspo|체조/i, "kspo-dome"],
  [/핸드볼/, "handball"],
  [/우리금융|k\s*아트홀/i, "woori-art-hall"],
  [/올림픽홀|뮤즈라이브/, "olympic-hall"],
  [/수변/, "waterside"],
  [/잔디/, "88-lawn"],
];

/** 대관정보 spatial / 실감형 콘텐츠 '장소' 문자열 → 공연장 ID */
export function resolveVenue(place: string): VenueId {
  for (const [re, id] of VENUE_PATTERNS) if (re.test(place)) return id;
  return "other";
}

/** 공연장별 일반적인 공연 시작 시각 (입력 기본값 용도) */
export const DEFAULT_SHOW_TIME: Record<VenueId, string> = {
  "kspo-dome": "18:00",
  handball: "18:00",
  "woori-art-hall": "19:30",
  "olympic-hall": "19:30",
  waterside: "17:00",
  "88-lawn": "17:00",
  other: "17:00",
};

/**
 * 코스: 경로·거리·집결지는 parkGeo.ts(OpenStreetMap 보행로 기준). 거리는 경로 길이를 0.1km 단위로 반올림.
 * id는 저장된 번개(crews.course_id)가 참조하므로 바꾸지 않는다.
 */
const geo = (id: string, name: string) => {
  const g = COURSE_GEO[id];
  return { distanceKm: Math.round(g.km * 10) / 10, meetingPoint: { name, ...g.meetingPoint }, path: g.path };
};

export const COURSES: Course[] = [
  {
    id: "lake-loop",
    name: "몽촌호 한 바퀴",
    description: "몽촌호를 따라 한 바퀴 도는 코스, 공연 전 가볍게 걷기 좋음",
    ...geo("lake-loop", "서울올림픽기념관 앞"),
    modes: ["walk", "jog"],
  },
  {
    id: "peace-gate",
    name: "세계평화의 문 · 88잔디마당 산책",
    description: "포토스팟 많은 산책 코스, 굿즈 구매 후 합류하기 좋음",
    ...geo("peace-gate", "88잔디마당 입구"),
    modes: ["walk"],
  },
  {
    id: "mongchon-fortress",
    name: "몽촌토성 한 바퀴",
    description: "완만한 언덕 포함, 조깅 추천",
    ...geo("mongchon-fortress", "한성백제박물관 앞"),
    modes: ["jog", "run"],
  },
  {
    id: "perimeter",
    name: "올림픽공원 외곽 순환",
    description: "공원 외곽을 크게 도는 러닝 코스",
    ...geo("perimeter", "KSPO DOME 앞"),
    modes: ["run"],
  },
];

export function getCourse(id: string): Course | undefined {
  return COURSES.find((c) => c.id === id);
}

/** 두 좌표 간 거리(km), 하버사인 */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
