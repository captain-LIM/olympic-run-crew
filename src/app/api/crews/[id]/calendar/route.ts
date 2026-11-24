import type { NextRequest } from "next/server";
import { jsonError, requireUser } from "@/lib/api";
import { buildIcs, crewCalendarEvent } from "@/lib/calendar";
import { getShow } from "@/lib/data/shows";
import { requestOrigin } from "@/lib/origin";
import { getCourse } from "@/lib/park";
import { getCrew, isMember } from "@/lib/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET: 크루 일정 .ics (크루 멤버만) — 휴대폰 캘린더에 추가하면 출발 30분 전에 알린다 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.res) return auth.res;
  const { id } = await params;
  const crew = await getCrew(id);
  if (!crew || !isMember(crew, auth.user.id)) return jsonError("크루 멤버만 일정을 받을 수 있습니다.", 403);
  const course = getCourse(crew.courseId);
  if (!course) return jsonError("코스를 찾을 수 없습니다.", 404);
  const show = await getShow(crew.eventId);

  // req.nextUrl.origin은 서버 자신의 주소(localhost)가 되므로, 실제 접속 주소를 헤더로 만든다
  const origin = requestOrigin(req.headers, req.nextUrl.origin);
  const ics = buildIcs(crewCalendarEvent({ crew, course, show: { title: show?.title ?? "공연" }, origin }));
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="crew-${crew.id}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
