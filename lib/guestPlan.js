// 손님(로그인 전) 추천 미션(작업 O-2). 로그인하면 /api/me/curriculum이 DB 기록으로 고르는 것과 같은 엔진(lib/personalize.js)을
// 브라우저에 있는 진단과 학습 기록으로 돌린다. 서버 API는 따로 두지 않는다.
// 진단 결과 비교 화면과 교육 탭이 같은 함수를 불러 같은 세 장을 보여 준다(사용자가 일부러 중복되게 정함).
import { LESSONS } from "../data/curriculum.js";
import { courseSignals } from "./courseSignals.js";
import { diagnosisTrend } from "./diagnosisTrend.js";
import { ITEM, ITEMS } from "./items.js";
import { levelOf } from "./level.js";
import { personalize } from "./personalize.js";
import { areaScores } from "./scoreboard.js";

// 브라우저 학습 기록(record.history)을 엔진이 읽는 시도 모양으로. 못 넘은 기준(missed)은 브라우저에 남기지 않는다.
const attemptsOf = (record) =>
  (record?.history ?? [])
    .filter((h) => h?.lessonId)
    .map((h) => ({ lessonId: h.lessonId, passed: Boolean(h.passed), missed: [] }));

// 서버(/api/me/curriculum)와 같은 입력을 만든다. 손님은 처음 시도 점수(first_scores)가 없으니 부문 점수는 모두 안 푼 것이다.
export function guestPlan({ diagnosis, record }) {
  return personalize({
    level: levelOf(record?.completed),
    diagnosis,
    record,
    attempts: attemptsOf(record),
    trend: diagnosisTrend(diagnosis ? [diagnosis] : []),
    courses: {
      areas: areaScores({}).areas,
      signals: courseSignals({ diagnosis }),
      gaps: [],
      job: diagnosis?.job ?? null,
    },
  });
}

// 추천을 읽는 동안이나 읽지 못했을 때 카드 자리를 채운다(자리가 비면 안 된다).
// 진단에서 빠진 요소를 목표·맥락·조건·형식·기준 순으로, 그 요소를 다루는 과정 1 초급 미션 하나씩.
export function fallbackItems(diagnosis, limit = 3) {
  const missing = ITEMS.map((i) => i.id).filter((id) => diagnosis?.missing?.includes(id));
  return missing
    .map((id) => LESSONS.find((l) => l.level === "초급" && l.focus === id))
    .filter(Boolean)
    .slice(0, limit)
    .map((l) => ({
      lessonId: l.id,
      title: l.title,
      course: "prompt",
      level: l.level,
      focus: l.focus,
      reasons: [`진단 프롬프트에서 ${ITEM[l.focus].name} 누락`],
    }));
}
