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
