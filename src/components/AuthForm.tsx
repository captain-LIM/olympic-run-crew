"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AgeGroup } from "@/lib/types";

const AGE_LABEL: Record<AgeGroup, string> = { "14-19": "10대(14~19)", "20s": "20대", "30s": "30대", "40+": "40대 이상" };

/** 외부 사이트로의 오픈 리다이렉트 방지: 같은 사이트 내부 경로만 허용 */
function safeNext(next?: string): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [ageGroup, setAgeGroup] = useState<AgeGroup | "">("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isSignup = mode === "signup";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(isSignup ? { email, password, nickname, ageGroup } : { email, password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "요청에 실패했어요.");
    router.replace(safeNext(next));
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
      <label className="block text-sm">
        이메일
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
      </label>
      <label className="block text-sm">
        비밀번호 {isSignup && <span className="text-xs text-slate-500">(8자 이상, 영문+숫자)</span>}
        <input
          type="password"
          required
          minLength={isSignup ? 8 : undefined}
          autoComplete={isSignup ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2"
        />
      </label>
      {isSignup && (
        <>
          <label className="block text-sm">
            닉네임 <span className="text-xs text-slate-500">(크루원에게 보이는 이름, 1~12자)</span>
            <input required maxLength={12} value={nickname} onChange={(e) => setNickname(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="block text-sm">
            연령대
            <select required value={ageGroup} onChange={(e) => setAgeGroup(e.target.value as AgeGroup)} className="mt-1 w-full rounded-lg border px-3 py-2">
              <option value="">선택</option>
              {(Object.keys(AGE_LABEL) as AgeGroup[]).map((a) => <option key={a} value={a}>{AGE_LABEL[a]}</option>)}
            </select>
            <span className="text-xs text-slate-500">만 14세 미만은 가입할 수 없어요. 10대는 10대끼리만 매칭돼요.</span>
          </label>
        </>
      )}
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-sm text-rose-800">{error}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-violet-600 py-3 font-semibold text-white disabled:opacity-50">
        {busy ? "처리 중…" : isSignup ? "가입하기" : "로그인"}
      </button>
      <p className="text-center text-sm text-slate-600">
        {isSignup ? "이미 계정이 있나요? " : "처음이신가요? "}
        <Link href={`/${isSignup ? "login" : "signup"}${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-violet-700 underline">
          {isSignup ? "로그인" : "회원가입"}
        </Link>
      </p>
    </form>
  );
}
