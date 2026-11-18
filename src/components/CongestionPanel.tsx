import type { CongestionLevel, CongestionSnapshot } from "@/lib/types";

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

const DAY_LABEL = { weekend: "주말", weekday: "평일" } as const;

export function CongestionPanel({ data, showZones = true }: { data: CongestionSnapshot; showZones?: boolean }) {
  const curve = data.curves[data.dayType];
  const peak = [...curve].sort((a, b) => b.index - a.index)[0];
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">지금 시간대 주차 혼잡 이력</h2>
          <p className="text-xs text-slate-500">{DAY_LABEL[data.dayType]} {data.hour}시 전후 기준</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${LEVEL_STYLE[data.level]}`}>{data.level}</span>
      </div>

      <div className="mt-4" role="img" aria-label={`${DAY_LABEL[data.dayType]} 시간대별 혼잡 이력, ${peak?.hour}시가 가장 붐빔`}>
        <div className="flex h-24 items-end gap-1">
          {curve.map((p) => (
            <div key={p.hour} className="flex h-full flex-1 flex-col items-center justify-end" title={`${p.hour}시 · ${p.level}`}>
              <div
                className={`w-full rounded-t ${p.hour === data.hour ? "ring-2 ring-violet-600 ring-offset-1" : ""}`}
                style={{ height: `${Math.max(p.index * 100, 3)}%`, background: LEVEL_FILL[p.level], opacity: p.hour === data.hour ? 1 : 0.75 }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1 text-[10px] text-slate-500">
          {curve.map((p) => (
            <span key={p.hour} className="flex-1 text-center">{p.hour % 2 === 0 ? p.hour : ""}</span>
          ))}
        </div>
      </div>
      {peak && <p className="mt-2 text-xs text-slate-600">{DAY_LABEL[data.dayType]}에는 <b>{peak.hour}시 전후</b>가 가장 붐볐어요. 공연 전 산책은 이 시간을 피하면 좋아요.</p>}

      {showZones && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-violet-700">주차구역별 보기 ({data.zones.length}곳)</summary>
          <ul className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-5">
            {data.zones.map((z) => {
              const n = z.counts.원활 + z.counts.혼잡 + z.counts.만차;
              return (
                <li key={z.zone} className="rounded-lg bg-slate-50 p-2 text-center">
                  <p className="text-xs font-semibold">{z.zone}</p>
                  {n > 0 ? (
                    <span className={`mt-1 inline-block rounded-full px-1.5 text-[11px] ${LEVEL_STYLE[z.level]}`}>{z.counts.만차 > 0 ? `만차 ${z.counts.만차}회` : z.level}</span>
                  ) : (
                    <span className="mt-1 inline-block text-[11px] text-slate-400">기록없음</span>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      )}

      <p className="mt-3 text-[11px] text-slate-400">
        출처: 한국체육산업개발 주차장 혼잡도 정보 ({data.period.from} ~ {data.period.to}, {data.total}건) · 과거 기록 기반 지수
      </p>
    </section>
  );
}
