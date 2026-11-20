// 사용자와 사용자 데이터를 PostgreSQL에 읽고 쓴다. 표 정의는 db/schema.sql.
import { query, transaction } from "./db.js";
import { hashPassword, verifyPassword } from "./password.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USER_COLUMNS = `id, login_id AS "loginId", name`;
export const MAX_FAILS = 5;
export const LOCK_MINUTES = 10;

// 새 사용자. 가입 때 고른 관심 직무(job)는 같은 트랜잭션으로 profiles에 넣는다. 아이디가 이미 있으면 null.
export async function createUser({ loginId, password, name, job = null }) {
  const passwordHash = await hashPassword(password);
  try {
    return await transaction(async (db) => {
      const { rows } = await db.query(
        `INSERT INTO users (login_id, password_hash, name, last_login_at) VALUES ($1, $2, $3, now()) RETURNING ${USER_COLUMNS}`,
        [loginId, passwordHash, name.trim()],
      );
      if (job) await db.query("INSERT INTO profiles (user_id, job) VALUES ($1, $2)", [rows[0].id, job]);
      return rows[0];
    });
  } catch (error) {
    if (error?.code === "23505") return null; // unique_violation: 이미 있는 아이디
    throw error;
  }
}

// 내 정보의 이름 바꾸기. 바뀐 사용자 { id, loginId, name }, 없는 사용자면 null.
export async function updateName(uid, name) {
  if (!UUID.test(uid ?? "")) return null;
  const { rows } = await query(`UPDATE users SET name = $2 WHERE id = $1 RETURNING ${USER_COLUMNS}`, [uid, name.trim()]);
  return rows[0] ?? null;
}

// 내 정보의 비밀번호 바꾸기. 결과: { ok: true } | { error: "wrong" } | { error: "locked" }
// 지금 비밀번호 확인은 로그인(authenticate)과 같은 횟수 세기·잠금을 거친다. 로그인한 채 비밀번호를 맞혀 보는 것도 막으려는 것이다.
// 바꾸면 keepSid(지금 쓰는 세션)만 남기고 이 사용자의 다른 세션을 지워, 다른 기기의 로그인을 끊는다.
export async function changePassword(uid, { current, next, keepSid }) {
  const user = await getUser(uid);
  if (!user) return { error: "wrong" };
  const checked = await authenticate(user.loginId, current);
  if (checked.error) return checked;
  const passwordHash = await hashPassword(next);
  const keep = UUID.test(keepSid ?? "") ? keepSid : null;
  await transaction(async (db) => {
    await db.query("UPDATE users SET password_hash = $2 WHERE id = $1", [uid, passwordHash]);
    await db.query("DELETE FROM sessions WHERE user_id = $1 AND id IS DISTINCT FROM $2::uuid", [uid, keep]);
  });
  return { ok: true };
}

// 없는 아이디도 같은 시간이 걸리도록 가짜 해시와 한 번 비교한다(아이디가 있는지 시간으로 알아내지 못하게).
let dummyHash = null;
const dummy = () => (dummyHash ??= hashPassword("not-a-real-password"));

// 결과: { user } | { error: "wrong" } | { error: "locked" }
// 비밀번호를 확인하기 전에 시도 한 번을 먼저 세고, 다섯 번째 시도에서 바로 잠근다. 세기와 잠그기가 한 문장이라
// 동시에 몰려온 요청도 잠금 전에 다섯 번까지만 비밀번호를 확인한다. 그 시도가 맞으면 아래에서 잠금과 횟수를 푼다.
// 잠금이 끝난 뒤 첫 시도는 1부터 다시 센다.
export async function authenticate(loginId, password) {
  const id = loginId.trim().toLowerCase();
  const { rows } = await query(
    `UPDATE users SET
       failed_count = CASE WHEN failed_count >= $2 THEN 1 ELSE failed_count + 1 END,
       locked_until = CASE WHEN (CASE WHEN failed_count >= $2 THEN 1 ELSE failed_count + 1 END) >= $2
                           THEN now() + make_interval(mins => $3) ELSE NULL END
     WHERE login_id = $1 AND (locked_until IS NULL OR locked_until <= now())
     RETURNING ${USER_COLUMNS}, password_hash`,
    [id, MAX_FAILS, LOCK_MINUTES],
  );
  const row = rows[0];
  if (!row) {
    // 아이디가 있는데 못 셌으면 잠긴 것이다. 가입 화면이 이미 쓰는 아이디를 알려 주므로 여기서 숨길 것은 없다.
    if ((await query("SELECT 1 FROM users WHERE login_id = $1", [id])).rowCount) return { error: "locked" };
    await verifyPassword(password, await dummy());
    return { error: "wrong" };
  }
  if (!(await verifyPassword(password, row.password_hash))) return { error: "wrong" };
  await query("UPDATE users SET failed_count = 0, locked_until = NULL, last_login_at = now() WHERE id = $1", [row.id]);
  return { user: { id: row.id, loginId: row.loginId, name: row.name } };
}

// 로그인 세션 한 줄. 만들 때 이 사용자의 끝난 세션은 치운다.
export async function createSession(userId, maxAgeSeconds) {
  await query("DELETE FROM sessions WHERE user_id = $1 AND expires_at <= now()", [userId]);
  const { rows } = await query(
    "INSERT INTO sessions (user_id, expires_at) VALUES ($1, now() + make_interval(secs => $2)) RETURNING id",
    [userId, maxAgeSeconds],
  );
  return rows[0].id;
}

export async function userForSession(sid) {
  if (!UUID.test(sid ?? "")) return null;
  const { rows } = await query(
    `SELECT u.id, u.login_id AS "loginId", u.name FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > now()`,
    [sid],
  );
  return rows[0] ?? null;
}

export async function deleteSession(sid) {
  if (UUID.test(sid ?? "")) await query("DELETE FROM sessions WHERE id = $1", [sid]);
}

export async function getUser(id) {
  if (!UUID.test(id ?? "")) return null;
  const { rows } = await query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

// 화면 상태와 같은 모양으로 돌려준다. 저장한 적 없는 칸은 null.
export async function loadState(uid) {
  const [p, g, d] = await Promise.all([
    query("SELECT job, experience, level, survey FROM profiles WHERE user_id = $1", [uid]),
    query("SELECT xp, completed, tries, mastery, history, level_up_seen FROM progress WHERE user_id = $1", [uid]),
    query(
      "SELECT at, job, experience, level, prompt, found, missing, detail FROM diagnoses WHERE user_id = $1 ORDER BY at DESC LIMIT 1",
      [uid],
    ),
  ]);
  const profile = p.rows[0];
  const progress = g.rows[0];
  const diag = d.rows[0];
  return {
    profile: profile?.job || profile?.level ? { job: profile.job, experience: profile.experience, level: profile.level } : null,
    survey: profile?.survey ?? null,
    diagnosis: diag
      ? {
          ...diag.detail,
          at: diag.at.toISOString(),
          job: diag.job,
          experience: diag.experience,
          level: diag.level,
          prompt: diag.prompt,
          found: diag.found,
          missing: diag.missing,
        }
      : null,
    record: progress
      ? {
          xp: progress.xp,
          completed: progress.completed,
          tries: progress.tries,
          mastery: progress.mastery,
          history: progress.history,
          levelUpSeen: progress.level_up_seen,
        }
      : null,
  };
}

// state는 lib/server/state.js의 cleanState를 거친 값이다. 진단은 at이 같으면 덮어쓰고(추측·비교 결과가 나중에 붙음), 다르면 새로 쌓는다.
export async function saveState(uid, { profile, survey, diagnosis, record }) {
  await transaction(async (db) => {
    await db.query(
      `INSERT INTO profiles (user_id, job, experience, level, survey, updated_at) VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (user_id) DO UPDATE SET job = EXCLUDED.job, experience = EXCLUDED.experience,
         level = EXCLUDED.level, survey = EXCLUDED.survey, updated_at = now()`,
      [uid, profile?.job ?? null, profile?.experience ?? null, profile?.level ?? null, survey ? JSON.stringify(survey) : null],
    );
    await db.query(
      `INSERT INTO progress (user_id, xp, completed, tries, mastery, history, level_up_seen, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (user_id) DO UPDATE SET xp = EXCLUDED.xp, completed = EXCLUDED.completed, tries = EXCLUDED.tries,
         mastery = EXCLUDED.mastery, history = EXCLUDED.history, level_up_seen = EXCLUDED.level_up_seen, updated_at = now()`,
      [
        uid,
        record.xp,
        record.completed,
        JSON.stringify(record.tries),
        JSON.stringify(record.mastery),
        JSON.stringify(record.history),
        record.levelUpSeen,
      ],
    );
    if (diagnosis) {
      await db.query(
        `INSERT INTO diagnoses (user_id, at, job, experience, level, prompt, found, missing, detail)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (user_id, at) DO UPDATE SET level = EXCLUDED.level, found = EXCLUDED.found,
           missing = EXCLUDED.missing, detail = EXCLUDED.detail`,
        [
          uid,
          diagnosis.at,
          diagnosis.job,
          diagnosis.experience,
          diagnosis.level,
          diagnosis.prompt,
          diagnosis.found,
          diagnosis.missing,
          JSON.stringify(diagnosis.detail),
        ],
      );
    }
  });
}

// 내 정보의 "기록 모두 지우기": 계정은 남기고 진단·학습 기록을 모두 지운다.
// 관심 직무는 기록이 아니라 가입 때 고른 설정이라 남기고, 같은 줄의 나머지 칸(경험, 수준, 설문)만 비운다.
// 랭킹의 첫 점수(first_scores)는 남긴다. 지우고 다시 풀어 첫 시도를 새로 받지 못하게 하려는 것이다.
export async function clearData(uid) {
  await transaction(async (db) => {
    for (const table of ["attempts", "diagnoses", "progress"]) {
      await db.query(`DELETE FROM ${table} WHERE user_id = $1`, [uid]);
    }
    await db.query("DELETE FROM profiles WHERE user_id = $1 AND job IS NULL", [uid]);
    await db.query(
      "UPDATE profiles SET experience = NULL, level = NULL, survey = NULL, updated_at = now() WHERE user_id = $1",
      [uid],
    );
  });
}

// score: 서버가 채점한 강의 점수 0~100(lib/scoreboard.js). 강의마다 처음 받은 점수는 first_scores에 한 번만 남기고,
// 다시 푼 점수는 attempts에만 쌓는다. 랭킹은 first_scores만 읽는다.
export async function recordAttempt(uid, { lessonId, passed, found, missed, score = null }) {
  await transaction(async (db) => {
    await db.query("INSERT INTO attempts (user_id, lesson_id, passed, found, missed, score) VALUES ($1, $2, $3, $4, $5, $6)", [
      uid,
      lessonId,
      passed,
      found,
      missed,
      score,
    ]);
    if (score !== null) {
      await db.query(
        "INSERT INTO first_scores (user_id, lesson_id, score) VALUES ($1, $2, $3) ON CONFLICT (user_id, lesson_id) DO NOTHING",
        [uid, lessonId, score],
      );
    }
  });
}

export async function recentAttempts(uid, limit = 20) {
  const { rows } = await query(
    "SELECT lesson_id, passed, found, missed, created_at FROM attempts WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
    [uid, limit],
  );
  return rows.map((r) => ({ lessonId: r.lesson_id, passed: r.passed, found: r.found, missed: r.missed, at: r.created_at.toISOString() }));
}

export async function userStats(uid) {
  const { rows } = await query(
    `SELECT (SELECT count(*) FROM diagnoses WHERE user_id = $1)::int AS diagnoses,
            (SELECT count(*) FROM attempts WHERE user_id = $1)::int AS attempts`,
    [uid],
  );
  return rows[0];
}
