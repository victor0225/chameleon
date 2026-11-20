// 관심 직무 다섯 개. 회원가입(필수)과 내 정보에서 고르고, 고른 직무로 미션 상황과 예시가 바뀐다(lib/jobContent.js).
//   examples: 직무 카드에 쓰는 예시 업무 셋
//   placeholder: 첫 화면 진단 입력 칸의 예시 문장(직무가 없으면 NO_JOB_PLACEHOLDER)
//   examTasks: 시험 카드에 쓰는 짧은 예시 업무 한 줄
export const JOBS = [
  {
    id: "office",
    name: "사무·행정",
    examples: ["주간 업무 보고서 작성", "고객 문의 메일 답장", "회의록 요약"],
    placeholder: "예: 주간 업무 보고서 써 줘",
    examTasks: "주간 업무 보고서 · 문의 메일 답장 · 회의록 요약",
  },
  {
    id: "marketing",
    name: "마케팅",
    examples: ["신제품 SNS 게시글", "고객 설문 결과 정리", "광고 문구 세 가지"],
    placeholder: "예: 신제품 SNS 게시글 써 줘",
    examTasks: "신제품 SNS 게시글 · 고객 설문 정리 · 광고 문구",
  },
  {
    id: "cs",
    name: "고객 상담",
    examples: ["불만 고객 답장", "자주 묻는 질문 정리", "상담 기록 요약"],
    placeholder: "예: 불만 고객 답장 써 줘",
    examTasks: "불만 고객 답장 · 자주 묻는 질문 · 상담 기록 요약",
  },
  {
    id: "sales",
    name: "영업",
    examples: ["거래처 제안 메일", "방문 일정 정리", "견적 비교표"],
    placeholder: "예: 거래처 제안 메일 써 줘",
    examTasks: "거래처 제안 메일 · 방문 일정 · 견적 비교표",
  },
  {
    id: "dev",
    name: "개발",
    examples: ["오류 원인 찾기", "코드 리뷰 요청", "API 문서 요약"],
    placeholder: "예: 이 오류 원인 찾아 줘",
    examTasks: "오류 원인 찾기 · 코드 리뷰 요청 · API 문서 요약",
  },
];
export const NO_JOB_PLACEHOLDER = "평소 AI에게 하던 말 그대로 입력";
export const JOB = Object.fromEntries(JOBS.map((job) => [job.id, job]));

export const EXPERIENCES = [
  { id: "none", title: "거의 안 써 봄", desc: "무엇을 물을지 모름" },
  { id: "sometimes", title: "가끔 질문", desc: "검색하듯 짧게 물어봄" },
  { id: "often", title: "업무에 자주 씀", desc: "더 정확한 결과가 필요함" },
];

export const EXPERIENCE = Object.fromEntries(EXPERIENCES.map((e) => [e.id, e]));

// 설문 3번 "써 본 방식"(여러 개 고름, 안 골라도 됨). 과정 추천 규칙(lib/courseSignals.js)이 쓴다.
export const AI_USES = [
  { id: "memory", title: "긴 대화 이어 가기", desc: "한 대화에서 여러 번 주고받으며 일을 이어 감" },
  { id: "file", title: "파일 올리기", desc: "문서·표·그림을 올려서 질문" },
  { id: "search", title: "검색 켜기", desc: "AI에게 인터넷 검색을 시킴" },
  { id: "repeat", title: "같은 일 반복", desc: "비슷한 일을 매주 AI에게 맡김" },
];

export const AI_USE = Object.fromEntries(AI_USES.map((u) => [u.id, u]));
