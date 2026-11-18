import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildCurves, parseCongestionCsv } from "./congestion";
import { baseAt, predictedLevelAt, predictShowDay, venueScale } from "./prediction";

const curves = buildCurves(parseCongestionCsv(readFileSync(path.join(__dirname, "..", "..", "data", "parking-congestion.csv"), "utf8")));
const satShow = new Date("2026-11-21T18:00:00+09:00"); // 토요일
const wedShow = new Date("2026-11-18T19:30:00+09:00"); // 수요일

describe("predictShowDay", () => {
  it("predicts the KSPO DOME show day gets busy before the show", () => {
    const p = predictShowDay({ curves, showStart: satShow, venueId: "kspo-dome" });
    expect(p.dayType).toBe("weekend");
    expect(p.busyFrom).not.toBeNull();
    expect(p.busyFrom! < "18:00").toBe(true);
    expect(p.peak.minute).toBeLessThan(18 * 60);
    expect(p.crowdFrom).not.toBeNull();
  });

  it("suggests a walk window inside the allowed pre-show range", () => {
    const p = predictShowDay({ curves, showStart: satShow, venueId: "kspo-dome" });
    expect(p.walkWindow).not.toBeNull();
    expect(p.walkWindow!.from >= "15:30").toBe(true); // 공연 150분 전 이후
    expect(p.walkWindow!.to <= "17:15").toBe(true); // 공연 45분 전까지 종료
  });

  it("scales with venue size (big arena busier than small hall)", () => {
    const dome = predictShowDay({ curves, showStart: wedShow, venueId: "kspo-dome" });
    const hall = predictShowDay({ curves, showStart: wedShow, venueId: "woori-art-hall" });
    expect(dome.peak.index).toBeGreaterThan(hall.peak.index);
    expect(venueScale("kspo-dome")).toBe(1);
    expect(venueScale("woori-art-hall")).toBeLessThan(0.3);
  });

  it("drops after the show starts", () => {
    const p = predictShowDay({ curves, showStart: satShow, venueId: "kspo-dome" });
    const at = (label: string) => p.points.find((x) => x.label === label)!.index;
    expect(at("20:00")).toBeLessThan(at("17:00"));
  });

  it("keeps all indices in 0..1 at 30-minute steps", () => {
    const p = predictShowDay({ curves, showStart: satShow, venueId: "88-lawn" });
    expect(p.points.every((x) => x.index >= 0 && x.index <= 1)).toBe(true);
    expect(p.points[1].minute - p.points[0].minute).toBe(30);
  });

  it("returns the level near a given time", () => {
    const p = predictShowDay({ curves, showStart: satShow, venueId: "kspo-dome" });
    const lvl = predictedLevelAt(p, new Date("2026-11-21T16:50:00+09:00"));
    expect(["혼잡", "매우혼잡"]).toContain(lvl);
  });
});

describe("baseAt", () => {
  it("interpolates between hourly points", () => {
    const curve = [{ hour: 10, index: 0, level: "여유" as const }, { hour: 11, index: 1, level: "매우혼잡" as const }];
    expect(baseAt(curve, 10 * 60 + 30)).toBeCloseTo(0.5);
    expect(baseAt(curve, 9 * 60)).toBe(0);
    expect(baseAt(curve, 12 * 60)).toBe(1);
  });
});
