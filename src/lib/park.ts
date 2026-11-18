import type { Course, LatLng, Venue, VenueId } from "./types";

/** 좌표는 데모용 근사값이다. 실서비스 전 실측 좌표로 교체할 것. */
export const VENUES: Record<VenueId, Venue> = {
  "kspo-dome": { id: "kspo-dome", name: "KSPO DOME", lat: 37.5194, lng: 127.1273 },
  handball: { id: "handball", name: "SK핸드볼경기장", lat: 37.5163, lng: 127.1262 },
  "woori-art-hall": { id: "woori-art-hall", name: "우리금융아트홀", lat: 37.5172, lng: 127.1284 },
  "olympic-hall": { id: "olympic-hall", name: "올림픽홀", lat: 37.5203, lng: 127.1196 },
  waterside: { id: "waterside", name: "수변무대", lat: 37.5209, lng: 127.1214 },
  "88-lawn": { id: "88-lawn", name: "88잔디마당", lat: 37.5196, lng: 127.1229 },
  other: { id: "other", name: "올림픽공원", lat: 37.5207, lng: 127.1214 },
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

export const COURSES: Course[] = [
  {
    id: "lake-loop",
    name: "몽촌호수 한 바퀴",
    distanceKm: 1.6,
    description: "평지 위주, 공연 전 가볍게 걷기 좋은 코스",
    meetingPoint: { name: "몽촌호수 수변무대 앞", lat: 37.5209, lng: 127.1214 },
    path: [[37.5209, 127.1214], [37.5222, 127.1198], [37.5226, 127.1222], [37.5214, 127.1238], [37.5209, 127.1214]],
    modes: ["walk", "jog"],
  },
  {
    id: "peace-gate",
    name: "평화의 문 · 88잔디마당 산책",
    distanceKm: 2.2,
    description: "포토스팟 많은 산책 코스, 굿즈 구매 후 합류하기 좋음",
    meetingPoint: { name: "88잔디마당 입구", lat: 37.5196, lng: 127.1229 },
    path: [[37.5196, 127.1229], [37.5205, 127.117], [37.5188, 127.116], [37.518, 127.1205], [37.5196, 127.1229]],
    modes: ["walk"],
  },
  {
    id: "mongchon-fortress",
    name: "몽촌토성 둘레길",
    distanceKm: 2.7,
    description: "완만한 언덕 포함, 조깅 추천",
    meetingPoint: { name: "몽촌토성 남측 입구", lat: 37.5165, lng: 127.1215 },
    path: [[37.5165, 127.1215], [37.515, 127.1185], [37.5168, 127.115], [37.519, 127.118], [37.5182, 127.1225], [37.5165, 127.1215]],
    modes: ["jog", "run"],
  },
  {
    id: "perimeter",
    name: "올림픽공원 외곽 순환",
    distanceKm: 4.5,
    description: "공원 외곽을 크게 도는 러닝 코스",
    meetingPoint: { name: "KSPO DOME 광장", lat: 37.519, lng: 127.1262 },
    path: [[37.519, 127.1262], [37.5236, 127.126], [37.524, 127.118], [37.5195, 127.114], [37.515, 127.118], [37.5148, 127.126], [37.519, 127.1262]],
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
