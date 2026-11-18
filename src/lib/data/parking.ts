import { levelFromRatio } from "../matching";
import { GATES } from "../park";
import { kstDateString, kstHourFraction } from "../time";
import type { GateId, ParkingStatus } from "../types";
import { normalizeDate, parseItems, parseResultCode, pick, type XmlRecord } from "./xml";

/**
 * 한국체육산업개발_실시간 주차현황 (data.go.kr 15168686, XML)
 * 동2문/남2문/북2문 구역의 입차일시·출차일시 레코드 → 현재 주차 대수 집계.
 * 주차면 수는 API에 없으므로 가정값(실측 후 교체).
 */
export const CAPACITY: Record<GateId, number> = { east2: 600, south2: 400, north2: 500 };

const GATE_PATTERNS: [RegExp, GateId][] = [
  [/동\s*2|east/i, "east2"],
  [/남\s*2|south/i, "south2"],
  [/북\s*2|north/i, "north2"],
];

/** 오늘 입차했고 출차 기록이 없는 차량 수를 구역별로 센다 (장기주차 제외 목적) */
export function aggregateParking(records: XmlRecord[], today: string, now = new Date()): ParkingStatus[] {
  const counts: Record<GateId, number> = { east2: 0, south2: 0, north2: 0 };
  for (const rec of records) {
    const zone = pick(rec, ["parkingNm", "zoneNm", /구역|주차장|zone|park/i]) ?? "";
    const gate = GATE_PATTERNS.find(([re]) => re.test(zone))?.[1];
    if (!gate) continue;
    const entryDay = normalizeDate(pick(rec, ["inDate", "entryDt", /입차/]));
    const exit = pick(rec, ["outDate", "exitDt", /출차/]);
    if (entryDay === today && !exit) counts[gate]++;
  }
  return toStatuses(counts, now, "api");
}

function toStatuses(counts: Record<GateId, number>, now: Date, source: ParkingStatus["source"]): ParkingStatus[] {
  return (Object.keys(GATES) as GateId[]).map((gateId) => {
    const occupied = Math.min(counts[gateId], CAPACITY[gateId]);
    const ratio = occupied / CAPACITY[gateId];
    return { gateId, name: GATES[gateId].name, capacity: CAPACITY[gateId], occupied, ratio, level: levelFromRatio(ratio), updatedAt: now.toISOString(), source };
  });
}

export async function getParking(): Promise<{ parking: ParkingStatus[]; source: "api" | "mock"; error?: string }> {
  const url = process.env.KSPO_PARKING_API_URL;
  const key = process.env.KSPO_SERVICE_KEY;
  if (!url || !key) return { parking: mockParking(), source: "mock" };

  try {
    const today = kstDateString();
    const qs = new URLSearchParams({ pageNo: "1", numOfRows: "5000" });
    const res = await fetch(`${url}?serviceKey=${key}&${qs}`, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const rc = parseResultCode(xml);
    if (rc && !["00", "0", "INFO-000"].includes(rc.code)) throw new Error(`${rc.code} ${rc.msg}`);
    return { parking: aggregateParking(parseItems(xml), today), source: "api" };
  } catch (e) {
    console.error("[parking] API 실패, 목 데이터로 대체:", e);
    return { parking: mockParking(), source: "mock", error: String(e) };
  }
}

/** 공연일 저녁 피크를 흉내 낸 시간대별 데모 곡선 */
export function mockParking(now = new Date()): ParkingStatus[] {
  const h = kstHourFraction(now);
  const peak = (center: number, width: number) => Math.exp(-((h - center) ** 2) / (2 * width ** 2));
  const base = 0.15 + 0.15 * peak(14, 3);
  const ratios: Record<GateId, number> = {
    east2: base + 0.75 * peak(17.2, 1.2), // KSPO DOME 공연 전 몰림
    south2: base + 0.45 * peak(17, 1.5),
    north2: base + 0.25 * peak(16, 2),
  };
  const counts = Object.fromEntries(
    (Object.keys(ratios) as GateId[]).map((g) => [g, Math.round(Math.min(ratios[g], 1) * CAPACITY[g])]),
  ) as Record<GateId, number>;
  return toStatuses(counts, now, "mock");
}
