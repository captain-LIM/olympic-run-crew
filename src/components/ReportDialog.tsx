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
    let blockNote = "";
    if (alsoBlock) {
      // 차단 저장이 실제로 성공했을 때만 화면에서도 차단한 것으로 처리한다
      const blockRes = await fetch("/api/blocks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: target.userId }) }).catch(() => null);
      if (blockRes?.ok) {
        onBlocked?.(target.userId);
        blockNote = " 이 사용자를 차단했어요.";
      } else {
        blockNote = " 차단은 실패했어요. 잠시 후 다시 시도해 주세요.";
      }
    }
    setBusy(false);
    const reportNote = data.duplicate ? "이미 신고한 내용이에요." : `신고가 접수됐어요.${data.hidden ? " 해당 메시지는 가려졌어요." : ""}`;
    setResult(reportNote + blockNote);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`${target.nickname} 신고`} className="dialog-scrim" onClick={onClose}>
      <div className="dialog stack-sm" onClick={(e) => e.stopPropagation()}>
        <h2 className="t-cell">{target.nickname} {messageId ? "메시지 " : ""}신고</h2>
        {result ? (
          <>
            <p className="note">{result}</p>
            <button onClick={onClose} className="btn btn--solid btn--block">닫기</button>
          </>
        ) : (
          <>
            <fieldset className="space-y-2 border-0 p-0">
              <legend className="label mb-2">사유</legend>
              {REASONS.map((r) => (
                <label key={r.value} className="check">
                  <input type="radio" name="reason" checked={reason === r.value} onChange={() => setReason(r.value)} /> {r.label}
                </label>
              ))}
            </fieldset>
            <textarea value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={500} rows={3} placeholder="상황을 간단히 적어주세요 (선택)" aria-label="신고 상세" className="field" />
            <label className="check">
              <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} /> 이 사용자 차단하기 (서로의 채팅이 보이지 않고 다시 매칭되지 않아요)
            </label>
            <p className="small">위급한 상황이면 즉시 112 또는 공원 안내센터에 연락하세요.</p>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button onClick={onClose} className="btn">취소</button>
              <button disabled={busy} onClick={submit} className="btn btn--danger">신고하기</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
