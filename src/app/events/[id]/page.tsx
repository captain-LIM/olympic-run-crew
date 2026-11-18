import Link from "next/link";
import { notFound } from "next/navigation";
import { CongestionPanel } from "@/components/CongestionPanel";
import { CrewFinder } from "@/components/CrewFinder";
import { getCongestion } from "@/lib/data/congestion";
import { getShow } from "@/lib/data/shows";
import { getVenue3D } from "@/lib/data/venue3d";
import { listCrews } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const show = await getShow(id);
  if (!show) notFound();
  const congestion = getCongestion();
  const has3d = getVenue3D().some((v) => v.venueId === show.venueId);
  const openCount = listCrews(show.id).filter((c) => new Date(c.startAt).getTime() > Date.now()).length;

  return (
    <div className="space-y-4">
      <Link href="/" className="text-sm text-slate-500">← 공연 찾기</Link>
      <section>
        <p className="text-sm text-violet-700">{show.place}</p>
        <h1 className="text-2xl font-extrabold">{show.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{openCount > 0 ? `모집 중인 번개 ${openCount}개` : "아직 열린 번개가 없어요"}</p>
      </section>
      <CrewFinder show={show} curves={congestion.curves} />
      <CongestionPanel data={congestion} showZones={false} />
      {has3d && (
        <Link href={`/venues?v=${show.venueId}`} className="block rounded-2xl border border-slate-200 bg-white p-4 text-center text-sm">
          🏟️ {show.venueName} 실감형 3D로 미리 보기 →
        </Link>
      )}
    </div>
  );
}
