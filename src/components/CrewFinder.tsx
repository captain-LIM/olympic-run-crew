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
import { Mascot } from "./Mascot";
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
    <div className="grid gap-x-[var(--gap-columns)] gap-y-8 lg:grid-cols-12 lg:items-start">
      <div className="stack lg:col-span-7">
        <section className="cell">
          <h2 className="t-cell">내 티켓 정보</h2>
          <label className="mt-4 block">
            <span className="label">공연 날짜·시작 시각</span>
            <input type="datetime-local" value={showAt} onChange={(e) => { setShowAt(e.target.value); setStartAt(defaultStart(e.target.value)); setMatches(null); }} className="field" />
            <span className="small mt-2 block">같은 공연·같은 날짜를 입력한 사람끼리 매칭돼요.</span>
          </label>
        </section>

        {!user ? (
          <section className="cell cell--well flex items-center gap-6">
            <div className="min-w-0 flex-1">
              <h2 className="t-cell">번개를 찾거나 열려면 로그인이 필요해요</h2>
              <p className="mt-2 text-sm">크루 채팅과 신고·차단 같은 안전 기능을 위해 계정을 사용해요.</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Link href={loginHref} className="btn btn--solid">로그인</Link>
                <Link href={`/signup?next=${encodeURIComponent(`/events/${show.id}`)}`} className="btn">회원가입</Link>
              </div>
            </div>
            <Mascot pose="phone" sizes="160px" className="hidden w-32 shrink-0 sm:block" />
          </section>
        ) : (
          <>
            <section className="cell">
              <div className="cell-head">
                <h2 className="t-cell">번개 조건</h2>
                <span className="small">{user.nickname}, {AGE_LABEL[user.ageGroup]}</span>
              </div>
              <div className="seg mt-4" role="group" aria-label="활동 종류">
                {(Object.keys(MODE_LABEL) as CrewMode[]).map((m) => (
                  <button key={m} onClick={() => selectMode(m)} aria-pressed={mode === m}>
                    {MODE_LABEL[m]}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="label">페이스 (분/km)</span>
                  <input type="number" step={0.5} min={3} max={20} value={pace} onChange={(e) => setPace(Number(e.target.value))} className="field" />
                </label>
                <label className="block">
                  <span className="label">희망 출발 시각</span>
                  <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="field" />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="muted">출발 시각 예측 혼잡</span>
                <span className={`tag ${LEVEL_STYLE[level]}`}>{level}</span>
                {prediction.walkWindow && (
                  <button onClick={useWalkWindow} className="btn-text">추천 시간({prediction.walkWindow.from})으로 맞추기</button>
                )}
              </div>
              <button onClick={search} className="btn btn--solid btn--block mt-5">같은 공연 크루 찾기</button>
            </section>

            {matches && (
              <section className="cell" aria-live="polite">
                <h2 className="t-cell">매칭된 번개 {matches.length}개</h2>
                {matches.length === 0 && <p className="mt-3 text-sm muted">조건에 맞는 번개가 없어요. 아래에서 첫 번개를 열어보세요!</p>}
                <ul className="rows mt-3">
                  {matches.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{formatKstTime(c.startAt)} 출발, {COURSES.find((x) => x.id === c.courseId)?.name}</p>
                        <p className="meta mt-1">
                          <span>{MODE_LABEL[c.mode]} {c.paceMinPerKm}분/km</span>
                          <span>{c.members.length}/{c.capacity}명</span>
                        </p>
                      </div>
                      <button disabled={busy} onClick={() => join(c.id)} className="btn btn--solid btn--sm">참여</button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="cell">
              <h2 className="t-cell">새 번개 열기</h2>
              <p className="small mt-2">
                {level === "혼잡" || level === "매우혼잡"
                  ? "출발 시각이 붐빌 것으로 예상돼 공연장에서 조금 떨어진 집결지를 우선 추천해요."
                  : "출발 시각이 여유로울 것으로 예상돼 공연장과 가까운 코스를 우선 추천해요."}
              </p>
              <ul className="mt-4 space-y-3">
                {recs.map((r, i) => (
                  <li key={r.course.id}>
                    <label className="opt">
                      <input type="radio" name="course" checked={courseId === r.course.id} onChange={() => setCourseId(r.course.id)} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {i === 0 && <span className="tag tag--blue mr-2">추천</span>}
                          {r.course.name} <span className="muted text-sm font-normal">{r.course.distanceKm}km</span>
                        </p>
                        <p className="small mt-1">{r.course.description}, 공연장까지 도보 {r.walkToVenueMin}분</p>
                      </div>
                      {r.crowded && <span className="tag tag--red shrink-0">공연장 인파</span>}
                    </label>
                  </li>
                ))}
              </ul>
              {course && <div className="mt-4"><CourseMap course={course} venueId={show.venueId} /></div>}
              <label className="mt-4 block">
                <span className="label">정원</span>
                <select value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="field">
                  {[2, 4, 6, 8].map((n) => <option key={n} value={n}>{n}명</option>)}
                </select>
              </label>
              {timing && (
                <p className={`note mt-4 ${timing.ok ? "" : "note--error"}`}>
                  {timing.ok
                    ? `예상 ${timing.durationMin}분 소요, ${formatKstTime(timing.latestStart)}까지 출발하면 입장 30분 전 도착`
                    : `${timing.reason} (출발 가능: ${formatKstTime(timing.earliestStart)} ~ ${formatKstTime(timing.latestStart)})`}
                </p>
              )}
              <button disabled={busy || !timing?.ok} onClick={create} className="btn btn--solid btn--block mt-5">번개 열기</button>
            </section>
          </>
        )}

        {error && <p role="alert" className="note note--error">{error}</p>}
      </div>

      <div className="lg:sticky lg:top-24 lg:col-span-5">
        <PredictionCard prediction={prediction} showLabel={showAt.slice(11, 16)} />
      </div>
    </div>
  );
}
