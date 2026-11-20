// 사용자와 사용자 데이터를 PostgreSQL에 읽고 쓴다. 표 정의는 db/schema.sql.
import { query, transaction } from "./db.js";
import { hashPassword, verifyPassword } from "./password.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USER_COLUMNS = `id, login_id AS "loginId", name`;
export const MAX_FAILS = 5;
export const LOCK_MINUTES = 10;

// 새 사용자. 아이디가 이미 있으면 null.
export async function createUser({ loginId, password, name }) {
  const passwordHash = await hashPassword(password);
  try {
    const { rows } = await query(
      `INSERT INTO users (login_id, password_hash, name, last_login_at) VALUES ($1, $2, $3, now()) RETURNING ${USER_COLUMNS}`,
      [loginId, passwordHash, name.trim()],
    );
    return rows[0];
  } catch (error) {
    if (error?.code === "23505") return null; // unique_violation: 이미 있는 아이디
    throw error;
  }
}

// 없는 아이디도 같은 시간이 걸리도록 가짜 해시와 한 번 비교한다(아이디가 있는지 시간으로 알아내지 못하게).
let dummyHash = null;
const dummy = () => (dummyHash ??= hashPassword("not-a-real-password"));

// 결과: { user } | { error: "wrong" } | { error: "locked" }
export async function authenticate(loginId, password) {
  const { rows } = await query(
    `SELECT ${USER_COLUMNS}, password_hash, locked_until FROM users WHERE login_id = $1`,
    [loginId.trim().toLowerCase()],
  );
  const row = rows[0];
  if (!row) {
    await verifyPassword(password, await dummy());
    return { error: "wrong" };
  }
  if (row.locked_until && row.locked_until > new Date()) return { error: "locked" };
  if (!(await verifyPassword(password, row.password_hash))) {
    // 다섯 번째로 틀리면 10분 동안 막고 횟수를 다시 센다.
    await query(
      `UPDATE users SET
         locked_until = CASE WHEN failed_count + 1 >= $2 THEN now() + make_interval(mins => $3) ELSE locked_until END,
         failed_count = CASE WHEN failed_count + 1 >= $2 THEN 0 ELSE failed_count + 1 END
       WHERE id = $1`,
      [row.id, MAX_FAILS, LOCK_MINUTES],
    );
    return { error: "wrong" };
  }
  await query("UPDATE users SET failed_count = 0, locked_until = NULL, last_login_at = now() WHERE id = $1", [row.id]);
  return { user: { id: row.id, loginId: row.loginId, name: row.name } };
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
    profile: profile?.job ? { job: profile.job, experience: profile.experience, level: profile.level } : null,
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

// 마이페이지의 "기록 지우기": 계정은 남기고 진단·학습 기록을 모두 지운다.
export async function clearData(uid) {
  await transaction(async (db) => {
    for (const table of ["attempts", "diagnoses", "progress", "profiles"]) {
      await db.query(`DELETE FROM ${table} WHERE user_id = $1`, [uid]);
    }
  });
}

export async function recordAttempt(uid, { lessonId, passed, found, missed }) {
  await query("INSERT INTO attempts (user_id, lesson_id, passed, found, missed) VALUES ($1, $2, $3, $4, $5)", [
    uid,
    lessonId,
    passed,
    found,
    missed,
  ]);
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
