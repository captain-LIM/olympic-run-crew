"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatPeriod } from "@/lib/time";
import type { Show, VenueId } from "@/lib/types";

const FILTERS: { label: string; ids: VenueId[] | null }[] = [
  { label: "전체", ids: null },
  { label: "KSPO DOME", ids: ["kspo-dome"] },
  { label: "올림픽홀", ids: ["olympic-hall"] },
  { label: "핸드볼경기장", ids: ["handball"] },
  { label: "우리금융아트홀", ids: ["woori-art-hall"] },
  { label: "야외", ids: ["other", "88-lawn", "waterside"] },
];

export function ShowSearch({ shows, openCounts }: { shows: Show[]; openCounts: Record<string, number> }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState(0);
  const hasKopis = shows.some((s) => s.kopis);

  const results = useMemo(() => {
    const ids = FILTERS[filter].ids;
    const needle = q.trim().toLowerCase();
    return shows
      .filter((s) => (!ids || ids.includes(s.venueId)) && (!needle || s.title.toLowerCase().includes(needle) || s.place.toLowerCase().includes(needle)))
      .sort((a, b) => (openCounts[b.id] ?? 0) - (openCounts[a.id] ?? 0));
  }, [shows, q, filter, openCounts]);

  return (
    <section>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="공연 이름이나 공연장으로 검색"
        className="field !mt-0"
        aria-label="공연 검색"
      />
      <div className="chip-row mt-3" role="group" aria-label="공연장 필터">
        {FILTERS.map((f, i) => (
          <button key={f.label} onClick={() => setFilter(i)} aria-pressed={i === filter} className="chip">
            {f.label}
          </button>
        ))}
      </div>
      <p className="small mt-5 mb-2" aria-live="polite">{results.length}개 공연. {hasKopis ? "기간이 표시된 예정 공연은 회차를 고르고, 대관정보 공연은 날짜가 없어서 티켓의 날짜와 시각을 입력해요" : "대관정보에는 날짜가 없어서, 공연을 고른 뒤 티켓의 날짜와 시각을 입력해요"}</p>
      <ul className="rows">
        {results.slice(0, 20).map((s, i) => (
          <li key={s.id}>
            <Link href={`/events/${s.id}`} className="row-link">
              <span className="num-dot" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0">
                <p className="row-title">{s.title}</p>
                <p className="small mt-1">{s.place}{s.kopis && ` · ${formatPeriod(s.kopis.from, s.kopis.to)}`}</p>
              </div>
              {openCounts[s.id] ? <span className="tag tag--blue">번개 {openCounts[s.id]}</span> : <span className="small" aria-hidden="true"></span>}
            </Link>
          </li>
        ))}
      </ul>
      {results.length > 20 && <p className="small mt-4">검색어를 입력해 더 좁혀보세요</p>}
    </section>
  );
}
