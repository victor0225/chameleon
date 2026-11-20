// 직무별 AI 활용 시험(작업 L, 2026-11-21). 직무마다 시험 하나, 6문제(부문마다 하나), 문제마다 100점, 600점 만점, 5분.
// 이 파일은 화면에도 실리는 공통 값만 둔다. 문제와 정답표는 서버에만 있다(lib/server/exams/<직무 id>.js).
// 시험 규칙: 처음 본 점수만 랭킹에 들어가고, 다시 풀기는 연습이다. 동점이면 빨리 끝낸 사람이 위다.
// 시험 중에는 채점 기준을 숨기고, 다 내면 보여 준다. 로그인해야 볼 수 있고, 랭킹은 시험마다 따로다.
export const EXAM_SECONDS = 300;
export const QUESTION_POINTS = 100;

// 문제 순서 = 부문 순서. kind가 푸는 방식을 정한다(lib/examScore.js).
//   prompt:   프롬프트를 쓴다. 기준마다 맞으면 점수를 나눠 받는다.
//   sort:     정보 카드를 칸으로 나눈다. 맞힌 카드 비율이 점수다.
//   pick:     AI가 쓴 글에서 문제 있는 문장을 고른다. (찾은 것 - 잘못 고른 것) / 숨겨 둔 것.
//   choose:   상황 카드마다 방법을 하나 고른다. 맞힌 카드 비율이 점수다.
//   template: {{빈칸}}이 있는 템플릿 프롬프트를 쓴다. 채점은 prompt와 같다.
// course는 낮은 부문의 미션을 권할 때 가는 과정이다(data/courses.js).
export const EXAM_AREAS = [
  { id: "prompt", name: "프롬프트", way: "프롬프트 쓰기", kind: "prompt", course: "prompt" },
  { id: "memory", name: "메모리", way: "정보 카드 나누기", kind: "sort", course: "memory" },
  { id: "file", name: "파일", way: "표에 없는 숫자 찾기", kind: "pick", course: "file" },
  { id: "verify", name: "검증", way: "틀린 문장 찾기", kind: "pick", course: "verify" },
  { id: "tool", name: "도구", way: "상황마다 고르기", kind: "choose", course: "tool" },
  { id: "flow", name: "자동화", way: "템플릿 프롬프트 쓰기", kind: "template", course: "flow" },
];

export const EXAM_MAX = EXAM_AREAS.length * QUESTION_POINTS;

// 메모리 문제(sort)의 세 칸. 미션 mem1과 같은 기준이다.
export const EXAM_MEMORY_BINS = [
  { id: "keep", title: "오래 기억시킬 정보" },
  { id: "once", title: "이번 작업에만 줄 정보" },
  { id: "never", title: "기억시키면 안 되는 정보" },
];

// 도구 문제(choose)의 선택지 넷(보드 L5).
export const EXAM_TOOL_BINS = [
  { id: "search", title: "검색 켜기" },
  { id: "file", title: "파일 올리기" },
  { id: "ask", title: "그냥 질문" },
  { id: "no", title: "맡기지 않기" },
];

// 자동화 문제(template)의 기준: {{빈칸}}이 두 개 이상인 템플릿.
// 직무 시험 파일이 lib/server/exams/index.js에서 가져오면 서로 가져오는 고리가 생겨(index가 직무 파일을 먼저 읽음)
// 아직 정의 전인 값을 읽게 되므로 여기에 둔다. index.js는 이 값을 다시 내보낸다.
export const BLANKS_CHECK = /\{\{[^{}\n]+\}\}[\s\S]*\{\{[^{}\n]+\}\}/;

// 시험 이름: "마케팅 AI 활용 시험"
export const examTitle = (jobName) => `${jobName} AI 활용 시험`;

// 걸린 시간 4:21
export const clock = (seconds) => {
  const s = Math.max(0, Math.round(seconds ?? 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
