// db/schema.sql 을 DATABASE_URL 데이터베이스에 적용한다 (CREATE TABLE IF NOT EXISTS 이므로 반복 실행 안전)
// usage: npm run db:migrate
import { readFileSync } from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL이 없습니다. .env.local을 확인하세요.");
  process.exit(1);
}

const sql = readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf8");
const conn = await mysql.createConnection({ uri: url, multipleStatements: true });
try {
  await conn.query("SET time_zone = '+00:00'");
  await conn.query(sql);
  const [rows] = await conn.query("SHOW TABLES");
  console.log("적용 완료. 테이블:", rows.map((r) => Object.values(r)[0]).join(", "));
} finally {
  await conn.end();
}
