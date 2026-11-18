"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { MODE_LABEL } from "@/lib/matching";
import { distanceKm } from "@/lib/park";
import { formatKstTime } from "@/lib/time";
import type { Course, Crew, Member, Show } from "@/lib/types";
import { CourseMap } from "./CourseMap";
import { CrewChat } from "./CrewChat";
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
  return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분 ${String(s).padStart(2, "0")}초`;
}

export function CrewRoom({ crewId, course, event, user }: { crewId: string; course: Course; event: Show; user: { id: number } | null }) {
  const router = useRouter();
  const [crew, setCrew] = useState<CrewView | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [reporting, setReporting] = useState<{ userId: number; nickname: string } | null>(null);
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
    if (res.ok) setCrew((await res.json()).crew);
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
    setMsg(res.ok ? `${target.nickname}님을 차단했어요. 계정 페이지에서 해제할 수 있어요.` : "차단에 실패했어요.");
  }

  if (gone) return <p className="rounded-xl bg-white p-6 text-center">크루가 해산됐어요. <Link className="text-violet-700 underline" href={`/events/${event.id}`}>공연으로 돌아가기</Link></p>;
  if (!crew) return <p className="p-6 text-center text-slate-500">불러오는 중…</p>;

  const mine = crew.members.find((m) => m.isMe);
  const startMs = new Date(crew.startAt).getTime();
  const showMs = new Date(crew.eventStartAt).getTime();
  const closed = now > showMs + 3 * 3600_000;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 p-5 text-white">
        <p className="text-sm opacity-80">{event.title}</p>
        <h1 className="mt-1 text-xl font-bold">{course.name} · {MODE_LABEL[crew.mode]}</h1>
        <p className="mt-1 text-sm opacity-90">{formatKstTime(crew.startAt)} 출발 · {crew.paceMinPerKm}분/km · 공연 {formatKstTime(crew.eventStartAt)}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-white/15 p-3">
            <p className="text-xs opacity-80">출발까지</p>
            <p className="text-lg font-bold tabular-nums">{fmtCountdown(startMs - now)}</p>
          </div>
          <div className="rounded-xl bg-white/15 p-3">
            <p className="text-xs opacity-80">공연 시작까지</p>
            <p className="text-lg font-bold tabular-nums">{fmtCountdown(showMs - now)}</p>
          </div>
        </div>
        {showMs - now < 45 * 60_000 && showMs > now && (
          <p className="mt-3 rounded-lg bg-amber-300 p-2 text-sm font-semibold text-amber-950">입장 시간이 다가와요! 공연장으로 이동하세요.</p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 font-semibold">집결지 · 코스</h2>
        <CourseMap course={course} venueId={event.venueId} />
        <p className="mt-2 text-sm">📍 {course.meetingPoint.name} · {course.distanceKm}km</p>
      </section>

      {!crew.isMember ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
          <p className="font-semibold">크루원 {crew.memberCount}/{crew.capacity}명</p>
          <p className="mt-1 text-sm text-slate-500">멤버 정보와 채팅은 참여한 사람에게만 보여요.</p>
          {user ? (
            <button onClick={join} className="mt-3 w-full rounded-xl bg-violet-600 py-3 font-semibold text-white">이 번개 참여하기</button>
          ) : (
            <Link href={`/login?next=${encodeURIComponent(`/crews/${crewId}`)}`} className="mt-3 block rounded-xl bg-violet-600 py-3 font-semibold text-white">로그인하고 참여하기</Link>
          )}
          {msg && <p className="mt-2 text-sm text-rose-700">{msg}</p>}
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold">
              크루원 {crew.members.length}/{crew.capacity}
              {crew.teenOnly && <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-xs text-sky-800">10대 전용</span>}
            </h2>
            <ul className="mt-2 divide-y">
              {crew.members.map((m) => (
                <li key={m.userId} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {m.nickname}
                    {m.isMe && <span className="ml-1 text-xs text-violet-600">(나)</span>}
                    {m.userId === crew.hostId && <span className="ml-1 text-xs text-slate-500">· 방장</span>}
                  </span>
                  <span className="flex items-center gap-3 text-xs">
                    <span>{m.finished ? "🏁 완주" : m.checkedIn ? "✅ 도착" : "이동 중"}</span>
                    {!m.isMe && (
                      <>
                        <button onClick={() => setReporting({ userId: m.userId, nickname: m.nickname })} className="text-slate-400 underline hover:text-rose-600">신고</button>
                        <button onClick={() => block({ userId: m.userId, nickname: m.nickname })} className="text-slate-400 underline hover:text-rose-600">차단</button>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {user && <CrewChat crewId={crewId} myUserId={user.id} closed={closed} />}

          {mine && (
            <section className="space-y-2">
              {!mine.checkedIn && (
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={checkIn} className="rounded-xl bg-slate-900 py-3 font-semibold text-white">위치로 체크인</button>
                  <button onClick={() => patch({ checkedIn: true })} className="rounded-xl border border-slate-300 py-3 font-semibold">수동 체크인</button>
                </div>
              )}
              {mine.checkedIn && !mine.finished && (
                <button onClick={() => patch({ finished: true })} className="w-full rounded-xl bg-violet-600 py-3 font-semibold text-white">완주했어요 🏁</button>
              )}
              {mine.finished && (
                <Link href={`/venues?v=${event.venueId}`} className="block rounded-2xl border-2 border-violet-600 bg-violet-50 p-4 text-center">
                  <p className="font-bold text-violet-700">🎁 완주 보상 해금!</p>
                  <p className="text-sm text-violet-900">{event.venueName} 실감형 3D 무대 시점 보러가기 →</p>
                </Link>
              )}
              {msg && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{msg}</p>}
              <button onClick={leave} className="w-full py-2 text-sm text-slate-500 underline">크루 나가기</button>
            </section>
          )}
        </>
      )}

      <p className="text-center text-xs text-slate-500">안전 수칙: 공개된 장소에서만 만나고, 개인 연락처 교환은 자제하세요. 불편한 상황은 신고하거나 공원 안내센터에 알려주세요.</p>

      {reporting && <ReportDialog target={reporting} crewId={crewId} onClose={() => setReporting(null)} />}
    </div>
  );
}
