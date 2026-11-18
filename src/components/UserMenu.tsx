"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function UserMenu({ nickname }: { nickname: string | null }) {
  const router = useRouter();
  if (!nickname) {
    return <Link href="/login" className="rounded-full bg-violet-600 px-3 py-1 text-white">로그인</Link>;
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return (
    <span className="flex items-center gap-2">
      <Link href="/account" className="font-medium text-violet-700">{nickname}</Link>
      <button onClick={logout} className="text-slate-500 underline">로그아웃</button>
    </span>
  );
}
