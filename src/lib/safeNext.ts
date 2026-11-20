/**
 * 로그인·회원가입 후 이동할 경로(`?next=`)를 같은 사이트 내부 경로로 제한한다 (오픈 리다이렉트 방지).
 *
 * 문자열 모양으로 판단하면 `/\example.com`처럼 브라우저가 외부 주소로 해석하는 값을 놓친다.
 * 그래서 브라우저와 같은 규칙(WHATWG URL)으로 해석한 뒤 출처(origin)가 같을 때만 허용하고,
 * 해석이 끝난 경로만 돌려준다.
 */
export function safeNext(next: unknown, origin: string): string {
  if (typeof next !== "string" || !next.startsWith("/")) return "/";
  try {
    const url = new URL(next, origin);
    if (url.origin !== origin) return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}
