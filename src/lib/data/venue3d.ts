import { readFileSync } from "node:fs";
import path from "node:path";
import { parseVenue3dCsv } from "../venue3d";
import type { Venue3D } from "../types";

/** data/venue-3d-contents.csv = 공공데이터포털 '올림픽공원 공연장 실감형 콘텐츠' 원본(EUC-KR)을 UTF-8로 변환한 파일 */
const CSV_PATH = path.join(process.cwd(), "data", "venue-3d-contents.csv");

let cache: Venue3D[] | null = null;

export function getVenue3D(): Venue3D[] {
  cache ??= parseVenue3dCsv(readFileSync(CSV_PATH, "utf8"));
  return cache;
}
