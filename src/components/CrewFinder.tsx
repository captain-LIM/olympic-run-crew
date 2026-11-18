"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_PACE, MODE_LABEL, recommendCourses, validateTiming } from "@/lib/matching";
import { COURSES, DEFAULT_SHOW_TIME } from "@/lib/park";
import { predictedLevelAt, predictShowDay } from "@/lib/prediction";
import { formatKstTime, fromKstLocalInput, kstDateString, toKstLocalInput } from "@/lib/time";
import type { AgeGroup, Crew, CrewMode, DayType, HourlyPoint, Show } from "@/lib/types";
import { LEVEL_STYLE } from "./CongestionPanel";
import { CourseMap } from "./CourseMap";
import { PredictionCard } from "./PredictionCard";

const AGE_LABEL: Record<AgeGroup, string> = { "14-19": "10대", "20s": "20대", "30s": "30대", "40+": "40대 이상" };

function defaultShowTime(show: Show): string {
  const time = DEFAULT_SHOW_TIME[show.venueId];
  const today = fromKstLocalInput(`${kstDateString()}T${time}`);
  const d = today.getTime() - Date.now() > 3 * 3600_000 ? today : fromKstLocalInput(`${kstDateString(new Date(), 1)}T${time}`);
  return toKstLocalInput(d);
}

function defaultStart(showAt: string): string {
  const d = new Date(Math.max(fromKstLocalInput(showAt).getTime() - 80 * 60_000, Date.now() + 10 * 60_000));
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  return toKstLocalInput(d);
}

export function CrewFinder({
  show,
  curves,
  user,
}: {
  show: Show;
  curves: Record<DayType, HourlyPoint[]>;
  user: { nickname: string; ageGroup: AgeGroup } | null;
}) {
  const router = useRouter();
  const [showAt, setShowAt] = useState(() => defaultShowTime(show));
  const [startAt, setStartAt] = useState(() => defaultStart(showAt));
  const [mode, setMode] = useState<CrewMode>("walk");
  const [pace, setPace] = useState(DEFAULT_PACE.walk);
  const [capacity, setCapacity] = useState(6);
  const [matches, setMatches] = useState<Crew[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const showDate = fromKstLocalInput(showAt);
  const startDate = fromKstLocalInput(startAt);
  const prediction = useMemo(() => predictShowDay({ curves, showStart: fromKstLocalInput(showAt), venueId: show.venueId }), [curves, showAt, show.venueId]);
  const level = predictedLevelAt(prediction, startDate);

  const recs = useMemo(() => recommendCourses(COURSES, mode, show.venueId, level), [mode, show.venueId, level]);
  const [courseId, setCourseId] = useState<string>(recs[0]?.course.id ?? "");
  useEffect(() => {
    if (!recs.some((r) => r.course.id === courseId)) setCourseId(recs[0]?.course.id ?? "");
  }, [recs, courseId]);
  const course = COURSES.find((c) => c.id === courseId);
  const timing = course ? validateTiming({ startAt: startDate, eventStartAt: showDate, course, pace, venueId: show.venueId }) : null;
  const loginHref = `/login?next=${encodeURIComponent(`/events/${show.id}`)}`;

  function selectMode(m: CrewMode) {
    setMode(m);
    setPace(DEFAULT_PACE[m]);
    setMatches(null);
  }

  function useWalkWindow() {
    if (!prediction.walkWindow) return;
    setStartAt(`${kstDateString(showDate)}T${prediction.walkWindow.from}`);
  }

  async function search() {
    setError(null);
    const qs = new URLSearchParams({ eventId: show.id, mode, pace: String(pace), startAt: startDate.toISOString(), eventStartAt: showDate.toISOString() });
    const res = await fetch(`/api/crews?${qs}`);
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setMatches(data.crews);
  }

  async function join(crewId: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/crews/${crewId}`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    router.push(`/crews/${crewId}`);
  }

  async function create() {
    if (!course) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/crews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId: show.id, mode, paceMinPerKm: pace, courseId, capacity, startAt: startDate.toISOString(), eventStartAt: showDate.toISOString() }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    router.push(`/crews/${data.crew.id}`);
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">내 티켓 정보</h2>
        <label className="block text-sm">
          공연 날짜·시작 시각
          <input type="datetime-local" value={showAt} onChange={(e) => { setShowAt(e.target.value); setStartAt(defaultStart(e.target.value)); setMatches(null); }} className="mt-1 w-full rounded-lg border px-3 py-2" />
          <span className="text-xs text-slate-500">같은 공연·같은 날짜를 입력한 사람끼리 매칭돼요.</span>
        </label>
      </section>

      <PredictionCard prediction={prediction} showLabel={showAt.slice(11, 16)} />

      {!user ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
          <p className="font-semibold">번개를 찾거나 열려면 로그인이 필요해요</p>
          <p className="mt-1 text-sm text-slate-500">크루 채팅과 신고·차단 같은 안전 기능을 위해 계정을 사용해요.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href={loginHref} className="rounded-xl bg-violet-600 py-2.5 font-semibold text-white">로그인</Link>
            <Link href={`/signup?next=${encodeURIComponent(`/events/${show.id}`)}`} className="rounded-xl border border-slate-300 py-2.5 font-semibold">회원가입</Link>
          </div>
        </section>
      ) : (
        <>
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">번개 조건</h2>
              <span className="text-xs text-slate-500">{user.nickname} · {AGE_LABEL[user.ageGroup]}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(MODE_LABEL) as CrewMode[]).map((m) => (
                <button key={m} onClick={() => selectMode(m)} className={`rounded-xl border py-2 text-sm font-medium ${mode === m ? "border-violet-600 bg-violet-50 text-violet-700" : "border-slate-200"}`}>
                  {MODE_LABEL[m]}
                </button>
              ))}
            </div>
            <label className="block text-sm">
              페이스 <span className="text-slate-500">(분/km)</span>
              <input type="number" step={0.5} min={3} max={20} value={pace} onChange={(e) => setPace(Number(e.target.value))} className="mt-1 w-full rounded-lg border px-3 py-2" />
            </label>
            <label className="block text-sm">
              희망 출발 시각
              <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
            </label>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-600">출발 시각 예측 혼잡</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${LEVEL_STYLE[level]}`}>{level}</span>
              {prediction.walkWindow && (
                <button onClick={useWalkWindow} className="text-xs font-semibold text-violet-700 underline">추천 시간({prediction.walkWindow.from})으로 맞추기</button>
              )}
            </div>
            <button onClick={search} className="w-full rounded-xl bg-slate-900 py-2.5 font-semibold text-white">같은 공연 크루 찾기</button>
          </section>

          {matches && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="font-semibold">매칭된 번개 {matches.length}개</h2>
              {matches.length === 0 && <p className="mt-2 text-sm text-slate-500">조건에 맞는 번개가 없어요. 아래에서 첫 번개를 열어보세요!</p>}
              <ul className="mt-2 divide-y">
                {matches.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">{formatKstTime(c.startAt)} 출발 · {COURSES.find((x) => x.id === c.courseId)?.name}</p>
                      <p className="text-xs text-slate-500">{MODE_LABEL[c.mode]} {c.paceMinPerKm}분/km · {c.members.length}/{c.capacity}명</p>
                    </div>
                    <button disabled={busy} onClick={() => join(c.id)} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">참여</button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold">새 번개 열기</h2>
            <p className="text-xs text-slate-500">
              {level === "혼잡" || level === "매우혼잡"
                ? "출발 시각이 붐빌 것으로 예상돼 공연장에서 조금 떨어진 집결지를 우선 추천해요."
                : "출발 시각이 여유로울 것으로 예상돼 공연장과 가까운 코스를 우선 추천해요."}
            </p>
            <ul className="space-y-2">
              {recs.map((r, i) => (
                <li key={r.course.id}>
                  <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${courseId === r.course.id ? "border-violet-600 bg-violet-50" : "border-slate-200"}`}>
                    <input type="radio" name="course" className="mt-1" checked={courseId === r.course.id} onChange={() => setCourseId(r.course.id)} />
                    <div className="flex-1">
                      <p className="font-medium">
                        {i === 0 && <span className="mr-1 rounded bg-violet-600 px-1.5 py-0.5 text-[10px] text-white">추천</span>}
                        {r.course.name} <span className="text-sm text-slate-500">{r.course.distanceKm}km</span>
                      </p>
                      <p className="text-xs text-slate-500">{r.course.description} · 공연장까지 도보 {r.walkToVenueMin}분</p>
                    </div>
                    {r.crowded && <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800">공연장 인파</span>}
                  </label>
                </li>
              ))}
            </ul>
            {course && <CourseMap course={course} venueId={show.venueId} />}
            <label className="block text-sm">
              정원
              <select value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="mt-1 w-full rounded-lg border px-3 py-2">
                {[2, 4, 6, 8].map((n) => <option key={n} value={n}>{n}명</option>)}
              </select>
            </label>
            {timing && (
              <p className={`rounded-lg p-2 text-sm ${timing.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
                {timing.ok
                  ? `예상 ${timing.durationMin}분 소요 · ${formatKstTime(timing.latestStart)}까지 출발하면 입장 30분 전 도착`
                  : `${timing.reason} (출발 가능: ${formatKstTime(timing.earliestStart)} ~ ${formatKstTime(timing.latestStart)})`}
              </p>
            )}
            <button disabled={busy || !timing?.ok} onClick={create} className="w-full rounded-xl bg-violet-600 py-2.5 font-semibold text-white disabled:opacity-40">번개 열기</button>
          </section>
        </>
      )}

      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    </div>
  );
}
