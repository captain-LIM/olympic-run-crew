import { notFound } from "next/navigation";
import { CrewRoom } from "@/components/CrewRoom";
import { getShow } from "@/lib/data/shows";
import { getCourse } from "@/lib/park";
import { getCrew } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function CrewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const crew = getCrew(id);
  if (!crew) notFound();
  const [show, course] = [await getShow(crew.eventId), getCourse(crew.courseId)];
  if (!show || !course) notFound();
  return <CrewRoom crewId={crew.id} course={course} event={show} />;
}
