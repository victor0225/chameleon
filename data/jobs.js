export const JOBS = [
  {
    id: "office",
    name: "사무·행정",
    examples: ["주간 업무 보고서 작성", "고객 문의 메일 답장", "회의록 요약"],
  },
  {
    id: "marketing",
    name: "마케팅",
    examples: ["신제품 SNS 게시글", "고객 설문 결과 정리", "광고 문구 세 가지"],
  },
  {
    id: "cs",
    name: "고객 상담",
    examples: ["불만 고객 답장", "자주 묻는 질문 정리", "상담 기록 요약"],
  },
  {
    id: "sales",
    name: "영업",
    examples: ["거래처 제안 메일", "방문 일정 정리", "견적 비교표"],
  },
  {
    id: "dev",
    name: "개발",
    examples: ["오류 원인 찾기", "코드 리뷰 요청", "API 문서 요약"],
  },
];
export const JOB = Object.fromEntries(JOBS.map((job) => [job.id, job]));

export const EXPERIENCES = [
  { id: "none", title: "거의 안 써 봤어요", desc: "무엇을 물어야 할지 모르겠어요" },
  { id: "sometimes", title: "가끔 질문해요", desc: "검색하듯 짧게 물어본 적이 있어요" },
  { id: "often", title: "업무에 자주 써요", desc: "결과를 더 정확하게 받고 싶어요" },
];

export const EXPERIENCE = Object.fromEntries(EXPERIENCES.map((e) => [e.id, e]));

// 설문 3번 "AI를 이렇게 써 봤어요"(여러 개 고름, 안 골라도 됨). 과정 추천 규칙(lib/courseSignals.js)이 쓴다.
export const AI_USES = [
  { id: "long", title: "긴 대화 이어 가기", desc: "한 대화에서 여러 번 주고받으며 일을 이어 갔어요" },
  { id: "file", title: "파일 올리기", desc: "문서, 표, 그림을 올려서 물어봤어요" },
  { id: "search", title: "검색 켜기", desc: "AI가 인터넷을 찾아보게 했어요" },
  { id: "repeat", title: "같은 일 반복", desc: "매주 비슷한 일을 AI에게 맡겨요" },
];

export const AI_USE = Object.fromEntries(AI_USES.map((u) => [u.id, u]));
