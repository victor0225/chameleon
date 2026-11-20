export const JOBS = [
  {
    id: "office",
    name: "사무·행정",
    diagnosisTask: "팀장님께 드릴 이번 주 업무 보고서를 AI에게 부탁해 보세요.",
    examples: ["주간 업무 보고서 작성", "고객 문의 메일 답장", "회의록 요약"],
  },
  {
    id: "marketing",
    name: "마케팅",
    diagnosisTask: "새 제품 출시를 알리는 SNS 게시글을 AI에게 부탁해 보세요.",
    examples: ["신제품 SNS 게시글", "고객 설문 결과 정리", "광고 문구 세 가지"],
  },
  {
    id: "cs",
    name: "고객 상담",
    diagnosisTask: "배송이 늦어 화가 난 고객에게 보낼 답장을 AI에게 부탁해 보세요.",
    examples: ["불만 고객 답장", "자주 묻는 질문 정리", "상담 기록 요약"],
  },
  {
    id: "sales",
    name: "영업",
    diagnosisTask: "새 거래처에 보낼 제품 제안 메일을 AI에게 부탁해 보세요.",
    examples: ["거래처 제안 메일", "방문 일정 정리", "견적 비교표"],
  },
  {
    id: "dev",
    name: "개발",
    diagnosisTask: "로그인 기능에서 나는 오류의 원인을 AI에게 찾아 달라고 해 보세요.",
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
