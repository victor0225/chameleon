-- 카멜레온 DB 표. 여러 번 실행해도 되도록 IF NOT EXISTS로 만든다. (npm run db:migrate)

-- 아이디·비밀번호로 가입한 사용자. 비밀번호는 scrypt 해시로만 둔다(lib/server/password.js).
-- failed_count, locked_until: 비밀번호를 5번 틀리면 10분 동안 로그인을 막는다.
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login_id      text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name          text NOT NULL,
  failed_count  integer NOT NULL DEFAULT 0,
  locked_until  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

-- 로그인 세션. 쿠키에는 이 id만 서명해 담고, 로그아웃하면 줄을 지워 그 쿠키를 더는 못 쓰게 한다.
CREATE TABLE IF NOT EXISTS sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

-- 진단 설문과 지금 수준. 화면의 profile, survey와 같다.
CREATE TABLE IF NOT EXISTS profiles (
  user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  job        text,
  experience text,
  level      text,
  survey     jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 학습 기록. 화면의 record와 같다.
CREATE TABLE IF NOT EXISTS progress (
  user_id        uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp             integer NOT NULL DEFAULT 0,
  completed      text[] NOT NULL DEFAULT '{}',
  tries          jsonb NOT NULL DEFAULT '{}',
  mastery        jsonb NOT NULL DEFAULT '{}',
  history        jsonb NOT NULL DEFAULT '[]',
  level_up_seen  text[] NOT NULL DEFAULT '{}',
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- 진단을 받을 때마다 한 줄. at은 화면에서 진단한 시각이라 같은 진단을 두 번 넣지 않게 막는다.
CREATE TABLE IF NOT EXISTS diagnoses (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  at         timestamptz NOT NULL,
  job        text NOT NULL,
  experience text,
  level      text NOT NULL,
  prompt     text NOT NULL,
  found      text[] NOT NULL,
  missing    text[] NOT NULL,
  detail     jsonb NOT NULL DEFAULT '{}',
  UNIQUE (user_id, at)
);

-- 교육 실습을 제출할 때마다 한 줄. 개인화 엔진이 못 넘은 기준(missed)을 요소별로 센다.
CREATE TABLE IF NOT EXISTS attempts (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id  text NOT NULL,
  passed     boolean NOT NULL,
  found      text[] NOT NULL,
  missed     text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);
CREATE INDEX IF NOT EXISTS attempts_user_recent ON attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS diagnoses_user_recent ON diagnoses (user_id, at DESC);

-- 부문 점수와 랭킹(작업 F). 이미 만든 DB에도 칸을 더할 수 있게 ALTER로 둔다.
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS score smallint;                     -- 0~100. 빈 값은 이 기능 전 기록
ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname text;                          -- 랭킹에 보일 별명
ALTER TABLE users ADD COLUMN IF NOT EXISTS ranked boolean NOT NULL DEFAULT false;  -- 랭킹 참여. 기본은 꺼짐
ALTER TABLE users ADD COLUMN IF NOT EXISTS demo boolean NOT NULL DEFAULT false;    -- 시연용 예시 사용자
CREATE UNIQUE INDEX IF NOT EXISTS users_nickname ON users (nickname) WHERE nickname IS NOT NULL;
CREATE INDEX IF NOT EXISTS attempts_first ON attempts (user_id, lesson_id, created_at);

-- 강의마다 처음 받은 점수. 랭킹은 이 표만 읽는다. 마이페이지 "기록 지우기"가 attempts를 지워도 이 표는 남겨서,
-- 지우고 다시 풀어 첫 시도를 새로 받지 못하게 한다. 계정을 지우면 함께 지워진다.
CREATE TABLE IF NOT EXISTS first_scores (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id  text NOT NULL,
  score      smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);
-- 이 표를 만들기 전에 attempts에 남은 점수를 옮긴다. 여러 번 돌려도 이미 있는 줄은 그대로 둔다.
INSERT INTO first_scores (user_id, lesson_id, score, created_at)
SELECT DISTINCT ON (user_id, lesson_id) user_id, lesson_id, score, created_at
FROM attempts
WHERE score IS NOT NULL
ORDER BY user_id, lesson_id, created_at
ON CONFLICT (user_id, lesson_id) DO NOTHING;
