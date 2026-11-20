"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { MODE_LABEL } from "@/lib/matching";
import { distanceKm } from "@/lib/park";
import { formatKstDate, formatKstTime, kstDateString } from "@/lib/time";
import type { Course, Crew, Member, Show } from "@/lib/types";
import { CourseMap } from "./CourseMap";
import { CrewChat } from "./CrewChat";
import { Mascot } from "./Mascot";
import { RecordCard } from "./RecordCard";
import { ReportDialog } from "./ReportDialog";

type CrewView = Omit<Crew, "members"> & {
  isMember: boolean;
  isHost: boolean;
  memberCount: number;
  members: (Member & { isMe: boolean })[];
};

const CHECKIN_RADIUS_KM = 0.3;

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function fmtCountdown(ms: number) {
  if (ms <= 0) return "출발!";
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  if (m >= 1440) return `${Math.floor(m / 1440)}일 ${Math.floor((m % 1440) / 60)}시간`;
  return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분 ${String(s).padStart(2, "0")}초`;
}

export function CrewRoom({ crewId, course, event, user }: { crewId: string; course: Course; event: Show; user: { id: number } | null }) {
  const router = useRouter();
  const [crew, setCrew] = useState<CrewView | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [reporting, setReporting] = useState<{ userId: number; nickname: string } | null>(null);
  // 이 화면에서 차단한 사용자. 채팅은 그릴 때마다 이 목록으로 거른다 (이미 받아 둔 메시지 포함)
  const [blockedIds, setBlockedIds] = useState<ReadonlySet<number>>(() => new Set());
  const markBlocked = useCallback((userId: number) => {
    setBlockedIds((prev) => (prev.has(userId) ? prev : new Set(prev).add(userId)));
  }, []);
  const now = useNow();

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/crews/${crewId}`, { cache: "no-store" });
    if (res.status === 404) return setGone(true);
    setCrew((await res.json()).crew);
  }, [crewId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  async function patch(body: { checkedIn?: boolean; finished?: boolean }) {
    const res = await fetch(`/api/crews/${crewId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { setMsg(null); setCrew(data.crew); } else setMsg(data.error ?? "처리하지 못했어요.");
  }

  async function share() {
    const url = window.location.href;
    const text = `${event.title} 전에 같이 걸어요! ${formatKstTime(crew!.startAt)} 출발`;
    try {
      if (navigator.share) await navigator.share({ title: "공연 전 한 바퀴", text, url });
      else { await navigator.clipboard.writeText(url); setMsg("링크를 복사했어요. 친구에게 붙여넣어 보내세요."); }
    } catch { /* 공유 취소 */ }
  }

  async function join() {
    setMsg(null);
    const res = await fetch(`/api/crews/${crewId}`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error);
    setCrew(data.crew);
  }

  function checkIn() {
    setMsg(null);
    if (!navigator.geolocation) return setMsg("위치 정보를 쓸 수 없어 수동 체크인을 이용하세요.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const d = distanceKm({ lat: pos.coords.latitude, lng: pos.coords.longitude }, course.meetingPoint);
        if (d <= CHECKIN_RADIUS_KM) patch({ checkedIn: true });
        else setMsg(`집결지에서 ${d < 10 ? `${Math.round(d * 1000)}m` : `${d.toFixed(0)}km`} 떨어져 있어요. 집결지 근처에서 다시 시도하세요.`);
      },
      () => setMsg("위치 권한이 없어요. 수동 체크인을 이용하세요."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function leave() {
    if (!confirm("크루에서 나갈까요?")) return;
    await fetch(`/api/crews/${crewId}`, { method: "DELETE" });
    router.push(`/events/${event.id}`);
  }

  async function block(target: { userId: number; nickname: string }) {
    if (!confirm(`${target.nickname}님을 차단할까요? 서로의 채팅이 보이지 않고 앞으로 같은 번개에 매칭되지 않아요.`)) return;
    const res = await fetch("/api/blocks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: target.userId }) });
    if (res.ok) markBlocked(target.userId);
    setMsg(res.ok ? `${target.nickname}님을 차단했어요. 계정 페이지에서 해제할 수 있어요.` : "차단에 실패했어요.");
  }

  if (gone) return <p className="cell">크루가 해산됐어요. <Link className="lnk" href={`/events/${event.id}`}>공연으로 돌아가기</Link></p>;
  if (!crew) return <p className="cell muted">불러오는 중…</p>;

  const mine = crew.members.find((m) => m.isMe);
  const startMs = new Date(crew.startAt).getTime();
  const showMs = new Date(crew.eventStartAt).getTime();
  const closed = now > showMs + 3 * 3600_000;
  const opensAt = startMs - 30 * 60_000;
  const canCheckIn = now >= opensAt && !closed;

  return (
    <div className="stack">
      <section className="cell cell--ink relative overflow-hidden">
        <Mascot pose="run" priority sizes="260px" className="absolute right-4 top-3 hidden w-32 sm:block lg:right-10 lg:w-36" />
        <p className="text-sm text-rule">{event.title}</p>
        <h1 className="t-title mt-2 !max-w-none">{course.name}, {MODE_LABEL[crew.mode]}</h1>
        <p className="meta mt-3 !text-rule">
          <span>{formatKstTime(crew.startAt)} 출발</span>
          <span>{crew.paceMinPerKm}분/km</span>
          <span>공연 {formatKstTime(crew.eventStartAt)}</span>
        </p>
        <p className="mt-1 text-sm text-rule">{formatKstDate(kstDateString(new Date(crew.startAt)))} · 집결지 {course.meetingPoint.name}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={share} className="btn btn--white btn--sm">링크 공유하기</button>
          {crew.isMember && <a href="#chat" className="btn btn--white btn--sm lg:hidden">채팅 바로가기</a>}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-ink-2 p-4">
            <p className="text-sm text-rule">출발까지</p>
            <p className="figure-xl mt-2 !text-sky-2">{fmtCountdown(startMs - now)}</p>
          </div>
          <div className="rounded-2xl bg-ink-2 p-4">
            <p className="text-sm text-rule">공연 시작까지</p>
            <p className="figure-xl mt-2 !text-sky-2">{fmtCountdown(showMs - now)}</p>
          </div>
        </div>
        {showMs - now < 45 * 60_000 && showMs > now && (
          <p className="note note--warn mt-4 !text-ink font-semibold">입장 시간이 다가와요! 공연장으로 이동하세요.</p>
        )}
      </section>

      {mine && (
        <section className="cell stack-sm" aria-label="내 체크인">
          {!mine.checkedIn && !canCheckIn && (
            <p className="note">{closed ? "체크인 가능 시간이 지났어요." : `체크인은 출발 30분 전(${formatKstTime(new Date(opensAt).toISOString())})부터 열려요.`}</p>
          )}
          {!mine.checkedIn && canCheckIn && (
            <div className="grid gap-3 sm:grid-cols-2">
              <button onClick={checkIn} className="btn btn--solid">위치로 체크인</button>
              <button onClick={() => patch({ checkedIn: true })} className="btn">수동 체크인</button>
            </div>
          )}
          {mine.checkedIn && !mine.finished && (
            <button onClick={() => patch({ finished: true })} className="btn btn--solid btn--block">완주했어요</button>
          )}
          {mine.finished && (
            <Link href={`/venues?v=${event.venueId}&stage=1`} className="cell cell--well flex items-center justify-between gap-4 no-underline hover:bg-accent-3">
              <div>
                <p className="font-display text-xl font-bold">완주 보상 해금!</p>
                <p className="mt-1 text-sm">{event.venueName} 실감형 3D 무대 시점 보러가기</p>
              </div>
              <Mascot pose="cheer" sizes="120px" className="w-24 shrink-0" />
            </Link>
          )}
          {msg && <p role="status" className="note note--warn">{msg}</p>}
        </section>
      )}

      {mine?.finished && (
        <RecordCard crew={{ mode: crew.mode, paceMinPerKm: crew.paceMinPerKm, startAt: crew.startAt, eventStartAt: crew.eventStartAt, memberCount: crew.members.length }} course={course} eventTitle={event.title} />
      )}

      <div className="grid gap-x-[var(--gap-columns)] gap-y-8 lg:grid-cols-12 lg:items-start">
        <div className="stack lg:col-span-6">
          <section className="cell">
            <h2 className="t-cell">집결지 · 코스</h2>
            <div className="mt-4"><CourseMap course={course} venueId={event.venueId} /></div>
            <p className="meta mt-3">
              <span>{course.meetingPoint.name}</span>
              <span>{course.distanceKm}km</span>
            </p>
          </section>

          {!crew.isMember ? (
            <section className="cell cell--well">
              <h2 className="t-cell">크루원 {crew.memberCount}/{crew.capacity}명</h2>
              <p className="small mt-2">멤버 정보와 채팅은 참여한 사람에게만 보여요.</p>
              {user ? (
                <button onClick={join} className="btn btn--solid btn--block mt-5">이 번개 참여하기</button>
              ) : (
                <Link href={`/login?next=${encodeURIComponent(`/crews/${crewId}`)}`} className="btn btn--solid btn--block mt-5">로그인하고 참여하기</Link>
              )}
              {msg && <p className="note note--error mt-3">{msg}</p>}
            </section>
          ) : (
            <section className="cell">
              <h2 className="t-cell">
                크루원 {crew.members.length}/{crew.capacity}
                {crew.teenOnly && <span className="tag tag--blue ml-3 align-middle">10대 전용</span>}
              </h2>
              <ul className="rows mt-4">
                {crew.members.map((m) => (
                  <li key={m.userId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
                    <span className="font-semibold">
                      {m.nickname}
                      {m.isMe && <span className="small ml-2">나</span>}
                      {m.userId === crew.hostId && <span className="small ml-2">방장</span>}
                    </span>
                    <span className="flex items-center gap-2 text-sm">
                      <span className={`tag ${m.finished ? "tag--ink" : m.checkedIn ? "tag--yellow" : ""}`}>{m.finished ? "완주" : m.checkedIn ? "도착" : "이동 중"}</span>
                      {!m.isMe && (
                        <>
                          <button onClick={() => setReporting({ userId: m.userId, nickname: m.nickname })} className="btn-text">신고</button>
                          <button onClick={() => block({ userId: m.userId, nickname: m.nickname })} className="btn-text">차단</button>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {crew.isMember && (
          <div className="stack lg:col-span-6">
            {user && <CrewChat crewId={crewId} myUserId={user.id} closed={closed} blockedIds={blockedIds} onBlocked={markBlocked} />}
            <button onClick={leave} className="btn-text justify-self-start">크루 나가기</button>

          </div>
        )}
      </div>

      <p className="small">안전 수칙: 공개된 장소에서만 만나고, 개인 연락처 교환은 자제하세요. 불편한 상황은 신고하거나 공원 안내센터에 알려주세요.</p>

      {reporting && <ReportDialog target={reporting} crewId={crewId} onClose={() => setReporting(null)} onBlocked={markBlocked} />}
    </div>
  );
}
