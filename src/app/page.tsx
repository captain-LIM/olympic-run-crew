import Link from "next/link";
import { CongestionPanel } from "@/components/CongestionPanel";
import { Mascot } from "@/components/Mascot";
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
    <div className="space-y-[var(--section-gap-s)]">
      <section className="hero-fill hero-panel grid content-center items-center gap-x-[var(--gap-columns)] gap-y-10 lg:grid-cols-12">
        <div className="relative z-[1] lg:col-span-5">
          <h1 className="t-page">같은 공연 보는 사람들과 한 바퀴</h1>
          <p className="lead mt-6">굿즈 사고 남는 1시간, 올림픽공원을 함께 걷고 달릴 번개 크루를 찾아보세요.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#shows" className="btn btn--solid">공연 찾기</a>
          </div>
        </div>
        <div className="lg:col-span-7">
          <Mascot pose="hero" priority sizes="(min-width: 1024px) 640px, 100vw" className="mx-auto w-full max-w-[44rem] lg:w-[110%] lg:max-w-none lg:-ml-[6%]" />
        </div>
      </section>

      <section aria-label="주차 혼잡 이력" className="band-sky grid items-center gap-x-[var(--gap-columns)] gap-y-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <CongestionPanel data={congestion} showZones={false} />
        </div>
        <div className="flex justify-center lg:col-span-5">
          <Mascot pose="peek" sizes="(min-width: 1024px) 320px, 60vw" className="w-48 sm:w-64 lg:w-72" />
        </div>
      </section>

      {open.length > 0 && (
        <section aria-labelledby="open-title">
          <h2 id="open-title" className="t-title mb-6">지금 모집 중인 번개</h2>
          <ul className="rows">
            {open.slice(0, 6).map((c, i) => {
              const s = showById.get(c.eventId)!;
              return (
                <li key={c.id}>
                  <Link href={`/events/${s.id}`} className="row-link">
                    <span className="num-dot" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                    <div className="min-w-0">
                      <p className="row-title">{s.title}</p>
                      <p className="meta mt-1">
                        <span>{formatKstDate(kstDateString(new Date(c.eventStartAt)))}</span>
                        <span>{formatKstTime(c.startAt)} 출발</span>
                        <span>{MODE_LABEL[c.mode]}</span>
                      </p>
                    </div>
                    <span className="tag tag--blue">{c.members.length}/{c.capacity}명</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section id="shows" aria-labelledby="shows-title" className="scroll-mt-24">
        <div className="mb-6 flex items-end justify-between gap-6">
          <div>
            <h2 id="shows-title" className="t-title">공연 찾기</h2>
            <p className="small mt-2">올림픽공원 대관정보 {shows.length}건{source === "fallback" && " (API 연결 실패, 기본 목록)"}</p>
          </div>
          <Mascot pose="run" sizes="200px" className="w-28 shrink-0 sm:w-40" />
        </div>
        <ShowSearch shows={shows} openCounts={openCounts} />
      </section>
    </div>
  );
}
