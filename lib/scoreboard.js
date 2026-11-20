// 부문 점수와 랭킹을 매기는 팀 규칙(작업 F). 순수 함수이고 LLM을 쓰지 않는다.
// 본인 점수 = 여섯 부문(= 여섯 과정)의 점수 합. 부문 점수 = 그 과정 강의들의 첫 시도 점수 평균.
// XP(통과한 강의 × 30)는 "얼마나 했나"를 보여 주는 숫자라 여기서 쓰지 않는다.
import { ALL_LESSONS, COURSES } from "../data/courses.js";

const percent = (part, whole) => (whole > 0 ? Math.round((Math.max(0, part) / whole) * 100) : 0);

// 채점 결과 하나 → 강의 점수 0~100(정수).
//   prompt, file: 채운 기준 수 ÷ 전체 기준 수. file의 "보고서에 없는 숫자"는 넣지 않는다(AI가 지어낸 것은 사용자 잘못이 아니다).
//   sort, choose: 맞힌 카드 수 ÷ 전체 카드 수
//   spot: (찾은 곳 − 맞는 문장을 틀렸다고 고른 수) ÷ 숨긴 곳 수. 문장을 전부 골라 다 찾은 것처럼 되지 않게 뺀다. 0 아래로는 안 내려간다.
export function lessonPoints(lesson, result) {
  const kind = lesson?.kind ?? "prompt";
  if (kind === "sort" || kind === "choose") return percent(result.score?.right ?? 0, result.score?.total ?? 0);
  if (kind === "spot") return percent((result.score?.found ?? 0) - (result.score?.falsePicks ?? 0), result.score?.total ?? 0);
  const criteria = result.criteria ?? [];
  return percent(criteria.filter((c) => c.met).length, criteria.length);
}

const COURSE_OF = Object.fromEntries(ALL_LESSONS.map((l) => [l.id, l.course]));

// firstPoints: { [강의 id]: 첫 시도 점수 } → { areas: [{ course, score, done }], total, max, done }
//   강의는 원래 속한 과정에만 센다("같이 보면 좋은 강의"로 다른 과정에 보여도 두 번 세지 않는다).
//   안 푼 부문은 0점. 준비 중 과정은 score: null이고 합계와 만점에서 뺀다. 만점 = 열린 과정 수 × 100.
export function areaScores(firstPoints = {}) {
  const byCourse = {};
  for (const [id, points] of Object.entries(firstPoints)) {
    const course = COURSE_OF[id];
    if (course && Number.isFinite(points)) (byCourse[course] ??= []).push(points);
  }
  const areas = COURSES.map((c) => {
    const list = byCourse[c.id] ?? [];
    if (!c.ready) return { course: c.id, score: null, done: 0 };
    const score = list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : 0;
    return { course: c.id, score, done: list.length };
  });
  const open = areas.filter((a) => a.score !== null);
  return {
    areas,
    total: open.reduce((sum, a) => sum + a.score, 0),
    max: open.length * 100,
    done: open.reduce((sum, a) => sum + a.done, 0),
  };
}

// rows: [{ total, done, ... }] → 합계가 높은 순, 같으면 푼 강의가 많은 순으로 정렬하고 rank를 붙인다.
// 둘 다 같으면 같은 순위다(1, 1, 3).
export function rankRows(rows) {
  const sorted = [...rows].sort((a, b) => b.total - a.total || b.done - a.done);
  let rank = 0;
  return sorted.map((row, i) => {
    const prev = sorted[i - 1];
    if (!prev || prev.total !== row.total || prev.done !== row.done) rank = i + 1;
    return { ...row, rank };
  });
}

// 랭킹에 보일 별명. 2~12자, 한글·영문·숫자·띄어쓰기만. 문제가 없으면 null.
export const NICKNAME = /^[가-힣a-zA-Z0-9 ]+$/;
export function nicknameError(nickname) {
  const name = typeof nickname === "string" ? nickname.trim() : "";
  if (name.length < 2 || name.length > 12) return "별명은 2~12자로 정해 주세요.";
  if (!NICKNAME.test(name)) return "별명에는 한글, 영문, 숫자, 띄어쓰기만 쓸 수 있어요.";
  return null;
}
