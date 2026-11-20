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
