import { notFound } from "next/navigation";
import { CrewRoom } from "@/components/CrewRoom";
import { getEvent } from "@/lib/data/rentals";
import { getCourse } from "@/lib/park";
import { getCrew } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function CrewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const crew = getCrew(id);
  if (!crew) notFound();
  const [event, course] = [await getEvent(crew.eventId), getCourse(crew.courseId)];
  if (!event || !course) notFound();
  return <CrewRoom crewId={crew.id} course={course} event={event} />;
}
