// 직무별 시험 결과 읽기·쓰기(작업 L). 사용자·시험마다 처음 본 점수 한 줄만 둔다. 다시 풀기(연습)는 저장하지 않는다.
// 순위는 lib/examScore.js의 rankRows(점수 높은 순, 같으면 걸린 시간이 짧은 순)로 매긴다.
// 랭킹에는 응시한 사람이 모두 들어가고, 닉네임은 랭킹에 참가한 사람(users.ranked이고 nickname이 있음)만 보인다.
// 가입 이름(users.name)과 아이디(login_id)는 읽지 않는다.
//
// 표는 팀원이 db/schema.sql에 더한다(여기서 만들지 않는다).
//   CREATE TABLE IF NOT EXISTS exam_results (
//     user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
//     exam_id  text NOT NULL,              -- 직무 id
//     scores   smallint[] NOT NULL,        -- 문제별 점수 6개
//     total    smallint NOT NULL,          -- 0~600
//     seconds  integer NOT NULL,           -- 걸린 시간(초)
//     taken_at timestamptz NOT NULL DEFAULT now(),
//     PRIMARY KEY (user_id, exam_id)       -- 사용자·시험마다 처음 본 한 줄
//   );
//   CREATE INDEX IF NOT EXISTS exam_results_rank ON exam_results (exam_id, total DESC, seconds);
//
// 표가 아직 없으면(42P01) 읽기는 notReady: true를 붙인 빈 값을, 저장은 saved: false를 돌려준다. 채점 결과는 그대로 보여 준다.
import { JOBS } from "../../data/jobs.js";
import { rankRows } from "../examScore.js";
import { query } from "./db.js";

export const TOP = 10;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrNull = (id) => (UUID.test(id ?? "") ? id : null);
export const isMissingTable = (error) => error?.code === "42P01"; // undefined_table

// ---------- 순수 함수: DB 없이 가짜 행으로 테스트한다 ----------
// rows: [{ userId, examId, total, seconds, scores, nickname, ranked, demo }] 시험마다 처음 본 점수 한 줄

export const averageOf = (rows) => (rows.length ? Math.round(rows.reduce((sum, r) => sum + r.total, 0) / rows.length) : 0);

// 한 시험의 랭킹. rows는 그 시험의 행만.
// → { takers, avg, top: [{ rank, nickname, demo, me, total, seconds }], me: { rank, total, seconds, scores, nickname } | null }
//   me는 내가 상위 limit명 밖이어도 준다(화면이 '…' 뒤에 내 줄을 붙인다). 닉네임은 랭킹에 참가했을 때만(아니면 null).
const shownName = (r) => (r.ranked && r.nickname ? r.nickname : null);

export function buildBoard(rows, meId = null, limit = TOP) {
  const ranked = rankRows(rows);
  const mine = meId ? ranked.find((r) => r.userId === meId) : null;
  return {
    takers: rows.length,
    avg: averageOf(rows),
    top: ranked.slice(0, limit).map((r) => ({
      rank: r.rank,
      nickname: shownName(r),
      demo: Boolean(r.demo),
      me: Boolean(meId) && r.userId === meId,
      total: r.total,
      seconds: r.seconds,
    })),
    me: mine
      ? { rank: mine.rank, total: mine.total, seconds: mine.seconds, scores: mine.scores ?? [], nickname: shownName(mine) }
      : null,
  };
}

// 시험 목록 카드 다섯 장. → [{ job, takers, avg, mine: { total, rank, seconds } | null }]
export function buildSummary(rows, meId = null) {
  return JOBS.map((job) => {
    const { takers, avg, me } = buildBoard(
      rows.filter((r) => r.examId === job.id),
      meId,
      0,
    );
    return { job: job.id, takers, avg, mine: me && { total: me.total, rank: me.rank, seconds: me.seconds } };
  });
}

export const emptySummary = () => buildSummary([]);

// 이 점수(total, seconds)가 다른 사람들의 처음 점수 사이에서 몇 위인지. 연습 점수의 자리를 셀 때 쓴다.
export function rankAmong(rows, meId, total, seconds) {
  const others = rows.filter((r) => r.userId !== meId);
  return rankRows([...others, { userId: meId, total, seconds }]).find((r) => r.userId === meId).rank;
}

// ---------- DB ----------

// 같은 점수·시간이면 먼저 본 사람이 표에서 위에 오도록 본 순서로 읽는다(rankRows의 정렬은 순서를 지킨다).
const ROWS = `SELECT r.user_id AS "userId", r.exam_id AS "examId", r.total, r.seconds, r.scores, u.nickname, u.ranked, u.demo
  FROM exam_results r JOIN users u ON u.id = r.user_id`;

async function resultRows(job = null) {
  const { rows } = job
    ? await query(`${ROWS} WHERE r.exam_id = $1 ORDER BY r.taken_at`, [job])
    : await query(`${ROWS} ORDER BY r.taken_at`);
  return rows;
}

async function joinedOf(uid) {
  const { rows } = await query("SELECT ranked, nickname FROM users WHERE id = $1", [uid]);
  return Boolean(rows[0]?.ranked && rows[0]?.nickname);
}

// GET /api/exam → { exams: buildSummary() } | { exams: 빈 값, notReady: true }
export async function examSummary(meId) {
  try {
    return { exams: buildSummary(await resultRows(), uuidOrNull(meId)) };
  } catch (error) {
    if (isMissingTable(error)) return { exams: emptySummary(), notReady: true };
    throw error;
  }
}

// GET /api/exam/[job] → buildBoard() + joined(로그인했을 때만 true/false, 손님은 null). 표가 없으면 notReady: true.
// joined는 users 표에서 읽으니 시험 표가 없어도 닉네임 참가 칸은 쓸 수 있다.
export async function examBoard(job, meId) {
  const me = uuidOrNull(meId);
  const joined = me ? await joinedOf(me) : null;
  try {
    return { ...buildBoard(await resultRows(job), me), joined };
  } catch (error) {
    if (isMissingTable(error)) return { ...buildBoard([], me), joined, notReady: true };
    throw error;
  }
}

// 이 시험을 이미 봤는지(시작할 때 연습인지 알려 준다). 표가 없으면 false.
export async function hasFirstResult(uid, job) {
  try {
    const { rowCount } = await query("SELECT 1 FROM exam_results WHERE user_id = $1 AND exam_id = $2", [uid, job]);
    return rowCount > 0;
  } catch (error) {
    if (isMissingTable(error)) return false;
    throw error;
  }
}

// 채점한 결과를 저장한다. 처음 본 결과만 들어가고(동시에 두 번 내도 ON CONFLICT로 한 줄), 다시 푼 것은 넣지 않는다.
// → { saved, counted, first: { total, seconds, rank } | null, rank, takers }
//   counted: 이번 결과가 처음 본 점수로 들어갔는지. first: 랭킹에 들어간 내 점수와 순위.
//   rank: 이번 점수가 다른 사람들 사이에서 몇 위인지(counted면 first.rank와 같다). 표가 없으면 saved: false에 나머지는 null.
export async function saveResult(uid, job, { scores, total, seconds }) {
  let counted;
  try {
    const { rowCount } = await query(
      `INSERT INTO exam_results (user_id, exam_id, scores, total, seconds) VALUES ($1, $2, $3::smallint[], $4, $5)
       ON CONFLICT (user_id, exam_id) DO NOTHING`,
      [uid, job, scores, total, seconds],
    );
    counted = rowCount === 1;
  } catch (error) {
    if (isMissingTable(error)) return { saved: false, counted: false, first: null, rank: null, takers: null };
    throw error;
  }
  const rows = await resultRows(job);
  const { me, takers } = buildBoard(rows, uid, 0);
  return {
    saved: true,
    counted,
    first: me && { total: me.total, seconds: me.seconds, rank: me.rank },
    rank: rankAmong(rows, uid, total, seconds),
    takers,
  };
}
