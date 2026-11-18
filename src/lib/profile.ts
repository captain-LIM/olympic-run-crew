"use client";

import type { AgeGroup, VenueId } from "./types";

export interface Profile {
  nickname: string;
  ageGroup: AgeGroup;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 사생활 보호 모드 등에서는 저장 생략 */
  }
}

export const loadProfile = () => read<Profile | null>("orc.profile", null);
export const saveProfile = (p: Profile) => write("orc.profile", p);

export const getMemberId = (crewId: string) => read<Record<string, string>>("orc.memberships", {})[crewId];
export function setMemberId(crewId: string, memberId: string | null) {
  const all = read<Record<string, string>>("orc.memberships", {});
  if (memberId) all[crewId] = memberId;
  else delete all[crewId];
  write("orc.memberships", all);
}

export const loadUnlocked = () => read<VenueId[]>("orc.unlocked", []);
export function unlockVenue(id: VenueId) {
  const s = new Set(loadUnlocked());
  s.add(id);
  write("orc.unlocked", [...s]);
}
