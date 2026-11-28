export type VenueId =
  | "kspo-dome"
  | "handball"
  | "woori-art-hall"
  | "olympic-hall"
  | "waterside"
  | "88-lawn"
  | "other";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Venue extends LatLng {
  id: VenueId;
  name: string;
}

/**
 * 공연 한 건. 올림픽공원 대관정보 API(api.kcisa.kr meta12/getKSCD0803)
 * 또는 KOPIS 공연예술통합전산망(id가 "k-"로 시작, kopis 필드 있음)
 */
export interface Show {
  id: string;
  title: string;
  /** 공연장 이름 원문 (대관정보 spatial 예: 체조경기장, KOPIS 예: KSPO DOME(체조경기장)) */
  place: string;
  venueId: VenueId;
  venueName: string;
  kopis?: KopisSchedule;
}

/** KOPIS 공연의 기간·회차 */
export interface KopisSchedule {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  /** 공연 시간 (예: 2시간 10분), 없으면 빈 문자열 */
  runtime: string;
  /** dtguidance 원문 (예: 금요일(19:00), 토요일 ~ 일요일(16:00)) */
  schedule: string;
  /** schedule을 요일별 시각으로 해석했는지. false면 회차 목록 없이 직접 입력 */
  scheduleKnown: boolean;
  /** 공휴일 회차(HOL)가 따로 있음. 어느 날이 공휴일인지는 몰라 회차 목록에 없다 */
  holidaySessions: boolean;
  /** 앞으로의 회차 (KST, YYYY-MM-DDTHH:mm) */
  sessions: string[];
}

export type CongestionLevel = "여유" | "보통" | "혼잡" | "매우혼잡";
export type ZoneStatus = "원활" | "혼잡" | "만차";
export type DayType = "weekend" | "weekday";

/** 주차장 혼잡도 정보 CSV 한 행 */
export interface CongestionRecord {
  zone: string;
  status: ZoneStatus;
  date: string; // YYYY-MM-DD
  hour: number; // 0~23 (원본 등록시간의 '시'만 유효)
}

export interface HourlyPoint {
  hour: number;
  index: number; // 0~1, 혼잡 이력 지수
  level: CongestionLevel;
}

export interface ZoneCongestion {
  zone: string;
  index: number;
  level: CongestionLevel;
  counts: Record<ZoneStatus, number>;
}

export interface CongestionSnapshot {
  dayType: DayType;
  hour: number;
  index: number;
  level: CongestionLevel;
  zones: ZoneCongestion[];
  curves: Record<DayType, HourlyPoint[]>;
  period: { from: string; to: string };
  total: number;
}

/** 올림픽공원 공연장 실감형 콘텐츠 CSV를 공연장 단위로 묶은 것 */
export interface Venue3D {
  venueId: VenueId;
  venueName: string;
  category: string; // 실내 / 실외
  files: { ext: string; fileName: string }[];
  homepage: string;
  /** 웹 뷰어용으로 최적화한 GLB (public/models). 없으면 미리보기 불가 */
  modelUrl?: string;
}

export type CrewMode = "walk" | "jog" | "run";

export interface Course {
  id: string;
  name: string;
  distanceKm: number;
  description: string;
  meetingPoint: LatLng & { name: string };
  path: [number, number][]; // [lat, lng]
  modes: CrewMode[];
}

export type AgeGroup = "14-19" | "20s" | "30s" | "40+";

export interface Member {
  userId: number;
  nickname: string;
  ageGroup: AgeGroup;
  joinedAt: string;
  checkedIn: boolean;
  finished: boolean;
}

export interface ChatMessage {
  id: number;
  userId: number;
  nickname: string;
  body: string;
  createdAt: string;
}

export type ReportReason = "spam" | "abuse" | "harassment" | "unsafe" | "other";

export interface Crew {
  id: string;
  /** Show.id */
  eventId: string;
  mode: CrewMode;
  paceMinPerKm: number;
  courseId: string;
  startAt: string; // ISO
  /** 사용자가 입력한 티켓 기준 공연 시작 시각 */
  eventStartAt: string; // ISO
  capacity: number;
  /** 미성년 보호: true면 같은 연령대(14-19)만 참여 */
  teenOnly: boolean;
  hostId: number;
  members: Member[];
  createdAt: string;
}
