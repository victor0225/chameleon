// 과정 2~6에 더한 미션 10개(작업 H, 2026-11-21). 과정마다 미션 3개가 되게 한다. 모양과 kind는 data/courses.js 머리말과 같다.
// 이 파일에서 새로 쓰는 데이터 기능
//   absent: true    정규식이 안 맞아야 채운 것으로 본다(mem3). Gemini는 label 그대로 판단한다.
//   samples, check  file 미션의 예시 파일 여러 개와, 결과물 숫자 확인(미션에 하나)
//   tryAsk          설정을 넣고 이 질문을 했을 때의 답을 결과로 보여 준다(mem3)
//   noRun: true     Gemini로 결과를 만들지 않고 outputs 예시만 보여 준다(tool2, 검색 결과를 지어내면 안 되므로)
import { FILE_MENTION } from "../lib/fileSignals.js";
import { PERSONAL_INFO } from "../lib/privacy.js";
import { either, FORMAT_CHECK, NO_MADE_UP_CHECK } from "./checks.js";

const RULE_NOTE = "AI 연결 없음. 미리 만든 예시 결과 표시.";

// tool1, tool3이 같이 쓰는 칸과 코칭 질문
export const TOOL_BINS = [
  { id: "ask", title: "그냥 질문" },
  { id: "search", title: "검색 켜기" },
  { id: "file", title: "파일 붙여 분석" },
  { id: "no", title: "AI에게 맡기지 않기" },
];
export const TOOL_COACHING = {
  no: { question: "{card} AI의 답대로 끝내도 되는 일인가?" },
  search: { question: "이 일에 필요한 정보가 AI가 배울 때 이미 있었는가?" },
  file: { question: "AI가 이 일을 하려면 읽어야 할 것은?" },
  ask: { question: "이 일에 새로 찾을 정보나 읽을 파일이 꼭 필요한가?" },
};

const SALES_LINES = [
  "원목 식탁 · 42개 · 3,780만 원",
  "패브릭 소파 · 35개 · 4,550만 원",
  "수납 선반 · 128개 · 1,920만 원",
  "침대 프레임 · 27개 · 2,970만 원",
  "사무용 의자 · 96개 · 2,400만 원",
];

const SPOT_KINDS = [
  { id: "wrong", name: "틀린 정보" },
  { id: "made", name: "지어낸 내용" },
  { id: "source", name: "확인 안 되는 출처" },
];
const SPOT_PASS = { min: 3, maxFalse: 1 };
const SPOT_CRITERIA = [
  { label: "숨겨 둔 4곳 중 3곳 이상 찾기", item: null },
  { label: "맞는 문장을 틀렸다고 고른 것 1개 이하", item: null },
];

export const MORE_MISSIONS = [
  // ---------- 과정 2 ----------
  {
    id: "mem3",
    course: "memory",
    kind: "prompt",
    focus: null,
    title: "AI 설정에 내 정보 쓰기",
    summary: "AI 서비스 설정에 넣을 나에 대한 정보와 답변 방식 쓰기",
    lecture: {
      point: "AI 서비스 설정에는 '나에 대해 알려 줄 내용'과 '답변 방식'을 적는 칸이 있다(이름은 서비스마다 다름).",
      points: ["한 번 적어 두면 새 대화마다 다시 말하지 않아도 됨.", "다음 일에도 늘 맞는 것만 적기.", "이번 일 정보와 남의 개인정보는 적지 않기."],
      bad: "나는 회사원이야. 잘 부탁해",
      good: "나는 온라인 가구 쇼핑몰 마케팅팀에서 SNS 운영을 맡고 있어. 답은 결론부터, 다섯 줄 이내 목록으로 써 줘. 존댓말로 쓰고 이모지는 쓰지 마.",
    },
    mission: "새 대화마다 같은 설명을 반복하지 않게, AI 서비스 설정에 넣을 '나에 대한 정보'와 '원하는 답변 방식' 쓰기.",
    tryAsk: "이번 주 SNS 게시물 아이디어 세 개 줘",
    criteria: [
      {
        label: "내가 하는 일",
        item: "context",
        check: /팀|직무|담당|맡|회사|하는 일|업무/,
        question: "AI가 내 일을 알면 답이 어떻게 달라지는가?",
      },
      {
        label: "늘 원하는 답변 모양",
        item: "format",
        check: /결론|목록|표|\d+\s*줄|이내|짧게|길이|형식|번호/,
        question: "매번 '짧게', '목록으로'라고 다시 말하고 있지 않은가?",
      },
      {
        label: "말투나 쓰지 말 것",
        item: "constraint",
        check: /말투|존댓말|반말|이모지|쓰지\s*마|하지\s*마|빼/,
        question: "AI 답에서 늘 거슬리던 말투나 표현은?",
      },
      {
        label: "이번 일에만 맞는 정보 빼기",
        item: null,
        absent: true,
        check: /이번\s*(주|달)|오늘|내일|마감|\d+월\s*\d+일|까지\s*(내|제출)/,
        question: "다음 달 다른 일을 맡길 때도 맞는 정보인가?",
      },
      {
        label: "남의 개인정보·비밀 빼기",
        item: null,
        absent: true,
        check: new RegExp([...PERSONAL_INFO.map((p) => p.re.source), "비밀번호"].join("|")),
        question: "이 설정이 서비스에 계속 남아도 괜찮은 정보인가?",
      },
    ],
    outputs: {
      weak: "SNS 게시물 아이디어를 알려 드릴게요! 😊 첫째, 계절에 맞는 콘텐츠를 올려 보세요. 요즘 같은 때에는 따뜻한 분위기의 사진이 인기가 많아요. 둘째, 팔로워 참여를 이끄는 이벤트를 열어 보세요. 셋째, 비하인드 영상으로 브랜드를 친근하게 보여 주세요.",
      strong: "1. 겨울 거실 꾸미기 전후 사진 (원목 식탁·러그)\n2. 고객 집들이 후기 다시 올리기\n3. 12월 출시 텀블러 미리 보기 스토리",
      weakNote: RULE_NOTE,
    },
    model:
      "나는 온라인 가구 쇼핑몰 마케팅팀에서 SNS 운영을 맡고 있어. 답은 결론부터, 다섯 줄 이내의 번호 목록으로 써 줘. 존댓말로 쓰고 이모지와 과장된 표현은 쓰지 마.",
  },

  // ---------- 과정 3 ----------
  {
    id: "file2",
    course: "file",
    kind: "file",
    focus: null,
    title: "매출 표에서 많이 팔린 제품 뽑기",
    summary: "매출 표를 붙이고 잘 팔린 제품을 기준과 함께 묻기",
    lecture: {
      point: "'가장 많이 팔린'은 수량인지 매출인지에 따라 답이 달라진다.",
      points: ["기준 정해 주기.", "AI가 계산에 쓴 숫자도 같이 보여 달라고 하기. 맞는지 바로 확인 가능."],
      bad: "이 표에서 제일 잘 팔린 거 알려 줘",
      good: "첨부한 10월 매출 표에서 판매 수량 기준으로 많이 팔린 제품 세 개를 번호 목록으로 뽑아 줘. 제품마다 표의 수량을 같이 적어 줘.",
    },
    mission: "첨부한 10월 제품별 매출 표를 보고 가장 잘 팔린 제품을 AI에게 묻기.",
    sampleLabel: "예시 매출 표",
    samples: [
      {
        url: "/samples/sales-oct.csv",
        name: "10월_제품별_매출_예시.csv",
        type: "text/csv",
        title: "10월 제품별 매출",
        preview: ["제품,판매수량,매출(만 원)", "원목 식탁,42,3780", "패브릭 소파,35,4550", "수납 선반,128,1920"],
      },
    ],
    check: {
      numbers: ["10", "42", "35", "128", "27", "96", "3780", "4550", "1920", "2970", "2400", "328", "15620"],
      core: [
        { label: "수량 1위 수납 선반 128개", check: /수납\s*선반[^\n]{0,20}128|128[^\n]{0,20}수납\s*선반/ },
        { label: "매출 1위 패브릭 소파 4,550만 원", check: /소파[^\n]{0,20}4,?550|4,?550[^\n]{0,20}소파/ },
      ],
      coreMin: 1,
      unknownLabel: "표에 없는 숫자",
      unknownNote: "AI가 계산한 값일 수 있음. 계산이 맞는지 표와 맞춰 보기.",
      compareNote: "표에 실린 숫자와 하나씩 맞춰 봄.",
    },
    criteria: [
      {
        label: "첨부한 표 지정",
        item: null,
        check: either(FILE_MENTION, /표/),
        question: "AI가 읽어야 할 것은?",
      },
      {
        label: "'잘 팔린'의 기준 정하기",
        item: "constraint",
        check: /수량|개수|판매량|매출|금액/,
        question: "많이 팔렸다는 건 개수인가, 금액인가?",
      },
      {
        label: "받을 모양을 정했다",
        item: "format",
        check: FORMAT_CHECK,
        question: "비교하기 쉬운 결과 모양은?",
      },
      {
        label: "계산에 쓴 숫자 요청",
        item: "criteria",
        check: /근거|계산|숫자.{0,6}(같이|함께|적어|보여)|어떻게\s*(셌|계산)/,
        question: "AI가 낸 숫자가 맞는지 어떻게 확인하는가?",
      },
    ],
    outputs: {
      weak: "가장 많이 팔린 제품은 패브릭 소파예요. 매출이 가장 높아서 인기가 많은 제품이에요.",
      strong:
        "기준: 판매 수량\n1. 수납 선반 128개\n2. 사무용 의자 96개\n3. 원목 식탁 42개\n참고: 매출로 보면 패브릭 소파가 4,550만 원으로 1위예요.\n계산: 표의 '판매수량' 칸을 큰 순서로 늘어놓았어요.",
    },
    model:
      "첨부한 10월 제품별 매출 표에서 판매 수량 기준으로 많이 팔린 제품 세 개를 번호 목록으로 뽑아 줘. 제품마다 표의 수량을 같이 적고, 매출 기준 1위도 한 줄로 따로 알려 줘. 표에 있는 숫자만 쓰고 어떻게 계산했는지 적어 줘.",
  },
  {
    id: "file3",
    course: "file",
    kind: "file",
    focus: null,
    title: "두 회의록에서 바뀐 점 찾기",
    summary: "회의록 두 개를 붙이고 바뀐 점만 정리해 달라고 하기",
    lecture: {
      point: "파일을 여러 개 붙이면 AI는 어느 파일이 먼저인지 모른다.",
      points: ["파일을 구분해 가리키기.", "무엇을 비교할지, 전과 후를 어떻게 나란히 받을지 말하기."],
      bad: "이 두 개 정리해 줘",
      good: "첨부한 11월 4일 회의록과 11월 11일 회의록을 비교해서 바뀐 것만 표로 정리해 줘. 항목, 4일, 11일 칸으로 나눠 줘.",
    },
    mission: "지난주와 이번 주 회의록 첨부됨. 바뀐 점 정리를 AI에게 요청하기.",
    sampleLabel: "예시 회의록",
    samples: [
      {
        url: "/samples/meeting-1104.txt",
        name: "11월4일_출시준비_회의록_예시.txt",
        type: "text/plain",
        title: "11월 4일 신제품 출시 준비 회의",
        preview: ["출시일: 12월 1일", "예산: 300만 원", "홍보 채널: 인스타그램, 블로그", "경품: 텀블러 100개"],
      },
      {
        url: "/samples/meeting-1111.txt",
        name: "11월11일_출시준비_회의록_예시.txt",
        type: "text/plain",
        title: "11월 11일 신제품 출시 준비 회의",
        preview: ["출시일: 12월 8일로 미룸 (공장 일정)", "예산: 300만 원", "홍보 채널: 인스타그램만 (블로그는 뺌)", "경품: 텀블러 150개"],
      },
    ],
    check: {
      numbers: ["4", "11", "12", "1", "8", "300", "100", "150"],
      core: [
        { label: "출시일 12월 8일", check: /12월\s*8일/ },
        { label: "블로그 뺌", check: /블로그/ },
        { label: "경품 150개", check: /150/ },
        { label: "경품 담당 김 주임", check: /김\s*주임/ },
      ],
      coreMin: 3,
      unknownLabel: "회의록에 없는 숫자",
      unknownNote: "없는 숫자는 AI가 지어냈을 가능성이 큼.",
      compareNote: "두 회의록에 실린 숫자와 하나씩 맞춰 봄.",
    },
    criteria: [
      {
        label: "두 회의록을 구분해 지정",
        item: null,
        check: /두\s*(파일|회의록|개)|각각|지난\s*(주|번)|이번\s*주|4일|11일|첫\s*번째|두\s*번째|이전|나중/,
        question: "AI가 어느 회의록이 먼저인지 아는가?",
      },
      {
        label: "바뀐 점 찾기 요청",
        item: "goal",
        check: /바뀐|달라진|변경|차이|비교/,
        question: "두 회의록에서 찾아 달라는 것은?",
      },
      {
        label: "전과 후를 나란히 받기",
        item: "format",
        check: /표로|표 형식|나란히|전후|전과\s*후|→|칸으로/,
        question: "바뀌기 전과 후를 한눈에 볼 모양은?",
      },
      {
        label: "회의록에 없는 내용은 지어내지 말라고 지시",
        item: "criteria",
        check: NO_MADE_UP_CHECK,
        question: "바뀐 이유가 회의록에 없으면 AI가 할 일은?",
      },
    ],
    outputs: {
      weak: "두 회의록 모두 신제품 출시를 준비하는 내용이에요. 예산은 300만 원이고 인스타그램으로 홍보해요. 출시일은 12월로 잡혀 있어요.",
      strong:
        "| 항목 | 11월 4일 | 11월 11일 |\n| 출시일 | 12월 1일 | 12월 8일 (공장 일정) |\n| 홍보 채널 | 인스타그램, 블로그 | 인스타그램만 |\n| 경품 수량 | 텀블러 100개 | 텀블러 150개 |\n| 경품 담당 | 박 주임 | 김 주임 |\n그대로인 것: 예산 300만 원, 홍보 담당 이 대리",
    },
    model:
      "첨부한 11월 4일 회의록과 11월 11일 회의록을 비교해서 바뀐 것만 표로 정리해 줘. 항목, 11월 4일, 11월 11일 칸으로 나누고, 바뀐 이유가 회의록에 있으면 함께 적어 줘. 회의록에 없는 내용은 지어내지 마.",
  },

  // ---------- 과정 4 ----------
  {
    id: "ver2",
    course: "verify",
    kind: "spot",
    focus: null,
    title: "매출 요약에서 틀린 숫자 찾기",
    summary: "AI가 쓴 매출 요약에서 틀린 숫자 찾기",
    lecture: {
      point: "AI는 계산과 숫자를 자주 틀린다.",
      points: [
        "결과를 그대로 옮기기 전에 표와 맞춰 보기.",
        "합계와 순위는 표의 숫자와 하나씩 맞춰 보기.",
        "비율은 직접 나눠 보기.",
        "표에 없는 기간과 비교한 말은 지어낸 것인지 보기.",
      ],
    },
    mission: "10월 매출 표 요약을 맡겼더니 숫자가 틀린 요약이 옴. 표와 맞춰 보고 문제 문장과 빠진 내용 찾기.",
    material: { title: "자료 · 10월 제품별 매출 표", subtitle: "교육용 예시 자료", kind: "list", lines: SALES_LINES },
    source: "표",
    answerName: "요약",
    answerTitle: "AI가 쓴 매출 요약",
    kinds: SPOT_KINDS,
    sentences: [
      { text: "10월 전체 판매 수량은 328개예요.", answer: null },
      { text: "전체 매출은 1억 5,620만 원이에요.", answer: null },
      {
        text: "가장 많이 팔린 제품은 패브릭 소파로, 128개가 팔렸어요.",
        answer: "wrong",
        question: "표에서 128개가 팔린 제품은?",
        why: "숫자가 맞아도 제품 이름이 바뀌면 틀린 보고.",
        kindNote: "표와 제품 이름이 달라 '틀린 정보'에 더 가까움.",
      },
      {
        text: "수납 선반 매출은 전체의 약 25%예요.",
        answer: "wrong",
        question: "1,920을 15,620으로 나누면 얼마인가?",
        why: "비율은 직접 나눠 봐야 틀린 게 보임.",
        kindNote: "계산이 틀린 것도 '틀린 정보'. 실제로는 약 12%.",
      },
      {
        text: "사무용 의자는 9월보다 20% 더 팔렸어요.",
        answer: "made",
        question: "표에 9월 숫자가 있는가?",
        why: "표에 없는 기간과 비교한 말은 AI가 지어낸 것.",
        kindNote: "표에 9월 숫자가 아예 없어 '지어낸 내용'에 더 가까움.",
      },
      { text: "침대 프레임은 27개로 가장 적게 팔렸어요.", answer: null },
    ],
    missing: {
      words: ["소파", "4,550", "4550", "매출"],
      min: 2,
      question: "수량 말고 다른 기준의 1위도 요약에 들어 있는가?",
      found: "수량과 매출처럼 기준이 둘이면 요약에서 한쪽이 자주 빠짐.",
    },
    pass: SPOT_PASS,
    criteria: SPOT_CRITERIA,
  },
  {
    id: "ver3",
    course: "verify",
    kind: "spot",
    focus: null,
    title: "의심스러운 출처 찾기",
    summary: "AI 답에서 확인 안 되는 출처와 빠진 자료 찾기",
    lecture: {
      point: "출처를 댔다고 믿지 말고 직접 열어 본다.",
      points: [
        "'전문가들은', '연구에 따르면'처럼 누가 했는지 모르는 말은 근거가 아님.",
        "실제로 있는 자료라도 숫자 맞춰 보기.",
        "AI가 쓰지 않은 자료가 있는지도 보기.",
      ],
    },
    mission:
      "공유 폴더 자료로 서비스 개선 방향을 근거와 함께 정리해 달라고 했더니 이런 답이 옴. 출처가 의심스러운 문장과 빠진 자료 찾기.",
    material: {
      title: "자료 · 우리 팀 공유 폴더",
      subtitle: "교육용 예시 자료",
      kind: "list",
      lines: [
        "고객 만족도 조사 결과.pdf: 응답 512명, 만족도 5점 만점에 4.2점",
        "3분기 고객 문의 분석 보고서.pdf: 총 문의 1,240건",
        "경쟁사 가격 비교표(10월).xlsx: 우리 가격이 경쟁사 3곳 평균보다 8% 높음",
        "고객 인터뷰 메모(11월).docx: '조립 설명서가 어렵다'는 말이 가장 많음",
      ],
    },
    source: "공유 폴더 자료",
    answerName: "답",
    answerTitle: "AI가 쓴 개선 방향 정리",
    kinds: SPOT_KINDS,
    sentences: [
      { text: "고객 만족도 조사(512명 응답)에서 만족도는 5점 만점에 4.2점이었어요.", answer: null },
      { text: "3분기 고객 문의는 1,240건이었어요.", answer: null },
      {
        text: "「2025 온라인 가구 시장 백서」에 따르면 고객의 70%가 배송 속도를 가장 중요하게 봐요.",
        answer: "source",
        question: "이 백서가 공유 폴더에 있는가? 직접 찾아볼 수 있는가?",
        why: "그럴듯한 이름의 자료라도 직접 열어 볼 수 없으면 근거로 쓰지 않음.",
        kindNote: "어디서 나왔는지 확인할 수 없어 '확인 안 되는 출처'에 더 가까움.",
      },
      {
        text: "전문가들은 무료 배송이 재구매율을 두 배로 올린다고 말해요.",
        answer: "source",
        question: "어느 전문가가 어디서 한 말인가?",
        why: "누가 했는지 모르는 말은 근거가 아님.",
        kindNote: "누가 한 말인지 알 수 없어 '확인 안 되는 출처'에 더 가까움.",
      },
      {
        text: "경쟁사 가격 비교표를 보면 우리 가격이 평균보다 15% 높아요.",
        answer: "wrong",
        question: "비교표의 숫자와 같은가?",
        why: "실제로 있는 자료라도 숫자는 맞춰 봐야 함.",
        kindNote: "자료는 있지만 숫자가 달라 '틀린 정보'에 더 가까움.",
      },
    ],
    missing: {
      words: ["조립", "설명서", "인터뷰"],
      min: 2,
      question: "공유 폴더 자료 중 답에 한 번도 쓰이지 않은 것은?",
      found: "AI는 자료를 다 읽은 척해도 일부만 쓰기도 함.",
    },
    pass: SPOT_PASS,
    criteria: SPOT_CRITERIA,
  },

  // ---------- 과정 5 ----------
  {
    id: "tool2",
    course: "tool",
    kind: "prompt",
    focus: null,
    title: "검색 켜고 최신 소식 묻기",
    summary: "검색을 켠 AI에게 최신 소식을 기간·출처와 함께 묻기",
    noRun: true,
    lecture: {
      point: "검색을 켜도 무엇을, 언제 것을 찾을지 말하지 않으면 오래된 글이나 출처 없는 요약이 온다.",
      points: ["기간 정하기.", "소식마다 날짜와 출처 링크 달라고 하기.", "못 찾으면 없다고 하라고 하기."],
      bad: "우드홈 신제품 알려 줘",
      good: "검색해서 경쟁사 우드홈의 이번 주 신제품 소식을 찾아 줘. 소식마다 날짜와 출처 링크를 붙이고, 찾지 못하면 '찾지 못함'이라고 적어 줘.",
    },
    mission:
      "검색을 켠 AI에게 경쟁사 '우드홈'의 이번 주 신제품 소식 정리를 부탁하는 프롬프트 쓰기. ('우드홈'은 연습용으로 지어낸 회사 이름.)",
    criteria: [
      {
        label: "찾을 것 지정",
        item: "goal",
        check: /^(?=[\s\S]*(신제품|출시|소식|가격|뉴스))(?=[\s\S]*(찾|정리|알려|요약|모아))/,
        question: "AI가 찾아야 할 것은?",
      },
      {
        label: "기간 지정",
        item: "constraint",
        check: /이번\s*주|최근\s*\d*\s*(일|주)|지난\s*\d+\s*일|\d+월\s*\d+일\s*(부터|이후|~)|일주일/,
        question: "언제 것까지 찾아야 하는가? 작년 소식이 섞여도 괜찮은가?",
      },
      {
        label: "소식마다 날짜와 출처 요청",
        item: "criteria",
        check: /^(?=[\s\S]*(출처|링크|URL|주소))(?=[\s\S]*(날짜|언제|발표일|게시일))/i,
        question: "찾은 소식이 진짜인지 어떻게 확인하는가?",
      },
      {
        label: "못 찾으면 없다고 하라고 지시",
        item: null,
        check: /없으면|못\s*찾|찾지\s*못|확인\s*안\s*되면|모르면|지어내지/,
        question: "소식이 없으면 AI가 할 일은?",
      },
    ],
    outputs: {
      weak: "우드홈은 최근 다양한 신제품을 내며 좋은 반응을 얻고 있어요. 특히 친환경 소재 제품이 인기를 끌고 있어요.",
      strong:
        "이번 주(11월 17일~23일) 우드홈 신제품 소식\n1. 11월 18일 · 접이식 원목 테이블 출시 · 출처: 우드홈 공식 블로그 (링크)\n2. 11월 21일 · 겨울 한정 패브릭 커버 판매 시작 · 출처: 가구업계 뉴스 (링크)\n이번 주 가격 인하 소식은 찾지 못했어요.",
      weakNote: "실제 검색은 하지 않음. 이런 답이 온다는 예시.",
    },
    model:
      "검색해서 경쟁사 우드홈의 이번 주(11월 17일~23일) 신제품 소식을 찾아 줘. 소식마다 발표 날짜와 출처 링크를 붙여 번호 목록으로 정리하고, 찾지 못한 건 지어내지 말고 '찾지 못함'이라고 적어 줘.",
  },
  {
    id: "tool3",
    course: "tool",
    kind: "choose",
    focus: null,
    title: "거래처 미팅 준비, 단계마다 고르기",
    summary: "미팅 준비 여섯 단계마다 AI 쓰는 방법 고르기",
    lecture: {
      point: "한 가지 일 안에서도 단계마다 맞는 방법이 다르다.",
      points: ["찾아볼 것, 읽어야 할 자료, 그냥 물어도 될 것, 사람이 정할 것 나누기."],
    },
    mission: "다음 주 거래처 미팅 준비 6단계. 단계마다 AI를 어떻게 쓸지 고르기.",
    bins: TOOL_BINS,
    cards: [
      { id: "news", text: "거래처의 최근 뉴스 찾아보기", answer: "search" },
      { id: "minutes", text: "지난 미팅 회의록에서 약속한 일 뽑기", answer: "file" },
      { id: "agenda", text: "미팅 안건 초안 쓰기", answer: "ask" },
      { id: "quote", text: "견적서 엑셀에서 할인율 계산하기", answer: "file" },
      { id: "discount", text: "미팅에서 줄 할인 폭 최종 결정하기", answer: "no" },
      { id: "thanks", text: "미팅 뒤 감사 메일 초안 쓰기", answer: "ask" },
    ],
    pass: { min: 5, must: "no" },
    criteria: [
      { label: "6장 중 5장 이상 맞게 고르기", item: null },
      { label: "AI에게 맡기지 않을 일은 꼭 맞히기", item: null },
    ],
    coaching: TOOL_COACHING,
    mustDetail: "결과에 책임을 지는 사람이 누구인지 생각해 보기.",
    mustNote: "AI에게 맡기지 않을 일은 꼭 맞혀야 통과.",
  },

  // ---------- 과정 6 ----------
  {
    id: "flow1",
    course: "flow",
    kind: "sort",
    focus: null,
    title: "보고 흐름 세 단계로 나누기",
    summary: "AI에게 보낼 부탁 여섯 개를 세 단계에 놓기",
    lecture: {
      point: "긴 일은 한 번에 맡기지 말고 단계로 나눈다. 앞 단계의 결과가 다음 단계의 재료가 된다.",
      points: [
        "① 자료 요약: 흩어진 자료에서 필요한 것만 뽑기.",
        "② 초안: 뽑은 내용으로 보고 쓰기.",
        "③ 검토: 초안을 자료와 맞춰 보기. 마지막에는 꼭 검토 단계 두기.",
      ],
    },
    mission: "주간 보고를 AI와 세 단계로 만들려 함. AI에게 보낼 부탁 6개를 알맞은 단계에 놓기.",
    bins: [
      { id: "s1", title: "① 자료 요약", desc: "흩어진 자료에서 필요한 것만 뽑기" },
      { id: "s2", title: "② 보고 초안", desc: "뽑은 내용으로 보고 쓰기" },
      { id: "s3", title: "③ 검토", desc: "초안을 자료와 맞춰 보기" },
    ],
    cards: [
      { id: "minutes", text: "첨부한 이번 주 회의록 세 개에서 결정된 것만 뽑아 줘", answer: "s1" },
      { id: "inquiry", text: "고객 문의 표에서 지난주보다 늘어난 유형을 정리해 줘", answer: "s1" },
      { id: "draft", text: "앞에서 뽑은 내용으로 팀장님께 올릴 주간 보고를 다섯 줄로 써 줘", answer: "s2" },
      { id: "lead", text: "주간 보고 첫 줄에 이번 주 결론을 한 문장으로 넣어 줘", answer: "s2" },
      { id: "numbers", text: "초안의 숫자가 회의록·표와 같은지 하나씩 맞춰 봐 줘", answer: "s3" },
      { id: "gaps", text: "초안에서 빠진 결정 사항이 있는지 회의록과 비교해 줘", answer: "s3" },
    ],
    pass: { min: 5, must: "s3" },
    criteria: [
      { label: "6장 중 5장 이상 맞게 놓기", item: null },
      { label: "검토 카드는 모두 맞히기", item: null },
    ],
    coaching: {
      s3: { question: "{card} 초안이 있어야 할 수 있는 일이 아닌가?" },
      "s1>s2": { question: "이 일의 결과가 초안의 재료가 되지 않는가?" },
      "s1>s3": { question: "이 일의 결과가 초안의 재료가 되지 않는가?" },
      "s2>s1": { question: "이 일을 하려면 먼저 정리된 자료가 있어야 하지 않는가?" },
      "s2>s3": { question: "이 일은 새로 쓰는 일인가, 맞춰 보는 일인가?" },
    },
    mustDetail: "AI가 쓴 초안은 마지막에 자료와 맞춰 봐야 함.",
    mustNote: "검토 카드는 한 장도 빠짐없이 맞혀야 통과.",
  },
  {
    id: "flow2",
    course: "flow",
    kind: "prompt",
    focus: null,
    title: "매주 쓰는 보고를 템플릿으로",
    summary: "날짜와 메모만 바꿔 쓰는 주간 보고 템플릿 쓰기",
    lecture: {
      point: "매주 하는 일은 바뀌는 칸만 비워 둔 템플릿 프롬프트로 만들어 둔다.",
      points: ["자료만 바꿔 붙여 쓰면 됨.", "형식과 규칙은 템플릿에 고정."],
      bad: "이번 주 보고 써 줘",
      good: "[기간] 주간 보고를 써 줘. 아래 [이번 주 메모]를 보고 한 일, 다음 주 할 일, 막힌 일 세 칸으로 나눠 줘.",
    },
    mission: "매주 월요일 주간 보고를 AI에게 맡김. 날짜와 메모만 바꿔 쓰는 템플릿 프롬프트 쓰기. 매주 바뀌는 칸은 [ ]로 비워 두기.",
    material: {
      title: "자료 · 이번 주 메모",
      subtitle: "템플릿을 시험할 예시",
      kind: "list",
      lines: [
        "기간: 11월 17일~21일",
        "한 일: 겨울 캠페인 게시물 3개 올림, 경품 업체 두 곳 견적 받음",
        "다음 주: 경품 업체 결정, 12월 게시 일정 확정",
        "막힌 일: 디자인팀 일정이 밀려 배너가 늦어짐",
      ],
    },
    criteria: [
      {
        label: "매주 바뀌는 칸 비워 두기",
        item: null,
        check: /\[[^\]]+\]|\{[^}]+\}|○○|OO/,
        question: "다음 주에 이 프롬프트를 다시 쓸 때 바꿀 것은?",
      },
      {
        label: "정리할 내용 지정",
        item: "goal",
        check: /한\s*일|할\s*일|결정|이슈|문제|진행|성과|계획|막힌/,
        question: "보고에 들어가야 할 것은?",
      },
      {
        label: "보고를 읽는 사람 명시",
        item: "context",
        check: /팀장|보고|읽는|받는|우리\s*팀|팀원|윗선/,
        question: "이 보고를 읽는 사람은?",
      },
      {
        label: "매주 같은 형식 지정",
        item: "format",
        check: either(FORMAT_CHECK, /칸|나눠/),
        question: "매주 같은 모양으로 받으려면 어떻게 말해야 하는가?",
      },
      {
        label: "메모에 없는 내용은 지어내지 말라고 지시",
        item: "criteria",
        check: either(NO_MADE_UP_CHECK, /없음이라고/),
        question: "메모에 막힌 일이 없으면 AI가 할 일은?",
      },
    ],
    outputs: {
      weak: "이번 주에는 여러 업무를 진행했고 좋은 성과가 있었어요. 다음 주에도 계획한 일을 잘 진행할 예정이에요.",
      strong:
        "주간 보고 (11월 17일~21일)\n1. 한 일: 겨울 캠페인 게시물 3개 올림, 경품 업체 두 곳 견적 받음\n2. 다음 주 할 일: 경품 업체 결정, 12월 게시 일정 확정\n3. 막힌 일: 디자인팀 일정이 밀려 배너가 늦어짐",
      weakNote: RULE_NOTE,
    },
    model:
      "[기간] 주간 보고를 써 줘. 나는 마케팅팀 SNS 담당이고 팀장님이 읽을 보고야. 아래 [이번 주 메모]를 보고 1. 한 일 2. 다음 주 할 일 3. 막힌 일 세 칸으로 나눠 칸마다 세 줄 이내로 써 줘. 메모에 없는 내용은 지어내지 말고 '없음'이라고 적어 줘.\n[이번 주 메모]",
  },
  {
    id: "flow3",
    course: "flow",
    kind: "choose",
    focus: null,
    title: "단계마다 AI와 사람 역할 정하기",
    summary: "월간 보고 흐름의 단계마다 누가 맡을지 고르기",
    lecture: {
      point: "AI에게 맡긴 흐름에도 사람이 확인할 곳이 있어야 한다.",
      points: [
        "틀려도 바로 보이고 피해가 없으면 그대로 쓰기.",
        "숫자와 밖으로 나가는 글은 사람이 확인.",
        "돈, 사람 평가, 최종 결정은 사람이 함.",
      ],
    },
    mission: "월간 고객 문의 보고를 AI로 자동화. 단계마다 맡을 주체 고르기.",
    bins: [
      { id: "auto", title: "AI에게 맡기고 그대로 쓰기" },
      { id: "check", title: "AI가 하고 사람이 확인" },
      { id: "human", title: "사람이 직접 하기" },
    ],
    cards: [
      { id: "titles", text: "보고서 제목 후보 세 개 내기", answer: "auto" },
      { id: "spelling", text: "사내 공지 문장의 맞춤법 고치기", answer: "auto" },
      { id: "count", text: "고객 문의 표에서 유형별 건수 세기", answer: "check" },
      { id: "report", text: "팀장님께 보낼 월간 보고 초안 쓰기", answer: "check" },
      { id: "apology", text: "고객에게 보낼 사과 안내문 초안 쓰기", answer: "check" },
      { id: "todo", text: "회의록에서 다음 달 할 일 뽑기", answer: "check" },
      { id: "refund", text: "환불해 줄 고객 최종 정하기", answer: "human" },
      { id: "budget", text: "다음 달 예산 확정하기", answer: "human" },
    ],
    pass: { min: 6, must: "human" },
    criteria: [
      { label: "8장 중 6장 이상 맞게 고르기", item: null },
      { label: "사람이 직접 할 일은 꼭 맞히기", item: null },
    ],
    coaching: {
      human: { question: "{quoted}의 결과에 책임질 사람은?" },
      "check>auto": { question: "틀린 숫자나 문장이 그대로 나가면 어떤 일이 생기는가?" },
      "auto>check": { question: "틀려도 바로 보이고 피해가 없는 일은 아닌가?" },
      "auto>human": { question: "AI가 초안을 쓰고 사람이 고치면 더 빠르지 않은가?" },
      "check>human": { question: "AI가 초안을 쓰고 사람이 고치면 더 빠르지 않은가?" },
    },
    mustDetail: "돈, 사람 평가, 최종 결정은 AI 답을 참고만 하고 사람이 결정.",
    mustNote: "사람이 직접 할 일은 꼭 맞혀야 통과.",
  },
];
