import { GATES, VENUES } from "@/lib/park";
import type { Course, GateId, ParkingStatus, VenueId } from "@/lib/types";
import { LEVEL_FILL } from "./ParkingPanel";

const BOX = { minLat: 37.5135, maxLat: 37.525, minLng: 127.112, maxLng: 127.132 };
const W = 400;
const H = 290;

const x = (lng: number) => ((lng - BOX.minLng) / (BOX.maxLng - BOX.minLng)) * W;
const y = (lat: number) => ((BOX.maxLat - lat) / (BOX.maxLat - BOX.minLat)) * H;

/** 지도 SDK 없이 그리는 올림픽공원 개략도 (좌표는 근사값) */
export function CourseMap({ course, venueId, parking = [] }: { course?: Course; venueId?: VenueId; parking?: ParkingStatus[] }) {
  const venue = venueId ? VENUES[venueId] : undefined;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-emerald-50" role="img" aria-label={course ? `${course.name} 코스 지도` : "올림픽공원 지도"}>
      <rect x={x(127.1135)} y={y(37.5242)} width={x(127.1312) - x(127.1135)} height={y(37.5143) - y(37.5242)} rx={24} fill="#d1fae5" />
      <ellipse cx={x(127.1212)} cy={y(37.5217)} rx={22} ry={12} fill="#bae6fd" />
      <text x={x(127.1212)} y={y(37.5217) + 4} textAnchor="middle" fontSize={9} fill="#0369a1">몽촌호수</text>

      {(Object.keys(GATES) as GateId[]).map((g) => {
        const p = parking.find((s) => s.gateId === g);
        return (
          <g key={g}>
            <rect x={x(GATES[g].lng) - 7} y={y(GATES[g].lat) - 7} width={14} height={14} rx={3} fill={p ? LEVEL_FILL[p.level] : "#94a3b8"} />
            <text x={x(GATES[g].lng)} y={y(GATES[g].lat) + 4} textAnchor="middle" fontSize={9} fontWeight={700} fill="white">P</text>
            <text x={x(GATES[g].lng)} y={y(GATES[g].lat) + 18} textAnchor="middle" fontSize={8} fill="#334155">{GATES[g].name.replace(" 주차장", "")}</text>
          </g>
        );
      })}

      {course && (
        <>
          <polyline points={course.path.map(([la, ln]) => `${x(ln)},${y(la)}`).join(" ")} fill="none" stroke="#7c3aed" strokeWidth={4} strokeLinejoin="round" strokeDasharray="1 0" />
          <circle cx={x(course.meetingPoint.lng)} cy={y(course.meetingPoint.lat)} r={7} fill="#7c3aed" stroke="white" strokeWidth={2} />
          <text x={x(course.meetingPoint.lng) + 10} y={y(course.meetingPoint.lat) - 8} fontSize={9} fontWeight={600} fill="#5b21b6">집결: {course.meetingPoint.name}</text>
        </>
      )}

      {venue && (
        <g>
          <circle cx={x(venue.lng)} cy={y(venue.lat)} r={9} fill="#0f172a" />
          <text x={x(venue.lng)} y={y(venue.lat) + 3.5} textAnchor="middle" fontSize={9} fill="white">★</text>
          <text x={x(venue.lng)} y={y(venue.lat) + 21} textAnchor="middle" fontSize={9} fontWeight={700} fill="#0f172a">{venue.name}</text>
        </g>
      )}
    </svg>
  );
}
