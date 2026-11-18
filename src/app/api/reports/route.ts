import { NextResponse } from "next/server";
import { jsonError, readJson, requireUser } from "@/lib/api";
import { createReport, getCrew, getMessage, isMember } from "@/lib/store";
import type { ReportReason } from "@/lib/types";

const REASONS: ReportReason[] = ["spam", "abuse", "harassment", "unsafe", "other"];

/** POST { crewId, targetUserId, messageId?, reason, detail? } — 같은 크루 멤버만 신고 가능 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.res) return auth.res;
  const body = await readJson(req);
  if (!body) return jsonError("잘못된 요청입니다.", 400);

  const crewId = String(body.crewId ?? "");
  const targetUserId = Number(body.targetUserId);
  const messageId = body.messageId === undefined || body.messageId === null ? undefined : Number(body.messageId);
  const reason = body.reason as ReportReason;
  const detail = typeof body.detail === "string" ? body.detail.trim().slice(0, 500) : undefined;

  if (!REASONS.includes(reason)) return jsonError("신고 사유를 선택하세요.", 400);
  if (!Number.isInteger(targetUserId) || targetUserId === auth.user.id) return jsonError("신고 대상을 확인하세요.", 400);

  const crew = await getCrew(crewId);
  if (!crew || !isMember(crew, auth.user.id)) return jsonError("같은 크루 멤버만 신고할 수 있습니다.", 403);
  if (messageId !== undefined) {
    const msg = await getMessage(messageId);
    if (!msg || msg.crewId !== crewId || msg.userId !== targetUserId) return jsonError("신고할 메시지를 찾을 수 없습니다.", 404);
  } else if (!isMember(crew, targetUserId)) {
    return jsonError("신고 대상이 이 크루에 없습니다.", 404);
  }

  const r = await createReport({ reporterId: auth.user.id, targetUserId, crewId, messageId, reason, detail });
  return NextResponse.json({ ok: true, ...r }, { status: r.duplicate ? 200 : 201 });
}
