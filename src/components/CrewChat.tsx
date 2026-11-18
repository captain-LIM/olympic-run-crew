"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatKstTime } from "@/lib/time";
import type { ChatMessage } from "@/lib/types";
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

  const poll = useCallback(async () => {
    const res = await fetch(`/api/crews/${crewId}/messages?after=${lastId.current}`, { cache: "no-store" });
    if (!res.ok) return;
    const { messages: fresh } = (await res.json()) as { messages: ChatMessage[] };
    if (fresh.length) {
      lastId.current = fresh[fresh.length - 1].id;
      setMessages((prev) => [...prev, ...fresh.filter((m) => !prev.some((p) => p.id === m.id))]);
    }
  }, [crewId]);

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
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="font-semibold">크루 채팅</h2>
      <ul ref={listRef} className="mt-2 h-64 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3" aria-live="polite">
        {messages.length === 0 && <li className="pt-20 text-center text-sm text-slate-400">첫 인사를 남겨보세요 👋 집결지에서 어떤 옷을 입고 있는지 알려주면 찾기 쉬워요.</li>}
        {messages.map((m) => {
          const mine = m.userId === myUserId;
          return (
            <li key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              {!mine && <span className="text-xs text-slate-500">{m.nickname}</span>}
              <div className={`group flex items-end gap-1 ${mine ? "flex-row-reverse" : ""}`}>
                <p className={`max-w-[75vw] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm sm:max-w-xs ${mine ? "bg-violet-600 text-white" : "bg-white shadow-sm"}`}>{m.body}</p>
                <span className="text-[10px] text-slate-400">{formatKstTime(m.createdAt)}</span>
                {!mine && (
                  <button onClick={() => setReporting(m)} className="text-[10px] text-slate-400 underline hover:text-rose-600" aria-label={`${m.nickname}의 메시지 신고`}>
                    신고
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {closed ? (
        <p className="mt-2 text-center text-sm text-slate-500">종료된 크루라 채팅을 보낼 수 없어요.</p>
      ) : (
        <form onSubmit={send} className="mt-2 flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="메시지 입력" aria-label="메시지 입력" className="min-w-0 flex-1 rounded-xl border px-3 py-2" />
          <button disabled={sending || !text.trim()} className="rounded-xl bg-violet-600 px-4 font-semibold text-white disabled:opacity-40">전송</button>
        </form>
      )}
      {error && <p className="mt-1 text-xs text-rose-700">{error}</p>}
      <p className="mt-2 text-[11px] text-slate-400">연락처·계좌 등 개인정보는 공유하지 마세요. 불편한 메시지는 &lsquo;신고&rsquo;로 알려주세요.</p>
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
