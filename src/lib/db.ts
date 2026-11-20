import mysql from "mysql2/promise";

/**
 * MySQL 커넥션 풀 (서버 전용). 개발 모드 핫리로드 시 풀이 중복 생성되지 않도록 globalThis에 보관.
 * 모든 DATETIME은 UTC로 읽고 쓴다.
 */
const g = globalThis as unknown as { __orcPool?: mysql.Pool };

export function db(): mysql.Pool {
  if (!g.__orcPool) {
    const uri = process.env.DATABASE_URL;
    if (!uri) throw new Error("DATABASE_URL이 설정되지 않았습니다 (.env.local)");
    g.__orcPool = mysql.createPool({ uri, timezone: "Z", connectionLimit: 10, supportBigNumbers: true, bigNumberStrings: false });
    // DEFAULT CURRENT_TIMESTAMP / UTC_TIMESTAMP가 서버 로컬 시간대(KST)가 아닌 UTC로 기록되도록 세션 시간대 고정
    g.__orcPool.on("connection", (conn) => {
      conn.query("SET time_zone = '+00:00'");
    });
  }
  return g.__orcPool;
}

export async function query<T = mysql.RowDataPacket>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await db().query(sql, params);
  return rows as T[];
}

export async function exec(sql: string, params: unknown[] = []): Promise<mysql.ResultSetHeader> {
  const [res] = await db().query(sql, params);
  return res as mysql.ResultSetHeader;
}

/**
 * readCommitted: 이 트랜잭션만 READ COMMITTED로 실행한다.
 * 일반 SELECT도 스냅샷이 아니라 매번 최신 커밋 상태를 읽고, 빈 구간 잠금(gap lock)을 걸지 않는다.
 */
export async function transaction<T>(fn: (conn: mysql.PoolConnection) => Promise<T>, opts: { readCommitted?: boolean } = {}): Promise<T> {
  const conn = await db().getConnection();
  try {
    // SESSION 없이 쓰면 바로 다음 트랜잭션 하나에만 적용된다
    if (opts.readCommitted) await conn.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
