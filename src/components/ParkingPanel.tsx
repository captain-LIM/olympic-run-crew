import { formatKstTime } from "@/lib/time";
import type { CongestionLevel, ParkingStatus } from "@/lib/types";

export const LEVEL_STYLE: Record<CongestionLevel, string> = {
  여유: "bg-emerald-100 text-emerald-800",
  보통: "bg-amber-100 text-amber-800",
  혼잡: "bg-orange-200 text-orange-900",
  매우혼잡: "bg-rose-200 text-rose-900",
};

export const LEVEL_FILL: Record<CongestionLevel, string> = {
  여유: "#10b981",
  보통: "#f59e0b",
  혼잡: "#f97316",
  매우혼잡: "#e11d48",
};

export function ParkingPanel({ parking, source }: { parking: ParkingStatus[]; source: "api" | "mock" }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-semibold">지금 공원 혼잡도</h2>
        <span className="text-xs text-slate-500">
          실시간 주차현황 · {parking[0] ? formatKstTime(parking[0].updatedAt) : "-"} 기준
          {source === "mock" && " (데모 데이터)"}
        </span>
      </div>
      <ul className="grid grid-cols-3 gap-2">
        {parking.map((p) => (
          <li key={p.gateId} className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{p.name}</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{Math.round(p.ratio * 100)}%</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full" style={{ width: `${Math.round(p.ratio * 100)}%`, background: LEVEL_FILL[p.level] }} />
            </div>
            <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_STYLE[p.level]}`}>{p.level}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
