// 과정 2~6 중 무엇이 약한지(작업 I-1). 개인화 엔진(lib/personalize.js)이 과정 2~6 후보의 점수로 쓴다.
// 팀 규칙이고 LLM을 쓰지 않는다. 가중치는 해커톤용 첫 값이라 바꿔도 된다.
import { COURSE } from "../data/courses.js";
import { JOB } from "../data/jobs.js";
import { NOT_USED_COURSE } from "./courseSignals.js";

export const COURSE_WEAK = {
  signal: 3, // 마지막 진단으로 courseSignals가 고른 과정
  lowScore: 1 / 40, // 100에서 모자란 부문 점수만큼(0~2.5). 한 번이라도 푼 과정만
  lowScoreReason: 70, // 이 점수 아래일 때만 이유 문장을 붙인다
  untouched: 1, // 아직 하나도 안 해 본 과정
  notUsed: 1, // 설문에서 안 써 봤다고 한 기능의 과정
  jobGap: 1 / 20, // 같은 직무 평균보다 낮은 만큼(0~2). 한 번이라도 푼 과정만
  jobGapMax: 2,
  jobGapReason: 10, // 평균보다 이만큼 넘게 낮을 때만 이유 문장을 붙인다
};

// areas: areaScores().areas [{ course, score, done }]
// signals: courseSignals({ diagnosis }) [{ course, reason }] (설문은 넣지 않는다. used로 따로 센다)
// used: 설문 3번 답(profiles.survey.used). 답하기 전이면 undefined
// gaps: jobGaps() [{ course, mine, avg, n, gap }], job: 내 직무 id
// → { [course]: { score, reasons } } 과정 2~6 중 열린 과정만. reasons는 강한 순서다.
export function courseWeakness({ areas = [], signals = [], used, gaps = [], job = null }) {
  const out = {};
  for (const area of areas) {
    const course = COURSE[area.course];
    if (!course || course.id === "prompt" || !course.ready || area.score === null) continue;
    let score = 0;
    const reasons = [];
    const signal = signals.find((s) => s.course === course.id);
    if (signal) {
      score += COURSE_WEAK.signal;
      reasons.push(signal.reason);
    }
    if (area.done > 0) {
      score += (100 - area.score) * COURSE_WEAK.lowScore;
      if (area.score < COURSE_WEAK.lowScoreReason) reasons.push(`${course.short} 부문이 ${area.score}점이에요`);
      const gap = gaps.find((g) => g.course === course.id)?.gap ?? 0;
      if (gap > 0) score += Math.min(gap * COURSE_WEAK.jobGap, COURSE_WEAK.jobGapMax);
      if (gap > COURSE_WEAK.jobGapReason && JOB[job]) {
        reasons.push(`같은 ${JOB[job].name} 직무 평균보다 ${course.short} 부문이 ${Math.round(gap)}점 낮아요`);
      }
    }
    const notUsed = Array.isArray(used) ? NOT_USED_COURSE.find((n) => n.course === course.id && !used.includes(n.used)) : null;
    if (notUsed) {
      score += COURSE_WEAK.notUsed;
      reasons.push(notUsed.reason);
    }
    if (area.done === 0) {
      score += COURSE_WEAK.untouched;
      reasons.push("아직 해 보지 않은 과정이에요");
    }
    out[course.id] = { score, reasons };
  }
  return out;
}
