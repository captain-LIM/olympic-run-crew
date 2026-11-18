"use client";

import { useState } from "react";
import type { ReportReason } from "@/lib/types";

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "harassment", label: "괴롭힘·불쾌한 접근" },
  { value: "abuse", label: "욕설·혐오 표현" },
  { value: "unsafe", label: "안전 위협·위험 행동" },
  { value: "spam", label: "광고·도배" },
  { value: "other", label: "기타" },
];

/** 신고 + 선택적 차단 다이얼로그 */
export function ReportDialog({
  target,
  crewId,
  messageId,
  onClose,
  onBlocked,
}: {
  target: { userId: number; nickname: string };
  crewId: string;
  messageId?: number;
  onClose: () => void;
  onBlocked?: (userId: number) => void;
}) {
  const [reason, setReason] = useState<ReportReason>("harassment");
  const [detail, setDetail] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ crewId, targetUserId: target.userId, messageId, reason, detail }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setResult(data.error ?? "신고에 실패했어요.");
    }
    if (alsoBlock) {
      await fetch("/api/blocks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: target.userId }) });
      onBlocked?.(target.userId);
    }
    setBusy(false);
    setResult(data.duplicate ? "이미 신고한 내용이에요." : `신고가 접수됐어요.${data.hidden ? " 해당 메시지는 가려졌어요." : ""}${alsoBlock ? " 이 사용자를 차단했어요." : ""}`);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`${target.nickname} 신고`} className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">{target.nickname} {messageId ? "메시지 " : ""}신고</h2>
        {result ? (
          <>
            <p className="rounded-lg bg-slate-100 p-3 text-sm">{result}</p>
            <button onClick={onClose} className="w-full rounded-xl bg-slate-900 py-2.5 font-semibold text-white">닫기</button>
          </>
        ) : (
          <>
            <fieldset className="space-y-1.5">
              <legend className="mb-1 text-sm font-medium">사유</legend>
              {REASONS.map((r) => (
                <label key={r.value} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="reason" checked={reason === r.value} onChange={() => setReason(r.value)} /> {r.label}
                </label>
              ))}
            </fieldset>
            <textarea value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={500} rows={3} placeholder="상황을 간단히 적어주세요 (선택)" className="w-full rounded-lg border px-3 py-2 text-sm" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} /> 이 사용자 차단하기 (서로의 채팅이 보이지 않고 다시 매칭되지 않아요)
            </label>
            <p className="text-xs text-slate-500">위급한 상황이면 즉시 112 또는 공원 안내센터에 연락하세요.</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={onClose} className="rounded-xl border border-slate-300 py-2.5 font-semibold">취소</button>
              <button disabled={busy} onClick={submit} className="rounded-xl bg-rose-600 py-2.5 font-semibold text-white disabled:opacity-50">신고하기</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
