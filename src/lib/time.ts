/** KST 기준 날짜/시간 헬퍼 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function kstDateString(date: Date = new Date(), dayOffset = 0): string {
  const d = new Date(date.getTime() + KST_OFFSET_MS + dayOffset * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export function kstHourFraction(date: Date = new Date()): number {
  const d = new Date(date.getTime() + KST_OFFSET_MS);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

export function kstDateTime(dateStr: string, time: string): Date {
  return new Date(`${dateStr}T${time}:00+09:00`);
}

export function formatKstTime(iso: string | Date): string {
  return new Date(iso).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });
}

export function formatKstDate(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00+09:00`).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" });
}

/** <input type="datetime-local"> 값(KST로 해석) → Date */
export function fromKstLocalInput(value: string): Date {
  return new Date(`${value}:00+09:00`);
}

export function toKstLocalInput(date: Date): string {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 16);
}

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * KST 날짜·시각 문자열(YYYY-MM-DDTHH:mm) → "12월 18일 (금) 19:30".
 * toLocaleString은 서버(Node)와 브라우저의 표기가 달라 화면 하이드레이션이 어긋날 수 있어 직접 만든다.
 */
export function formatKstSession(local: string): string {
  const [date, time] = local.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const weekday = WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}월 ${d}일 (${weekday}) ${time}`;
}

/** 공연 기간 "2026-12-18"~"2026-12-20" → "12.18 ~ 12.20" (해가 다르거나 올해가 아니면 연도 포함) */
export function formatPeriod(from: string, to: string, now: Date = new Date()): string {
  const thisYear = kstDateString(now).slice(0, 4);
  const withYear = from.slice(0, 4) !== to.slice(0, 4) || from.slice(0, 4) !== thisYear;
  const f = (ymd: string) => (withYear ? ymd.replace(/-/g, ".") : `${Number(ymd.slice(5, 7))}.${Number(ymd.slice(8, 10))}`);
  return from === to ? f(from) : `${f(from)} ~ ${f(to)}`;
}
