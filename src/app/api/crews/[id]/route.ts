import { NextResponse, type NextRequest } from "next/server";
import { getCrew, joinCrew, leaveCrew, updateMember } from "@/lib/store";
import { parseProfile } from "@/lib/validate";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 멤버 ID는 본인 확인 토큰 역할이므로 본인 것만 노출한다 */
function publicCrew(crew: NonNullable<ReturnType<typeof getCrew>>, me?: string | null) {
  return {
    ...crew,
    members: crew.members.map((m) => ({ ...m, id: m.id === me ? m.id : undefined, isMe: m.id === me })),
  };
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const crew = getCrew(id);
  if (!crew) return NextResponse.json({ error: "크루를 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ crew: publicCrew(crew, req.nextUrl.searchParams.get("me")) });
}

/** 참여 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const profile = parseProfile(await req.json().catch(() => null));
  if (!profile.ok) return NextResponse.json({ error: profile.error }, { status: 400 });
  const r = joinCrew(id, profile.value);
  if (r.error || !r.crew) return NextResponse.json({ error: r.error }, { status: 409 });
  return NextResponse.json({ crew: publicCrew(r.crew, r.memberId), memberId: r.memberId });
}

/** 체크인 / 완주 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { memberId?: string; checkedIn?: boolean; finished?: boolean } | null;
  if (!body?.memberId) return NextResponse.json({ error: "memberId가 필요합니다." }, { status: 400 });
  const crew = updateMember(id, body.memberId, {
    checkedIn: typeof body.checkedIn === "boolean" ? body.checkedIn : undefined,
    finished: typeof body.finished === "boolean" ? body.finished : undefined,
  });
  if (!crew) return NextResponse.json({ error: "멤버를 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ crew: publicCrew(crew, body.memberId) });
}

/** 나가기 */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const me = req.nextUrl.searchParams.get("me");
  if (!me) return NextResponse.json({ error: "memberId가 필요합니다." }, { status: 400 });
  leaveCrew(id, me);
  return NextResponse.json({ ok: true });
}
