// 랭킹 읽기와 참여 설정. 점수 규칙은 lib/scoreboard.js(팀 규칙)이고, 여기서는 DB에서 강의마다 첫 시도 점수를 모아 넘긴다.
// 랭킹에는 별명만 보인다. 가입 이름(users.name)과 아이디(login_id)는 읽지 않는다.
import { areaScores, nicknameError, rankRows } from "../scoreboard.js";
import { query } from "./db.js";

export const TOP = 10;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 강의마다 처음 받은 점수(first_scores)만 센다. 다시 푼 점수와 점수가 없는 예전 기록(이 기능 전)은 들어 있지 않고,
// 마이페이지 "기록 지우기"를 해도 남는다(lib/server/users.js의 recordAttempt, clearData).
async function firstPoints(userIds) {
  if (!userIds.length) return {};
  const { rows } = await query("SELECT user_id, lesson_id, score FROM first_scores WHERE user_id = ANY($1::uuid[])", [userIds]);
  const points = {};
  for (const r of rows) (points[r.user_id] ??= {})[r.lesson_id] = r.score;
  return points;
}

// meId: 로그인한 사용자 id(없으면 null). job: 이 직무만 센다(없으면 전체).
// → { me: { total, max, areas, done, rank, ranked, nickname, job } | null, top: [{ rank, nickname, job, total, demo, me }] }
export async function loadRanking(meId, job) {
  const me = UUID.test(meId ?? "") ? meId : null;
  const { rows: people } = await query(
    `SELECT u.id, u.nickname, u.ranked, u.demo, p.job
     FROM users u LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.ranked OR u.id = $1`,
    [me],
  );
  const points = await firstPoints(people.map((p) => p.id));
  const scored = people.map((p) => ({ ...p, ...areaScores(points[p.id]) }));
  const ranked = rankRows(scored.filter((p) => p.ranked && p.nickname && (!job || p.job === job)));
  const mine = me ? scored.find((p) => p.id === me) : null;
  return {
    me: mine
      ? {
          total: mine.total,
          max: mine.max,
          areas: mine.areas,
          done: mine.done,
          rank: ranked.find((r) => r.id === me)?.rank ?? null,
          ranked: mine.ranked,
          nickname: mine.nickname,
          job: mine.job,
        }
      : null,
    top: ranked
      .slice(0, TOP)
      .map((r) => ({ rank: r.rank, nickname: r.nickname, job: r.job, total: r.total, demo: r.demo, me: r.id === me })),
  };
}

// { ranked: true, nickname }으로 참여하고, { ranked: false }로 빠진다. 빠져도 별명은 남겨 둔다.
// → { ok: true } | { error, status }
export async function setRanking(uid, body) {
  if (body?.ranked === false) {
    await query("UPDATE users SET ranked = false WHERE id = $1", [uid]);
    return { ok: true };
  }
  if (body?.ranked !== true) return { error: "요청 형식이 올바르지 않아요.", status: 400 };
  const error = nicknameError(body.nickname);
  if (error) return { error, status: 400 };
  try {
    await query("UPDATE users SET ranked = true, nickname = $2 WHERE id = $1", [
      uid,
      body.nickname.trim().replace(/ {2,}/g, " "),
    ]);
  } catch (e) {
    if (e?.code === "23505") return { error: "이미 쓰는 별명이에요.", status: 409 }; // unique_violation
    throw e;
  }
  return { ok: true };
}
