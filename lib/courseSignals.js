// 진단 결과에서 다음에 배울 과정을 고르는 팀 규칙(작업 E). LLM을 쓰지 않는다.
// 입력 { diagnosis: { found, missing, prompt, files }, survey?: { uses } } → [{ course, reason }] 강한 순서로 3개까지.
// 진단 프롬프트에서 보인 신호가 먼저이고, 설문 3번 "AI를 이렇게 써 봤어요"는 그보다 약하게 더한다.
// 가중치는 임시다. 팀이 바꾸면 COURSE_WEIGHT만 고친다.
import { countWord } from "./fileRules.js";
import { fileCoaching } from "./fileSignals.js";
import { ITEM, ITEMS } from "./items.js";
import { josa } from "./josa.js";
import { findPersonalInfo } from "./privacy.js";

export const COURSE_WEIGHT = {
  privacy: 3.5, // 프롬프트에 개인정보가 들어 있음 → memory(무엇을 맡기면 안 되는지)
  file: 2.5, // 붙인 파일을 가리키지 않음, 또는 파일 이야기만 있고 파일이 없음 → file
  missingEach: 1, // 빠진 요소 하나마다 → prompt
  criteria: 1.5, // 기준이 빠져 지어낸 부분을 걸러낼 수 없음 → verify
  use: 0.8, // 설문 3번 답 하나 → 그 쓰임을 다루는 과정(아래 USE_COURSE)
};

// 설문 3번에서 고른 쓰임 → 그 쓰임에서 부딪히는 문제를 다루는 과정
export const USE_COURSE = {
  long: { course: "memory", reason: "긴 대화를 이어 가며 AI를 써 봤다고 했어요" },
  file: { course: "file", reason: "AI에 파일을 올려 써 봤다고 했어요" },
  search: { course: "verify", reason: "검색을 켜고 써 봤다고 했어요. 찾아 준 내용도 출처를 확인해야 해요" },
  repeat: { course: "flow", reason: "같은 일을 반복해서 맡긴다고 했어요" },
};
// 설문에 답했는데 파일 올리기도 검색 켜기도 안 골랐으면 → 일에 맞는 기능 고르기
const NO_TOOL = { course: "tool", reason: "검색이나 파일 분석은 아직 안 써 봤다고 했어요" };
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
  if (pii.length) add("memory", COURSE_WEIGHT.privacy, `프롬프트에 ${josa(pii[0].name, "이가")} 들어 있어요`);

  const coach = fileCoaching({ prompt: diagnosis.prompt, files: diagnosis.files });
  if (coach?.kind === "unused") add("file", COURSE_WEIGHT.file, "파일을 붙였지만 무엇을 하라는지 말하지 않았어요");
  if (coach?.kind === "missing") add("file", COURSE_WEIGHT.file, "파일 이야기는 있는데 붙인 파일이 없어요");

  if (missing.length) {
    add(
      "prompt",
      missing.length * COURSE_WEIGHT.missingEach,
      `빠진 요소가 ${countWord(missing.length)} 있어요: ${missing.map((id) => ITEM[id].name).join("·")}`,
    );
  }
  if (missing.includes("criteria")) add("verify", COURSE_WEIGHT.criteria, "AI가 지어낸 부분을 걸러낼 기준이 없어요");

  // 설문 3번. 답하기 전 설문(uses 없음)은 건너뛴다. 같은 과정이 진단 신호로 이미 들어왔으면 진단 이유를 남긴다.
  const uses = Array.isArray(survey?.uses) ? survey.uses : null;
  if (uses) {
    for (const id of Object.keys(USE_COURSE)) if (uses.includes(id)) add(USE_COURSE[id].course, COURSE_WEIGHT.use, USE_COURSE[id].reason);
    if (!uses.includes("file") && !uses.includes("search")) add(NO_TOOL.course, COURSE_WEIGHT.use, NO_TOOL.reason);
  }

  return found
    .sort((a, b) => b.score - a.score || ORDER.indexOf(a.course) - ORDER.indexOf(b.course))
    .slice(0, MAX)
    .map(({ course, reason }) => ({ course, reason }));
}
