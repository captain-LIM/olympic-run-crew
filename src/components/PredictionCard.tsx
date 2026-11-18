import type { Prediction } from "@/lib/prediction";
import { LEVEL_FILL, LEVEL_STYLE } from "./CongestionPanel";

/** 공연일 혼잡 예측 타임라인 (30분 단위) */
export function PredictionCard({ prediction, showLabel }: { prediction: Prediction; showLabel: string }) {
  const { points, busyFrom, crowdFrom, peak, walkWindow } = prediction;
  return (
    <section className="rounded-2xl border border-violet-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold">공연일 혼잡 예측</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${LEVEL_STYLE[peak.level]}`}>최고 {peak.level}</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed">
        {crowdFrom ? (
          <>이 공연은 <b className="text-violet-700">{crowdFrom}부터 관객이 몰리기 시작</b>하고, <b>{peak.label} 전후</b>가 가장 붐빌 것으로 예상돼요.</>
        ) : busyFrom ? (
          <>공원은 <b className="text-violet-700">{busyFrom}부터 붐빌</b> 것으로 예상돼요. 공연 자체로 인한 혼잡은 크지 않아요.</>
        ) : (
          <>공연 전까지 비교적 <b className="text-emerald-700">여유로울</b> 것으로 예상돼요.</>
        )}
      </p>
      {walkWindow && (
        <p className="mt-2 rounded-lg bg-violet-50 p-2 text-sm text-violet-900">
          🚶 추천 산책 시간 <b>{walkWindow.from}~{walkWindow.to}</b> <span className="text-xs">(출발 가능 구간 중 가장 한산)</span>
        </p>
      )}

      <div className="mt-3" role="img" aria-label={`시간대별 예측 혼잡도, ${peak.label}에 최고`}>
        <div className="flex h-20 items-end gap-[2px]">
          {points.map((p) => (
            <div
              key={p.minute}
              title={`${p.label} · ${p.level} (${Math.round(p.index * 100)})`}
              className={`flex-1 rounded-t ${p.label === showLabel ? "ring-2 ring-slate-900 ring-offset-1" : ""}`}
              style={{ height: `${Math.max(p.index * 100, 3)}%`, background: LEVEL_FILL[p.level] }}
            />
          ))}
        </div>
        <div className="mt-1 flex gap-[2px] text-[10px] text-slate-500">
          {points.map((p) => (
            <span key={p.minute} className="flex-1 text-center">{p.minute % 120 === 0 ? p.label.slice(0, 2) : ""}</span>
          ))}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        주차장 혼잡 이력(요일·시간대)과 공연장 규모(규모계수 {prediction.scale}), 관객 도착 패턴을 합친 추정치예요. 검은 테두리는 공연 시작 시각.
      </p>
    </section>
  );
}
