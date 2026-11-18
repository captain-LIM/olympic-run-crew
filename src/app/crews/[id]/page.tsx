import { notFound } from "next/navigation";
import { CrewRoom } from "@/components/CrewRoom";
import { currentUser } from "@/lib/auth";
import { getShow } from "@/lib/data/shows";
import { getCourse } from "@/lib/park";
import { getCrew } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function CrewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const crew = await getCrew(id);
  if (!crew) notFound();
  const [show, course, user] = [await getShow(crew.eventId), getCourse(crew.courseId), await currentUser()];
  if (!show || !course) notFound();
  return <CrewRoom crewId={crew.id} course={course} event={show} user={user && { id: user.id }} />;
}
