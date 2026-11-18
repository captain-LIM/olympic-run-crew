import type { Course, GateId, LatLng, Venue, VenueId } from "./types";

/**
 * 좌표는 데모용 근사값이다. 실서비스 전 실측 좌표로 교체할 것.
 */
export const GATES: Record<GateId, LatLng & { name: string }> = {
  east2: { name: "동2문 주차장", lat: 37.5196, lng: 127.1302 },
  south2: { name: "남2문 주차장", lat: 37.5151, lng: 127.1246 },
  north2: { name: "북2문 주차장", lat: 37.5236, lng: 127.1224 },
};

export const VENUES: Record<VenueId, Venue> = {
  "kspo-dome": { id: "kspo-dome", name: "KSPO DOME", lat: 37.5194, lng: 127.1273, nearestGate: "east2", modelFile: "kspo-dome.dae" },
  handball: { id: "handball", name: "SK핸드볼경기장", lat: 37.5163, lng: 127.1262, nearestGate: "south2", modelFile: "handball.dae" },
  "woori-art-hall": { id: "woori-art-hall", name: "우리금융아트홀", lat: 37.5172, lng: 127.1284, nearestGate: "east2", modelFile: "woori-art-hall.dae" },
  "olympic-hall": { id: "olympic-hall", name: "올림픽홀", lat: 37.5203, lng: 127.1196, nearestGate: "north2" },
  waterside: { id: "waterside", name: "수변무대", lat: 37.5209, lng: 127.1214, nearestGate: "north2", modelFile: "waterside.dae" },
  "88-lawn": { id: "88-lawn", name: "88잔디마당", lat: 37.5196, lng: 127.1229, nearestGate: "north2", modelFile: "88-lawn.dae" },
  other: { id: "other", name: "올림픽공원", lat: 37.5207, lng: 127.1214, nearestGate: "north2" },
};

const VENUE_PATTERNS: [RegExp, VenueId][] = [
  [/kspo|체조/i, "kspo-dome"],
  [/핸드볼/, "handball"],
  [/아트홀|우리금융/, "woori-art-hall"],
  [/올림픽홀|뮤즈라이브/, "olympic-hall"],
  [/수변/, "waterside"],
  [/잔디/, "88-lawn"],
];

/** 대관정보의 '장소' 문자열을 공연장 ID로 매핑 */
export function resolveVenue(place: string): VenueId {
  for (const [re, id] of VENUE_PATTERNS) if (re.test(place)) return id;
  return "other";
}

export const COURSES: Course[] = [
  {
    id: "lake-loop",
    name: "몽촌호수 한 바퀴",
    distanceKm: 1.6,
    description: "평지 위주, 공연 전 가볍게 걷기 좋은 코스",
    meetingPoint: { name: "몽촌호수 수변무대 앞", lat: 37.5209, lng: 127.1214 },
    nearGate: "north2",
    path: [[37.5209, 127.1214], [37.5222, 127.1198], [37.5226, 127.1222], [37.5214, 127.1238], [37.5209, 127.1214]],
    modes: ["walk", "jog"],
  },
  {
    id: "peace-gate",
    name: "평화의 문 · 88잔디마당 산책",
    distanceKm: 2.2,
    description: "포토스팟 많은 산책 코스, 굿즈 구매 후 합류하기 좋음",
    meetingPoint: { name: "88잔디마당 입구", lat: 37.5196, lng: 127.1229 },
    nearGate: "north2",
    path: [[37.5196, 127.1229], [37.5205, 127.1170], [37.5188, 127.1160], [37.5180, 127.1205], [37.5196, 127.1229]],
    modes: ["walk"],
  },
  {
    id: "mongchon-fortress",
    name: "몽촌토성 둘레길",
    distanceKm: 2.7,
    description: "완만한 언덕 포함, 조깅 추천",
    meetingPoint: { name: "몽촌토성 남측 입구", lat: 37.5165, lng: 127.1215 },
    nearGate: "south2",
    path: [[37.5165, 127.1215], [37.5150, 127.1185], [37.5168, 127.1150], [37.5190, 127.1180], [37.5182, 127.1225], [37.5165, 127.1215]],
    modes: ["jog", "run"],
  },
  {
    id: "perimeter",
    name: "올림픽공원 외곽 순환",
    distanceKm: 4.5,
    description: "공원 외곽을 크게 도는 러닝 코스",
    meetingPoint: { name: "KSPO DOME 광장", lat: 37.5190, lng: 127.1262 },
    nearGate: "east2",
    path: [[37.5190, 127.1262], [37.5236, 127.1260], [37.5240, 127.1180], [37.5195, 127.1140], [37.5150, 127.1180], [37.5148, 127.1260], [37.5190, 127.1262]],
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
