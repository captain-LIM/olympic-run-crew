import Link from "next/link";
import { redirect } from "next/navigation";
import { BlockList } from "@/components/BlockList";
import { currentUser } from "@/lib/auth";
import { getShows } from "@/lib/data/shows";
import { query } from "@/lib/db";
import { VENUES } from "@/lib/park";
import { listBlocks, unlockedVenues } from "@/lib/store";
import { formatKstDate, formatKstTime, kstDateString } from "@/lib/time";
import type { VenueId } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "내 계정 | 공연 전 한 바퀴" };

const AGE_LABEL = { "14-19": "10대", "20s": "20대", "30s": "30대", "40+": "40대 이상" } as const;

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/account");

  const [blocks, unlocked, myCrews, { shows }] = await Promise.all([
    listBlocks(user.id),
    unlockedVenues(user.id),
    query<{ id: string; event_id: string; start_at: Date; event_start_at: Date }>(
      `SELECT c.id, c.event_id, c.start_at, c.event_start_at FROM crews c
         JOIN crew_members m ON m.crew_id = c.id
        WHERE m.user_id = ? ORDER BY c.start_at DESC LIMIT 20`,
      [user.id],
    ),
    getShows(),
  ]);
  const title = new Map(shows.map((s) => [s.id, s.title]));

  return (
    <div className="space-y-4">
      <section>
        <h1 className="text-2xl font-extrabold">{user.nickname}</h1>
        <p className="text-sm text-slate-500">{user.email} · {AGE_LABEL[user.ageGroup]}</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">내 번개</h2>
        {myCrews.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">아직 참여한 번개가 없어요.</p>
        ) : (
          <ul className="mt-2 divide-y">
            {myCrews.map((c) => (
              <li key={c.id}>
                <Link href={`/crews/${c.id}`} className="block py-2">
                  <p className="truncate font-medium">{title.get(c.event_id) ?? "공연"}</p>
                  <p className="text-xs text-slate-500">{formatKstDate(kstDateString(c.event_start_at))} · {formatKstTime(c.start_at)} 출발</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">해금한 무대 시점</h2>
        <p className="mt-1 text-sm">
          {unlocked.length ? unlocked.map((v) => VENUES[v as VenueId]?.name ?? v).join(", ") : "크루를 완주하면 공연장 3D '무대 시점'이 열려요."}
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-1 font-semibold">차단한 사용자</h2>
        <BlockList initial={blocks} />
      </section>
    </div>
  );
}
