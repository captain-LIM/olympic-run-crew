import { VenueViewer } from "@/components/VenueViewer";
import { getVenue3D } from "@/lib/data/venue3d";
import type { VenueId } from "@/lib/types";

export const metadata = { title: "공연장 실감형 3D | 공연 전 한 바퀴" };

export default async function VenuesPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const venues = getVenue3D();
  const initial = venues.some((x) => x.venueId === v) ? (v as VenueId) : undefined;
  return (
    <div className="space-y-4">
      <section>
        <h1 className="text-2xl font-extrabold">공연장 실감형 3D</h1>
        <p className="text-sm text-slate-500">공연장을 미리 둘러보고, 크루 완주로 &lsquo;무대 시점&rsquo;을 해금하세요.</p>
      </section>
      <VenueViewer venues={venues} initial={initial} />
    </div>
  );
}
