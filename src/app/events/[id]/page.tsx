import Link from "next/link";
import { notFound } from "next/navigation";
import { CrewFinder } from "@/components/CrewFinder";
import { ParkingPanel } from "@/components/ParkingPanel";
import { getParking } from "@/lib/data/parking";
import { getEvent } from "@/lib/data/rentals";
import { listCrews } from "@/lib/store";
import { formatKstDate } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [event, { parking, source }] = await Promise.all([getEvent(id), getParking()]);
  if (!event) notFound();

  return (
    <div className="space-y-4">
      <Link href="/" className="text-sm text-slate-500">← 공연 목록</Link>
      <section>
        <p className="text-sm text-violet-700">{event.venueName}</p>
        <h1 className="text-2xl font-extrabold">{event.title}</h1>
        <p className="text-sm text-slate-500">
          {formatKstDate(event.startDate)}
          {event.endDate !== event.startDate && ` ~ ${formatKstDate(event.endDate)}`}
        </p>
      </section>
      <ParkingPanel parking={parking} source={source} />
      <CrewFinder event={event} parking={parking} initialCrews={listCrews(event.id)} />
      <Link href={`/venues?v=${event.venueId}`} className="block rounded-2xl border border-slate-200 bg-white p-4 text-center text-sm">
        🏟️ {event.venueName} 실감형 3D로 미리 보기 →
      </Link>
    </div>
  );
}
