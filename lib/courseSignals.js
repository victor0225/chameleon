// 진단 결과에서 다음에 배울 과정을 고르는 팀 규칙(작업 E). LLM을 쓰지 않는다.
// 입력 { diagnosis: { found, missing, prompt, files }, survey?: { used } } → [{ course, reason }] 강한 순서로 3개까지.
// 진단 프롬프트에서 보인 신호가 먼저이고, 설문 3번 "AI를 이렇게 써 봤어요"에서 안 고른 기능은 그 뒤에 붙인다. reason은 개조식 한 줄이다.
// 가중치는 임시다. 팀이 바꾸면 COURSE_WEIGHT만 고친다.
import { countWord } from "./fileRules.js";
import { fileCoaching } from "./fileSignals.js";
import { ITEM, ITEMS } from "./items.js";
import { findPersonalInfo } from "./privacy.js";

export const COURSE_WEIGHT = {
  privacy: 3.5, // 프롬프트에 개인정보가 들어 있음 → memory(무엇을 맡기면 안 되는지)
  file: 2.5, // 붙인 파일을 가리키지 않음, 또는 파일 이야기만 있고 파일이 없음 → file
  missingEach: 1, // 빠진 요소 하나마다 → prompt
  criteria: 1.5, // 기준이 빠져 지어낸 부분을 걸러낼 수 없음 → verify
};

// 설문 3번에서 안 고른 기능 → 그 기능을 다루는 과정. 이 순서대로 붙인다.
export const NOT_USED_COURSE = [
  { used: "file", course: "file", reason: "파일을 붙여 맡겨 본 적 없다고 답함" },
  { used: "memory", course: "memory", reason: "긴 대화를 이어 가 본 적 없다고 답함" },
  { used: "search", course: "tool", reason: "검색을 켜고 써 본 적 없다고 답함" },
  { used: "repeat", course: "flow", reason: "같은 일을 반복해 AI에게 맡겨 본 적 없다고 답함" },
];
// 점수가 같으면 과정 순서대로
const ORDER = ["prompt", "memory", "file", "verify", "tool", "flow"];
const MAX = 3;

export function courseSignals({ diagnosis, survey }) {
  if (!diagnosis) return [];
  const missing = ITEMS.map((i) => i.id).filter((id) => (diagnosis.missing ?? []).includes(id));
  const found = [];
  const add = (course, score, reason) => {
    if (!found.some((f) => f.course === course)) found.push({ course, score, reason });
  };

  const pii = findPersonalInfo(diagnosis.prompt);
  if (pii.length) add("memory", COURSE_WEIGHT.privacy, `프롬프트에 ${pii[0].name} 들어 있음`);

  const coach = fileCoaching({ prompt: diagnosis.prompt, files: diagnosis.files });
  if (coach?.kind === "unused") add("file", COURSE_WEIGHT.file, "파일을 붙였지만 무엇을 하라는지 말하지 않음");
  if (coach?.kind === "missing") add("file", COURSE_WEIGHT.file, "파일 이야기는 있는데 붙인 파일 없음");

  if (missing.length) {
    add(
      "prompt",
      missing.length * COURSE_WEIGHT.missingEach,
      `빠진 요소 ${countWord(missing.length)}: ${missing.map((id) => ITEM[id].name).join("·")}`,
    );
  }
  if (missing.includes("criteria")) add("verify", COURSE_WEIGHT.criteria, "AI가 지어낸 부분을 걸러낼 기준 없음");

  found.sort((a, b) => b.score - a.score || ORDER.indexOf(a.course) - ORDER.indexOf(b.course));

  // 설문 3번은 진단 신호 뒤에 붙인다. 답하기 전 설문(used 없음)은 건너뛰고, 같은 과정이 이미 있으면 진단 이유를 남긴다.
  if (Array.isArray(survey?.used)) {
    for (const n of NOT_USED_COURSE) if (!survey.used.includes(n.used)) add(n.course, 0, n.reason);
  }

  return found.slice(0, MAX).map(({ course, reason }) => ({ course, reason }));
}
