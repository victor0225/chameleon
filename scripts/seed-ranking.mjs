// 시연용 예시 사용자 8명과 첫 시도 기록을 넣는다. 사람이 적어도 랭킹이 비어 보이지 않게 한다.
// 사용: node scripts/seed-ranking.mjs (.env.local의 DATABASE_URL을 쓴다. 먼저 npm run db:migrate)
// - 예시 사용자는 demo, ranked로 넣고 별명은 "예시 사용자 n"이다. 랭킹 표에 "예시" 표시가 붙는다.
// - 로그인할 수 없게 비밀번호 칸에는 무작위 문자열의 해시를 넣고, 아이디는 가입 규칙에 없는 demo_n으로 한다.
// - 다시 돌려도 겹치지 않게 예시 사용자를 지우고 다시 넣는다.
// - 로컬 DB가 아니면 --yes를 붙여야 돌아간다. 배포 DB에 넣기 전에는 팀에 먼저 묻는다.
import crypto from "node:crypto";
import pg from "pg";
import { findAnyLesson } from "../data/courses.js";
import { hashPassword } from "../lib/server/password.js";
import { areaScores } from "../lib/scoreboard.js";

try {
  process.loadEnvFile(new URL("../.env.local", import.meta.url));
} catch {
  // .env.local이 없으면 환경 변수의 DATABASE_URL을 쓴다.
}

// 강의 id → 첫 시도 점수(0~100). 합계가 고르게 퍼지도록 정했다.
const PEOPLE = [
  { job: "marketing", scores: { b1: 100, b3: 67, mem1: 88, file1: 100, ver1: 50, tool1: 100 } },
  { job: "office", scores: { b1: 100, b2: 100, m1: 80, mem1: 100, mem2: 80, file1: 75, ver1: 75, tool1: 83 } },
  { job: "office", scores: { b1: 100, b2: 80, mem1: 88, mem2: 60, file1: 75, ver1: 75, tool1: 83 } },
  { job: "cs", scores: { b1: 100, b2: 67, mem1: 75, mem2: 100, ver1: 100, tool1: 67 } },
  { job: "office", scores: { b1: 100, mem1: 100, file1: 50, ver1: 25, tool1: 50 } },
  { job: "dev", scores: { b1: 100, b2: 100, b3: 100, m1: 100, file1: 100, ver1: 75 } },
  { job: "sales", scores: { b1: 67, mem1: 63, tool1: 83 } },
  { job: "marketing", scores: { b1: 33, b2: 67 } },
];

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL이 없어요. .env.local에 넣거나 환경 변수로 주세요.");
  process.exit(1);
}
const host = new URL(url).hostname;
if (!["localhost", "127.0.0.1", "::1"].includes(host) && !process.argv.includes("--yes")) {
  console.error(`로컬 DB가 아니에요(${host}). 이 DB에 예시 사용자를 넣으려면 팀에 묻고 --yes를 붙여 다시 돌려 주세요.`);
  process.exit(1);
}
for (const p of PEOPLE) {
  for (const id of Object.keys(p.scores)) if (!findAnyLesson(id)) throw new Error(`없는 강의 id: ${id}`);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("BEGIN");
  const removed = await client.query("DELETE FROM users WHERE demo");
  for (const [i, person] of PEOPLE.entries()) {
    const n = i + 1;
    const name = `예시 사용자 ${n}`;
    const passwordHash = await hashPassword(crypto.randomBytes(32).toString("base64url"));
    const { rows } = await client.query(
      `INSERT INTO users (login_id, password_hash, name, nickname, ranked, demo) VALUES ($1, $2, $3, $3, true, true) RETURNING id`,
      [`demo_${n}`, passwordHash, name],
    );
    const uid = rows[0].id;
    await client.query("INSERT INTO profiles (user_id, job, experience) VALUES ($1, $2, 'often')", [uid, person.job]);
    // 며칠 전에 처음 푼 것으로 남긴다.
    for (const [lessonId, score] of Object.entries(person.scores)) {
      await client.query(
        `INSERT INTO attempts (user_id, lesson_id, passed, found, missed, score, created_at)
         VALUES ($1, $2, $3, '{}', '{}', $4, now() - make_interval(days => $5))`,
        [uid, lessonId, score >= 70, score, PEOPLE.length - i],
      );
    }
    const { total, max } = areaScores(person.scores);
    console.log(`${name} (${person.job}): ${total} / ${max}`);
  }
  await client.query("COMMIT");
  console.log(`예시 사용자 ${removed.rowCount}명을 지우고 ${PEOPLE.length}명을 넣었어요.`);
} catch (error) {
  await client.query("ROLLBACK");
  if (error?.code === "23505") console.error("이미 누가 '예시 사용자 n' 별명을 쓰고 있어요. 그 별명을 바꾼 뒤 다시 돌려 주세요.");
  throw error;
} finally {
  await client.end();
}
