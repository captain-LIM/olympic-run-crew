/** 완주 기록 통계와 배지 계산 (순수 함수) */
export interface FinishStats {
  /** 완주한 크루 수 */
  count: number;
  /** 완주 코스 거리 합계(km) */
  km: number;
  /** 완주한 공연장 ID (중복 제거) */
  venues: string[];
}

export interface Badge {
  id: string;
  name: string;
  desc: string;
  earned: boolean;
  /** 진행 상황 문구 (예: "2/3") */
  progress: string;
}

const RULES: { id: string; name: string; desc: string; value: (s: FinishStats) => number; goal: number }[] = [
  { id: "first", name: "첫 한 바퀴", desc: "크루를 처음 완주했어요", value: (s) => s.count, goal: 1 },
  { id: "three", name: "단골 러너", desc: "크루 3번 완주", value: (s) => s.count, goal: 3 },
  { id: "five", name: "공연 전 루틴", desc: "크루 5번 완주", value: (s) => s.count, goal: 5 },
  { id: "km10", name: "10km 클럽", desc: "누적 10km 걷고 달리기", value: (s) => Math.floor(s.km), goal: 10 },
  { id: "venues3", name: "공연장 투어", desc: "서로 다른 공연장 3곳 완주", value: (s) => s.venues.length, goal: 3 },
];

export function computeBadges(stats: FinishStats): Badge[] {
  return RULES.map((r) => {
    const v = r.value(stats);
    return { id: r.id, name: r.name, desc: r.desc, earned: v >= r.goal, progress: `${Math.min(v, r.goal)}/${r.goal}` };
  });
}

export function summarizeFinished(rows: { venueId: string | undefined; distanceKm: number }[]): FinishStats {
  return {
    count: rows.length,
    km: Math.round(rows.reduce((a, r) => a + r.distanceKm, 0) * 10) / 10,
    venues: [...new Set(rows.map((r) => r.venueId).filter((v): v is string => !!v && v !== "other"))],
  };
}
