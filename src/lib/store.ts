import { randomUUID } from "node:crypto";
import { canJoin } from "./matching";
import type { AgeGroup, Crew, CrewMode } from "./types";

/**
 * MVP용 인메모리 저장소. 서버 재시작 시 초기화된다.
 * 배포 시 Supabase 등 영속 DB 구현으로 교체 (동일 함수 시그니처 유지).
 */
const g = globalThis as unknown as { __crews?: Map<string, Crew> };
const crews: Map<string, Crew> = (g.__crews ??= new Map());

export interface NewCrewInput {
  eventId: string;
  mode: CrewMode;
  paceMinPerKm: number;
  courseId: string;
  startAt: Date;
  eventStartAt: Date;
  capacity: number;
  host: { nickname: string; ageGroup: AgeGroup };
}

export function listCrews(eventId?: string): Crew[] {
  const all = [...crews.values()];
  return (eventId ? all.filter((c) => c.eventId === eventId) : all).sort((a, b) => a.startAt.localeCompare(b.startAt));
}

export function getCrew(id: string): Crew | undefined {
  return crews.get(id);
}

export function createCrew(input: NewCrewInput): { crew: Crew; memberId: string } {
  const now = new Date().toISOString();
  const memberId = randomUUID();
  const crew: Crew = {
    id: randomUUID().slice(0, 8),
    eventId: input.eventId,
    mode: input.mode,
    paceMinPerKm: input.paceMinPerKm,
    courseId: input.courseId,
    startAt: input.startAt.toISOString(),
    eventStartAt: input.eventStartAt.toISOString(),
    capacity: input.capacity,
    teenOnly: input.host.ageGroup === "14-19",
    members: [{ id: memberId, ...input.host, joinedAt: now, checkedIn: false, finished: false }],
    createdAt: now,
  };
  crews.set(crew.id, crew);
  return { crew, memberId };
}

export function joinCrew(crewId: string, who: { nickname: string; ageGroup: AgeGroup }): { crew?: Crew; memberId?: string; error?: string } {
  const crew = crews.get(crewId);
  if (!crew) return { error: "크루를 찾을 수 없습니다." };
  const check = canJoin(crew, who.ageGroup, new Date());
  if (!check.ok) return { error: check.reason };
  const memberId = randomUUID();
  crew.members.push({ id: memberId, ...who, joinedAt: new Date().toISOString(), checkedIn: false, finished: false });
  return { crew, memberId };
}

export function updateMember(crewId: string, memberId: string, patch: { checkedIn?: boolean; finished?: boolean }): Crew | undefined {
  const crew = crews.get(crewId);
  const m = crew?.members.find((x) => x.id === memberId);
  if (!crew || !m) return undefined;
  if (patch.checkedIn !== undefined) m.checkedIn = patch.checkedIn;
  if (patch.finished !== undefined) m.finished = patch.finished;
  return crew;
}

export function leaveCrew(crewId: string, memberId: string): Crew | undefined {
  const crew = crews.get(crewId);
  if (!crew) return undefined;
  crew.members = crew.members.filter((m) => m.id !== memberId);
  if (crew.members.length === 0) crews.delete(crewId);
  return crew;
}

/** 데모용 시드: 목 공연에 대해 미리 열린 번개 몇 개 */
export function seedIfEmpty(events: { id: string; startDate: string; estimatedStartTime: string }[]) {
  if (crews.size > 0) return;
  const seeds: [CrewMode, number, string, number, string, AgeGroup][] = [
    [  "walk", 12, "lake-loop", 75, "굿즈산 사람", "20s"],
    [  "jog", 7.5, "mongchon-fortress", 95, "아침런", "30s"],
    [  "walk", 12, "peace-gate", 80, "응원봉", "14-19"],
  ];
  for (const ev of events.slice(0, 2)) {
    const eventStartAt = new Date(`${ev.startDate}T${ev.estimatedStartTime}:00+09:00`);
    if (eventStartAt.getTime() < Date.now()) continue;
    for (const [mode, pace, courseId, before, nickname, ageGroup] of seeds) {
      const startAt = new Date(eventStartAt.getTime() - before * 60_000);
      if (startAt.getTime() < Date.now()) continue;
      createCrew({ eventId: ev.id, mode, paceMinPerKm: pace, courseId, startAt, eventStartAt, capacity: 6, host: { nickname, ageGroup } });
    }
  }
}
