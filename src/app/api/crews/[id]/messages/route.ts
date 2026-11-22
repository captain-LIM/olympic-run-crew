import { NextResponse, type NextRequest } from "next/server";
import { jsonError, readJson, requireUser, tooManyRequests } from "@/lib/api";
import { hitAll, LIMITS } from "@/lib/rateLimit";
import { addMessage, getCrew, isMember, listMessages, MESSAGE_MAX } from "@/lib/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET ?after=<id> : 크루 멤버만, 차단 관계 사용자의 메시지와 숨김 메시지는 제외 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.res) return auth.res;
  const { id } = await params;
  const crew = await getCrew(id);
  if (!crew || !isMember(crew, auth.user.id)) return jsonError("크루 멤버만 채팅을 볼 수 있습니다.", 403);
  const after = Math.max(0, Number(req.nextUrl.searchParams.get("after")) || 0);
  return NextResponse.json({ messages: await listMessages(id, auth.user.id, after) });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.res) return auth.res;
  const { id } = await params;
  const crew = await getCrew(id);
  if (!crew || !isMember(crew, auth.user.id)) return jsonError("크루 멤버만 채팅할 수 있습니다.", 403);
  // 공연 시작 3시간 후에는 채팅 종료
  if (Date.now() > new Date(crew.eventStartAt).getTime() + 3 * 3600_000) return jsonError("종료된 크루입니다.", 410);

  const body = await readJson(req);
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text) return jsonError("메시지를 입력하세요.", 400);
  if (text.length > MESSAGE_MAX) return jsonError(`메시지는 ${MESSAGE_MAX}자 이하로 입력하세요.`, 400);

  // 도배 방지: 사용자별 1초에 1건, 1분에 30건 (DB 기록이라 서버 여러 대에서도 공유)
  const limited = await hitAll([
    [LIMITS.chatSecond, [auth.user.id]],
    [LIMITS.chatMinute, [auth.user.id]],
  ]);
  if (!limited.ok) return tooManyRequests("너무 빠르게 보내고 있어요. 잠시 후 다시 보내 주세요.", limited.retryAfterSec);

  const messageId = await addMessage(id, auth.user.id, text);
  return NextResponse.json({ id: messageId }, { status: 201 });
}
