// 개인화 엔진: DB에 쌓인 진단·실습 기록으로 사용자마다 다음에 들을 강의를 고르고, 고른 이유를 문장으로 붙인다.
// LLM을 쓰지 않는 팀 규칙이다. 숫자(가중치)는 해커톤용 첫 값이라 바꿔도 된다.
import { LESSONS } from "../data/curriculum.js";
import { ITEMS } from "./items.js";
import { josa } from "./josa.js";

export const LEVELS = ["초급", "중급", "고급"];
const RECENT_ATTEMPTS = 10;
export const WEIGHT = {
  missingInDiagnosis: 3, // 마지막 진단 프롬프트에 빠진 요소
  missedCriterion: 1.5, // 최근 실습에서 못 넘은 기준 하나(요소마다 세 번까지 셈)
  lowMastery: 1 / 40, // 숙련도 100에서 모자란 만큼 (0~2.5점)
  myLevel: 2,
  lowerLevel: 1,
  nextLevel: 0.5,
  failedBefore: 1, // 지난번 이 강의를 통과하지 못함
  sameFocus: 1.5, // 이미 고른 강의와 같은 요소면 빼는 점수(한 요소에 몰리지 않게)
};

// 요소별 약한 정도. 점수가 높을수록 먼저 연습할 요소다.
export function weaknesses({ diagnosis, record, attempts }) {
  const recent = (attempts ?? []).slice(0, RECENT_ATTEMPTS);
  return ITEMS.map(({ id, name }) => {
    const mastery = record?.mastery?.[id] ?? 0;
    const missed = recent.filter((a) => !a.passed && a.missed?.includes(id)).length;
    const inDiagnosis = Boolean(diagnosis?.missing?.includes(id));
    const score =
      (inDiagnosis ? WEIGHT.missingInDiagnosis : 0) +
      Math.min(missed, 3) * WEIGHT.missedCriterion +
      (100 - mastery) * WEIGHT.lowMastery;
    const reasons = [];
    if (missed) reasons.push(`최근 실습에서 ${name} 기준을 ${missed}번 못 넘었어요`);
    if (inDiagnosis) reasons.push(`진단 프롬프트에 ${josa(name, ["이", "가"])} 빠져 있었어요`);
    if (mastery < 40) reasons.push(`${name} 숙련도가 아직 ${mastery}이에요`);
    return { id, name, score, mastery, missed, inDiagnosis, reasons };
  }).sort((a, b) => b.score - a.score || ITEMS.findIndex((i) => i.id === a.id) - ITEMS.findIndex((i) => i.id === b.id));
}

// 최근 기록에서 이 강의를 마지막으로 낸 것이 실패였는지
function failedLast(lessonId, attempts) {
  const last = (attempts ?? []).find((a) => a.lessonId === lessonId);
  return Boolean(last && !last.passed);
}

// level: 지금 수준. 반환: { focus: 가장 약한 요소, weak: 요소별 약한 정도, items: [{ lessonId, title, level, focus, reasons }] }
export function personalize({ level, diagnosis, record, attempts, limit = 3 }) {
  const myIndex = Math.max(0, LEVELS.indexOf(level));
  const completed = record?.completed ?? [];
  const weak = weaknesses({ diagnosis, record, attempts });
  const byId = Object.fromEntries(weak.map((w) => [w.id, w]));
  const myLevelDone = LESSONS.filter((l) => l.level === LEVELS[myIndex]).every((l) => completed.includes(l.id));

  const candidates = LESSONS.map((lesson, order) => ({ lesson, order, index: LEVELS.indexOf(lesson.level) }))
    .filter(({ lesson, index }) => !completed.includes(lesson.id) && (index <= myIndex || (index === myIndex + 1 && myLevelDone)))
    .map(({ lesson, order, index }) => {
      const failed = failedLast(lesson.id, attempts);
      const levelScore = index === myIndex ? WEIGHT.myLevel : index < myIndex ? WEIGHT.lowerLevel : WEIGHT.nextLevel;
      return {
        lesson,
        index,
        failed,
        score: byId[lesson.focus].score + levelScore + (failed ? WEIGHT.failedBefore : 0) - order * 0.01,
      };
    });

  const items = [];
  const usedFocus = [];
  while (items.length < limit && candidates.length) {
    candidates.sort(
      (a, b) =>
        b.score - (usedFocus.includes(b.lesson.focus) ? WEIGHT.sameFocus : 0) -
        (a.score - (usedFocus.includes(a.lesson.focus) ? WEIGHT.sameFocus : 0)),
    );
    const { lesson, index, failed } = candidates.shift();
    usedFocus.push(lesson.focus);
    const reasons = [];
    if (failed) reasons.push("지난번에 이 미션을 통과하지 못했어요");
    reasons.push(...byId[lesson.focus].reasons);
    if (!reasons.length) {
      reasons.push(
        index < myIndex
          ? `${lesson.level}에서 아직 안 끝낸 미션이에요`
          : index > myIndex
            ? `${LEVELS[myIndex]}을 다 마쳐서 다음 단계 미션을 골랐어요`
            : `${lesson.level} 순서상 다음 미션이에요`,
      );
    }
    items.push({ lessonId: lesson.id, title: lesson.title, level: lesson.level, focus: lesson.focus, reasons: reasons.slice(0, 2) });
  }
  return { focus: weak[0].id, weak, items };
}
