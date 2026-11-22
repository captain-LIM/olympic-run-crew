-- 공연 전 한 바퀴 · MySQL 8 스키마
-- 적용: npm run db:migrate  (모든 시각은 UTC로 저장)

CREATE TABLE IF NOT EXISTS users (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nickname      VARCHAR(12)  NOT NULL,
  age_group     ENUM('14-19','20s','30s','40+') NOT NULL,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 세션 토큰은 SHA-256 해시만 저장 (DB 유출 시에도 토큰 재사용 불가)
CREATE TABLE IF NOT EXISTS sessions (
  id         CHAR(64)        NOT NULL PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME(3)     NOT NULL,
  created_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_sessions_user (user_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS crews (
  id              CHAR(8)          NOT NULL PRIMARY KEY,
  event_id        VARCHAR(32)      NOT NULL,
  mode            ENUM('walk','jog','run') NOT NULL,
  pace_min_per_km DECIMAL(4,1)     NOT NULL,
  course_id       VARCHAR(32)      NOT NULL,
  start_at        DATETIME(3)      NOT NULL,
  event_start_at  DATETIME(3)      NOT NULL,
  capacity        TINYINT UNSIGNED NOT NULL,
  teen_only       BOOLEAN          NOT NULL DEFAULT FALSE,
  host_id         BIGINT UNSIGNED  NOT NULL,
  created_at      DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_crews_event (event_id, event_start_at),
  KEY idx_crews_start (start_at),
  CONSTRAINT fk_crews_host FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS crew_members (
  crew_id    CHAR(8)         NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  joined_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  checked_in BOOLEAN         NOT NULL DEFAULT FALSE,
  finished   BOOLEAN         NOT NULL DEFAULT FALSE,
  PRIMARY KEY (crew_id, user_id),
  KEY idx_members_user (user_id),
  CONSTRAINT fk_members_crew FOREIGN KEY (crew_id) REFERENCES crews(id) ON DELETE CASCADE,
  CONSTRAINT fk_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 크루 채팅. 서로 다른 사용자 신고가 일정 수 이상 쌓이면 hidden 처리
CREATE TABLE IF NOT EXISTS messages (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  crew_id    CHAR(8)         NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  body       VARCHAR(500)    NOT NULL,
  hidden     BOOLEAN         NOT NULL DEFAULT FALSE,
  created_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_messages_crew (crew_id, id),
  CONSTRAINT fk_messages_crew FOREIGN KEY (crew_id) REFERENCES crews(id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS reports (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reporter_id    BIGINT UNSIGNED NOT NULL,
  target_user_id BIGINT UNSIGNED NOT NULL,
  crew_id        CHAR(8)         NULL,
  message_id     BIGINT UNSIGNED NULL,
  reason         ENUM('spam','abuse','harassment','unsafe','other') NOT NULL,
  detail         VARCHAR(500)    NULL,
  status         ENUM('open','reviewed','dismissed') NOT NULL DEFAULT 'open',
  created_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_reports_target (target_user_id),
  KEY idx_reports_message (message_id),
  KEY idx_reports_reporter (reporter_id),
  CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_reports_target FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_reports_crew FOREIGN KEY (crew_id) REFERENCES crews(id) ON DELETE SET NULL,
  CONSTRAINT fk_reports_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS blocks (
  blocker_id BIGINT UNSIGNED NOT NULL,
  blocked_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (blocker_id, blocked_id),
  KEY idx_blocks_blocked (blocked_id),
  CONSTRAINT fk_blocks_blocker FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_blocks_blocked FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 크루 완주로 해금한 공연장 3D '무대 시점'
CREATE TABLE IF NOT EXISTS user_rewards (
  user_id    BIGINT UNSIGNED NOT NULL,
  venue_id   VARCHAR(32)     NOT NULL,
  crew_id    CHAR(8)         NULL,
  created_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, venue_id),
  CONSTRAINT fk_rewards_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_rewards_crew FOREIGN KEY (crew_id) REFERENCES crews(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 요청 횟수 제한 (로그인·회원가입·채팅). 서버 메모리가 아니라 DB에 두어
-- 재시작이나 서버 여러 대(Vercel 서버리스 인스턴스)에서도 같은 기록을 본다.
-- subject는 이메일·IP 원문 대신 SHA-256 해시(64자)로 저장한다.
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket       VARCHAR(32)  NOT NULL,
  subject      CHAR(64)     NOT NULL,
  window_start DATETIME     NOT NULL,
  hits         INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, subject, window_start),
  KEY idx_rate_limits_window (window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
