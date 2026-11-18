import { describe, expect, it } from "vitest";
import { aggregateParking, mockParking } from "./parking";
import { mockEvents } from "./rentals";
import { normalizeDate, parseItems, parseResultCode, pick } from "./xml";

// 합성 XML (실제 필드명은 활용신청 후 확인 필요)
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<response><header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header>
<body><items>
<item><parkingNm>동2문</parkingNm><inDate>2026-11-21 16:10</inDate><outDate></outDate></item>
<item><parkingNm>동2문</parkingNm><inDate>2026-11-21 15:00</inDate><outDate>2026-11-21 15:40</outDate></item>
<item><parkingNm>남2문</parkingNm><inDate>2026-11-21 16:30</inDate><outDate></outDate></item>
<item><parkingNm>북2문</parkingNm><inDate>2026-11-01 09:00</inDate><outDate></outDate></item>
</items></body></response>`;

describe("xml helpers", () => {
  it("parses items and result code", () => {
    expect(parseItems(XML)).toHaveLength(4);
    expect(parseResultCode(XML)?.code).toBe("00");
  });
  it("wraps a single item in an array", () => {
    expect(parseItems("<response><body><items><item><a>1</a></item></items></body></response>")).toHaveLength(1);
  });
  it("picks by key or regex", () => {
    expect(pick({ 행사명: "공연" }, ["eventNm", /행사명/])).toBe("공연");
    expect(pick({ eventNm: "" }, ["eventNm"])).toBeUndefined();
  });
  it("normalizes dates", () => {
    expect(normalizeDate("20261121")).toBe("2026-11-21");
    expect(normalizeDate("2026.11.21 18:00")).toBe("2026-11-21");
    expect(normalizeDate("2026")).toBeUndefined();
  });
});

describe("aggregateParking", () => {
  it("counts today's cars without exit per gate, ignoring long-term parkers", () => {
    const s = aggregateParking(parseItems(XML), "2026-11-21");
    const by = Object.fromEntries(s.map((x) => [x.gateId, x.occupied]));
    expect(by).toEqual({ east2: 1, south2: 1, north2: 0 });
  });
});

describe("mock data", () => {
  it("produces events with ids and estimated times", () => {
    const ev = mockEvents();
    expect(ev.length).toBeGreaterThan(0);
    expect(ev.every((e) => /^\d{2}:\d{2}$/.test(e.estimatedStartTime))).toBe(true);
  });
  it("produces higher east-gate congestion before evening shows", () => {
    const pre = mockParking(new Date("2026-11-21T17:10:00+09:00")).find((p) => p.gateId === "east2")!;
    const morning = mockParking(new Date("2026-11-21T09:00:00+09:00")).find((p) => p.gateId === "east2")!;
    expect(pre.ratio).toBeGreaterThan(morning.ratio);
  });
});
