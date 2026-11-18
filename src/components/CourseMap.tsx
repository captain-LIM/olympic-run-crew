import { VENUES } from "@/lib/park";
import type { Course, VenueId } from "@/lib/types";

const BOX = { minLat: 37.5135, maxLat: 37.525, minLng: 127.112, maxLng: 127.132 };
const W = 400;
const H = 290;

const x = (lng: number) => ((lng - BOX.minLng) / (BOX.maxLng - BOX.minLng)) * W;
const y = (lat: number) => ((BOX.maxLat - lat) / (BOX.maxLat - BOX.minLat)) * H;

const INK = "var(--color-ink)";

/** 지도 SDK 없이 그리는 올림픽공원 개략도 (좌표는 근사값) */
export function CourseMap({ course, venueId }: { course?: Course; venueId?: VenueId }) {
  const venue = venueId && venueId !== "other" ? VENUES[venueId] : undefined;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-2xl border border-rule bg-paper-2" role="img" aria-label={course ? `${course.name} 코스 개략도` : "올림픽공원 개략도"}>
      <rect x={x(127.1135)} y={y(37.5242)} width={x(127.1312) - x(127.1135)} height={y(37.5143) - y(37.5242)} rx={20} style={{ fill: "var(--color-paper-3)", stroke: "var(--color-edge)", strokeWidth: 1.5 }} />
      <ellipse cx={x(127.1212)} cy={y(37.5217)} rx={22} ry={12} style={{ fill: "var(--color-accent-3)", stroke: "var(--color-edge)", strokeWidth: 1.5 }} />
      <text x={x(127.1212)} y={y(37.5217) + 4} textAnchor="middle" fontSize={10} style={{ fill: INK }}>몽촌호수</text>

      {course && (
        <>
          <polyline points={course.path.map(([la, ln]) => `${x(ln)},${y(la)}`).join(" ")} style={{ fill: "none", stroke: "var(--color-accent)", strokeWidth: 4, strokeLinejoin: "round" }} />
          <circle cx={x(course.meetingPoint.lng)} cy={y(course.meetingPoint.lat)} r={8} style={{ fill: "var(--color-sun)", stroke: INK, strokeWidth: 2.5 }} />
          <text x={x(course.meetingPoint.lng) + 12} y={y(course.meetingPoint.lat) - 8} fontSize={11} fontWeight={600} style={{ fill: INK }}>집결: {course.meetingPoint.name}</text>
        </>
      )}

      {venue && (
        <g>
          <rect x={x(venue.lng) - 9} y={y(venue.lat) - 9} width={18} height={18} rx={9} style={{ fill: INK }} />
          <text x={x(venue.lng)} y={y(venue.lat) + 4} textAnchor="middle" fontSize={10} style={{ fill: "var(--color-paper)" }}>★</text>
          <text x={x(venue.lng)} y={y(venue.lat) + 24} textAnchor="middle" fontSize={11} fontWeight={700} style={{ fill: INK }}>{venue.name}</text>
        </g>
      )}
    </svg>
  );
}
