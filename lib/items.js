// 팀 프롬프트 평가 체크리스트 1~4, 8번을 화면에서 쓰는 다섯 요소로 줄인 것.
export const ITEMS = [
  {
    id: "goal",
    name: "목표",
    color: "var(--c-goal)",
    hint: "무엇을 해 달라는지 한 문장으로",
    question: "AI가 일을 끝냈을 때 손에 쥐어야 할 결과물은 무엇인가요?",
  },
  {
    id: "context",
    name: "맥락",
    color: "var(--c-context)",
    hint: "누가, 왜, 어떤 상황에서 쓰는지",
    question: "이 결과물은 누가, 어디에 쓰나요? AI는 내 사정을 모릅니다.",
  },
  {
    id: "constraint",
    name: "조건",
    color: "var(--c-constraint)",
    hint: "분량, 말투, 넣을 것과 뺄 것",
    question: "길이나 말투, 꼭 넣거나 빼야 할 것이 있나요?",
  },
  {
    id: "format",
    name: "형식",
    color: "var(--c-format)",
    hint: "표, 목록, 이메일 같은 결과 모양",
    question: "결과를 어떤 모양으로 받고 싶나요? 표, 목록, 이메일처럼요.",
  },
  {
    id: "criteria",
    name: "기준",
    color: "var(--c-criteria)",
    hint: "잘 됐는지 확인할 기준, 모를 때 할 일",
    question: "결과가 맞는지 무엇으로 확인할까요? 모르는 게 있으면 AI가 어떻게 해야 하나요?",
  },
];
export const ITEM = Object.fromEntries(ITEMS.map((item) => [item.id, item]));
