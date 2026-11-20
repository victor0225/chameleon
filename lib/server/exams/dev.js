// 'dev'(개발) 직무 시험. 모양은 lib/server/exams/index.js 머리말을 본다.
// 5분 시험이라 읽을 양을 줄였다. 자료와 숫자는 모두 교육용 예시다.
// 미션(data/jobMissions/dev.js)과 겹치지 않게 일정 추정, 환불 화면 수정, API 호출 표, 코드 리뷰 규칙, PR 설명 상황을 쓴다.
import { NO_MADE_UP_CHECK } from "../../../data/checks.js";
import { BLANKS_CHECK } from "../../../data/exams.js";

// 1번: 새 기능 일정 추정. 기준마다 다섯 요소 하나씩.
const prompt = {
  area: "prompt",
  kind: "prompt",
  task: "새 기능 '찜 목록'의 개발 일정 추정을 AI에게 부탁하는 프롬프트 쓰기. 결과는 다음 주 기획 회의에서 공유.",
  question: "AI가 이 프롬프트만 보고 회의에 올릴 일정표를 만들 수 있는가?",
  criteria: [
    {
      label: "일정을 추정해 달라는 요청",
      item: "goal",
      check:
        /^(?=[\s\S]*(일정|기간|작업량|공수|며칠|얼마나\s*걸))(?=[\s\S]*(추정|예상|짜\s?줘|짜\s?주|잡아|계산|정리|알려|만들|나눠))/,
      question: "AI가 첫 문장만 읽고도 무엇을 내놓아야 하는지 아는가?",
    },
    {
      label: "누가 어디에 쓰는지 밝히기",
      item: "context",
      check: /기획|회의|공유|팀장|PM|보고|발표|함께\s*볼|같이\s*볼|읽을|읽는/,
      question: "이 추정을 누가, 어디에서 보는지 AI가 아는가?",
    },
    {
      label: "인원이나 만들 범위 정하기",
      item: "constraint",
      check: /(\d+|한|두|세|네|다섯)\s?명|혼자|인원|범위|만\s*(넣|포함|다뤄|계산)|빼고|제외|포함/,
      question: "몇 명이 어디까지 만드는지 AI가 아는가?",
    },
    {
      label: "작업별 표나 목록으로 받기",
      item: "format",
      check: /표로|표 형식|표를|목록|번호|항목별|작업별|단계별|칸으로|불릿/,
      question: "회의에서 바로 보여 주려면 결과를 어떤 모양으로 받아야 하는가?",
    },
    {
      label: "가정과 모르는 부분 밝히라고 하기",
      item: "criteria",
      check: /가정|모르는|모르면|불확실|추측|확인\s*필요|질문해|근거|위험/,
      question: "AI가 모르는 부분을 짐작으로 채우면 일정은 어떻게 되는가?",
    },
  ],
  model:
    "새 기능 '찜 목록'의 개발 일정을 추정해 줘. 다음 주 기획 회의에서 공유할 거야. 개발자는 백엔드 1명, 앱 1명이고, 서버 API와 앱 화면만 범위에 넣어 줘. 작업별 예상 일수를 표로 정리하고, 추정에 쓴 가정과 모르는 부분은 따로 적어 줘.",
  bad: "찜 목록 개발 얼마나 걸려?",
};

// 2번: 환불 화면 버그 수정을 맡기기 전 정보 카드 나누기. 칸마다 두 장.
const memory = {
  area: "memory",
  kind: "sort",
  task: "환불 화면 버그 수정을 AI에게 맡기기 전. 정보 카드 6장을 세 칸으로 나누기.",
  question: "다음 일에도 맞는 정보인가, 기록에 남아도 괜찮은 정보인가?",
  cards: [
    { id: "role", text: "나는 사내 결제 시스템 유지 보수를 맡고 있어", answer: "keep" },
    { id: "rule", text: "답은 늘 코드 먼저, 설명은 세 줄 이내로", answer: "keep" },
    { id: "page", text: "이번에 고칠 화면은 환불 신청 페이지야", answer: "once" },
    { id: "release", text: "이 수정은 다음 주 수요일에 배포해", answer: "once" },
    { id: "token", text: "사내 코드 저장소 접근 토큰 값", answer: "never" },
    { id: "orders", text: "장애 때 내려받은 고객 주문 원본(이름·주소 포함)", answer: "never" },
  ],
};

// 3번: API 호출 표와 AI 요약. 숨긴 문장 둘은 표에 없는 숫자다.
const file = {
  area: "file",
  kind: "pick",
  task: "지난주 API 호출 표와 AI가 쓴 요약. 요약에서 표에 없는 숫자가 든 문장 고르기.",
  question: "AI 요약의 숫자마다 표의 어느 칸에서 왔는지 맞춰 봤는가?",
  material: {
    title: "자료 · 지난주 API 호출 현황",
    kind: "table",
    columns: ["API", "호출 수", "오류 수", "평균 응답(ms)"],
    rows: [
      ["로그인", "12,400", "31", "120"],
      ["상품 목록", "38,900", "12", "340"],
      ["장바구니", "9,800", "45", "210"],
      ["주문", "6,100", "27", "480"],
      ["결제", "5,700", "8", "650"],
    ],
  },
  answerTitle: "AI가 쓴 표 요약",
  sentences: [
    { text: "가장 많이 호출된 API는 상품 목록으로 38,900번입니다.", answer: false },
    { text: "주문 API 오류는 그 전주보다 40% 줄었습니다.", answer: true, miss: "'그 전주보다 40%'는 표에 없는 숫자" },
    { text: "오류는 장바구니 API가 45건으로 가장 많았습니다.", answer: false },
    { text: "로그인 API는 하루 평균 2,300번 호출됐습니다.", answer: true, miss: "'하루 평균 2,300번'은 표에 없는 숫자" },
    { text: "결제 API의 평균 응답은 650ms로 가장 느렸습니다.", answer: false },
  ],
};

// 4번: 코드 리뷰 규칙 회의 메모와 AI 요약. 틀린 정보, 지어낸 내용, 확인 안 되는 출처가 하나씩.
const verify = {
  area: "verify",
  kind: "pick",
  task: "코드 리뷰 규칙 회의 메모와 AI가 쓴 요약. 요약에서 틀리거나 지어낸 문장 고르기.",
  question: "요약의 문장마다 메모에서 같은 내용을 찾아봤는가?",
  material: {
    title: "자료 · 코드 리뷰 규칙 회의 메모",
    subtitle: "11월 18일 개발팀 회의",
    kind: "list",
    lines: [
      "PR 하나에 리뷰어는 두 명",
      "리뷰는 이틀 안에 끝내기",
      "테스트 없는 PR은 합치지 않음",
      "급한 수정은 팀장 한 명 승인으로 합침",
      "새 규칙은 12월 1일부터 적용",
    ],
  },
  answerTitle: "AI가 쓴 회의 요약",
  sentences: [
    { text: "PR 하나에 리뷰어는 두 명입니다.", answer: false },
    { text: "리뷰는 하루 안에 끝내야 합니다.", answer: true, miss: "리뷰 기한은 하루가 아니라 이틀" },
    { text: "테스트 없는 PR은 합치지 않습니다.", answer: false },
    { text: "규칙을 세 번 어기면 팀장에게 보고합니다.", answer: true, miss: "메모에 없는 규칙. AI가 지어낸 내용" },
    {
      text: "한 개발 연구소 조사에 따르면 리뷰어가 두 명일 때 버그가 절반으로 줄어듭니다.",
      answer: true,
      miss: "'개발 연구소 조사'는 메모에 없는 출처",
    },
    { text: "새 규칙은 12월 1일부터 적용됩니다.", answer: false },
  ],
};

// 5번: 상황마다 AI 쓰는 방법 고르기. 네 칸을 하나씩.
const tool = {
  area: "tool",
  kind: "choose",
  task: "개발 업무 상황 카드 4장. 상황마다 AI를 어떻게 쓸지 고르기.",
  question: "이 일에 필요한 정보는 AI가 이미 아는 것인가, 새로 찾거나 읽어야 하는 것인가?",
  cards: [
    { id: "db", text: "어제 공개된 데이터베이스 새 버전 소식 정리", answer: "search" },
    { id: "spec", text: "넘겨받은 화면 설계서 PDF에서 입력 칸 목록 뽑기", answer: "file" },
    { id: "loop", text: "반복문을 더 짧게 쓰는 방법 묻기", answer: "ask" },
    { id: "probation", text: "후배 개발자 수습 평가 결과 정하기", answer: "no" },
  ],
};

// 6번: PR을 올릴 때마다 쓰는 설명 템플릿. {{빈칸}} 두 개 이상.
const flow = {
  area: "flow",
  kind: "template",
  task: "PR을 올릴 때마다 설명 쓰기를 AI에게 맡김. 이슈 번호와 변경 내용만 바꿔 쓰는 템플릿 프롬프트 쓰기. 바뀌는 곳은 {{빈칸}}으로.",
  question: "다음 PR 때 이 프롬프트를 그대로 다시 쓸 수 있는가?",
  criteria: [
    {
      label: "매번 바뀌는 곳을 {{빈칸}} 두 개 이상으로",
      item: null,
      check: BLANKS_CHECK,
      question: "다음 PR 때 이 프롬프트에서 바꿀 곳은 어디인가?",
    },
    {
      label: "PR 설명을 써 달라는 요청",
      item: "goal",
      check: /^(?=[\s\S]*(PR|풀\s*리퀘스트|pull\s*request))(?=[\s\S]*(써|작성|정리|만들|요약|채워))/i,
      question: "AI가 이 변경 내용으로 무엇을 써야 하는가?",
    },
    {
      label: "읽을 사람 밝히기",
      item: "context",
      check: /리뷰어|리뷰할|팀원|동료|우리\s*팀|팀장|읽을|읽는|검토/,
      question: "이 PR 설명은 누가 읽는가?",
    },
    {
      label: "매번 같은 형식 지정",
      item: "format",
      check: /목록|번호|표로|항목|칸|나눠|순서로|제목|섹션|\d+\s*줄|(한|두|세)\s*(줄|문장)|이내/,
      question: "PR마다 같은 모양으로 받으려면 무엇을 정해야 하는가?",
    },
    {
      label: "변경 내용에 없는 것은 지어내지 말라고 하기",
      item: "criteria",
      check: NO_MADE_UP_CHECK,
      question: "테스트한 방법이 변경 내용에 없으면 AI는 어떻게 해야 하는가?",
    },
  ],
  model:
    "아래 변경 내용으로 PR 설명을 써 줘. 리뷰어인 우리 팀 동료가 읽을 글이야. 바꾼 이유, 바꾼 것, 테스트한 방법 세 칸으로 나눠 칸마다 세 줄 이내로 써 줘. 변경 내용에 없는 것은 지어내지 말고 '없음'이라고 적어 줘.\n관련 이슈: {{이슈 번호}}\n---\n{{변경 내용}}\n---",
  bad: "PR 설명 써 줘",
};

const dev = { questions: [prompt, memory, file, verify, tool, flow] };
export default dev;
