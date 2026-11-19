import { NextResponse, type NextRequest } from "next/server";
import { jsonError, readJson, requireUser } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { getShow } from "@/lib/data/shows";
import { getCrew, isMember, joinCrew, leaveCrew, updateMember } from "@/lib/store";
import type { Crew } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 비회원·비멤버에게는 인원수만, 멤버에게는 닉네임 등 상세 공개 */
function view(crew: Crew, userId: number | null) {
  const member = userId !== null && isMember(crew, userId);
  return {
    ...crew,
    isMember: member,
    isHost: crew.hostId === userId,
    members: member ? crew.members.map((m) => ({ ...m, isMe: m.userId === userId })) : [],
    memberCount: crew.members.length,
  };
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const crew = await getCrew(id);
  if (!crew) return jsonError("크루를 찾을 수 없습니다.", 404);
  const user = await currentUser();
  return NextResponse.json({ crew: view(crew, user?.id ?? null) });
}

/** 참여 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.res) return auth.res;
  const { id } = await params;
  const r = await joinCrew(id, auth.user);
  if (r.error || !r.crew) return jsonError(r.error ?? "참여할 수 없습니다.", 409);
  return NextResponse.json({ crew: view(r.crew, auth.user.id) });
}

/** 본인 체크인 / 완주 (완주 시 공연장 3D 보상 해금) */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.res) return auth.res;
  const { id } = await params;
  const body = await readJson(req);
  const crew = await getCrew(id);
  if (!crew || !isMember(crew, auth.user.id)) return jsonError("크루 멤버가 아닙니다.", 403);
  const show = await getShow(crew.eventId);
  const now = Date.now();
  const opens = new Date(crew.startAt).getTime() - 30 * 60_000;
  const closes = new Date(crew.eventStartAt).getTime() + 3 * 3600_000;
  const wantsCheckIn = body?.checkedIn === true || body?.finished === true;
  if (wantsCheckIn && now < opens) return jsonError("출발 30분 전부터 체크인할 수 있어요.", 409);
  if (wantsCheckIn && now > closes) return jsonError("체크인 가능 시간이 지났어요.", 409);
  if (body?.finished === true && !crew.members.find((m) => m.userId === auth.user.id)?.checkedIn) return jsonError("먼저 체크인을 해주세요.", 409);
  const updated = await updateMember(
    id,
    auth.user.id,
    {
      checkedIn: typeof body?.checkedIn === "boolean" ? body.checkedIn : undefined,
      finished: typeof body?.finished === "boolean" ? body.finished : undefined,
    },
    show?.venueId,
  );
  if (!updated) return jsonError("멤버를 찾을 수 없습니다.", 404);
  return NextResponse.json({ crew: view(updated, auth.user.id) });
}

/** 나가기 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.res) return auth.res;
  const { id } = await params;
  await leaveCrew(id, auth.user.id);
  return NextResponse.json({ ok: true });
}
