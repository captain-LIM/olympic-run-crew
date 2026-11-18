import Link from "next/link";
import { ParkingPanel } from "@/components/ParkingPanel";
import { getParking } from "@/lib/data/parking";
import { getEvents } from "@/lib/data/rentals";
import { listCrews, seedIfEmpty } from "@/lib/store";
import { formatKstDate, kstDateString } from "@/lib/time";
import type { PerformanceEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [{ events, source }, { parking, source: parkingSource }] = await Promise.all([getEvents(), getParking()]);
  if (source === "mock") seedIfEmpty(events);

  const today = kstDateString();
  const byDate = new Map<string, PerformanceEvent[]>();
  for (const e of events.slice(0, 30)) {
    const key = e.startDate < today ? today : e.startDate;
    byDate.set(key, [...(byDate.get(key) ?? []), e]);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 p-5 text-white">
        <h1 className="text-2xl font-extrabold leading-snug">공연 전 대기시간,<br />같은 공연 보는 사람들과 한 바퀴</h1>
        <p className="mt-2 text-sm opacity-90">굿즈 사고 남는 1시간, 올림픽공원을 함께 걷고 달릴 번개 크루를 찾아보세요.</p>
      </section>

      <ParkingPanel parking={parking} source={parkingSource} />

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-semibold">다가오는 공연</h2>
          <span className="text-xs text-slate-500">올림픽공원 대관정보{source === "mock" && " (데모 데이터)"}</span>
        </div>
        {events.length === 0 && <p className="rounded-xl bg-white p-4 text-sm text-slate-500">예정된 공연이 없어요.</p>}
        <div className="space-y-4">
          {[...byDate.entries()].map(([date, list]) => (
            <div key={date}>
              <p className="mb-1.5 text-sm font-medium text-slate-500">{date === today ? "오늘" : formatKstDate(date)}</p>
              <ul className="space-y-2">
                {list.map((e) => {
                  const crews = listCrews(e.id);
                  const people = crews.reduce((n, c) => n + c.members.length, 0);
                  return (
                    <li key={e.id}>
                      <Link href={`/events/${e.id}`} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-violet-400">
                        <div>
                          <p className="font-semibold">{e.title}</p>
                          <p className="text-sm text-slate-500">{e.venueName} · {e.estimatedStartTime} 공연(추정)</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-violet-700">번개 {crews.length}</p>
                          <p className="text-xs text-slate-500">{people}명 참여 중</p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
