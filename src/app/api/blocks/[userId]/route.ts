import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api";
import { unblockUser } from "@/lib/store";

export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireUser();
  if (auth.res) return auth.res;
  const userId = Number((await params).userId);
  if (!Number.isInteger(userId)) return jsonError("잘못된 사용자입니다.", 400);
  await unblockUser(auth.user.id, userId);
  return NextResponse.json({ ok: true });
}
