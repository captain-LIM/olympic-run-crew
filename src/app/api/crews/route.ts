import { NextResponse, type NextRequest } from "next/server";
import { getShow } from "@/lib/data/shows";
import { findMatches, validateTiming } from "@/lib/matching";
import { getCourse } from "@/lib/park";
import { createCrew, listCrews } from "@/lib/store";
import type { AgeGroup } from "@/lib/types";
import { parseDate, parseMode, parsePace, parseProfile } from "@/lib/validate";

export const dynamic = "force-dynamic";

const MAX_DAYS_AHEAD = 90;

/** GET /api/crews?eventId=...[&eventStartAt&mode&pace&startAt&ageGroup] → 목록 또는 매칭 결과 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const eventId = sp.get("eventId") ?? undefined;
  const crews = listCrews(eventId);

  const mode = parseMode(sp.get("mode"));
  const pace = parsePace(sp.get("pace"));
  const startAt = parseDate(sp.get("startAt"));
  const eventStartAt = parseDate(sp.get("eventStartAt"));
  const ageGroup = sp.get("ageGroup") as AgeGroup | null;
  if (eventId && eventStartAt && mode && pace && startAt && ageGroup) {
    return NextResponse.json({ crews: findMatches(crews, { eventId, eventStartAt, mode, pace, startAt, ageGroup }, new Date()) });
  }
  return NextResponse.json({ crews });
}

/** POST /api/crews → 번개 생성 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const profile = parseProfile(body.host);
  if (!profile.ok) return NextResponse.json({ error: profile.error }, { status: 400 });

  const show = await getShow(String(body.eventId));
  if (!show) return NextResponse.json({ error: "공연을 찾을 수 없습니다." }, { status: 404 });

  const mode = parseMode(body.mode);
  const pace = parsePace(body.paceMinPerKm);
  const course = getCourse(String(body.courseId));
  const startAt = parseDate(body.startAt);
  const eventStartAt = parseDate(body.eventStartAt);
  const capacity = Number(body.capacity);
  if (!mode || !pace || !course || !startAt || !eventStartAt) {
    return NextResponse.json({ error: "모드, 페이스, 코스, 시각을 확인하세요." }, { status: 400 });
  }
  if (!course.modes.includes(mode)) return NextResponse.json({ error: "선택한 모드에 맞지 않는 코스입니다." }, { status: 400 });
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 8) {
    return NextResponse.json({ error: "정원은 2~8명입니다." }, { status: 400 });
  }
  if (eventStartAt.getTime() - Date.now() > MAX_DAYS_AHEAD * 86_400_000) {
    return NextResponse.json({ error: `번개는 공연 ${MAX_DAYS_AHEAD}일 전부터 열 수 있습니다.` }, { status: 400 });
  }
  if (startAt.getTime() <= Date.now()) return NextResponse.json({ error: "출발 시각이 이미 지났습니다." }, { status: 400 });

  const timing = validateTiming({ startAt, eventStartAt, course, pace, venueId: show.venueId });
  if (!timing.ok) return NextResponse.json({ error: timing.reason, timing }, { status: 422 });

  const { crew, memberId } = createCrew({ eventId: show.id, mode, paceMinPerKm: pace, courseId: course.id, startAt, eventStartAt, capacity, host: profile.value });
  return NextResponse.json({ crew, memberId }, { status: 201 });
}
