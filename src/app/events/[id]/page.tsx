import Link from "next/link";
import { notFound } from "next/navigation";
import { CongestionPanel } from "@/components/CongestionPanel";
import { CrewFinder } from "@/components/CrewFinder";
import { KopisCredit } from "@/components/KopisCredit";
import { Mascot } from "@/components/Mascot";
import { currentUser } from "@/lib/auth";
import { getCongestion } from "@/lib/data/congestion";
import { getShow } from "@/lib/data/shows";
import { getVenue3D } from "@/lib/data/venue3d";
import { MODE_LABEL } from "@/lib/matching";
import { COURSES } from "@/lib/park";
import { blockedRelations, listCrews } from "@/lib/store";
import { formatKstDate, formatKstTime, formatPeriod, kstDateString } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const show = await getShow(id);
  if (!show) notFound();
  const [user, allCrews] = await Promise.all([currentUser(), listCrews(show.id, { upcomingOnly: true })]);
  const blocked = user ? await blockedRelations(user.id) : new Set<number>();
  const isTeen = user?.ageGroup === "14-19";
  // 10대·성인 분리, 차단 관계 크루 제외 (닉네임은 노출하지 않음)
  const crews = allCrews.filter((c) => c.teenOnly === isTeen && !c.members.some((m) => blocked.has(m.userId)));
  const congestion = getCongestion();
  const has3d = getVenue3D().some((v) => v.venueId === show.venueId);

  return (
    <div className="space-y-12">
      <header className="band-sky flex items-end justify-between gap-6">
        <div className="min-w-0">
          <Link href="/" className="lnk text-sm">공연 찾기</Link>
          <h1 className="t-title mt-4 !max-w-[28ch]">{show.title}</h1>
          <p className="meta mt-4 !text-ink-2">
            <span>{show.place}</span>
            {show.kopis && <span>{formatPeriod(show.kopis.from, show.kopis.to)}</span>}
            {show.kopis?.runtime && <span>{show.kopis.runtime}</span>}
            <span>{crews.length > 0 ? `모집 중인 번개 ${crews.length}개` : "아직 열린 번개가 없어요"}</span>
          </p>
          {show.kopis && <p className="small mt-2">공연 정보 <KopisCredit /></p>}
        </div>
        <Mascot pose="cheer" priority sizes="220px" className="hidden w-40 shrink-0 sm:block lg:w-52" />
      </header>

      <section aria-labelledby="open-crews" className="cell">
        <h2 id="open-crews" className="t-cell">지금 열려 있는 번개</h2>
        {crews.length === 0 ? (
          <p className="mt-3 text-sm muted">아직 없어요. <a href="#new-crew" className="lnk font-semibold">첫 번개를 열어보세요</a> (로그인 필요)</p>
        ) : (
          <ul className="rows mt-3">
            {crews.slice(0, 8).map((c) => (
              <li key={c.id}>
                <Link href={`/crews/${c.id}`} className="row-link">
                  <div className="min-w-0">
                    <p className="row-title">{formatKstDate(kstDateString(new Date(c.startAt)))} {formatKstTime(c.startAt)} 출발 · {COURSES.find((x) => x.id === c.courseId)?.name}</p>
                    <p className="meta mt-1"><span>{MODE_LABEL[c.mode]} {c.paceMinPerKm}분/km</span></p>
                  </div>
                  <span className="tag tag--blue">{c.members.length}/{c.capacity}명</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CrewFinder show={show} curves={congestion.curves} user={user && { nickname: user.nickname, ageGroup: user.ageGroup }} />

      <div className="grid gap-x-[var(--gap-columns)] gap-y-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <CongestionPanel data={congestion} showZones={false} />
        </div>
        {has3d && (
          <div className="lg:col-span-5">
            <Link href={`/venues?v=${show.venueId}`} className="cell cell--well flex items-center justify-between gap-4 no-underline hover:bg-accent-3">
              <h2 className="t-cell">{show.venueName} 실감형 3D로 미리 보기</h2>
              <Mascot pose="concert" sizes="140px" className="w-24 shrink-0 rounded-2xl sm:w-32" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
