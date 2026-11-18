"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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

  const results = useMemo(() => {
    const ids = FILTERS[filter].ids;
    const needle = q.trim().toLowerCase();
    return shows
      .filter((s) => (!ids || ids.includes(s.venueId)) && (!needle || s.title.toLowerCase().includes(needle)))
      .sort((a, b) => (openCounts[b.id] ?? 0) - (openCounts[a.id] ?? 0));
  }, [shows, q, filter, openCounts]);

  return (
    <section>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="보러 가는 공연 이름을 검색하세요"
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
        aria-label="공연 검색"
      />
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f, i) => (
          <button key={f.label} onClick={() => setFilter(i)} className={`shrink-0 rounded-full border px-3 py-1 text-sm ${i === filter ? "border-violet-600 bg-violet-600 text-white" : "border-slate-300 bg-white"}`}>
            {f.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">{results.length}개 공연</p>
      <ul className="mt-1 space-y-2">
        {results.slice(0, 20).map((s) => (
          <li key={s.id}>
            <Link href={`/events/${s.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 transition hover:border-violet-400">
              <div className="min-w-0">
                <p className="truncate font-medium">{s.title}</p>
                <p className="text-xs text-slate-500">{s.place}</p>
              </div>
              {openCounts[s.id] ? (
                <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">번개 {openCounts[s.id]}</span>
              ) : (
                <span className="shrink-0 text-slate-300">›</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      {results.length > 20 &&<p className="mt-2 text-center text-xs text-slate-500">검색어를 입력해 더 좁혀보세요</p>}
    </section>
  );
}
