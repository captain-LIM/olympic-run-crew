import Link from "next/link";
import { redirect } from "next/navigation";
import { BlockList } from "@/components/BlockList";
import { Mascot } from "@/components/Mascot";
import { currentUser } from "@/lib/auth";
import { KOPIS_ID_PREFIX } from "@/lib/data/kopis";
import { getShow, getShows } from "@/lib/data/shows";
import { query } from "@/lib/db";
import { VENUES } from "@/lib/park";
import { computeBadges, summarizeFinished } from "@/lib/badges";
import { COURSES } from "@/lib/park";
import { finishedCrewRows, listBlocks, unlockedVenues } from "@/lib/store";
import { formatKstDate, formatKstTime, kstDateString } from "@/lib/time";
import type { VenueId } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "내 계정 | 공연 전 한 바퀴" };

const AGE_LABEL = { "14-19": "10대", "20s": "20대", "30s": "30대", "40+": "40대 이상" } as const;

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/account");

  const [blocks, unlocked, myCrews, { shows }, finished] = await Promise.all([
    listBlocks(user.id),
    unlockedVenues(user.id),
    query<{ id: string; event_id: string; start_at: Date; event_start_at: Date }>(
      `SELECT c.id, c.event_id, c.start_at, c.event_start_at FROM crews c
         JOIN crew_members m ON m.crew_id = c.id
        WHERE m.user_id = ? ORDER BY c.start_at DESC LIMIT 20`,
      [user.id],
    ),
    getShows(),
    finishedCrewRows(user.id),
  ]);
  // 끝난 KOPIS 공연은 목록(앞으로 90일)에 없으므로 공연별로 찾는다 (공연 상세는 캐시됨)
  const known = new Set(shows.map((s) => s.id));
  const missing = [...new Set([...myCrews.map((c) => c.event_id), ...finished.map((f) => f.eventId)])].filter((id) => id.startsWith(KOPIS_ID_PREFIX) && !known.has(id));
  for (const s of await Promise.all(missing.map((id) => getShow(id)))) if (s) shows.push(s);
  const title = new Map(shows.map((s) => [s.id, s.title]));
  const venueOf = new Map(shows.map((s) => [s.id, s.venueId as string]));
  const stats = summarizeFinished(finished.map((f) => ({ venueId: venueOf.get(f.eventId), distanceKm: COURSES.find((c) => c.id === f.courseId)?.distanceKm ?? 0 })));
  const badges = computeBadges(stats);
  const venueList = Object.values(VENUES).filter((v) => v.id !== "other");

  return (
    <div className="stack">
      <section className="band-sky flex items-end justify-between gap-6">
        <div className="min-w-0">
          <h1 className="t-page">{user.nickname}</h1>
          <p className="meta mt-4 !text-ink-2">
            <span>{user.email}</span>
            <span>{AGE_LABEL[user.ageGroup]}</span>
          </p>
        </div>
        <Mascot pose="rest" priority sizes="260px" className="hidden w-44 shrink-0 sm:block lg:w-56" />
      </section>

      <div className="grid gap-x-[var(--gap-columns)] gap-y-8 lg:grid-cols-12 lg:items-start">
      <section className="cell lg:col-span-7">
        <h2 className="t-cell">내 번개</h2>
        {myCrews.length === 0 ? (
          <p className="mt-3 text-sm muted">아직 참여한 번개가 없어요.</p>
        ) : (
          <ul className="rows mt-4">
            {myCrews.map((c, i) => (
              <li key={c.id}>
                <Link href={`/crews/${c.id}`} className="row-link">
                  <span className="num-dot" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                  <div className="min-w-0">
                  <p className="row-title">{title.get(c.event_id) ?? "공연"}</p>
                  <p className="meta mt-1">
                    <span>{formatKstDate(kstDateString(c.event_start_at))}</span>
                    <span>{formatKstTime(c.start_at)} 출발</span>
                  </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="stack lg:col-span-5">
      <section className="cell cell--well">
        <h2 className="t-cell">해금한 무대 시점</h2>
        {unlocked.length ? (
          <ul className="chip-row mt-4">
            {unlocked.map((v) => (
              <li key={v}>
                <Link href={`/venues?v=${v}&stage=1`} className="btn btn--sm">{VENUES[v as VenueId]?.name ?? v} 무대 시점 보기</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm">크루를 완주하면 공연장 3D &lsquo;무대 시점&rsquo;이 열려요.</p>
        )}
      </section>

      <section className="cell" aria-labelledby="records">
        <h2 id="records" className="t-cell">나의 기록</h2>
        <p className="meta mt-3"><span>완주 {stats.count}회</span><span>누적 {stats.km}km</span><span>공연장 {stats.venues.length}곳</span></p>
        <ul className="mt-4 grid grid-cols-2 gap-3">
          {badges.map((b) => (
            <li key={b.id} className={`rounded-2xl border p-3 ${b.earned ? "border-accent bg-accent-3" : "border-rule"}`}>
              <p className="font-semibold">{b.name}</p>
              <p className="small mt-1">{b.desc}</p>
              <p className="mt-2"><span className={`tag ${b.earned ? "tag--blue" : ""}`}>{b.earned ? "획득" : b.progress}</span></p>
            </li>
          ))}
        </ul>
        <h3 className="label mt-5">공연장 완주 지도</h3>
        <ul className="chip-row mt-2 !flex-wrap">
          {venueList.map((v) => (
            <li key={v.id} className={`chip ${stats.venues.includes(v.id) ? "chip--on" : ""}`}>{stats.venues.includes(v.id) ? "✓ " : ""}{v.name}</li>
          ))}
        </ul>
      </section>

      <section className="cell">
        <h2 className="t-cell mb-3">차단한 사용자</h2>
        <BlockList initial={blocks} />
      </section>
      </div>
      </div>
    </div>
  );
}
