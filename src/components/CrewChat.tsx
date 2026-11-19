"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatKstTime } from "@/lib/time";
import type { ChatMessage } from "@/lib/types";
import { Mascot } from "./Mascot";
import { ReportDialog } from "./ReportDialog";

const POLL_MS = 3000;

/** 크루 채팅 (3초 간격 폴링). 차단한 사용자의 메시지는 서버에서 제외된다. */
export function CrewChat({ crewId, myUserId, closed }: { crewId: string; myUserId: number; closed: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [reporting, setReporting] = useState<ChatMessage | null>(null);
  const lastId = useRef(0);
  const listRef = useRef<HTMLUListElement>(null);
  const [notify, setNotify] = useState(false);
  const notifyRef = useRef(false);
  notifyRef.current = notify;
  const seeded = useRef(false);

  const poll = useCallback(async () => {
    const res = await fetch(`/api/crews/${crewId}/messages?after=${lastId.current}`, { cache: "no-store" });
    if (!res.ok) return;
    const { messages: fresh } = (await res.json()) as { messages: ChatMessage[] };
    if (fresh.length) {
      lastId.current = fresh[fresh.length - 1].id;
      const incoming = fresh.filter((m) => m.userId !== myUserId);
      if (seeded.current && notifyRef.current && document.hidden && incoming.length && typeof Notification !== "undefined" && Notification.permission === "granted") {
        const last = incoming[incoming.length - 1];
        new Notification(`${last.nickname}: 크루 새 메시지`, { body: last.body.slice(0, 80) });
      }
      setMessages((prev) => [...prev, ...fresh.filter((m) => !prev.some((p) => p.id === m.id))]);
    }
    seeded.current = true;
  }, [crewId, myUserId]);

  async function toggleNotify() {
    if (notify) return setNotify(false);
    if (typeof Notification === "undefined") return setError("이 브라우저는 알림을 지원하지 않아요.");
    const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (perm === "granted") setNotify(true);
    else setError("알림 권한이 꺼져 있어요. 브라우저 설정에서 허용해 주세요.");
  }

  useEffect(() => {
    poll();
    const t = setInterval(poll, POLL_MS);
    return () => clearInterval(t);
  }, [poll]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    const res = await fetch(`/api/crews/${crewId}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body }) });
    setSending(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "전송 실패");
    setText("");
    poll();
  }

  function onBlocked(userId: number) {
    setMessages((prev) => prev.filter((m) => m.userId !== userId));
  }

  return (
    <section id="chat" className="cell scroll-mt-24">
      <div className="cell-head">
        <h2 className="t-cell">크루 채팅</h2>
        <button onClick={toggleNotify} aria-pressed={notify} className="btn-text">{notify ? "알림 끄기" : "새 메시지 알림"}</button>
      </div>
      {notify && <p className="small mt-1">이 탭이 열려 있는 동안 새 메시지를 알려드려요.</p>}
      <ul ref={listRef} className="chat-well mt-4 h-72 space-y-3 overflow-y-auto" aria-live="polite">
        {messages.length === 0 && (
          <li className="flex flex-col items-center gap-3 pt-6 text-center text-sm muted">
            <Mascot pose="phone" sizes="120px" className="w-24" />
            첫 인사를 남겨보세요. 집결지에서 어떤 옷을 입고 있는지 알려주면 찾기 쉬워요.
          </li>
        )}
        {messages.map((m) => {
          const mine = m.userId === myUserId;
          return (
            <li key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              {!mine && <span className="small">{m.nickname}</span>}
              <div className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                <p className={`bubble ${mine ? "bubble--mine" : ""}`}>{m.body}</p>
                <span className="small">{formatKstTime(m.createdAt)}</span>
                {!mine && (
                  <button onClick={() => setReporting(m)} className="btn-text !min-h-[44px] !min-w-[44px] text-xs" aria-label={`${m.nickname}의 메시지 신고`}>
                    신고
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {closed ? (
        <p className="mt-3 text-sm muted">종료된 크루라 채팅을 보낼 수 없어요.</p>
      ) : (
        <form onSubmit={send} className="mt-3 flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="메시지 입력" aria-label="메시지 입력" className="field !mt-0 min-w-0 flex-1" />
          <button disabled={sending || !text.trim()} className="btn btn--solid">전송</button>
        </form>
      )}
      {error && <p className="note note--error mt-2">{error}</p>}
      <p className="small mt-3">연락처·계좌 등 개인정보는 공유하지 마세요. 불편한 메시지는 &lsquo;신고&rsquo;로 알려주세요.</p>
      {reporting && (
        <ReportDialog
          target={{ userId: reporting.userId, nickname: reporting.nickname }}
          crewId={crewId}
          messageId={reporting.id}
          onClose={() => setReporting(null)}
          onBlocked={onBlocked}
        />
      )}
    </section>
  );
}
