// 부문 점수 읽기(개인화)와 시험 랭킹에 쓸 닉네임 설정. 점수 규칙은 lib/scoreboard.js(팀 규칙)이고, 여기서는 DB에서 강의마다 첫 시도 점수를 모아 넘긴다.
// 랭킹에는 닉네임만 보인다. 가입 이름(users.name)과 아이디(login_id)는 읽지 않는다.
import { areaScores, averageAreas, nicknameError, pointsByUser } from "../scoreboard.js";
import { query } from "./db.js";


// 강의마다 처음 받은 점수(first_scores)만 센다. 다시 푼 점수와 점수가 없는 예전 기록(이 기능 전)은 들어 있지 않고,
// 마이페이지 "기록 지우기"를 해도 남는다(lib/server/users.js의 recordAttempt, clearData).
async function firstRows(userIds) {
  if (!userIds.length) return [];
  const { rows } = await query("SELECT user_id, lesson_id, score FROM first_scores WHERE user_id = ANY($1::uuid[])", [userIds]);
  return rows;
}

// 내 부문 점수(작업 I-1). → areaScores() 결과 { areas, total, max, done }
export async function myAreas(uid) {
  return areaScores(pointsByUser(await firstRows([uid]))[uid]);
}

// 같은 직무 사용자의 부문별 평균(작업 I-2). 랭킹 참여와 상관없이 세고, 예시 사용자(demo)도 들어간다.
// 5명보다 적은 부문은 주지 않는다(lib/scoreboard.js의 averageAreas). → { [course]: { avg, n } }
export async function jobAverages(job) {
  if (!job) return {};
  const { rows } = await query("SELECT user_id FROM profiles WHERE job = $1", [job]);
  return averageAreas(pointsByUser(await firstRows(rows.map((r) => r.user_id))));
}

// { ranked: true, nickname }으로 참여하고, { ranked: false }로 빠진다. 빠져도 닉네임은 남겨 둔다.
// → { ok: true } | { error, status }
export async function setRanking(uid, body) {
  if (body?.ranked === false) {
    await query("UPDATE users SET ranked = false WHERE id = $1", [uid]);
    return { ok: true };
  }
  if (body?.ranked !== true) return { error: "요청 형식이 올바르지 않음.", status: 400 };
  const error = nicknameError(body.nickname);
  if (error) return { error, status: 400 };
  try {
    await query("UPDATE users SET ranked = true, nickname = $2 WHERE id = $1", [
      uid,
      body.nickname.trim().replace(/ {2,}/g, " "),
    ]);
  } catch (e) {
    if (e?.code === "23505") return { error: "이미 쓰는 닉네임.", status: 409 }; // unique_violation
    throw e;
  }
  return { ok: true };
}
