import { NextResponse } from "next/server";
import { jsonError, readJson, requireUser } from "@/lib/api";
import { blockUser, listBlocks, userExists } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if (auth.res) return auth.res;
  return NextResponse.json({ blocks: await listBlocks(auth.user.id) });
}

/** POST { userId } — 차단하면 서로의 채팅이 보이지 않고, 같은 번개에 매칭·참여되지 않는다 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.res) return auth.res;
  const body = await readJson(req);
  const userId = Number(body?.userId);
  if (!Number.isInteger(userId) || userId === auth.user.id) return jsonError("차단 대상을 확인하세요.", 400);
  if (!(await userExists(userId))) return jsonError("사용자를 찾을 수 없습니다.", 404);
  await blockUser(auth.user.id, userId);
  return NextResponse.json({ ok: true }, { status: 201 });
}
