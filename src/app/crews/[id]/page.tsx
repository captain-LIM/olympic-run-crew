import { notFound } from "next/navigation";
import { CrewRoom } from "@/components/CrewRoom";
import { currentUser } from "@/lib/auth";
import { getShow, unknownShow } from "@/lib/data/shows";
import { getCourse } from "@/lib/park";
import { getCrew } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function CrewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const crew = await getCrew(id);
  if (!crew) notFound();
  const [show, course, user] = [await getShow(crew.eventId), getCourse(crew.courseId), await currentUser()];
  if (!course) notFound();
  // 번개는 있는데 공연 정보만 못 찾으면(KOPIS·대관정보 장애) 채팅·체크인은 쓸 수 있게 둔다
  return <CrewRoom crewId={crew.id} course={course} event={show ?? unknownShow(crew.eventId)} user={user && { id: user.id }} />;
}
