import { VENUES } from "@/lib/park";
import { LAKE_88, MONGCHON_LAKE, PARK_OUTLINE } from "@/lib/parkGeo";
import type { Course, VenueId } from "@/lib/types";

// 공원 경계를 조금 넉넉하게 감싼 범위. 가로·세로 비율은 실제 거리 비율(위도 37.52°)에 맞춘다
const BOX = { minLat: 37.5115, maxLat: 37.5265, minLng: 127.112, maxLng: 127.1328 };
const W = 400;
const H = Math.round((W * (BOX.maxLat - BOX.minLat)) / ((BOX.maxLng - BOX.minLng) * Math.cos((37.519 * Math.PI) / 180)));

const x = (lng: number) => ((lng - BOX.minLng) / (BOX.maxLng - BOX.minLng)) * W;
const y = (lat: number) => ((BOX.maxLat - lat) / (BOX.maxLat - BOX.minLat)) * H;
const pts = (path: [number, number][]) => path.map(([la, ln]) => `${x(ln).toFixed(1)},${y(la).toFixed(1)}`).join(" ");

const INK = "var(--color-ink)";
// 글자 뒤에 바탕색 테두리를 둘러 선과 겹쳐도 읽히게
const halo = { paintOrder: "stroke", stroke: "var(--color-paper-3)", strokeWidth: 3, strokeLinejoin: "round" } as const;

/** 지도 SDK 없이 그리는 올림픽공원 약도. 공원 경계·호수·코스는 OpenStreetMap 데이터 */
export function CourseMap({ course, venueId }: { course?: Course; venueId?: VenueId }) {
  const venue = venueId && venueId !== "other" ? VENUES[venueId] : undefined;
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-2xl border border-rule bg-paper-2" role="img" aria-label={course ? `${course.name} 코스 약도` : "올림픽공원 약도"}>
        <polygon points={pts(PARK_OUTLINE)} style={{ fill: "var(--color-paper-3)", stroke: "var(--color-edge)", strokeWidth: 1.5, strokeLinejoin: "round" }} />
        <polygon points={pts(MONGCHON_LAKE)} style={{ fill: "var(--color-accent-3)", stroke: "var(--color-edge)", strokeWidth: 1 }} />
        <polygon points={pts(LAKE_88)} style={{ fill: "var(--color-accent-3)", stroke: "var(--color-edge)", strokeWidth: 1 }} />
        <text x={x(127.1181)} y={y(37.5186)} textAnchor="middle" fontSize={10} style={{ fill: INK, ...halo }}>몽촌호</text>
        <text x={x(127.1262)} y={y(37.5236)} textAnchor="middle" fontSize={10} style={{ fill: INK, ...halo }}>88호수</text>

        {course && (
          <>
            <polyline points={pts(course.path)} style={{ fill: "none", stroke: "var(--color-accent)", strokeWidth: 4, strokeLinejoin: "round", strokeLinecap: "round" }} />
            <circle cx={x(course.meetingPoint.lng)} cy={y(course.meetingPoint.lat)} r={8} style={{ fill: "var(--color-sun)", stroke: INK, strokeWidth: 2.5 }} />
          </>
        )}

        {venue && (
          <g>
            <rect x={x(venue.lng) - 9} y={y(venue.lat) - 9} width={18} height={18} rx={9} style={{ fill: INK }} />
            <text x={x(venue.lng)} y={y(venue.lat) + 4} textAnchor="middle" fontSize={10} style={{ fill: "var(--color-paper)" }}>★</text>
            <text x={x(venue.lng)} y={y(venue.lat) + 24} textAnchor="middle" fontSize={11} fontWeight={700} style={{ fill: INK, ...halo }}>{venue.name}</text>
          </g>
        )}
      </svg>
      <figcaption className="small mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {course && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block size-3 rounded-full border-2 border-ink bg-sun" />
            집결: {course.meetingPoint.name}
          </span>
        )}
        {venue && <span>★ {venue.name}</span>}
        <span className="muted">지도 데이터 © OpenStreetMap 기여자</span>
      </figcaption>
    </figure>
  );
}
