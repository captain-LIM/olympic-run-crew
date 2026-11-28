import { unstable_cache } from "next/cache";
import { kstDateString } from "../time";
import type { Show } from "../types";
import { KOPIS_FACILITY_ID, parseKopisDetail, parseKopisList, parseKopisShowId, toKopisShow, type KopisDetail } from "./kopis";

/**
 * KOPIS 공연예술통합전산망 OpenAPI 호출 (서버 전용, KOPIS_SERVICE_KEY 필요).
 *
 * - 주소: 개발가이드 v5.0은 http://www.kopis.or.kr (평문)만 적어 두었지만, 키가 평문으로 가지 않도록
 *   https://kopis.or.kr 를 쓴다 (2026-11-24 동작 확인. https://www.… 는 이 주소로 301).
 * - 공연 목록: 가이드상 조회 기간 최대 31일, 한 번에 최대 100건 → 앞으로 90일을 31일 구간 3개로 나눠 부른다.
 * - KOPIS 이용제한: IP당 1초에 10회 이상 호출하면 서비스가 중지된다. 실제로 4개씩 동시에 부르자
 *   "400 Request Blocked"가 왔고 약 5분 뒤 풀렸다 (2026-11-24). 그래서
 *   - 요청 시작 간격을 MIN_GAP_MS(0.2초, 초당 최대 5회)로 띄우고,
 *   - 목록+상세를 합친 결과를 6시간 캐시한다. 시간이 지나면 이전 결과를 바로 보여주고 뒤에서 새로 받는다.
 *   - 상세는 공연별로도 24시간 캐시해, 새로 받을 때 새 공연만 부르게 한다.
 * - 하나라도 실패하면 그 결과는 캐시하지 않고(일부만 저장되지 않게), 5분 동안 KOPIS 공연 없이 동작한다.
 */
const BASE = "https://kopis.or.kr/openApi/restful";
const HORIZON_DAYS = 90;
const CHUNK_DAYS = 31;
const ROWS = 100;
const MAX_PAGES = 5;
const TIMEOUT_MS = 8_000;
const MIN_GAP_MS = 200;
const ALL_TTL_SEC = 6 * 3600;
const DETAIL_TTL_SEC = 24 * 3600;
const FAIL_COOLDOWN_MS = 5 * 60_000;

export type KopisStatus = "ok" | "off" | "error";

let failedUntil = 0;
let nextSlot = 0;
let inflight: Promise<KopisDetail[]> | null = null;

/** 로그·오류 메시지에 키가 섞이지 않게 */
function scrub(e: unknown): string {
  const key = process.env.KOPIS_SERVICE_KEY;
  const msg = e instanceof Error ? e.message : String(e);
  return key ? msg.split(key).join("***") : msg;
}

/** 이 서버 인스턴스에서 KOPIS 요청 시작 간격을 MIN_GAP_MS 이상으로 */
async function throttle(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + MIN_GAP_MS;
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}

async function call(path: string, params: Record<string, string> = {}): Promise<string> {
  const key = process.env.KOPIS_SERVICE_KEY;
  if (!key) throw new Error("KOPIS_SERVICE_KEY 미설정");
  await throttle();
  // 캐시는 unstable_cache가 맡는다
  const res = await fetch(`${BASE}/${path}?${new URLSearchParams({ service: key, ...params })}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = (await res.text()).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
    throw new Error(`KOPIS HTTP ${res.status} (${path.split("/")[0]}) ${body}`);
  }
  return res.text();
}

function addDays(ymd: string, days: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
const compact = (ymd: string) => ymd.replace(/-/g, "");

/** 오늘(KST)부터 HORIZON_DAYS일 뒤까지 공연 기간이 겹치는 올림픽공원 공연 ID */
async function fetchListIds(today: string): Promise<string[]> {
  const ids = new Set<string>();
  for (let start = 0; start <= HORIZON_DAYS; start += CHUNK_DAYS) {
    const end = Math.min(start + CHUNK_DAYS - 1, HORIZON_DAYS);
    for (let page = 1; page <= MAX_PAGES; page++) {
      const items = parseKopisList(
        await call("pblprfr", {
          stdate: compact(addDays(today, start)),
          eddate: compact(addDays(today, end)),
          cpage: String(page),
          rows: String(ROWS),
          prfplccd: KOPIS_FACILITY_ID,
        }),
      );
      for (const it of items) ids.add(it.id);
      if (items.length < ROWS) break;
    }
  }
  return [...ids];
}

/** 공연 상세. 없는 공연이면 null (null도 캐시된다) */
const loadDetail = unstable_cache(
  async (kopisId: string): Promise<KopisDetail | null> => parseKopisDetail(await call(`pblprfr/${kopisId}`)),
  ["kopis-detail-v1"],
  { revalidate: DETAIL_TTL_SEC },
);

const isOlympicPark = (d: KopisDetail | null): d is KopisDetail => d !== null && d.facilityId === KOPIS_FACILITY_ID;

/** 목록 + 상세 (회차는 보는 시점마다 다시 계산하므로 여기엔 원자료만 둔다) */
const loadAll = unstable_cache(
  async (): Promise<KopisDetail[]> => {
    const ids = await fetchListIds(kstDateString());
    const details: KopisDetail[] = [];
    // 순서대로 부른다 (간격은 throttle). 하나라도 실패하면 예외 → 이 결과는 캐시되지 않는다
    for (const id of ids) {
      const d = await loadDetail(id);
      if (isOlympicPark(d)) details.push(d);
    }
    return details;
  },
  ["kopis-all-v1"],
  { revalidate: ALL_TTL_SEC },
);

/** 앞으로 90일 안에 열리는 올림픽공원 공연. 가까운 회차(없으면 시작일) 순 */
export async function getKopisShows(now = new Date()): Promise<{ shows: Show[]; status: KopisStatus }> {
  if (!process.env.KOPIS_SERVICE_KEY) return { shows: [], status: "off" };
  if (Date.now() < failedUntil) return { shows: [], status: "error" };
  try {
    // 캐시가 비어 있을 때 동시에 들어온 요청이 KOPIS를 여러 번 부르지 않게 한 번만 기다린다
    inflight ??= loadAll().finally(() => (inflight = null));
    const details = await inflight;
    const today = kstDateString(now);
    const shows = details.filter((d) => d.to >= today).map((d) => toKopisShow(d, now));
    const firstAt = (s: Show) => s.kopis!.sessions[0] ?? `${s.kopis!.from}T99:99`;
    shows.sort((a, b) => firstAt(a).localeCompare(firstAt(b)));
    return { shows, status: "ok" };
  } catch (e) {
    failedUntil = Date.now() + FAIL_COOLDOWN_MS;
    console.error("[kopis] 공연 목록 실패, 5분 동안 KOPIS 공연 없이 동작:", scrub(e));
    return { shows: [], status: "error" };
  }
}

/** "k-PF…" 공연 하나. 목록에서 빠진 지난 공연(이미 열린 번개의 공연)도 상세로 찾는다 */
export async function getKopisShow(id: string, now = new Date()): Promise<Show | undefined> {
  const kopisId = parseKopisShowId(id);
  // failedUntil은 보지 않는다: 캐시에 있으면 KOPIS 장애 중에도 이미 열린 번개의 공연을 보여줄 수 있다
  if (!kopisId || !process.env.KOPIS_SERVICE_KEY) return undefined;
  try {
    const d = await loadDetail(kopisId);
    return isOlympicPark(d) ? toKopisShow(d, now) : undefined;
  } catch (e) {
    console.error(`[kopis] 공연 상세 실패 ${kopisId}:`, scrub(e));
    return undefined;
  }
}
