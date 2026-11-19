"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function UserMenu({ nickname }: { nickname: string | null }) {
  const router = useRouter();
  if (!nickname) {
    return <Link href="/login" className="btn btn--solid btn--sm">로그인</Link>;
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return (
    <span className="flex items-center gap-2 sm:gap-4">
      <Link href="/account">내 번개</Link>
      <button onClick={logout} className="btn-text">로그아웃</button>
    </span>
  );
}
