import { describe, expect, it } from "vitest";
import { COURSES, distanceKm, VENUES } from "./park";
import { PARK_OUTLINE } from "./parkGeo";

// 점이 다각형 안에 있는지 (ray casting)
function inside([lat, lng]: [number, number], poly: [number, number][]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ai, bi] = poly[i], [aj, bj] = poly[j];
    if ((ai > lat) !== (aj > lat) && lng < ((bj - bi) * (lat - ai)) / (aj - ai) + bi) c = !c;
  }
  return c;
}

describe("공원 좌표 데이터", () => {
  it("모든 공연장이 올림픽공원 경계 안에 있다", () => {
    for (const v of Object.values(VENUES)) expect(inside([v.lat, v.lng], PARK_OUTLINE), v.name).toBe(true);
  });

  it("코스 경로는 집결지에서 시작해 집결지로 돌아오고, 공원 안에 있다", () => {
    for (const c of COURSES) {
      const first = c.path[0], last = c.path.at(-1)!;
      expect([first[0], first[1]], c.name).toEqual([c.meetingPoint.lat, c.meetingPoint.lng]);
      expect(last, c.name).toEqual(first);
      for (const p of c.path) expect(inside(p, PARK_OUTLINE), `${c.name} ${p}`).toBe(true);
    }
  });

  it("코스 거리는 단순화한 경로 길이와 크게 다르지 않다", () => {
    for (const c of COURSES) {
      let km = 0;
      for (let i = 1; i < c.path.length; i++) km += distanceKm({ lat: c.path[i - 1][0], lng: c.path[i - 1][1] }, { lat: c.path[i][0], lng: c.path[i][1] });
      // 단순화로 굽은 길이 펴져 조금 짧아질 수 있다 (10% 이내)
      expect(km / c.distanceKm, c.name).toBeGreaterThan(0.9);
      expect(km / c.distanceKm, c.name).toBeLessThan(1.05);
    }
  });

  it("수변무대는 88호수 쪽이다 (몽촌호가 아님)", () => {
    // 88호수 남쪽 기슭(37.5212, 127.1254) 근처, 몽촌호 중심(37.5201, 127.1180)과는 멀다
    expect(distanceKm(VENUES.waterside, { lat: 37.5212, lng: 127.1254 })).toBeLessThan(0.05);
    expect(distanceKm(VENUES.waterside, { lat: 37.5201, lng: 127.118 })).toBeGreaterThan(0.5);
  });
});
