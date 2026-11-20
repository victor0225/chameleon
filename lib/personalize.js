// 개인화 엔진: DB에 쌓인 진단·실습 기록으로 사용자마다 다음에 풀 미션을 고르고, 고른 이유를 문장으로 붙인다.
// LLM을 쓰지 않는 팀 규칙이다. 숫자(가중치)는 해커톤용 첫 값이라 바꿔도 된다.
// 과정 1은 수준과 요소로, 과정 2~6은 과정마다 아직 안 끝낸 첫 미션 하나를 lib/courseWeakness.js 점수로 같은 줄에서 견준다(작업 I).
import { COURSES, findAnyLesson } from "../data/courses.js";
import { LESSONS } from "../data/curriculum.js";
import { courseWeakness } from "./courseWeakness.js";
import { ITEMS } from "./items.js";

export const LEVELS = ["초급", "중급", "고급"];
const RECENT_ATTEMPTS = 10;
export const WEIGHT = {
  missingInDiagnosis: 3, // 마지막 진단 프롬프트에 빠진 요소
  missedCriterion: 1.5, // 최근 실습에서 못 넘은 기준 하나(요소마다 세 번까지 셈)
  lowMastery: 1 / 40, // 숙련도 100에서 모자란 만큼 (0~2.5점)
  myLevel: 2,
  lowerLevel: 1,
  nextLevel: 0.5,
  failedBefore: 1, // 지난번 이 미션을 통과하지 못함
  sameFocus: 1.5, // 이미 고른 미션과 같은 요소면 빼는 점수(한 요소에 몰리지 않게)
  sameCourse: 1.5, // 이미 고른 미션과 같은 과정이면 빼는 점수(한 과정에 몰리지 않게)
  repeatMissing: 2, // 최근 진단 세 번 중 두 번 이상 빠진 요소
};

// 요소별 약한 정도. 점수가 높을수록 먼저 연습할 요소다.
// trend: lib/diagnosisTrend.js 결과. repeatMissing 요소는 더 약하게 본다.
export function weaknesses({ diagnosis, record, attempts, trend }) {
  const recent = (attempts ?? []).slice(0, RECENT_ATTEMPTS);
  return ITEMS.map(({ id, name }) => {
    const mastery = record?.mastery?.[id] ?? 0;
    const missed = recent.filter((a) => !a.passed && a.missed?.includes(id)).length;
    const inDiagnosis = Boolean(diagnosis?.missing?.includes(id));
    const repeat = trend?.repeatMissing?.find((r) => r.id === id);
    const score =
      (inDiagnosis ? WEIGHT.missingInDiagnosis : 0) +
      (repeat ? WEIGHT.repeatMissing : 0) +
      Math.min(missed, 3) * WEIGHT.missedCriterion +
      (100 - mastery) * WEIGHT.lowMastery;
    const reasons = [];
    // 이유는 개조식 한 줄이다. "기준" 요소는 "기준 기준"이 되지 않게 이름만 쓴다.
    if (missed) reasons.push(`최근 실습에서 ${id === "criteria" ? name : `${name} 기준`} ${missed}번 못 넘음`);
    if (repeat) {
      reasons.push(
        repeat.times === repeat.of
          ? `최근 진단 ${repeat.of}번 모두 ${name} 누락`
          : `최근 진단 ${repeat.of}번 중 ${repeat.times}번 ${name} 누락`,
      );
    }
    if (inDiagnosis && !repeat) reasons.push(`진단 프롬프트에서 ${name} 누락`);
    if (mastery < 40) reasons.push(`${name} 숙련도 아직 ${mastery}`);
    return { id, name, score, mastery, missed, inDiagnosis, reasons };
  }).sort((a, b) => b.score - a.score || ITEMS.findIndex((i) => i.id === a.id) - ITEMS.findIndex((i) => i.id === b.id));
}

// 최근 기록에서 이 강의를 마지막으로 낸 것이 실패였는지
function failedLast(lessonId, attempts) {
  const last = (attempts ?? []).find((a) => a.lessonId === lessonId);
  return Boolean(last && !last.passed);
}

// level: 지금 수준. 과정 2~6을 고르려면 courses(courseWeakness에 넘길 { areas, signals, used, gaps, job })를 준다.
// trend: lib/diagnosisTrend.js 결과.
// 반환: { focus: 가장 약한 요소, weak: 요소별 약한 정도, items: [{ lessonId, title, course, level, focus, reasons }] }
//   과정 2~6 미션은 level, focus가 null이다.
export function personalize({ level, diagnosis, record, attempts, trend, courses, limit = 3 }) {
  const myIndex = Math.max(0, LEVELS.indexOf(level));
  const completed = record?.completed ?? [];
  const weak = weaknesses({ diagnosis, record, attempts, trend });
  const byId = Object.fromEntries(weak.map((w) => [w.id, w]));
  const myLevelDone = LESSONS.filter((l) => l.level === LEVELS[myIndex]).every((l) => completed.includes(l.id));

  const candidates = LESSONS.map((lesson, order) => ({ lesson, order, index: LEVELS.indexOf(lesson.level) }))
    .filter(({ lesson, index }) => !completed.includes(lesson.id) && (index <= myIndex || (index === myIndex + 1 && myLevelDone)))
    .map(({ lesson, order, index }) => {
      const failed = failedLast(lesson.id, attempts);
      const levelScore = index === myIndex ? WEIGHT.myLevel : index < myIndex ? WEIGHT.lowerLevel : WEIGHT.nextLevel;
      return {
        lesson,
        course: "prompt",
        index,
        failed,
        score: byId[lesson.focus].score + levelScore + (failed ? WEIGHT.failedBefore : 0) - order * 0.01,
      };
    });

  // 과정 2~6: 과정마다 아직 안 끝낸 첫 미션 하나(순서대로 풀게)
  if (courses) {
    const weakCourse = courseWeakness(courses);
    COURSES.forEach((c, order) => {
      if (!weakCourse[c.id]) return;
      const id = c.lessons.find((lessonId) => !completed.includes(lessonId));
      if (!id) return;
      const failed = failedLast(id, attempts);
      candidates.push({
        lesson: findAnyLesson(id),
        course: c.id,
        failed,
        courseReasons: weakCourse[c.id].reasons,
        score: weakCourse[c.id].score + (failed ? WEIGHT.failedBefore : 0) - order * 0.01,
      });
    });
  }

  // 이미 고른 미션과 요소나 과정이 같으면 점수를 깎는다.
  const usedFocus = [];
  const usedCourse = [];
  const adjusted = (c) =>
    c.score - (c.lesson.focus && usedFocus.includes(c.lesson.focus) ? WEIGHT.sameFocus : 0) - (usedCourse.includes(c.course) ? WEIGHT.sameCourse : 0);

  const items = [];
  while (items.length < limit && candidates.length) {
    candidates.sort((a, b) => adjusted(b) - adjusted(a));
    const { lesson, course, index, failed, courseReasons } = candidates.shift();
    if (lesson.focus) usedFocus.push(lesson.focus);
    usedCourse.push(course);
    const reasons = [];
    if (failed) reasons.push("지난번 통과 못 함");
    if (courseReasons) {
      reasons.push(...courseReasons);
      if (!reasons.length) reasons.push("과정 순서상 다음 미션");
      items.push({ lessonId: lesson.id, title: lesson.title, course, level: null, focus: null, reasons: reasons.slice(0, 2) });
      continue;
    }
    reasons.push(...byId[lesson.focus].reasons);
    if (!reasons.length) {
      reasons.push(
        index < myIndex
          ? `${lesson.level}에서 아직 안 끝낸 미션`
          : index > myIndex
            ? `${LEVELS[myIndex]}을 다 마쳐 다음 단계 미션`
            : `${lesson.level} 순서상 다음 미션`,
      );
    }
    items.push({ lessonId: lesson.id, title: lesson.title, course, level: lesson.level, focus: lesson.focus, reasons: reasons.slice(0, 2) });
  }
  return { focus: weak[0].id, weak, items };
}
