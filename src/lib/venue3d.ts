import { resolveVenue, VENUES } from "./park";
import type { Venue3D, VenueId } from "./types";

/**
 * 한국체육산업개발_올림픽공원 공연장 실감형 콘텐츠 (data.go.kr 15127487, CSV)
 * 컬럼: 순번, 구분, 장소, 확장자, 파일명, 홈페이지주소
 */

/**
 * 원본을 웹용으로 변환·압축해 public/models 에 둔 파일 (README 참고)
 * KSPO DOME은 DAE 원본만 제공되어 scripts/sketchup-dae-to-glb.mjs로 GLB 변환 후 압축했다.
 */
export const OPTIMIZED_MODELS: Partial<Record<VenueId, string>> = {
  "kspo-dome": "/models/kspo-dome.glb",
  handball: "/models/handball.glb",
  "woori-art-hall": "/models/woori-art-hall.glb",
  "88-lawn": "/models/88-lawn.glb",
  waterside: "/models/waterside.glb",
};

export function parseVenue3dCsv(text: string): Venue3D[] {
  const lines = text.replace(/^﻿/, "").trim().split(/\r?\n/).slice(1);
  const byVenue = new Map<VenueId, Venue3D>();
  for (const line of lines) {
    const [, category, place, ext, fileName, homepage] = line.split(",").map((c) => c.trim());
    if (!place || !ext || !fileName) continue;
    const venueId = resolveVenue(place);
    const v = byVenue.get(venueId) ?? {
      venueId,
      venueName: place || VENUES[venueId].name,
      category,
      files: [],
      homepage,
      modelUrl: OPTIMIZED_MODELS[venueId],
    };
    v.files.push({ ext: ext.toUpperCase(), fileName });
    byVenue.set(venueId, v);
  }
  return [...byVenue.values()];
}

export const SOURCE_DOWNLOAD_BASE = "https://www.ksponco.or.kr/attachFiles/download/kspo/";
