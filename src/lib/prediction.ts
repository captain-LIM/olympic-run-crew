import { dayTypeOf, HOURS, levelFromIndex } from "./congestion";
import { kstDateString, kstHourFraction } from "./time";
import type { CongestionLevel, DayType, HourlyPoint, VenueId } from "./types";

/**
 * 공연일 혼잡 예측
 *
 *   예측지수(t) = min(1, 기저 × BASE_WEIGHT + 공연부하(t))
 *   - 기저: 주차장 혼잡도 정보(CSV)로 만든 요일유형별 시간대 혼잡 이력 지수 (선형 보간)
 *   - 공연부하: 공연 규모계수 × 관객 도착 분포
 *       · 본 도착: 공연 시작 70분 전 중심 (σ 45분)
 *       · 조기 도착(굿즈·대기): 공연 시작 3시간 전 중심 (σ 60분), 대형 공연장일수록 큼
 *   - 규모계수: (수용인원 / 15,000)^0.6  — KSPO DOME 만석 공연 = 1
 *
 * 공연일과 주차 기록을 직접 연결한 데이터가 없어 계수는 공연장 규모 기반 가정값이다.
 * '올림픽공원 차량입출차·공연·날씨 연계 데이터(15164822)'로 보정할 수 있다.
 */

/** 공연장 대략적 수용 인원 (공연 배치 기준) */
export const VENUE_CAPACITY: Record<VenueId, number> = {
  "kspo-dome": 15000,
  handball: 5000,
  "olympic-hall": 2500,
  "woori-art-hall": 1200,
  "88-lawn": 10000,
  waterside: 3000,
  other: 8000,
};

const BASE_WEIGHT = 0.6;
const MAIN_ARRIVAL = { before: 70, sigma: 45 };
const EARLY_ARRIVAL = { before: 180, sigma: 60, share: 0.45 };
export const BUSY_THRESHOLD = 0.5; // '혼잡' 이상
const STEP_MIN = 30;

export interface PredictionPoint {
  /** KST 기준 하루 중 분 (예: 17:30 → 1050) */
  minute: number;
  label: string; // HH:MM
  index: number;
  level: CongestionLevel;
  base: number;
  event: number;
}

export interface Prediction {
  dayType: DayType;
  scale: number;
  points: PredictionPoint[];
  /** 공연 시작 전 처음으로 '혼잡' 이상이 되는 시각 (없으면 null) */
  busyFrom: string | null;
  /** 공연 관객 유입(공연부하)이 본격화되는 시각 */
  crowdFrom: string | null;
  peak: PredictionPoint;
  /** 출발 가능 구간(공연 150~60분 전) 중 예측 혼잡이 가장 낮은 60분 산책 구간 */
  walkWindow: { from: string; to: string; index: number } | null;
}

const hhmm = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
const gauss = (x: number, mu: number, sigma: number) => Math.exp(-((x - mu) ** 2) / (2 * sigma ** 2));

export function venueScale(venueId: VenueId): number {
  return Math.min(1, Math.pow(VENUE_CAPACITY[venueId] / 15000, 0.6));
}

/** 시간대 곡선(정시 단위)을 분 단위로 선형 보간 */
export function baseAt(curve: HourlyPoint[], minute: number): number {
  const h = minute / 60;
  const first = curve[0], last = curve[curve.length - 1];
  if (h <= first.hour) return first.index;
  if (h >= last.hour) return last.index;
  const i = curve.findIndex((p) => p.hour > h);
  const a = curve[i - 1], b = curve[i];
  return a.index + (b.index - a.index) * ((h - a.hour) / (b.hour - a.hour));
}

export function predictShowDay(params: {
  curves: Record<DayType, HourlyPoint[]>;
  showStart: Date;
  venueId: VenueId;
}): Prediction {
  const { curves, showStart, venueId } = params;
  const dayType = dayTypeOf(kstDateString(showStart));
  const curve = curves[dayType];
  const showMin = Math.round(kstHourFraction(showStart) * 60);
  const scale = venueScale(venueId);
  const earlyShare = EARLY_ARRIVAL.share * scale; // 소규모 공연은 조기 대기 수요가 작다

  const from = HOURS[0] * 60;
  const to = Math.max(HOURS[HOURS.length - 1] * 60, showMin);
  const points: PredictionPoint[] = [];
  for (let m = from; m <= to; m += STEP_MIN) {
    const base = baseAt(curve, m);
    // 공연 시작 이후에는 도착이 끝나 부하가 빠르게 줄어든다
    const after = m > showMin ? Math.exp(-(m - showMin) / 30) : 1;
    const event = scale * after * Math.max(
      gauss(m, showMin - MAIN_ARRIVAL.before, MAIN_ARRIVAL.sigma),
      earlyShare / Math.max(scale, 1e-9) * gauss(m, showMin - EARLY_ARRIVAL.before, EARLY_ARRIVAL.sigma),
    );
    const index = Math.round(Math.min(1, base * BASE_WEIGHT + event) * 100) / 100;
    points.push({ minute: m, label: hhmm(m), index, level: levelFromIndex(index), base: Math.round(base * 100) / 100, event: Math.round(event * 100) / 100 });
  }

  const busy = points.find((p) => p.index >= BUSY_THRESHOLD && p.minute < showMin);
  const crowd = points.find((p) => p.event >= CROWD_EVENT_THRESHOLD && p.minute < showMin);
  const peak = points.reduce((a, b) => (b.index > a.index ? b : a));
  return {
    dayType,
    scale: Math.round(scale * 100) / 100,
    points,
    busyFrom: busy?.label ?? null,
    crowdFrom: crowd?.label ?? null,
    peak,
    walkWindow: bestWalkWindow(points, showMin),
  };
}

/** 공연 관객 유입이 '본격화'됐다고 보는 공연부하 값 */
const CROWD_EVENT_THRESHOLD = 0.3;
const WALK_LEN = 60;
const WALK_EARLIEST_BEFORE = 150;
const WALK_LATEST_END_BEFORE = 45;

/** 공연 150분 전 ~ 45분 전 사이에서 평균 예측지수가 가장 낮은 60분 구간 */
export function bestWalkWindow(points: PredictionPoint[], showMin: number): Prediction["walkWindow"] {
  let best: Prediction["walkWindow"] = null;
  for (let s = showMin - WALK_EARLIEST_BEFORE; s + WALK_LEN <= showMin - WALK_LATEST_END_BEFORE; s += STEP_MIN) {
    const inWin = points.filter((p) => p.minute >= s && p.minute <= s + WALK_LEN);
    if (inWin.length === 0) continue;
    const avg = inWin.reduce((t, p) => t + p.index, 0) / inWin.length;
    if (!best || avg < best.index) best = { from: hhmm(s), to: hhmm(s + WALK_LEN), index: Math.round(avg * 100) / 100 };
  }
  return best;
}

/** 특정 시각의 예측 혼잡 수준 (코스 분산 추천에 사용) */
export function predictedLevelAt(prediction: Prediction, at: Date): CongestionLevel {
  const m = Math.round(kstHourFraction(at) * 60);
  const p = prediction.points.reduce((a, b) => (Math.abs(b.minute - m) < Math.abs(a.minute - m) ? b : a));
  return p.level;
}
