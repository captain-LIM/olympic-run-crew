import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildCurves, dayTypeOf, indexAt, parseCongestionCsv, snapshot, zoneCongestion } from "../congestion";
import { parseVenue3dCsv } from "../venue3d";
import { showId, toShows } from "./shows";
import { parseItems, parseResultCode } from "./xml";

const root = path.join(__dirname, "..", "..", "..");

// 실제 대관정보 API 응답 형식 (필드 일부 생략)
const RENTAL_XML = `<response><header><resultCode>0000</resultCode><resultMsg>OK</resultMsg></header><body><items>
<item><title>2013 소명 명품콘서트</title><spatial>올림픽홀</spatial><temporalCoverage></temporalCoverage></item>
<item><title>2022 스트릿 우먼 파이터 리유니온 콘서트</title><spatial>핸드볼경기장</spatial></item>
<item><title>Groove Drum Festival 2013</title><spatial>K아트홀</spatial></item>
<item><title>Groove Drum Festival 2013</title><spatial>K아트홀</spatial></item>
<item><title>체조 콘서트</title><spatial>체조경기장</spatial></item>
<item><title>야외 페스티벌</title><spatial></spatial></item>
</items><numOfRows>6</numOfRows><pageNo>1</pageNo><totalCount>6</totalCount></body></response>`;

describe("대관정보 API 파싱", () => {
  it("reads result code and items", () => {
    expect(parseResultCode(RENTAL_XML)?.code).toBe("0000");
    expect(parseItems(RENTAL_XML)).toHaveLength(6);
  });

  it("maps places to venues, dedupes, and lists recent first", () => {
    const shows = toShows(RENTAL_XML);
    expect(shows).toHaveLength(5);
    expect(shows[0].title).toBe("야외 페스티벌");
    expect(shows[0].place).toBe("올림픽공원 내");
    const byTitle = Object.fromEntries(shows.map((s) => [s.title, s.venueId]));
    expect(byTitle["2013 소명 명품콘서트"]).toBe("olympic-hall");
    expect(byTitle["Groove Drum Festival 2013"]).toBe("woori-art-hall");
    expect(byTitle["체조 콘서트"]).toBe("kspo-dome");
  });

  it("produces stable ids", () => {
    expect(showId("a", "b")).toBe(showId("a", "b"));
    expect(showId("a", "b")).not.toBe(showId("a", "c"));
  });
});

describe("주차장 혼잡도 CSV", () => {
  const csv = `"일련번호","주차장아이디","주차구역","혼잡도","등록일","등록시간"
1,1,P1A,만차,"2025-03-01","14:03:01"
2,2,P1B,혼잡,"2025-03-01","13:03:01"
3,1,P1A,원활,"2025-03-03","10:03:03"
4,1,P1A,이상값,"2025-03-03","10:03:03"`;

  it("parses rows and skips invalid status", () => {
    const rows = parseCongestionCsv(csv);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ zone: "P1A", status: "만차", date: "2025-03-01", hour: 14 });
  });

  it("classifies weekend/weekday in KST", () => {
    expect(dayTypeOf("2025-03-01")).toBe("weekend"); // 토
    expect(dayTypeOf("2025-03-03")).toBe("weekday"); // 월
  });

  it("builds normalized curves peaking at weekend afternoon", () => {
    const curves = buildCurves(parseCongestionCsv(csv));
    expect(indexAt(curves, "weekend", 14)).toBe(1);
    expect(indexAt(curves, "weekday", 10)).toBe(0);
    expect(curves.weekend.every((p) => p.index >= 0 && p.index <= 1)).toBe(true);
  });

  it("summarizes zones for a time window", () => {
    const zones = zoneCongestion(parseCongestionCsv(csv), "weekend", 14);
    expect(zones.find((z) => z.zone === "P1A")?.counts.만차).toBe(1);
    expect(zones.find((z) => z.zone === "P1B")?.level).toBe("혼잡");
  });

  it("parses the bundled public data file", () => {
    const rows = parseCongestionCsv(readFileSync(path.join(root, "data", "parking-congestion.csv"), "utf8"));
    expect(rows.length).toBeGreaterThan(600);
    const snap = snapshot(rows, "weekend", 14);
    expect(snap.zones.length).toBeGreaterThanOrEqual(10);
    expect(snap.period.from < snap.period.to).toBe(true);
  });
});

describe("실감형 콘텐츠 CSV", () => {
  it("groups the bundled file by venue with optimized models", () => {
    const venues = parseVenue3dCsv(readFileSync(path.join(root, "data", "venue-3d-contents.csv"), "utf8"));
    const ids = venues.map((v) => v.venueId).sort();
    expect(ids).toEqual(["88-lawn", "handball", "kspo-dome", "waterside", "woori-art-hall"]);
    const dome = venues.find((v) => v.venueId === "kspo-dome")!;
    expect(dome.files.map((f) => f.ext)).toEqual(["SKP", "DAE"]);
    expect(dome.modelUrl).toBe("/models/kspo-dome.glb");
    expect(venues.every((v) => v.modelUrl)).toBe(true);
  });
});
