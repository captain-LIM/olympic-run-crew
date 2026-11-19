import { describe, expect, it } from "vitest";
import { computeBadges, summarizeFinished } from "./badges";

describe("badges", () => {
  it("완주 기록이 없으면 배지가 없다", () => {
    const b = computeBadges(summarizeFinished([]));
    expect(b.every((x) => !x.earned)).toBe(true);
    expect(b[0].progress).toBe("0/1");
  });

  it("횟수·거리·공연장 수에 따라 배지를 얻는다", () => {
    const rows = [
      { venueId: "kspo-dome", distanceKm: 4.2 },
      { venueId: "kspo-dome", distanceKm: 3.1 },
      { venueId: "handball", distanceKm: 3.0 },
    ];
    const stats = summarizeFinished(rows);
    expect(stats).toEqual({ count: 3, km: 10.3, venues: ["kspo-dome", "handball"] });
    const earned = computeBadges(stats).filter((x) => x.earned).map((x) => x.id);
    expect(earned).toEqual(["first", "three", "km10"]);
  });

  it("공연장을 알 수 없거나 'other'면 공연장 수에 넣지 않는다", () => {
    expect(summarizeFinished([{ venueId: undefined, distanceKm: 1 }, { venueId: "other", distanceKm: 1 }]).venues).toEqual([]);
  });
});
