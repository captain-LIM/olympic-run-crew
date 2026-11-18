import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api";
import { getCongestion } from "@/lib/data/congestion";
import { getShow } from "@/lib/data/shows";
import { predictShowDay } from "@/lib/prediction";
import { parseDate } from "@/lib/validate";

/** GET /api/prediction?eventId=...&eventStartAt=ISO → 공연일 시간대별 혼잡 예측 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const show = await getShow(String(sp.get("eventId")));
  const showStart = parseDate(sp.get("eventStartAt"));
  if (!show || !showStart) return jsonError("공연과 시작 시각을 확인하세요.", 400);
  const prediction = predictShowDay({ curves: getCongestion().curves, showStart, venueId: show.venueId });
  return NextResponse.json({ show: { id: show.id, title: show.title, venueName: show.venueName }, prediction });
}
