export type GateId = "east2" | "south2" | "north2";

export type VenueId =
  | "kspo-dome"
  | "handball"
  | "woori-art-hall"
  | "olympic-hall"
  | "waterside"
  | "88-lawn"
  | "other";

export type DataSource = "api" | "mock";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Venue extends LatLng {
  id: VenueId;
  name: string;
  nearestGate: GateId;
  /** 실감형 콘텐츠(DAE) 파일명. public/models/ 아래에 두면 3D 뷰어가 로드한다. */
  modelFile?: string;
}

/** 올림픽공원 대관정보(15015212) 한 건을 정규화한 형태 */
export interface PerformanceEvent {
  id: string;
  title: string;
  venueId: VenueId;
  venueName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  /** 대관정보에는 시작 시각이 없으므로 추정값 */
  estimatedStartTime: string; // HH:mm
  source: DataSource;
}

export type CongestionLevel = "여유" | "보통" | "혼잡" | "매우혼잡";

/** 실시간 주차현황(15168686) 구역별 집계 */
export interface ParkingStatus {
  gateId: GateId;
  name: string;
  capacity: number;
  occupied: number;
  ratio: number; // 0~1
  level: CongestionLevel;
  updatedAt: string; // ISO
  source: DataSource;
}

export type CrewMode = "walk" | "jog" | "run";

export interface Course {
  id: string;
  name: string;
  distanceKm: number;
  description: string;
  meetingPoint: LatLng & { name: string };
  nearGate: GateId;
  path: [number, number][]; // [lat, lng]
  modes: CrewMode[];
}

export type AgeGroup = "14-19" | "20s" | "30s" | "40+";

export interface Member {
  id: string;
  nickname: string;
  ageGroup: AgeGroup;
  joinedAt: string;
  checkedIn: boolean;
  finished: boolean;
}

export interface Crew {
  id: string;
  eventId: string;
  mode: CrewMode;
  paceMinPerKm: number;
  courseId: string;
  startAt: string; // ISO
  eventStartAt: string; // ISO
  capacity: number;
  /** 미성년 보호: true면 같은 연령대(14-19)만 참여 */
  teenOnly: boolean;
  members: Member[];
  createdAt: string;
}
