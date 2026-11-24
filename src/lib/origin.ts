/**
 * 사용자가 실제로 접속한 사이트 주소 (예: https://example.vercel.app).
 *
 * Next.js의 req.url / req.nextUrl.origin은 실제 접속 주소가 아니라 서버 자신의 주소
 * (예: http://localhost:3000)가 된다. LAN IP로 접속해도, 배포 환경에서도 그렇다.
 * 그래서 x-forwarded-host(없으면 host)와 x-forwarded-proto로 만든다.
 * 호스트에 주소로 쓸 수 없는 문자가 있으면 fallback을 쓴다.
 */
export function requestOrigin(headers: Headers, fallback: string): string {
  const host = (headers.get("x-forwarded-host") ?? headers.get("host"))?.split(",")[0]?.trim();
  if (!host || !/^[a-z0-9.\-]+(:\d{1,5})?$|^\[[0-9a-f:.]+\](:\d{1,5})?$/i.test(host)) return fallback;
  const proto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return `${proto === "https" ? "https" : "http"}://${host}`;
}
