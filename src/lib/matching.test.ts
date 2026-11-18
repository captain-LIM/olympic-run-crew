import { describe, expect, it } from "vitest";
import { levelFromIndex } from "./congestion";
import { canJoin, findMatches, recommendCourses, validateTiming } from "./matching";
import { COURSES, getCourse } from "./park";
import type { Crew } from "./types";

const eventStart = new Date("2026-11-21T19:00:00+09:00");
const now = new Date("2026-11-21T16:00:00+09:00");
const lake = getCourse("lake-loop")!;

function crew(over: Partial<Crew> = {}): Crew {
  return {
    id: "c1",
    eventId: "e1",
    mode: "walk",
    paceMinPerKm: 12,
    courseId: "lake-loop",
    startAt: "2026-11-21T17:30:00+09:00",
    eventStartAt: eventStart.toISOString(),
    capacity: 6,
    teenOnly: false,
    members: [{ id: "m1", nickname: "a", ageGroup: "20s", joinedAt: now.toISOString(), checkedIn: false, finished: false }],
    createdAt: now.toISOString(),
    ...over,
  };
}

describe("validateTiming", () => {
  it("accepts a start that leaves the entry buffer", () => {
    const r = validateTiming({ startAt: new Date("2026-11-21T17:30:00+09:00"), eventStartAt: eventStart, course: lake, pace: 12, venueId: "kspo-dome" });
    expect(r.ok).toBe(true);
    expect(r.durationMin).toBe(19);
  });

  it("rejects a start too close to the show", () => {
    const r = validateTiming({ startAt: new Date("2026-11-21T18:20:00+09:00"), eventStartAt: eventStart, course: lake, pace: 12, venueId: "kspo-dome" });
    expect(r.ok).toBe(false);
    expect(r.latestStart.getTime()).toBeLessThan(new Date("2026-11-21T18:20:00+09:00").getTime());
  });

  it("rejects a start earlier than the opening window", () => {
    const r = validateTiming({ startAt: new Date("2026-11-21T15:00:00+09:00"), eventStartAt: eventStart, course: lake, pace: 12, venueId: "kspo-dome" });
    expect(r.ok).toBe(false);
  });
});

describe("canJoin", () => {
  it("blocks full crews", () => {
    expect(canJoin(crew({ capacity: 1 }), "20s", now).ok).toBe(false);
  });
  it("separates teens and adults", () => {
    expect(canJoin(crew(), "14-19", now).ok).toBe(false);
    expect(canJoin(crew({ teenOnly: true }), "20s", now).ok).toBe(false);
    expect(canJoin(crew({ teenOnly: true }), "14-19", now).ok).toBe(true);
  });
  it("blocks crews that already left", () => {
    expect(canJoin(crew({ startAt: "2026-11-21T15:59:00+09:00" }), "20s", now).ok).toBe(false);
  });
});

describe("findMatches", () => {
  const req = { eventId: "e1", eventStartAt: eventStart, mode: "walk" as const, pace: 12, startAt: new Date("2026-11-21T17:35:00+09:00"), ageGroup: "20s" as const };

  it("requires the same show date (같은 공연, 다른 날짜는 다른 방)", () => {
    const otherDay = crew({ eventStartAt: "2026-11-22T19:00:00+09:00", startAt: "2026-11-21T17:30:00+09:00" });
    expect(findMatches([otherDay], req, now)).toHaveLength(0);
  });

  it("matches same event, mode, time window and pace", () => {
    expect(findMatches([crew()], req, now)).toHaveLength(1);
  });

  it("excludes other events, modes, far times and pace gaps", () => {
    const crews = [
      crew({ id: "x1", eventId: "e2" }),
      crew({ id: "x2", mode: "run" }),
      crew({ id: "x3", startAt: "2026-11-21T18:00:00+09:00" }),
      crew({ id: "x4", paceMinPerKm: 9 }),
    ];
    expect(findMatches(crews, req, now)).toHaveLength(0);
  });

  it("orders by closest start time", () => {
    const a = crew({ id: "a", startAt: "2026-11-21T17:45:00+09:00" });
    const b = crew({ id: "b", startAt: "2026-11-21T17:33:00+09:00" });
    expect(findMatches([a, b], req, now).map((c) => c.id)).toEqual(["b", "a"]);
  });
});

describe("recommendCourses", () => {
  it("only returns courses supporting the mode", () => {
    const recs = recommendCourses(COURSES, "run", "kspo-dome", "여유");
    expect(recs.every((r) => r.course.modes.includes("run"))).toBe(true);
  });

  it("prefers the closest meeting point when calm", () => {
    const recs = recommendCourses(COURSES, "walk", "88-lawn", "여유");
    expect(recs[0].course.id).toBe("peace-gate"); // 88잔디마당 바로 앞 집결
    expect(recs.some((r) => r.crowded)).toBe(false);
  });

  it("disperses away from the venue when congested", () => {
    const recs = recommendCourses(COURSES, "walk", "88-lawn", "매우혼잡");
    expect(recs[0].course.id).not.toBe("peace-gate");
    expect(recs.find((r) => r.course.id === "peace-gate")?.crowded).toBe(true);
  });
});

describe("levelFromIndex", () => {
  it("maps thresholds", () => {
    expect([0.1, 0.3, 0.6, 0.9].map(levelFromIndex)).toEqual(["여유", "보통", "혼잡", "매우혼잡"]);
  });
});
