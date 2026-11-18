"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_PACE, MODE_LABEL, recommendCourses, validateTiming } from "@/lib/matching";
import { COURSES } from "@/lib/park";
import { loadProfile, saveProfile, setMemberId, type Profile } from "@/lib/profile";
import { formatKstTime, fromKstLocalInput, toKstLocalInput } from "@/lib/time";
import type { AgeGroup, Crew, CrewMode, ParkingStatus, PerformanceEvent } from "@/lib/types";
import { CourseMap } from "./CourseMap";
import { LEVEL_STYLE } from "./ParkingPanel";

const AGE_LABEL: Record<AgeGroup, string> = { "14-19": "10대(14~19)", "20s": "20대", "30s": "30대", "40+": "40대 이상" };

export function CrewFinder({ event, parking, initialCrews }: { event: PerformanceEvent; parking: ParkingStatus[]; initialCrews: Crew[] }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [nickname, setNickname] = useState("");
  const [ageGroup, setAgeGroup] = useState<AgeGroup | "">("");

  const defaultShow = useMemo(() => fromKstLocalInput(`${event.startDate}T${event.estimatedStartTime}`), [event]);
  const [showAt, setShowAt] = useState(toKstLocalInput(defaultShow));
  const [mode, setMode] = useState<CrewMode>("walk");
  const [pace, setPace] = useState(DEFAULT_PACE.walk);
  const [startAt, setStartAt] = useState(() => {
    const d = new Date(Math.max(defaultShow.getTime() - 80 * 60_000, Date.now() + 10 * 60_000));
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    return toKstLocalInput(d);
  });
  const [capacity, setCapacity] = useState(6);
  const [matches, setMatches] = useState<Crew[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setProfile(loadProfile()), []);

  const recs = useMemo(() => recommendCourses(COURSES, mode, event.venueId, parking), [mode, event.venueId, parking]);
  const [courseId, setCourseId] = useState<string>(recs[0]?.course.id ?? "");
  useEffect(() => {
    if (!recs.some((r) => r.course.id === courseId)) setCourseId(recs[0]?.course.id ?? "");
  }, [recs, courseId]);
  const course = COURSES.find((c) => c.id === courseId);

  const timing = course
    ? validateTiming({ startAt: fromKstLocalInput(startAt), eventStartAt: fromKstLocalInput(showAt), course, pace, venueId: event.venueId })
    : null;

  function selectMode(m: CrewMode) {
    setMode(m);
    setPace(DEFAULT_PACE[m]);
    setMatches(null);
  }

  async function search() {
    if (!profile) return;
    setError(null);
    const qs = new URLSearchParams({ eventId: event.id, mode, pace: String(pace), startAt: fromKstLocalInput(startAt).toISOString(), ageGroup: profile.ageGroup });
    const res = await fetch(`/api/crews?${qs}`);
    setMatches((await res.json()).crews);
  }

  async function join(crewId: string) {
    if (!profile) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/crews/${crewId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(profile) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    setMemberId(crewId, data.memberId);
    router.push(`/crews/${crewId}`);
  }

  async function create() {
    if (!profile || !course) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/crews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId: event.id, mode, paceMinPerKm: pace, courseId, capacity,
        startAt: fromKstLocalInput(startAt).toISOString(),
        eventStartAt: fromKstLocalInput(showAt).toISOString(),
        host: profile,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    setMemberId(data.crew.id, data.memberId);
    router.push(`/crews/${data.crew.id}`);
  }

  if (!profile) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">먼저 프로필을 만들어 주세요</h2>
        <p className="mt-1 text-sm text-slate-500">실명·연락처는 받지 않습니다. 10대는 10대끼리만 매칭됩니다.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input className="rounded-lg border px-3 py-2" placeholder="닉네임 (1~12자)" maxLength={12} value={nickname} onChange={(e) => setNickname(e.target.value)} />
          <select className="rounded-lg border px-3 py-2" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value as AgeGroup)}>
            <option value="">연령대 선택</option>
            {(Object.keys(AGE_LABEL) as AgeGroup[]).map((a) => <option key={a} value={a}>{AGE_LABEL[a]}</option>)}
          </select>
        </div>
        <p className="mt-2 text-xs text-slate-500">만 14세 미만은 보호자 동반 없이 이용할 수 없습니다.</p>
        <button
          className="mt-3 w-full rounded-xl bg-violet-600 py-2.5 font-semibold text-white disabled:opacity-40"
          disabled={!nickname.trim() || !ageGroup}
          onClick={() => {
            const p = { nickname: nickname.trim(), ageGroup: ageGroup as AgeGroup };
            saveProfile(p);
            setProfile(p);
          }}
        >
          시작하기
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">번개 조건</h2>
          <span className="text-xs text-slate-500">{profile.nickname} · {AGE_LABEL[profile.ageGroup]}</span>
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
          공연 시작 시각
          <input type="datetime-local" value={showAt} onChange={(e) => setShowAt(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
          <span className="text-xs text-slate-500">대관정보에는 시작 시각이 없어 추정값입니다. 티켓 시간으로 수정하세요.</span>
        </label>
        <label className="block text-sm">
          희망 출발 시각
          <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <button onClick={search} className="w-full rounded-xl bg-slate-900 py-2.5 font-semibold text-white">같은 공연 크루 찾기</button>
      </section>

      {matches && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">매칭된 번개 {matches.length}개</h2>
          {matches.length === 0 && <p className="mt-2 text-sm text-slate-500">조건에 맞는 번개가 없어요. 아래에서 새로 열어보세요!</p>}
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

      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="font-semibold">새 번개 열기</h2>
        <p className="text-xs text-slate-500">주차 혼잡도가 낮은 구역 근처 집결지를 우선 추천합니다.</p>
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
                {r.gateLevel !== "알수없음" && <span className={`rounded-full px-2 py-0.5 text-xs ${LEVEL_STYLE[r.gateLevel]}`}>주변 {r.gateLevel}</span>}
              </label>
            </li>
          ))}
        </ul>
        {course && <CourseMap course={course} venueId={event.venueId} parking={parking} />}
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

      {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

      {initialCrews.length > 0 && !matches && (
        <p className="text-center text-sm text-slate-500">이 공연에 열린 번개 {initialCrews.length}개 · 조건을 입력하고 찾아보세요</p>
      )}
    </div>
  );
}
