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
