// 'marketing' 직무 시험. 모양은 lib/server/exams/index.js 머리말을 본다.
// 5분 시험이라 읽을 양을 줄였다. 자료와 숫자는 모두 교육용 예시다.
// 미션(data/jobMissions/marketing.js)과 겹치지 않게 SNS 게시글·텀블러 상황은 쓰지 않는다.
import { NO_MADE_UP_CHECK, either } from "../../../data/checks.js";
import { BLANKS_CHECK } from "../../../data/exams.js";

// 1번: 팝업 스토어 안내 문자. 기준마다 다섯 요소 하나씩.
const prompt = {
  area: "prompt",
  kind: "prompt",
  task: "다음 달 여는 팝업 스토어 안내 문자를 AI에게 부탁하는 프롬프트 쓰기. 받는 사람은 지난 1년 동안 산 적 있는 고객.",
  question: "AI가 이 프롬프트만 보고 바로 보낼 문자를 쓸 수 있는가?",
  criteria: [
    {
      label: "안내 문자를 써 달라는 요청",
      item: "goal",
      check: /^(?=[\s\S]*(문자|메시지|안내문|알림))(?=[\s\S]*(써 ?줘|써 ?주|작성|만들어|초안))/,
      question: "AI가 첫 문장만 읽고도 무엇을 써야 하는지 아는가?",
    },
    {
      label: "받는 사람: 지난 1년 동안 산 고객",
      item: "context",
      check:
        /(1|일|한)\s?년[^\n]{0,30}(구매|주문|산 |산 적|사신)|(구매|주문)\s?(이력|고객|경험|한 고객)|산 적 ?있는|기존 고객|단골/,
      question: "이 문자를 받는 사람이 누구인지 AI가 아는가?",
    },
    {
      label: "문자 길이나 말투 정하기",
      item: "constraint",
      check: /\d+\s*(자|줄|문장)|(한|두|세|네|다섯)\s?(줄|문장)|이내|이하|넘지|짧게|말투|존댓말|반말|친근|정중|격식|이모지/,
      question: "문자 길이와 말투를 AI가 마음대로 정해도 괜찮은가?",
    },
    {
      label: "받을 모양 정하기(시안 수, 줄 순서 등)",
      item: "format",
      check:
        /(\d+|한|두|세|네|다섯)\s?(가지|개)\s?(시안|버전|안)|시안|버전|목록|번호|표로|항목|순서로|첫\s?줄|둘째\s?줄|줄마다|줄로 나눠|형식|모양/,
      question: "결과를 바로 쓰려면 어떤 모양으로 받아야 하는가?",
    },
    {
      label: "정해지지 않은 정보는 지어내지 말라고 하기",
      item: "criteria",
      check: either(NO_MADE_UP_CHECK, /비워|빈칸|\[[^\]]+\]|\{\{[^}]+\}\}|검토|맞는지/),
      question: "날짜나 혜택을 모를 때 AI는 무엇을 해야 하는가?",
    },
  ],
  model:
    "다음 달 성수동에서 여는 팝업 스토어 안내 문자를 써 줘. 받는 사람은 지난 1년 동안 우리 제품을 산 적 있는 고객이야. 90자 이내로, 친근한 존댓말로 써 줘. 첫 줄에 날짜와 장소, 둘째 줄에 방문 혜택을 넣고 시안 2개로 보여 줘. 날짜나 혜택처럼 내가 안 준 정보는 지어내지 말고 [날짜]처럼 빈칸으로 남겨 줘.",
  bad: "팝업 스토어 문자 써 줘",
};

// 2번: 뉴스레터를 맡기기 전 정보 카드 나누기. 칸마다 두 장.
const memory = {
  area: "memory",
  kind: "sort",
  task: "브랜드 뉴스레터 작업을 AI에게 맡기기 전. 정보 카드 6장을 세 칸으로 나누기.",
  question: "AI가 이 정보를 계속 기억해도 괜찮은가?",
  cards: [
    { id: "role", text: "나는 생활용품 브랜드에서 이메일 뉴스레터를 맡고 있어", answer: "keep" },
    { id: "tone", text: "우리 브랜드 글은 늘 존댓말, 느낌표는 쓰지 않음", answer: "keep" },
    { id: "sale", text: "이번 할인 행사는 12월 1일부터 7일까지", answer: "once" },
    { id: "target", text: "이번 호는 신규 가입 고객에게만 보냄", answer: "once" },
    { id: "vip", text: "VIP 고객 이름과 휴대폰 번호 목록", answer: "never" },
    { id: "price", text: "광고 대행사와 맺은 계약 단가", answer: "never" },
  ],
};

// 3번: 캠페인 성과 표와 AI 요약. 숨긴 문장 둘은 표에 없는 숫자다.
const file = {
  area: "file",
  kind: "pick",
  task: "11월 캠페인 성과 표와 AI가 쓴 요약. 요약에서 표에 없는 숫자가 든 문장 고르기.",
  question: "AI 요약의 숫자를 표의 어느 칸과 맞춰 봤나?",
  material: {
    title: "자료 · 11월 캠페인 성과",
    kind: "table",
    columns: ["채널", "보낸 수", "클릭", "구매"],
    rows: [
      ["이메일", "12,000", "960", "84"],
      ["문자", "8,000", "720", "96"],
      ["앱 알림", "15,000", "600", "45"],
    ],
  },
  answerTitle: "AI가 쓴 표 요약",
  sentences: [
    { text: "문자는 8,000건을 보내 구매 96건으로 구매가 가장 많았습니다.", answer: false },
    { text: "구매 고객의 재구매율은 34%로 지난달보다 올랐습니다.", answer: true, miss: "'재구매율 34%'는 표에 없는 숫자" },
    { text: "앱 알림은 가장 많은 15,000건을 보냈지만 구매는 45건이었습니다.", answer: false },
    { text: "세 채널을 합친 매출은 1,850만 원입니다.", answer: true, miss: "'매출 1,850만 원'은 표에 없는 숫자" },
    { text: "클릭은 이메일이 960건으로 가장 많았습니다.", answer: false },
  ],
};

// 4번: 회의 메모와 AI 요약. 틀린 정보, 지어낸 내용, 확인 안 되는 출처가 하나씩.
const verify = {
  area: "verify",
  kind: "pick",
  task: "할인 행사 회의 메모와 AI가 쓴 요약. 요약에서 틀리거나 지어낸 문장 고르기.",
  question: "요약 문장마다 메모의 어느 줄이 근거인지 확인했나?",
  material: {
    title: "자료 · 할인 행사 회의 메모",
    subtitle: "12월 2일 마케팅팀 회의",
    kind: "list",
    lines: [
      "행사 기간: 12월 9일~15일",
      "할인: 전 품목 15%, 3만 원 이상 무료 배송",
      "문자 알림: 12월 8일 오후 6시에 한 번만",
      "배너 시안: 디자인팀이 12월 4일까지 전달",
      "예산: 아직 미정, 금요일에 팀장님이 확정",
    ],
  },
  answerTitle: "AI가 쓴 회의 요약",
  sentences: [
    { text: "할인 행사는 12월 9일부터 15일까지 열립니다.", answer: false },
    { text: "전 품목 20% 할인과 3만 원 이상 무료 배송을 제공합니다.", answer: true, miss: "할인율은 20%가 아니라 15%" },
    { text: "문자 알림은 12월 8일 오후 6시에 한 번 보냅니다.", answer: false },
    { text: "행사 예산은 500만 원으로 확정됐습니다.", answer: true, miss: "예산은 아직 미정. '500만 원'은 지어낸 숫자" },
    {
      text: "업계 조사에 따르면 연말 할인 문자의 클릭률이 평소의 두 배입니다.",
      answer: true,
      miss: "'업계 조사'는 메모에 없는 출처",
    },
    { text: "배너 시안은 디자인팀이 12월 4일까지 전달합니다.", answer: false },
  ],
};

// 5번: 상황마다 AI 쓰는 방법 고르기(보드 L5의 네 상황).
const tool = {
  area: "tool",
  kind: "choose",
  task: "상황 카드 4장. 상황마다 AI를 어떻게 쓸지 고르기.",
  question: "이 일에 필요한 정보가 AI 안에 있는가, 밖에 있는가?",
  cards: [
    { id: "rival", text: "이번 주 경쟁사 신제품 반응 정리", answer: "search" },
    { id: "excel", text: "지난 캠페인 성과 엑셀 요약", answer: "file" },
    { id: "copy", text: "광고 문구 세 가지 다른 말투로", answer: "ask" },
    { id: "birthday", text: "고객 명단으로 생일 쿠폰 대상 정하기", answer: "no" },
  ],
};

// 6번: 매주 쓰는 리뷰 요약 템플릿. {{빈칸}} 두 개 이상.
const flow = {
  area: "flow",
  kind: "template",
  task: "매주 쌓인 고객 리뷰를 AI에게 요약시킴. 기간과 리뷰만 바꿔 쓰는 템플릿 프롬프트 쓰기. 바뀌는 곳은 {{빈칸}}으로.",
  question: "다음 주에 이 프롬프트를 그대로 다시 쓸 수 있는가?",
  criteria: [
    {
      label: "매주 바뀌는 곳을 {{빈칸}} 두 개 이상으로",
      item: null,
      check: BLANKS_CHECK,
      question: "다음 주에 이 프롬프트를 다시 쓸 때 바꿀 곳은 어디인가?",
    },
    {
      label: "리뷰를 요약해 달라는 요청",
      item: "goal",
      check: /^(?=[\s\S]*(리뷰|후기))(?=[\s\S]*(요약|정리|분석|뽑아|나눠))/,
      question: "AI가 이 리뷰로 무엇을 해야 하는가?",
    },
    {
      label: "요약을 읽을 사람이나 쓰임 밝히기",
      item: "context",
      check: /팀장|팀원|회의|보고|공유|상품팀|우리 팀|읽을|읽는|담당/,
      question: "이 요약은 누가, 어디에 쓰는가?",
    },
    {
      label: "매주 같은 형식 지정",
      item: "format",
      check: /목록|번호|표로|표 형식|불릿|항목|한 줄|\d+\s*줄|(한|두|세)\s*(줄|문장)|이내|칸|나눠|순서로/,
      question: "매주 같은 모양으로 받으려면 무엇을 정해야 하는가?",
    },
    {
      label: "리뷰에 없는 내용은 지어내지 말라고 하기",
      item: "criteria",
      check: NO_MADE_UP_CHECK,
      question: "리뷰에 없는 내용이 필요하면 AI는 어떻게 해야 하는가?",
    },
  ],
  model:
    "{{기간}} 동안 들어온 고객 리뷰를 요약해 줘. 나는 생활용품 브랜드 마케터이고, 이 요약은 월요일 팀 회의에서 공유할 거야. 좋은 점, 아쉬운 점, 자주 나온 요청 세 칸으로 나눠 칸마다 세 줄 이내로 써 줘. 리뷰에 없는 내용은 지어내지 말고 '없음'이라고 적어 줘.\n---\n{{이번 주 리뷰}}\n---",
  bad: "리뷰 요약해 줘",
};

const marketing = { questions: [prompt, memory, file, verify, tool, flow] };
export default marketing;
