import type { CongestionLevel, CongestionSnapshot } from "@/lib/types";

/** 혼잡 단계 → 태그 클래스 (여유는 외곽선만, 보통은 노랑, 혼잡은 빨강, 매우혼잡은 잉크) */
export const LEVEL_STYLE: Record<CongestionLevel, string> = {
  여유: "tag--sky",
  보통: "tag--yellow",
  혼잡: "tag--red",
  매우혼잡: "tag--ink",
};

export const LEVEL_FILL: Record<CongestionLevel, string> = {
  여유: "var(--color-sky-2)",
  보통: "var(--color-sun)",
  혼잡: "var(--color-accent-2)",
  매우혼잡: "var(--color-ink)",
};

const DAY_LABEL = { weekend: "주말", weekday: "평일" } as const;

export function CongestionPanel({ data, showZones = true, tone = "white" }: { data: CongestionSnapshot; showZones?: boolean; tone?: "white" | "lime" }) {
  const curve = data.curves[data.dayType];
  const peak = [...curve].sort((a, b) => b.index - a.index)[0];
  return (
    <section className={tone === "lime" ? "cell cell--lime" : "cell"}>
      <div className="cell-head">
        <div>
          <h2 className="t-cell">지금 시간대 주차 혼잡 이력</h2>
          <p className="small mt-1">{DAY_LABEL[data.dayType]} {data.hour}시 전후 기준</p>
        </div>
        <span className={`tag ${LEVEL_STYLE[data.level]}`}>{data.level}</span>
      </div>

      <div className="mt-5" role="img" aria-label={`${DAY_LABEL[data.dayType]} 시간대별 혼잡 이력, ${peak?.hour}시가 가장 붐빔`}>
        <div className="bars">
          {curve.map((p) => (
            <div
              key={p.hour}
              className={`bar ${p.hour === data.hour ? "bar--now" : ""}`}
              title={`${p.hour}시, ${p.level}`}
              style={{ height: `${Math.max(p.index * 100, 3)}%`, background: LEVEL_FILL[p.level] }}
            />
          ))}
        </div>
        <div className="axis" aria-hidden="true">
          {curve.map((p) => (
            <span key={p.hour}>{p.hour % 2 === 0 ? p.hour : ""}</span>
          ))}
        </div>
      </div>
      {peak && <p className="mt-4 text-sm">{DAY_LABEL[data.dayType]}에는 <b>{peak.hour}시 전후</b>가 가장 붐볐어요. 공연 전 산책은 이 시간을 피하면 좋아요.</p>}

      {showZones && (
        <details className="mt-4">
          <summary className="btn-text inline-flex cursor-pointer items-center">주차구역별 보기 ({data.zones.length}곳)</summary>
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {data.zones.map((z) => {
              const n = z.counts.원활 + z.counts.혼잡 + z.counts.만차;
              return (
                <li key={z.zone} className="rounded-xl bg-paper-2 p-2 text-center">
                  <p className="text-sm font-semibold">{z.zone}</p>
                  {n > 0 ? (
                    <span className={`tag mt-1 ${LEVEL_STYLE[z.level]}`}>{z.counts.만차 > 0 ? `만차 ${z.counts.만차}회` : z.level}</span>
                  ) : (
                    <span className="small mt-1 inline-block">기록없음</span>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      )}

      <p className="small mt-4">
        출처: 한국체육산업개발 주차장 혼잡도 정보 ({data.period.from} ~ {data.period.to}, {data.total}건). 과거 기록 기반 지수
      </p>
    </section>
  );
}
