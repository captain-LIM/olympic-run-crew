import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { expandSessions, kopisVenue, parseDtGuidance, parseKopisDetail, parseKopisList, parseKopisShowId, toKopisShow } from "./kopis";

// 2026-11-24에 받은 실제 KOPIS 응답 (시설 FC001247 = 올림픽공원)
const fixture = (name: string) => readFileSync(path.join(__dirname, "fixtures", "kopis", name), "utf8");

describe("KOPIS 응답 해석", () => {
  it("목록: 공연 ID와 이름", () => {
    const list = parseKopisList(fixture("list.xml"));
    expect(list).toHaveLength(13);
    expect(list[0]).toEqual({ id: "PF307353", title: "XIA Musical Concert with Orchestra Vol.9" });
  });

  it("상세: 기간·공연장·시각, 이름의 &amp;는 &로", () => {
    const d = parseKopisDetail(fixture("detail-PF301499.xml"))!;
    expect(d).toMatchObject({
      id: "PF301499",
      title: "조용필 & 위대한 탄생 전국투어 콘서트 [서울]",
      facilityId: "FC001247",
      hallId: "FC001247-01",
      facilityName: "올림픽공원 (KSPO DOME(체조경기장))",
      from: "2026-11-27",
      to: "2026-11-29",
      runtime: "2시간 10분",
      schedule: "금요일(19:00), 토요일(18:00), 일요일(17:00)",
    });
  });

  it("오류 응답: 키 오류는 예외, 데이터 없음은 빈 결과", () => {
    expect(() => parseKopisList(fixture("error-bad-key.xml"))).toThrow(/SERVICE KEY IS NOT REGISTERED/);
    const nodata = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><dbs><db><returncode>04</returncode><errmsg>NODATA ERROR</errmsg></db></dbs>';
    expect(parseKopisList(nodata)).toEqual([]);
    expect(parseKopisDetail(nodata)).toBeNull();
  });
});

describe("공연 시각(dtguidance) 해석", () => {
  it("요일 하나씩", () => {
    const s = parseDtGuidance("금요일(19:00), 토요일(18:00), 일요일(17:00)")!;
    expect(s.byDay[5]).toEqual(["19:00"]);
    expect(s.byDay[6]).toEqual(["18:00"]);
    expect(s.byDay[0]).toEqual(["17:00"]);
    expect(s.byDay[1]).toEqual([]);
    expect(s.holiday).toEqual([]);
  });

  it("요일 범위와 하루 여러 회차", () => {
    const s = parseDtGuidance(parseKopisDetail(fixture("detail-PF293285.xml"))!.schedule)!;
    // 수요일 ~ 금요일(19:30), 토요일(15:00,19:00), 일요일(14:00)
    expect(s.byDay.map((t) => t.join(","))).toEqual(["14:00", "", "", "19:30", "19:30", "19:30", "15:00,19:00"]);
  });

  it("범위가 일요일을 넘어가는 경우 (토요일 ~ 일요일)", () => {
    const s = parseDtGuidance(parseKopisDetail(fixture("detail-PF297746.xml"))!.schedule)!;
    // 금요일(19:00), 토요일 ~ 일요일(16:00)
    expect(s.byDay[5]).toEqual(["19:00"]);
    expect(s.byDay[6]).toEqual(["16:00"]);
    expect(s.byDay[0]).toEqual(["16:00"]);
  });

  it("공휴일 회차 HOL은 따로", () => {
    const s = parseDtGuidance(parseKopisDetail(fixture("detail-PF305700.xml"))!.schedule)!;
    // 토요일 ~ 일요일(14:00), HOL(14:00)
    expect(s.byDay[6]).toEqual(["14:00"]);
    expect(s.byDay[0]).toEqual(["14:00"]);
    expect(s.holiday).toEqual(["14:00"]);
  });

  it("모르는 형식은 null", () => {
    expect(parseDtGuidance("")).toBeNull();
    expect(parseDtGuidance("매일 19시")).toBeNull();
    expect(parseDtGuidance("금요일(19:00), 공연 당일 확인")).toBeNull();
    expect(parseDtGuidance("금요일(저녁)")).toBeNull();
    expect(parseDtGuidance("불금(19:00)")).toBeNull();
    expect(parseDtGuidance("금요일(25:00)")).toBeNull();
  });
});

describe("회차 펼치기", () => {
  const schedule = parseDtGuidance("금요일(19:00), 토요일 ~ 일요일(16:00)")!;

  it("기간 안의 요일만, KST 날짜·시각으로", () => {
    // 2026-12-04(금) ~ 12-06(일)
    const now = new Date("2026-11-24T12:00:00+09:00");
    expect(expandSessions(schedule, { from: "2026-12-04", to: "2026-12-06" }, now)).toEqual(["2026-12-04T19:00", "2026-12-05T16:00", "2026-12-06T16:00"]);
  });

  it("이미 시작한 회차는 빼고, 진행 중인 공연은 오늘부터", () => {
    const now = new Date("2026-12-05T16:00:00+09:00");
    expect(expandSessions(schedule, { from: "2026-12-04", to: "2026-12-06" }, now)).toEqual(["2026-12-06T16:00"]);
  });

  it("앞으로 horizonDays 안, 최대 max개", () => {
    const now = new Date("2026-11-24T12:00:00+09:00");
    const long = { from: "2026-01-01", to: "2027-12-31" };
    const in14 = expandSessions(schedule, long, now, { horizonDays: 14 });
    expect(in14[0]).toBe("2026-11-27T19:00");
    expect(in14.at(-1)! <= "2026-12-08T23:59").toBe(true);
    expect(expandSessions(schedule, long, now, { max: 4 })).toHaveLength(4);
  });
});

describe("KOPIS 공연 → Show", () => {
  const now = new Date("2026-11-24T12:00:00+09:00");

  it("공연장 코드로 공연장을 고른다", () => {
    expect(kopisVenue("FC001247-01", "KSPO DOME(체조경기장)")).toBe("kspo-dome");
    expect(kopisVenue("FC001247-02", "티켓링크 라이브 아레나(핸드볼경기장)")).toBe("handball");
    expect(kopisVenue("FC001247-04", "뮤즈라이브")).toBe("olympic-hall");
    expect(kopisVenue("FC001247-05", "우리금융아트홀(역도경기장)")).toBe("woori-art-hall");
    expect(kopisVenue("FC001247-06", "K-아트홀")).toBe("other");
    expect(kopisVenue("", "올림픽홀")).toBe("olympic-hall");
  });

  it("ID·장소·회차", () => {
    const show = toKopisShow(parseKopisDetail(fixture("detail-PF301499.xml"))!, now);
    expect(show).toMatchObject({ id: "k-PF301499", place: "KSPO DOME(체조경기장)", venueId: "kspo-dome", venueName: "KSPO DOME" });
    expect(show.kopis).toMatchObject({ from: "2026-11-27", to: "2026-11-29", scheduleKnown: true, holidaySessions: false });
    expect(show.kopis!.sessions).toEqual(["2026-11-27T19:00", "2026-11-28T18:00", "2026-11-29T17:00"]);
  });

  it("공휴일 회차가 있으면 표시, 형식을 모르면 회차 없음", () => {
    const hol = toKopisShow(parseKopisDetail(fixture("detail-PF305700.xml"))!, now);
    expect(hol.kopis).toMatchObject({ holidaySessions: true, scheduleKnown: true });
    const d = { ...parseKopisDetail(fixture("detail-PF301499.xml"))!, schedule: "공연 당일 안내" };
    expect(toKopisShow(d, now).kopis).toMatchObject({ scheduleKnown: false, sessions: [] });
  });

  it("ID 형식 검사 (외부 API 주소에 들어가므로)", () => {
    expect(parseKopisShowId("k-PF301499")).toBe("PF301499");
    expect(parseKopisShowId("PF301499")).toBeUndefined();
    expect(parseKopisShowId("k-PF1/../prfplc")).toBeUndefined();
    expect(parseKopisShowId("abc123")).toBeUndefined();
  });
});
