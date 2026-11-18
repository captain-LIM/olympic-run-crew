import Link from "next/link";
import { CongestionPanel } from "@/components/CongestionPanel";
import { ShowSearch } from "@/components/ShowSearch";
import { getCongestion } from "@/lib/data/congestion";
import { getShows } from "@/lib/data/shows";
import { MODE_LABEL } from "@/lib/matching";
import { listCrews } from "@/lib/store";
import { formatKstDate, formatKstTime, kstDateString } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { shows, source } = await getShows();
  const congestion = getCongestion();
  const showById = new Map(shows.map((s) => [s.id, s]));

  const open = (await listCrews(undefined, { upcomingOnly: true })).filter((c) => showById.has(c.eventId));
  const openCounts: Record<string, number> = {};
  for (const c of open) openCounts[c.eventId] = (openCounts[c.eventId] ?? 0) + 1;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 p-5 text-white">
        <h1 className="text-2xl font-extrabold leading-snug">공연 전 대기시간,<br />같은 공연 보는 사람들과 한 바퀴</h1>
        <p className="mt-2 text-sm opacity-90">굿즈 사고 남는 1시간, 올림픽공원을 함께 걷고 달릴 번개 크루를 찾아보세요.</p>
      </section>

      {open.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">지금 모집 중인 번개</h2>
          <ul className="space-y-2">
            {open.slice(0, 6).map((c) => {
              const s = showById.get(c.eventId)!;
              return (
                <li key={c.id}>
                  <Link href={`/events/${s.id}`} className="block rounded-2xl border border-violet-200 bg-white p-3.5 hover:border-violet-400">
                    <p className="truncate font-medium">{s.title}</p>
                    <p className="text-xs text-slate-500">
                      {formatKstDate(kstDateString(new Date(c.eventStartAt)))} · {formatKstTime(c.startAt)} 출발 · {MODE_LABEL[c.mode]} · {c.members.length}/{c.capacity}명
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <CongestionPanel data={congestion} />

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-semibold">공연 찾기</h2>
          <span className="text-xs text-slate-500">올림픽공원 대관정보 {shows.length}건{source === "fallback" && " (API 연결 실패 · 기본 목록)"}</span>
        </div>
        <ShowSearch shows={shows} openCounts={openCounts} />
      </section>
    </div>
  );
}
