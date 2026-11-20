// 부문 점수를 매기는 팀 규칙(작업 F). 순수 함수이고 LLM을 쓰지 않는다. 개인화(과정 추천)와 같은 직무 평균에 쓴다.
// 미션 점수 랭킹은 없어졌다(작업 L). 랭킹은 직무별 시험마다 있다(lib/examScore.js).
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
//   courses는 테스트에서 준비 중 과정을 흉내 낼 때만 넘긴다.
export function areaScores(firstPoints = {}, courses = COURSES) {
  const byCourse = {};
  for (const [id, points] of Object.entries(firstPoints)) {
    const course = COURSE_OF[id];
    if (course && Number.isFinite(points)) (byCourse[course] ??= []).push(points);
  }
  const areas = courses.map((c) => {
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

// DB 행 [{ user_id, lesson_id, score }] → { [user_id]: { [lesson_id]: 첫 시도 점수 } }
export function pointsByUser(rows) {
  const points = {};
  for (const r of rows ?? []) (points[r.user_id] ??= {})[r.lesson_id] = r.score;
  return points;
}

// 같은 직무 평균(작업 I-2). byUser: pointsByUser() 결과(같은 직무 사용자만).
// → { [course]: { avg, n } } 그 부문을 한 번이라도 푼 사람만 센다. 사람이 MIN_PEOPLE보다 적은 부문은 빼서 한두 사람의 점수가 드러나지 않게 한다.
//   평균은 AVG_STEP점 단위로 반올림한다. 한 사람이 더해질 때 평균이 바뀐 만큼으로 그 사람 점수를 거꾸로 셈하기 어렵게.
export const MIN_PEOPLE = 5;
export const AVG_STEP = 5;
export function averageAreas(byUser) {
  const sums = {};
  for (const points of Object.values(byUser ?? {})) {
    for (const a of areaScores(points).areas) {
      if (a.score === null || a.done === 0) continue;
      const s = (sums[a.course] ??= { total: 0, n: 0 });
      s.total += a.score;
      s.n += 1;
    }
  }
  return Object.fromEntries(
    Object.entries(sums)
      .filter(([, s]) => s.n >= MIN_PEOPLE)
      .map(([course, s]) => [course, { avg: Math.round(s.total / s.n / AVG_STEP) * AVG_STEP, n: s.n }]),
  );
}

// mine: areaScores().areas, averages: averageAreas() → [{ course, mine, done, avg, n, gap }] 평균이 있는 부문만.
// gap = 평균 − 내 점수(양수면 평균보다 낮다).
export function jobGaps(mine, averages) {
  return (mine ?? [])
    .filter((a) => a.score !== null && averages?.[a.course])
    .map((a) => ({ course: a.course, mine: a.score, done: a.done, ...averages[a.course], gap: averages[a.course].avg - a.score }));
}

// 시험 랭킹에 보일 닉네임. 2~12자, 한글·영문·숫자·띄어쓰기만. 문제가 없으면 null.
export const NICKNAME = /^[가-힣a-zA-Z0-9 ]+$/;
export function nicknameError(nickname) {
  const name = typeof nickname === "string" ? nickname.trim() : "";
  if (name.length < 2 || name.length > 12) return "닉네임은 2~12자";
  if (!NICKNAME.test(name)) return "닉네임은 한글, 영문, 숫자, 띄어쓰기만";
  return null;
}
