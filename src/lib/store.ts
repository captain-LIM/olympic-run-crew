import { randomBytes } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import type { User } from "./auth";
import { exec, query, transaction } from "./db";
import { canJoin } from "./matching";
import { kstDateString, kstDateTime } from "./time";
import type { AgeGroup, ChatMessage, Crew, CrewMode, Member, ReportReason } from "./types";

/** MySQL 기반 크루·채팅·신고·차단 저장소 (서버 전용) */

interface CrewRow {
  id: string;
  event_id: string;
  mode: CrewMode;
  pace_min_per_km: string | number;
  course_id: string;
  start_at: Date;
  event_start_at: Date;
  capacity: number;
  teen_only: number;
  host_id: number;
  created_at: Date;
}

interface MemberRow {
  crew_id: string;
  user_id: number;
  nickname: string;
  age_group: AgeGroup;
  joined_at: Date;
  checked_in: number;
  finished: number;
}

const toMember = (m: MemberRow): Member => ({
  userId: Number(m.user_id),
  nickname: m.nickname,
  ageGroup: m.age_group,
  joinedAt: m.joined_at.toISOString(),
  checkedIn: !!m.checked_in,
  finished: !!m.finished,
});

async function hydrate(rows: CrewRow[]): Promise<Crew[]> {
  if (rows.length === 0) return [];
  const members = await query<MemberRow>(
    `SELECT m.crew_id, m.user_id, u.nickname, u.age_group, m.joined_at, m.checked_in, m.finished
       FROM crew_members m JOIN users u ON u.id = m.user_id
      WHERE m.crew_id IN (?) ORDER BY m.joined_at`,
    [rows.map((r) => r.id)],
  );
  const byCrew = new Map<string, Member[]>();
  for (const m of members) byCrew.set(m.crew_id, [...(byCrew.get(m.crew_id) ?? []), toMember(m)]);
  return rows.map((r) => ({
    id: r.id,
    eventId: r.event_id,
    mode: r.mode,
    paceMinPerKm: Number(r.pace_min_per_km),
    courseId: r.course_id,
    startAt: r.start_at.toISOString(),
    eventStartAt: r.event_start_at.toISOString(),
    capacity: r.capacity,
    teenOnly: !!r.teen_only,
    hostId: Number(r.host_id),
    members: byCrew.get(r.id) ?? [],
    createdAt: r.created_at.toISOString(),
  }));
}

export async function listCrews(eventId?: string, opts: { upcomingOnly?: boolean } = {}): Promise<Crew[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (eventId) { where.push("event_id = ?"); params.push(eventId); }
  if (opts.upcomingOnly) where.push("start_at > UTC_TIMESTAMP(3)");
  const rows = await query<CrewRow>(`SELECT * FROM crews ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY start_at LIMIT 200`, params);
  return hydrate(rows);
}

/** 내가 참여 중이고 아직 출발 전인 크루 */
export async function myUpcomingCrews(userId: number): Promise<Crew[]> {
  const rows = await query<CrewRow>(
    `SELECT c.* FROM crews c JOIN crew_members m ON m.crew_id = c.id
     WHERE m.user_id = ? AND c.event_start_at > UTC_TIMESTAMP(3) - INTERVAL 3 HOUR ORDER BY c.start_at LIMIT 20`,
    [userId],
  );
  return hydrate(rows);
}

export async function getCrew(id: string): Promise<Crew | undefined> {
  const rows = await query<CrewRow>("SELECT * FROM crews WHERE id = ?", [id]);
  return (await hydrate(rows))[0];
}

export interface NewCrewInput {
  eventId: string;
  mode: CrewMode;
  paceMinPerKm: number;
  courseId: string;
  startAt: Date;
  eventStartAt: Date;
  capacity: number;
}

/**
 * 번개 생성. 같은 공연·같은 공연 날짜(KST)에 이미 참여 중인 번개가 있으면 만들지 않는다.
 * (한 사람이 같은 공연 번개를 여러 개 열어 매칭 목록을 채우는 것을 막는다)
 */
export async function createCrew(input: NewCrewInput, host: User): Promise<{ crew?: Crew; error?: string }> {
  const id = randomBytes(6).toString("base64url").slice(0, 8);
  // "같은 날짜"는 매칭 규칙(findMatches)과 같게 KST 날짜 기준
  const dayStart = kstDateTime(kstDateString(input.eventStartAt), "00:00");
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  const error = await transaction(async (conn) => {
    // 같은 사용자의 요청이 동시에 와도 둘 다 검사를 통과하지 않도록 사용자 행을 잠근다
    await conn.query("SELECT id FROM users WHERE id = ? FOR UPDATE", [host.id]);
    const [dup] = await conn.query<RowDataPacket[]>(
      `SELECT c.id FROM crews c JOIN crew_members m ON m.crew_id = c.id
        WHERE m.user_id = ? AND c.event_id = ? AND c.event_start_at >= ? AND c.event_start_at < ?
        LIMIT 1`,
      [host.id, input.eventId, dayStart, dayEnd],
    );
    if (dup.length) return "이미 이 공연(같은 날짜)의 번개에 참여 중이에요.";
    await conn.query(
      `INSERT INTO crews (id, event_id, mode, pace_min_per_km, course_id, start_at, event_start_at, capacity, teen_only, host_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.eventId, input.mode, input.paceMinPerKm, input.courseId, input.startAt, input.eventStartAt, input.capacity, host.ageGroup === "14-19", host.id],
    );
    await conn.query("INSERT INTO crew_members (crew_id, user_id) VALUES (?, ?)", [id, host.id]);
    return null;
  });
  if (error) return { error };
  return { crew: (await getCrew(id))! };
}

/** 나를 차단했거나 내가 차단한 사용자 ID */
export async function blockedRelations(userId: number): Promise<Set<number>> {
  const rows = await query<{ other: number }>(
    `SELECT blocked_id AS other FROM blocks WHERE blocker_id = ?
     UNION SELECT blocker_id AS other FROM blocks WHERE blocked_id = ?`,
    [userId, userId],
  );
  return new Set(rows.map((r) => Number(r.other)));
}

export async function joinCrew(crewId: string, user: User): Promise<{ crew?: Crew; error?: string }> {
  const blocked = await blockedRelations(user.id);
  const error = await transaction(async (conn) => {
    // 정원 초과 방지를 위해 크루 행 잠금
    const [rows] = await conn.query<(CrewRow & RowDataPacket)[]>("SELECT * FROM crews WHERE id = ? FOR UPDATE", [crewId]);
    if (!rows[0]) return "크루를 찾을 수 없습니다.";
    const [crew] = await hydrate(rows);
    if (crew.members.some((m) => m.userId === user.id)) return null;
    if (crew.members.some((m) => blocked.has(m.userId))) return "참여할 수 없는 크루입니다.";
    const check = canJoin(crew, user.ageGroup, new Date());
    if (!check.ok) return check.reason ?? "참여할 수 없습니다.";
    await conn.query("INSERT INTO crew_members (crew_id, user_id) VALUES (?, ?)", [crewId, user.id]);
    return null;
  });
  if (error) return { error };
  return { crew: await getCrew(crewId) };
}

export async function updateMember(
  crewId: string,
  userId: number,
  patch: { checkedIn?: boolean; finished?: boolean },
  rewardVenueId?: string,
): Promise<Crew | undefined> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.checkedIn !== undefined) { sets.push("checked_in = ?"); params.push(patch.checkedIn); }
  if (patch.finished !== undefined) { sets.push("finished = ?"); params.push(patch.finished); }
  if (sets.length === 0) return getCrew(crewId);
  const res = await exec(`UPDATE crew_members SET ${sets.join(", ")} WHERE crew_id = ? AND user_id = ?`, [...params, crewId, userId]);
  if (res.affectedRows === 0) return undefined;
  if (patch.finished && rewardVenueId) {
    await exec("INSERT IGNORE INTO user_rewards (user_id, venue_id, crew_id) VALUES (?, ?, ?)", [userId, rewardVenueId, crewId]);
  }
  return getCrew(crewId);
}

/** 나가기. 방장이 나가면 가장 먼저 들어온 멤버에게 위임, 아무도 없으면 크루 삭제 */
export async function leaveCrew(crewId: string, userId: number): Promise<void> {
  await transaction(async (conn) => {
    await conn.query("DELETE FROM crew_members WHERE crew_id = ? AND user_id = ?", [crewId, userId]);
    const [rest] = await conn.query<RowDataPacket[]>("SELECT user_id FROM crew_members WHERE crew_id = ? ORDER BY joined_at LIMIT 1", [crewId]);
    if (rest.length === 0) await conn.query("DELETE FROM crews WHERE id = ?", [crewId]);
    else await conn.query("UPDATE crews SET host_id = ? WHERE id = ? AND host_id = ?", [rest[0].user_id, crewId, userId]);
  });
}

export function isMember(crew: Crew, userId: number): boolean {
  return crew.members.some((m) => m.userId === userId);
}

// ---------- 채팅 ----------

export const MESSAGE_MAX = 500;
/** 서로 다른 사용자에게 이만큼 신고되면 메시지를 자동으로 가린다 */
export const AUTO_HIDE_REPORTS = 2;

export async function listMessages(crewId: string, viewerId: number, afterId = 0): Promise<ChatMessage[]> {
  const blocked = [...(await blockedRelations(viewerId))];
  const rows = await query<{ id: number; user_id: number; nickname: string; body: string; created_at: Date }>(
    `SELECT m.id, m.user_id, u.nickname, m.body, m.created_at
       FROM messages m JOIN users u ON u.id = m.user_id
      WHERE m.crew_id = ? AND m.id > ? AND m.hidden = FALSE
        ${blocked.length ? "AND m.user_id NOT IN (?)" : ""}
      ORDER BY m.id DESC LIMIT 100`,
    blocked.length ? [crewId, afterId, blocked] : [crewId, afterId],
  );
  return rows.reverse().map((r) => ({ id: Number(r.id), userId: Number(r.user_id), nickname: r.nickname, body: r.body, createdAt: r.created_at.toISOString() }));
}

export async function addMessage(crewId: string, userId: number, body: string): Promise<number> {
  const res = await exec("INSERT INTO messages (crew_id, user_id, body) VALUES (?, ?, ?)", [crewId, userId, body]);
  return res.insertId;
}

// ---------- 신고 ----------

export async function createReport(input: {
  reporterId: number;
  targetUserId: number;
  crewId: string;
  messageId?: number;
  reason: ReportReason;
  detail?: string;
}): Promise<{ hidden: boolean; duplicate: boolean }> {
  const dup = await query(
    "SELECT id FROM reports WHERE reporter_id = ? AND target_user_id = ? AND crew_id <=> ? AND message_id <=> ? LIMIT 1",
    [input.reporterId, input.targetUserId, input.crewId, input.messageId ?? null],
  );
  if (dup.length) return { hidden: false, duplicate: true };
  await exec(
    "INSERT INTO reports (reporter_id, target_user_id, crew_id, message_id, reason, detail) VALUES (?, ?, ?, ?, ?, ?)",
    [input.reporterId, input.targetUserId, input.crewId, input.messageId ?? null, input.reason, input.detail ?? null],
  );
  if (!input.messageId) return { hidden: false, duplicate: false };
  const [{ n }] = await query<{ n: number }>("SELECT COUNT(DISTINCT reporter_id) AS n FROM reports WHERE message_id = ?", [input.messageId]);
  if (Number(n) >= AUTO_HIDE_REPORTS) {
    await exec("UPDATE messages SET hidden = TRUE WHERE id = ?", [input.messageId]);
    return { hidden: true, duplicate: false };
  }
  return { hidden: false, duplicate: false };
}

export async function getMessage(id: number): Promise<{ id: number; crewId: string; userId: number } | undefined> {
  const rows = await query<{ id: number; crew_id: string; user_id: number }>("SELECT id, crew_id, user_id FROM messages WHERE id = ?", [id]);
  return rows[0] && { id: Number(rows[0].id), crewId: rows[0].crew_id, userId: Number(rows[0].user_id) };
}

// ---------- 차단 ----------

export async function blockUser(blockerId: number, blockedId: number): Promise<void> {
  await exec("INSERT IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)", [blockerId, blockedId]);
}

export async function unblockUser(blockerId: number, blockedId: number): Promise<void> {
  await exec("DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?", [blockerId, blockedId]);
}

export async function listBlocks(blockerId: number): Promise<{ userId: number; nickname: string; createdAt: string }[]> {
  const rows = await query<{ id: number; nickname: string; created_at: Date }>(
    "SELECT u.id, u.nickname, b.created_at FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = ? ORDER BY b.created_at DESC",
    [blockerId],
  );
  return rows.map((r) => ({ userId: Number(r.id), nickname: r.nickname, createdAt: r.created_at.toISOString() }));
}

export async function userExists(id: number): Promise<boolean> {
  return (await query("SELECT id FROM users WHERE id = ?", [id])).length > 0;
}

// ---------- 보상 ----------

export async function unlockedVenues(userId: number): Promise<string[]> {
  const rows = await query<{ venue_id: string }>("SELECT venue_id FROM user_rewards WHERE user_id = ?", [userId]);
  return rows.map((r) => r.venue_id);
}

/** 내가 완주한 크루(공연·코스 ID) */
export async function finishedCrewRows(userId: number): Promise<{ eventId: string; courseId: string }[]> {
  const rows = await query<{ event_id: string; course_id: string }>(
    `SELECT c.event_id, c.course_id FROM crew_members m JOIN crews c ON c.id = m.crew_id
      WHERE m.user_id = ? AND m.finished = 1`,
    [userId],
  );
  return rows.map((r) => ({ eventId: r.event_id, courseId: r.course_id }));
}
