import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "공연 전 한 바퀴 | 올림픽공원 공연×러닝 크루",
  description: "같은 공연을 보러 온 사람들과 공연 전 올림픽공원을 함께 걷고 달리는 번개 매칭 서비스",
};

export const viewport: Viewport = { themeColor: "#7c3aed", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
          <nav className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-extrabold text-violet-700">🎤🏃 공연 전 한 바퀴</Link>
            <div className="flex gap-4 text-sm">
              <Link href="/">공연</Link>
              <Link href="/venues">공연장 3D</Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-xl px-4 py-5">{children}</main>
        <footer className="mx-auto max-w-xl px-4 pb-8 text-center text-xs text-slate-400">
          데이터: 한국체육산업개발(주) 올림픽공원 대관정보 · 실시간 주차현황 · 공연장 실감형 콘텐츠 (공공데이터포털)
        </footer>
      </body>
    </html>
  );
}
