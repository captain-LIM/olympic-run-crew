import { readFileSync } from "node:fs";
import path from "node:path";
import { dayTypeOf, parseCongestionCsv, snapshot } from "../congestion";
import { kstDateString, kstHourFraction } from "../time";
import type { CongestionRecord, CongestionSnapshot } from "../types";

/** data/parking-congestion.csv = 공공데이터포털 '주차장 혼잡도 정보' 원본(EUC-KR)을 UTF-8로 변환한 파일 */
const CSV_PATH = path.join(process.cwd(), "data", "parking-congestion.csv");

let cache: CongestionRecord[] | null = null;

export function getCongestionRecords(): CongestionRecord[] {
  cache ??= parseCongestionCsv(readFileSync(CSV_PATH, "utf8"));
  return cache;
}

export function getCongestion(at: Date = new Date()): CongestionSnapshot {
  return snapshot(getCongestionRecords(), dayTypeOf(kstDateString(at)), Math.floor(kstHourFraction(at)));
}
