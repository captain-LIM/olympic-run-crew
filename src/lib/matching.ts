import { distanceKm, VENUES } from "./park";
import type { Course, Crew, CrewMode, AgeGroup, ParkingStatus, VenueId } from "./types";

export const DEFAULT_PACE: Record<CrewMode, number> = { walk: 12, jog: 7.5, run: 5.5 };
export const MODE_LABEL: Record<CrewMode, string> = { walk: "산책", jog: "가벼운 조깅", run: "러닝" };

/** 공연장 입장 전 확보해야 할 여유 시간(분) */
export const ENTRY_BUFFER_MIN = 30;
/** 번개를 열 수 있는 가장 이른 시점: 공연 시작 N분 전 */
export const EARLIEST_BEFORE_MIN = 150;
export const MATCH_WINDOW_MIN = 15;
export const PACE_TOLERANCE = 1.0;

const MIN = 60_000;

export function estimateDurationMin(course: Course, pace: number): number {
  return Math.round(course.distanceKm * pace);
}

/** 코스 종료 후 집결지 → 공연장 이동 시간(도보 12분/km) */
export function walkToVenueMin(course: Course, venueId: VenueId): number {
  return Math.ceil(distanceKm(course.meetingPoint, VENUES[venueId]) * 12);
}

export interface TimingResult {
  ok: boolean;
  earliestStart: Date;
  latestStart: Date;
  durationMin: number;
  reason?: string;
}

/**
 * 출발 시각이 '공연 시작 전 입장 버퍼'를 지키는지 검증한다.
 * latestStart = 공연시작 - 버퍼 - 코스소요 - 공연장 이동
 */
export function validateTiming(params: {
  startAt: Date;
  eventStartAt: Date;
  course: Course;
  pace: number;
  venueId: VenueId;
}): TimingResult {
  const { startAt, eventStartAt, course, pace, venueId } = params;
  const durationMin = estimateDurationMin(course, pace);
  const total = durationMin + walkToVenueMin(course, venueId) + ENTRY_BUFFER_MIN;
  const latestStart = new Date(eventStartAt.getTime() - total * MIN);
  const earliestStart = new Date(eventStartAt.getTime() - EARLIEST_BEFORE_MIN * MIN);

  if (latestStart < earliestStart) {
    return { ok: false, earliestStart, latestStart, durationMin, reason: "코스가 너무 길어 공연 전에 마칠 수 없습니다." };
  }
  if (startAt > latestStart) {
    return { ok: false, earliestStart, latestStart, durationMin, reason: "출발이 늦어 입장 시간에 맞추기 어렵습니다." };
  }
  if (startAt < earliestStart) {
    return { ok: false, earliestStart, latestStart, durationMin, reason: `공연 시작 ${EARLIEST_BEFORE_MIN}분 전부터 출발할 수 있습니다.` };
  }
  return { ok: true, earliestStart, latestStart, durationMin };
}

export interface MatchRequest {
  eventId: string;
  mode: CrewMode;
  pace: number;
  startAt: Date;
  ageGroup: AgeGroup;
}

export function canJoin(crew: Crew, ageGroup: AgeGroup, now: Date): { ok: boolean; reason?: string } {
  if (crew.members.length >= crew.capacity) return { ok: false, reason: "정원이 찼습니다." };
  if (new Date(crew.startAt) <= now) return { ok: false, reason: "이미 출발한 크루입니다." };
  const isTeen = ageGroup === "14-19";
  if (crew.teenOnly !== isTeen) {
    return { ok: false, reason: crew.teenOnly ? "10대 전용 크루입니다." : "10대는 10대 전용 크루에만 참여할 수 있습니다." };
  }
  return { ok: true };
}

/** 같은 공연 · 같은 모드 · 출발 ±15분 · 페이스 ±1분/km 크루를 가까운 순으로 */
export function findMatches(crews: Crew[], req: MatchRequest, now: Date): Crew[] {
  return crews
    .filter(
      (c) =>
        c.eventId === req.eventId &&
        c.mode === req.mode &&
        Math.abs(new Date(c.startAt).getTime() - req.startAt.getTime()) <= MATCH_WINDOW_MIN * MIN &&
        Math.abs(c.paceMinPerKm - req.pace) <= PACE_TOLERANCE &&
        canJoin(c, req.ageGroup, now).ok,
    )
    .sort((a, b) => {
      const da = Math.abs(new Date(a.startAt).getTime() - req.startAt.getTime());
      const db = Math.abs(new Date(b.startAt).getTime() - req.startAt.getTime());
      if (da !== db) return da - db;
      return b.members.length - a.members.length;
    });
}

export interface CourseRecommendation {
  course: Course;
  score: number;
  gateLevel: ParkingStatus["level"] | "알수없음";
  walkToVenueMin: number;
}

const LEVEL_PENALTY: Record<ParkingStatus["level"], number> = { 여유: 0, 보통: 1, 혼잡: 3, 매우혼잡: 5 };

/**
 * 코스 추천: 모드 적합 코스 중, 집결지 인근 주차구역 혼잡도가 낮고 공연장과 가까운 순.
 * 혼잡한 주차구역 근처를 집결지로 쓰지 않도록 분산 유도.
 */
export function recommendCourses(
  courses: Course[],
  mode: CrewMode,
  venueId: VenueId,
  parking: ParkingStatus[],
): CourseRecommendation[] {
  return courses
    .filter((c) => c.modes.includes(mode))
    .map((course) => {
      const gate = parking.find((p) => p.gateId === course.nearGate);
      const walk = walkToVenueMin(course, venueId);
      const penalty = gate ? LEVEL_PENALTY[gate.level] : 1;
      return { course, score: penalty * 2 + walk / 5, gateLevel: gate?.level ?? ("알수없음" as const), walkToVenueMin: walk };
    })
    .sort((a, b) => a.score - b.score);
}

export function levelFromRatio(ratio: number): ParkingStatus["level"] {
  if (ratio < 0.5) return "여유";
  if (ratio < 0.75) return "보통";
  if (ratio < 0.9) return "혼잡";
  return "매우혼잡";
}
