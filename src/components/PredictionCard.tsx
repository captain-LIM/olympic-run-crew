import type { Prediction } from "@/lib/prediction";
import { LEVEL_FILL, LEVEL_STYLE } from "./CongestionPanel";

/** 공연일 혼잡 예측 타임라인 (30분 단위) */
export function PredictionCard({ prediction, showLabel }: { prediction: Prediction; showLabel: string }) {
  const { points, busyFrom, crowdFrom, peak, walkWindow } = prediction;
  return (
    <section className="cell">
      <div className="cell-head">
        <h2 className="t-cell">공연일 혼잡 예측</h2>
        <span className={`tag ${LEVEL_STYLE[peak.level]}`}>최고 {peak.level}</span>
      </div>
      <p className="mt-4 leading-relaxed">
        {crowdFrom ? (
          <>이 공연은 <b>{crowdFrom}부터 관객이 몰리기 시작</b>하고, <b>{peak.label} 전후</b>가 가장 붐빌 것으로 예상돼요.</>
        ) : busyFrom ? (
          <>공원은 <b>{busyFrom}부터 붐빌</b> 것으로 예상돼요. 공연 자체로 인한 혼잡은 크지 않아요.</>
        ) : (
          <>공연 전까지 비교적 <b>여유로울</b> 것으로 예상돼요.</>
        )}
      </p>
      {walkWindow && (
        <p className="note note--warn mt-4">
          추천 산책 시간 <b className="num">{walkWindow.from}~{walkWindow.to}</b> <span className="small !text-ink">(출발 가능 구간 중 가장 한산)</span>
        </p>
      )}

      <details className="mt-4 lg:hidden">
        <summary className="btn-text">시간대별 그래프 보기</summary>
      <div className="mt-5" role="img" aria-label={`시간대별 예측 혼잡도, ${peak.label}에 최고`}>
        <div className="bars">
          {points.map((p) => (
            <div
              key={p.minute}
              title={`${p.label}, ${p.level} (${Math.round(p.index * 100)})`}
              className={`bar ${p.label === showLabel ? "bar--now" : ""}`}
              style={{ height: `${Math.max(p.index * 100, 3)}%`, background: LEVEL_FILL[p.level] }}
            />
          ))}
        </div>
        <div className="axis" aria-hidden="true">
          {points.map((p) => (
            <span key={p.minute}>{p.minute % 120 === 0 ? p.label.slice(0, 2) : ""}</span>
          ))}
        </div>
      </div>
      </details>
      <div className="hidden lg:block">
      <div className="mt-5" role="img" aria-label={`시간대별 예측 혼잡도, ${peak.label}에 최고`}>
        <div className="bars">
          {points.map((p) => (
            <div
              key={p.minute}
              title={`${p.label}, ${p.level} (${Math.round(p.index * 100)})`}
              className={`bar ${p.label === showLabel ? "bar--now" : ""}`}
              style={{ height: `${Math.max(p.index * 100, 3)}%`, background: LEVEL_FILL[p.level] }}
            />
          ))}
        </div>
        <div className="axis" aria-hidden="true">
          {points.map((p) => (
            <span key={p.minute}>{p.minute % 120 === 0 ? p.label.slice(0, 2) : ""}</span>
          ))}
        </div>
      </div>
      </div>
      <p className="small mt-4">
        주차장 혼잡 이력(요일·시간대)과 공연장 규모(규모계수 {prediction.scale}), 관객 도착 패턴을 합친 추정치예요. 굵은 테두리는 공연 시작 시각.
      </p>
    </section>
  );
}
