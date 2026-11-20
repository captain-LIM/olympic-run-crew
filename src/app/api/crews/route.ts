import { NextResponse, type NextRequest } from "next/server";
import { jsonError, readJson, requireUser } from "@/lib/api";
import { getShow } from "@/lib/data/shows";
import { findMatches, validateTiming } from "@/lib/matching";
import { getCourse } from "@/lib/park";
import { blockedRelations, createCrew, listCrews } from "@/lib/store";
import { parseDate, parseMode, parsePace } from "@/lib/validate";

export const dynamic = "force-dynamic";

const MAX_DAYS_AHEAD = 90;

/** GET /api/crews?eventId=...&eventStartAt&mode&pace&startAt → 내 조건에 맞는 번개 (로그인 필요) */
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (auth.res) return auth.res;
  const sp = req.nextUrl.searchParams;
  const eventId = sp.get("eventId");
  const mode = parseMode(sp.get("mode"));
  const pace = parsePace(sp.get("pace"));
  const startAt = parseDate(sp.get("startAt"));
  const eventStartAt = parseDate(sp.get("eventStartAt"));
  if (!eventId || !mode || !pace || !startAt || !eventStartAt) return jsonError("검색 조건을 확인하세요.", 400);

  const blocked = await blockedRelations(auth.user.id);
  const crews = (await listCrews(eventId, { upcomingOnly: true }))
    .filter((c) => !c.members.some((m) => m.userId === auth.user.id || blocked.has(m.userId)));
  return NextResponse.json({ crews: findMatches(crews, { eventId, eventStartAt, mode, pace, startAt, ageGroup: auth.user.ageGroup }, new Date()) });
}

/** POST /api/crews → 번개 생성 (로그인 필요) */
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.res) return auth.res;
  const body = await readJson(req);
  if (!body) return jsonError("잘못된 요청입니다.", 400);

  const show = await getShow(String(body.eventId));
  if (!show) return jsonError("공연을 찾을 수 없습니다.", 404);

  const mode = parseMode(body.mode);
  const pace = parsePace(body.paceMinPerKm);
  const course = getCourse(String(body.courseId));
  const startAt = parseDate(body.startAt);
  const eventStartAt = parseDate(body.eventStartAt);
  const capacity = Number(body.capacity);
  if (!mode || !pace || !course || !startAt || !eventStartAt) return jsonError("모드, 페이스, 코스, 시각을 확인하세요.", 400);
  if (!course.modes.includes(mode)) return jsonError("선택한 모드에 맞지 않는 코스입니다.", 400);
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 8) return jsonError("정원은 2~8명입니다.", 400);
  if (eventStartAt.getTime() - Date.now() > MAX_DAYS_AHEAD * 86_400_000) return jsonError(`번개는 공연 ${MAX_DAYS_AHEAD}일 전부터 열 수 있습니다.`, 400);
  if (startAt.getTime() <= Date.now()) return jsonError("출발 시각이 이미 지났습니다.", 400);

  const timing = validateTiming({ startAt, eventStartAt, course, pace, venueId: show.venueId });
  if (!timing.ok) return NextResponse.json({ error: timing.reason, timing }, { status: 422 });

  const r = await createCrew({ eventId: show.id, mode, paceMinPerKm: pace, courseId: course.id, startAt, eventStartAt, capacity }, auth.user);
  if (r.error || !r.crew) return jsonError(r.error ?? "번개를 열 수 없습니다.", 409);
  return NextResponse.json({ crew: r.crew }, { status: 201 });
}
