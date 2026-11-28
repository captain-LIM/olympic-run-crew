import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { KopisCredit } from "@/components/KopisCredit";
import { UserMenu } from "@/components/UserMenu";
import { currentUser } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "공연 전 한 바퀴 | 올림픽공원 공연×러닝 크루",
  description: "같은 공연을 보러 온 사람들과 공연 전 올림픽공원을 함께 걷고 달리는 번개 매칭 서비스",
};

export const viewport: Viewport = { themeColor: "#2f6fd8", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser().catch(() => null);
  return (
    <html lang="ko">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/variable/woff2/SUIT-Variable.css" />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="skip">본문으로 건너뛰기</a>
        <header className="navbar">
          <nav className="container flex items-center justify-between gap-4 py-3" aria-label="주요 메뉴">
            <Link href="/" className="brand">공연 전 한 바퀴</Link>
            <div className="flex items-center gap-2 sm:gap-4">
              <Link href="/venues" className="whitespace-nowrap">공연장 3D</Link>
              <UserMenu nickname={user?.nickname ?? null} />
            </div>
          </nav>
        </header>
        <main id="main" className="container flex-1 py-10 sm:py-14">{children}</main>
        <footer className="mast">
          <div className="container py-12">
            <p className="wordmark text-2xl font-extrabold">공연 전 한 바퀴</p>
            <p className="mt-4 max-w-[60ch] text-sm">
              데이터: 한국체육산업개발(주) 올림픽공원 대관정보, 주차장 혼잡도 정보, 올림픽공원 공연장 실감형 콘텐츠 (공공데이터포털)
            </p>
            <p className="mt-2 max-w-[60ch] text-sm">
              공연 일정은 KOPIS OPEN API를 이용했습니다. <KopisCredit />
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
