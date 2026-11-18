import type { AgeGroup, CrewMode } from "./types";

const AGE_GROUPS: AgeGroup[] = ["14-19", "20s", "30s", "40+"];
const MODES: CrewMode[] = ["walk", "jog", "run"];

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseProfile(body: unknown): Parsed<{ nickname: string; ageGroup: AgeGroup }> {
  const b = (body ?? {}) as Record<string, unknown>;
  const nickname = typeof b.nickname === "string" ? b.nickname.trim() : "";
  if (nickname.length < 1 || nickname.length > 12) return { ok: false, error: "닉네임은 1~12자로 입력하세요." };
  if (!AGE_GROUPS.includes(b.ageGroup as AgeGroup)) return { ok: false, error: "만 14세 이상만 이용할 수 있습니다. 연령대를 선택하세요." };
  return { ok: true, value: { nickname, ageGroup: b.ageGroup as AgeGroup } };
}

export function parseMode(v: unknown): CrewMode | null {
  return MODES.includes(v as CrewMode) ? (v as CrewMode) : null;
}

export function parsePace(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= 3 && n <= 20 ? n : null;
}

export function parseDate(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
