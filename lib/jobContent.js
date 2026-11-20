// 관심 직무에 맞춘 미션 내용(작업 K, 2026-11-21).
// 미션이 가르치는 기술(제목, 배우기, 푸는 방식, 통과 숫자, 칸 이름)은 공통이고,
// 상황·자료·모범 답·예시 결과·카드·정답표는 직무마다 다르다. 직무별로 바꿀 칸은 data/jobMissions/<직무 id>.js에 있다.
//
// 직무 파일 모양: export default { [미션 id]: 바꿀 칸 }
//   바꿀 칸은 미션 데이터(data/curriculum.js, data/courses.js, data/moreMissions.js)와 같은 이름을 쓰고, 그 칸을 통째로 바꾼다.
//   예: mission(할 일), model(모범 답), outputs, material, cards, sentences, missing, source, answerName, answerTitle,
//       samples, sampleLabel, check, coaching, mustDetail, tryAsk
//   criteria만은 배열 자리마다 합친다: criteria: [{ check }, undefined, { label, check, question }]처럼 바꿀 기준만 적는다.
//   FIXED에 있는 칸은 직무 파일에 적어도 쓰지 않는다(모든 직무가 같은 기술을 배우게).
// 직무가 없거나(손님이 직무를 안 고름) 직무 파일에 그 미션이 없으면 공통 미션을 그대로 쓴다.
import cs from "../data/jobMissions/cs.js";
import dev from "../data/jobMissions/dev.js";
import marketing from "../data/jobMissions/marketing.js";
import office from "../data/jobMissions/office.js";
import sales from "../data/jobMissions/sales.js";

export const JOB_MISSIONS = { office, marketing, cs, sales, dev };

export const FIXED = new Set([
  "id",
  "course",
  "kind",
  "focus",
  "level",
  "title",
  "summary",
  "lecture",
  "pass",
  "xp",
  "bins",
  "kinds",
  "showTarget",
  "mustNote",
  "noRun",
  "practice",
]);

const cache = new WeakMap();

// 같은 미션·직무면 같은 객체를 돌려준다(화면의 effect가 미션이 바뀐 줄 알고 다시 돌지 않게).
export function lessonFor(lesson, job) {
  const over = lesson && job ? JOB_MISSIONS[job]?.[lesson.id] : null;
  if (!over) return lesson;
  let byJob = cache.get(lesson);
  if (!byJob) cache.set(lesson, (byJob = new Map()));
  if (byJob.has(job)) return byJob.get(job);
  const { criteria, ...rest } = over;
  const merged = { ...lesson, job };
  for (const [key, value] of Object.entries(rest)) if (!FIXED.has(key) && value !== undefined) merged[key] = value;
  if (Array.isArray(criteria)) merged.criteria = lesson.criteria.map((c, i) => ({ ...c, ...(criteria[i] ?? {}) }));
  byJob.set(job, merged);
  return merged;
}
