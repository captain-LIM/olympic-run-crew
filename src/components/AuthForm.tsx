"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { safeNext } from "@/lib/safeNext";
import type { AgeGroup } from "@/lib/types";

const AGE_LABEL: Record<AgeGroup, string> = { "14-19": "10대(14~19)", "20s": "20대", "30s": "30대", "40+": "40대 이상" };

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [nickname, setNickname] = useState("");
  const [ageGroup, setAgeGroup] = useState<AgeGroup | "">("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isSignup = mode === "signup";
  const mismatch = isSignup && passwordConfirm.length > 0 && password !== passwordConfirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (isSignup && password !== passwordConfirm) return setError("비밀번호가 서로 일치하지 않아요.");
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(isSignup ? { email, password, passwordConfirm, nickname, ageGroup } : { email, password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "요청에 실패했어요.");
    router.replace(safeNext(next, window.location.origin));
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="cell stack-sm">
      <label className="block">
        <span className="label">이메일</span>
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
      </label>
      <label className="block">
        <span className="label">비밀번호 {isSignup && <span className="font-normal">(8자 이상, 영문+숫자)</span>}</span>
        <input
          type="password"
          required
          minLength={isSignup ? 8 : undefined}
          autoComplete={isSignup ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field"
        />
      </label>
      {isSignup && (
        <>
          <label className="block">
            <span className="label">비밀번호 확인</span>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              aria-invalid={mismatch}
              aria-describedby={mismatch ? "pw-mismatch" : undefined}
              className="field"
            />
            {mismatch && <span id="pw-mismatch" role="alert" className="mt-2 block text-sm font-semibold text-error">비밀번호가 서로 일치하지 않아요.</span>}
          </label>
          <label className="block">
            <span className="label">닉네임 <span className="font-normal">(크루원에게 보이는 이름, 1~12자)</span></span>
            <input required maxLength={12} value={nickname} onChange={(e) => setNickname(e.target.value)} className="field" />
          </label>
          <label className="block">
            <span className="label">연령대</span>
            <select required value={ageGroup} onChange={(e) => setAgeGroup(e.target.value as AgeGroup)} className="field">
              <option value="">선택</option>
              {(Object.keys(AGE_LABEL) as AgeGroup[]).map((a) => <option key={a} value={a}>{AGE_LABEL[a]}</option>)}
            </select>
            <span className="small mt-2 block">만 14세 미만은 가입할 수 없어요. 10대는 10대끼리만 매칭돼요.</span>
          </label>
        </>
      )}
      {error && <p role="alert" className="note note--error">{error}</p>}
      <button disabled={busy || mismatch} className="btn btn--solid btn--block !mt-6">
        {busy ? "처리 중…" : isSignup ? "가입하기" : "로그인"}
      </button>
      <p className="pt-2 text-sm">
        {isSignup ? "이미 계정이 있나요? " : "처음이신가요? "}
        <Link href={`/${isSignup ? "login" : "signup"}${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="lnk font-semibold">
          {isSignup ? "로그인" : "회원가입"}
        </Link>
      </p>
    </form>
  );
}
