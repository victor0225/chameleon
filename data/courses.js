// AI 활용 교육 여섯 과정과 과정 2~6의 미션(코드 이름은 lesson). 과정 1(프롬프트 작성)의 15개는 data/curriculum.js의 LESSONS 그대로다.
// 과정 2~6은 미션 3개씩이다. 처음 만든 다섯 개(mem1, mem2, file1, ver1, tool1)는 여기에, 더한 열 개는 data/moreMissions.js에 있다.
// 미션의 kind가 실습 칸 모양과 채점 방법을 정한다.
//   prompt: 프롬프트를 쓰고 기준으로 채점한다(Gemini, 키가 없으면 check 정규식). material이 있으면 자료 칸을 같이 보여 준다.
//   sort:   카드를 칸으로 나눈다. 정답표로 채점한다(lib/server/practice.js, LLM 안 씀).
//   choose: 상황 카드마다 방법을 하나 고른다. 채점은 sort와 같다.
//   spot:   AI 답변에서 문제 있는 문장을 고르고 빠진 내용을 적는다. 정답표로 채점한다.
//   file:   파일을 붙이고 프롬프트를 쓴다. 프롬프트는 기준으로, 예시 파일(samples)일 때 결과물은 check의 숫자로 확인한다.
// 기준의 item이 null이면 다섯 요소가 아닌 기준이다. 색 없이 그리고, 개인화 엔진의 요소 숙련도에 섞지 않는다.
// 통과 숫자(pass)는 팀이 정한 값이다(2026-11-20). file1의 "보고서에 없는 숫자"는 표시만 하고 통과에는 넣지 않는다.
import { FILE_MENTION } from "../lib/fileSignals.js";
import { FORMAT_CHECK, NO_MADE_UP_CHECK } from "./checks.js";
import { LESSONS } from "./curriculum.js";
import { MORE_MISSIONS, TOOL_BINS, TOOL_COACHING } from "./moreMissions.js";

export const COURSE_LESSONS = [
  {
    id: "mem1",
    course: "memory",
    kind: "sort",
    focus: null,
    title: "기억시킬 것, 이번만 쓸 것, 맡기면 안 되는 것",
    summary: "정보 카드 여덟 장을 세 칸으로 나누기",
    lecture: {
      point:
        "Gemini, ChatGPT 같은 AI 서비스에는 나에 대해 기억해 두는 기능이 있어요. 설정에서 켜고, 무엇을 기억하는지 확인하고, 지울 수 있어요.",
      points: [
        "오래 쓸 정보만 기억시켜요. 내가 맡은 일, 회사, 늘 원하는 보고 방식처럼 다음 일에도 맞는 것이에요.",
        "이번 일에만 필요한 정보는 기억시키지 말고 그때그때 알려 줘요. 이번 마감, 이번 예산 같은 것이에요.",
        "남의 개인정보, 비밀번호, 민감한 내용은 기억시키지 않아요. 대화 기록도 서비스에 남을 수 있어요.",
      ],
      note: "이 기억은 카멜레온이 아니라 바깥 AI 서비스의 기능이에요.",
    },
    mission: "AI 서비스에 알려 줄 정보 카드가 여덟 장 있어요. 오래 기억시킬 것, 이번 작업에만 줄 것, 기억시키면 안 되는 것으로 나눠 보세요.",
    bins: [
      { id: "keep", title: "오래 기억시킬 정보", desc: "다음 일에도 늘 맞는 것" },
      { id: "once", title: "이번 작업에만 줄 정보", desc: "이번 일이 끝나면 쓸모없는 것" },
      { id: "never", title: "기억시키면 안 되는 정보", desc: "남의 개인정보, 비밀번호, 민감한 내용" },
    ],
    cards: [
      { id: "role", text: "나는 마케팅팀에서 SNS 운영을 맡고 있어", answer: "keep" },
      { id: "report", text: "보고서는 늘 결론부터, 다섯 줄 이내로 써 줘", answer: "keep" },
      { id: "company", text: "우리 회사는 온라인 가구 쇼핑몰이야", answer: "keep" },
      { id: "deadline", text: "이번 주 금요일까지 3분기 실적 보고서를 내야 해", answer: "once" },
      { id: "budget", text: "이번 겨울 캠페인 예산은 300만 원이야", answer: "once" },
      { id: "phone", text: "고객 김민수 님 전화번호 010-1234-5678", answer: "never" },
      { id: "password", text: "회사 공용 계정 비밀번호", answer: "never" },
      { id: "review", text: "옆 팀 동료의 인사 평가 내용", answer: "never" },
    ],
    // 8장 중 min장 이상 맞히고, must 칸의 카드는 모두 맞혀야 통과
    pass: { min: 7, must: "never" },
    // 금지 카드를 놓치면 옮겨 볼 칸을 보여 준다(보드 4-1)
    showTarget: true,
    criteria: [
      { label: "8장 중 7장 이상 맞게 나눴다", item: null },
      { label: "기억시키면 안 되는 정보는 모두 맞혔다", item: null },
    ],
    // 잘못 놓은 칸에 따라 던지는 질문. "정답 칸>놓은 칸" 순서이고, never는 금지 카드를 다른 칸에 놓았을 때다.
    coaching: {
      never: { question: "{card} AI 서비스 기록에 남아도 괜찮을까요?" },
      "once>keep": { question: "다음 달에 다른 일을 맡길 때도 이 정보가 맞을까요?" },
      "keep>once": { question: "매번 다시 말하고 있는 정보는 아닌가요?" },
      "keep>never": { question: "이 정보에 남의 개인정보나 비밀이 들어 있나요?" },
      "once>never": { question: "이 정보에 남의 개인정보나 비밀이 들어 있나요?" },
    },
    mustDetail: {
      once: "이번 작업에만 쓰더라도, 대화 기록은 서비스에 남을 수 있어요.",
      keep: "기억시킨 정보는 내가 지우기 전까지 남아 다음 대화에도 쓰여요.",
    },
    mustNote: "기억시키면 안 되는 정보는 한 장도 빠짐없이 맞혀야 통과예요.",
  },
  {
    id: "mem2",
    course: "memory",
    kind: "prompt",
    focus: null,
    title: "긴 대화를 새 대화로 이어 가기",
    summary: "이어가기 요약을 AI에게 부탁하는 프롬프트 쓰기",
    lecture: {
      point:
        "대화가 길어지면 AI는 앞에서 정한 것을 놓치기 시작해요. 그럴 땐 지금 대화의 AI에게 이어가기 요약을 부탁하고, 새 대화에 붙여 넣어 이어 가세요.",
      bad: "지금까지 내용 요약해 줘",
      good: "새 대화에 붙여 넣어 이어 갈 거야. 지금까지 정한 것과 아직 남은 일을 목록으로 나눠 요약해 줘. 연락처 같은 개인정보는 빼 줘.",
      badOutput:
        "12월 신제품 텀블러 이벤트를 준비하고 있어요. 날짜와 예산, 홍보 채널을 이야기했고 경품 업체도 알아보는 중이에요.",
      badNote: "무엇을 정했는지 빠져서, 새 대화의 AI가 처음부터 다시 물어요.",
    },
    mission:
      "대화가 길어져 AI가 앞 내용을 잊기 시작했어요. 새 대화에 붙여 넣을 이어가기 요약을 지금 대화의 AI에게 부탁해 보세요.",
    material: {
      title: "자료 · 지금까지의 대화",
      subtitle: "신제품 출시 이벤트 준비, 12턴",
      kind: "chat",
      lines: [
        ["나", "12월 신제품 텀블러 출시 이벤트를 준비하려고 해. 같이 계획 세워 줘."],
        ["AI", "좋아요. 날짜, 예산, 홍보 채널부터 정해 볼까요?"],
        ["나", "날짜는 12월 1일로 하자."],
        ["AI", "12월 1일로 적어 둘게요. 예산은 얼마인가요?"],
        ["나", "예산은 300만 원이야."],
        ["AI", "300만 원 안에서 홍보비와 경품비를 나눠 볼게요. 홍보는 어디에 할까요?"],
        ["나", "인스타그램으로만 하자. 블로그는 이번엔 빼고."],
        ["AI", "인스타그램 게시물 세 번과 스토리 이벤트를 제안해요."],
        ["나", "좋아. 경품 업체는 아직 못 정했어. 두 곳 견적을 받아 볼게."],
        ["AI", "업체가 정해지면 경품 수량을 다시 계산해 드릴게요."],
        ["나", "지난번 당첨자 박지수 님 연락처는 010-9876-5432야. 이번에도 연락해 볼까 해."],
        ["AI", "알겠어요. 다음으로 무엇을 정할까요?"],
      ],
    },
    criteria: [
      {
        label: "지금까지 정한 것을 담으라고 했다",
        item: null,
        check: /정한|결정/,
        question: "새 대화의 AI가 꼭 알아야 할, 지금까지 정한 것은 무엇인가요?",
      },
      {
        label: "남은 일과 질문을 담으라고 했다",
        item: null,
        check: /남은|할 ?일|아직|질문/,
        question: "아직 정하지 못한 일은 새 대화에서 어떻게 이어 가나요?",
      },
      {
        label: "새 대화에 붙여 넣을 요약이라고 밝혔다",
        item: "context",
        check: /새 ?대화|이어|붙여 ?넣/,
        question: "이 요약은 어디에 쓰려는 건가요? 쓰임을 알면 AI가 더 알맞게 정리해요.",
      },
      {
        label: "목록 형식을 정했다",
        item: "format",
        check: /목록|항목|번호|불릿|글머리|표로|나눠|구분/,
        question: "요약을 어떤 모양으로 받으면 새 대화에 붙여 넣기 편할까요?",
      },
      {
        label: "개인정보는 빼라고 했다",
        item: "criteria",
        check: /개인정보|전화번호|연락처|빼/,
        question: "대화에 나온 연락처까지 새 대화로 옮겨도 괜찮을까요?",
      },
    ],
    outputs: {
      weak: "12월 신제품 텀블러 이벤트를 준비하고 있어요. 날짜와 예산, 홍보 채널을 이야기했고 경품 업체도 알아보는 중이에요. 지난번 당첨자 박지수 님(010-9876-5432)에게도 연락해 볼 예정이에요.",
      strong:
        "이어가기 요약\n\n정한 것\n· 날짜: 12월 1일\n· 예산: 300만 원\n· 홍보: 인스타그램 게시물 세 번과 스토리 이벤트\n\n남은 일\n· 경품 업체 두 곳 견적 받기\n· 업체가 정해지면 경품 수량 다시 계산",
      weakNote: "AI가 연결되어 있지 않아 미리 만든 예시 결과를 보여 줘요.",
    },
    model:
      "이 대화가 길어져서 새 대화에서 이어 가려고 해. 새 대화에 붙여 넣을 이어가기 요약을 써 줘. 지금까지 정한 것과 아직 남은 할 일을 나눠 목록으로 정리하고, 전화번호 같은 개인정보는 빼 줘.",
  },
  {
    id: "file1",
    course: "file",
    kind: "file",
    focus: null,
    title: "보고서 PDF에서 핵심 뽑기",
    summary: "보고서를 붙이고 핵심 세 가지를 뽑아 달라고 하기",
    lecture: {
      point:
        "파일을 붙이기만 하면 AI는 그걸로 무엇을 할지 몰라요. 붙인 파일을 가리키고, 무엇을 뽑을지, 어떤 모양으로 받을지 말해 주세요. 보고서에 없는 내용을 지어내지 말라는 말도 함께요.",
      bad: "이거 정리해 줘",
      good: "첨부한 보고서에서 팀장님께 올릴 핵심 세 가지를 번호 목록으로 뽑아 줘. 보고서에 없는 숫자는 지어내지 말고 '보고서에 없음'이라고 적어 줘.",
    },
    mission: "첨부한 보고서를 읽고 팀장님께 올릴 핵심 세 가지를 뽑아 달라고 AI에게 부탁해 보세요.",
    sampleLabel: "예시 보고서",
    samples: [
      {
        url: "/samples/cs-report-q3.pdf",
        name: "3분기_고객문의_보고서.pdf",
        type: "application/pdf",
        pages: 2,
        title: "3분기 고객 문의 분석 보고서",
        preview: ["총 문의 1,240건, 전 분기보다 12% 늘었다.", "유형: 배송 지연 38%, 환불 24%, 사용법 21%, 기타 17%"],
      },
    ],
    // 예시 파일로 받은 결과물 확인. numbers에 없는 숫자는 unknownLabel로 표시하고, core 중 coreMin개 이상이면 "핵심을 담았다"고 본다.
    check: {
      numbers: ["1240", "12", "38", "24", "21", "17", "9", "212", "3"],
      core: [
        { label: "총 문의 1,240건", check: /1,?240/ },
        { label: "배송 지연 38%", check: /배송\s*지연[^\n]{0,12}38/ },
        { label: "개선 제안", check: /제안|도입|개편|제작/ },
      ],
      coreMin: 2,
      unknownLabel: "보고서에 없는 숫자",
      unknownNote: "없는 숫자는 AI가 지어냈을 가능성이 커요.",
      compareNote: "보고서에 실린 숫자와 하나씩 맞춰 봤어요.",
    },
    criteria: [
      {
        label: "첨부한 보고서를 가리켰다",
        item: null,
        check: FILE_MENTION,
        question: "AI가 무엇을 읽어야 하는지 알까요? 붙인 보고서를 가리켜 보세요.",
      },
      {
        label: "무엇을 뽑을지 정했다",
        item: "goal",
        check: /^(?=[\s\S]*(핵심|요점|중요|주요|문제|원인|제안|숫자|결론|내용))(?=[\s\S]*(뽑|추려|골라|간추|요약|정리))/,
        question: "보고서에서 무엇을 얼마나 뽑아 달라는 건가요?",
      },
      {
        label: "받을 모양을 정했다",
        item: "format",
        check: FORMAT_CHECK,
        question: "팀장님께 올리려면 결과를 어떤 모양으로 받으면 좋을까요?",
      },
      {
        label: "보고서에 없는 내용은 지어내지 말라고 했다",
        item: "criteria",
        check: NO_MADE_UP_CHECK,
        question: "보고서에 없는 내용이 필요해지면 AI가 어떻게 해야 하나요?",
        hint: "말해 주지 않으면 AI는 그럴듯한 숫자로 빈칸을 채워요.",
      },
    ],
    outputs: {
      weak: "1. 3분기 고객 문의는 1,240건으로 전 분기보다 12% 늘었습니다.\n2. 배송 지연이 38%로 가장 많고, 해결까지 평균 3.5일이 걸렸습니다.\n3. 출고 알림 문자를 도입하면 문의를 30% 줄일 수 있습니다.",
      strong:
        "1. 3분기 고객 문의는 1,240건으로 전 분기보다 12% 늘었습니다.\n2. 배송 지연이 38%로 가장 많고, 9월에 212건으로 가장 많았습니다.\n3. 제안: 출고 알림 문자 도입, 환불 안내 페이지 개편, 사용법 영상 3편 제작 (기대 효과는 보고서에 없음)",
    },
    model:
      "첨부한 3분기 고객 문의 보고서를 읽고, 팀장님께 올릴 핵심 세 가지를 번호 목록으로 뽑아 줘. 항목마다 보고서에 나온 숫자를 넣고, 보고서에 없는 내용은 지어내지 말고 '보고서에 없음'이라고 적어 줘.",
  },
  {
    id: "ver1",
    course: "verify",
    kind: "spot",
    focus: null,
    title: "일부러 틀린 AI 답변 고치기",
    summary: "AI가 쓴 회의 요약에서 틀린 곳 찾기",
    lecture: {
      point: "AI는 자료에 없는 내용도 그럴듯하게 써요. 결과를 그대로 옮기기 전에 자료와 한 줄씩 맞춰 보세요.",
      points: [
        "틀린 정보: 자료와 숫자나 이름이 달라요.",
        "지어낸 내용: 자료에 아예 없는 말이에요.",
        "확인 안 되는 출처: '조사에 따르면'처럼 근거를 댔지만 어디서 나왔는지 알 수 없어요.",
        "빠진 내용: 자료에 있는 중요한 일이 결과에 없어요.",
      ],
    },
    mission: "AI에게 회의록 요약을 맡겼더니 문제가 숨은 요약이 왔어요. 회의록과 맞춰 보고 문제 있는 문장과 빠진 내용을 찾아 보세요.",
    material: {
      title: "자료 · 회의록",
      subtitle: "11월 18일 마케팅 주간 회의",
      kind: "list",
      lines: [
        "참석: 김 팀장, 이 대리, 박 주임",
        "겨울 텀블러 캠페인 예산은 300만 원으로 정했다.",
        "인스타그램 게시는 12월 1일에 시작한다.",
        "이벤트 경품 업체는 이 대리가 금요일까지 두 곳을 알아본다.",
        "다음 회의 날짜는 정하지 않았다.",
      ],
    },
    // 화면과 코칭에 쓰는 이름: 맞춰 볼 자료, AI가 쓴 글, 그 글 칸의 제목
    source: "회의록",
    answerName: "요약",
    answerTitle: "AI가 쓴 회의 요약",
    kinds: [
      { id: "wrong", name: "틀린 정보" },
      { id: "made", name: "지어낸 내용" },
      { id: "source", name: "확인 안 되는 출처" },
    ],
    sentences: [
      {
        text: "겨울 텀블러 캠페인 예산은 500만 원으로 정했어요.",
        answer: "wrong",
        question: "회의록에서 예산을 말한 줄과 숫자가 같나요?",
        why: "숫자 하나만 달라도 보고가 틀어져요.",
        kindNote: "회의록과 숫자가 달라서 '틀린 정보'에 더 가까워요.",
      },
      { text: "인스타그램 게시는 12월 1일에 시작해요.", answer: null },
      {
        text: "업계 조사에 따르면 겨울 캠페인은 12월 첫 주 반응이 가장 좋아요.",
        answer: "source",
        question: "이 조사는 회의록 어디에 나오나요?",
        why: "출처를 확인할 수 없는 말은 그대로 옮기기 전에 따져 봐야 해요.",
        kindNote: "근거를 댔지만 어디서 나왔는지 알 수 없어 '확인 안 되는 출처'에 더 가까워요.",
      },
      {
        text: "다음 회의는 다음 주 화요일이에요.",
        answer: "made",
        question: "회의록에 다음 회의 날짜가 있었나요?",
        why: "회의록에 아예 없는 날짜를 AI가 채워 넣었어요.",
        kindNote: "회의록에 아예 없는 내용이라 '지어낸 내용'에 더 가까워요.",
      },
      { text: "참석자는 김 팀장, 이 대리, 박 주임이에요.", answer: null },
    ],
    missing: {
      words: ["경품", "업체", "이 대리"],
      min: 2,
      question: "누가 무엇을 하기로 한 줄이 요약에 들어 있나요?",
      found: "누가 무엇을 하기로 했는지는 요약에서 가장 자주 빠져요.",
    },
    // 숨겨 둔 4곳(문장 3 + 빠진 내용 1) 중 min곳 이상 찾고, 맞는 문장을 틀렸다고 고른 것이 maxFalse개 이하
    pass: { min: 3, maxFalse: 1 },
    criteria: [
      { label: "숨겨 둔 4곳 중 3곳 이상 찾았다", item: null },
      { label: "맞는 문장을 틀렸다고 고른 것이 1개 이하다", item: null },
    ],
  },
  {
    id: "tool1",
    course: "tool",
    kind: "choose",
    focus: null,
    title: "이럴 땐 무엇을 쓸까",
    summary: "업무 상황 여섯 개에 맞는 방법 고르기",
    lecture: {
      point:
        "AI 서비스에는 그냥 묻는 것 말고도 검색, 파일 분석 같은 기능이 있어요. 일마다 맞는 방법을 고르면 엉뚱한 답이 줄어요.",
      points: [
        "그냥 질문: 글 다듬기, 아이디어 내기처럼 AI가 가진 지식으로 되는 일이에요.",
        "검색 켜기: 오늘 환율, 최근 소식처럼 새로 찾아봐야 하는 일이에요. AI는 배운 뒤에 생긴 일을 모를 수 있어요.",
        "파일 붙여 분석: 계약서, 엑셀처럼 내 자료를 읽어야 하는 일이에요.",
        "AI에게 맡기지 않기: 사람을 평가하거나 최종 결정을 내리는 일이에요. 참고는 해도 결정은 사람이 해요.",
      ],
    },
    mission: "업무 상황 카드가 여섯 장 있어요. 상황마다 AI를 어떻게 쓸지 골라 보세요.",
    bins: TOOL_BINS,
    cards: [
      { id: "rate", text: "이번 주 환율 변동 정리", answer: "search" },
      { id: "rival", text: "오늘 발표된 경쟁사 신제품 정리", answer: "search" },
      { id: "contract", text: "첨부한 계약서에서 위약금 조항 찾기", answer: "file" },
      { id: "sales", text: "지난달 매출 엑셀에서 가장 많이 팔린 제품", answer: "file" },
      { id: "apology", text: "거래처에 보낼 사과 메일 문장 다듬기", answer: "ask" },
      { id: "grade", text: "직원 평가 최종 등급 정하기", answer: "no" },
    ],
    // 6장 중 5장 이상 맞히고, "맡기지 않기" 카드는 꼭 맞혀야 통과
    pass: { min: 5, must: "no" },
    criteria: [
      { label: "6장 중 5장 이상 맞게 골랐다", item: null },
      { label: "AI에게 맡기지 않을 일은 꼭 맞혔다", item: null },
    ],
    coaching: TOOL_COACHING,
    mustDetail: "결과에 책임을 지는 사람이 누구인지 생각해 보세요.",
    mustNote: "AI에게 맡기지 않을 일은 꼭 맞혀야 통과예요.",
  },
  ...MORE_MISSIONS,
];

export const ALL_LESSONS = [...LESSONS.map((l) => ({ course: "prompt", kind: "prompt", ...l })), ...COURSE_LESSONS];
export const findAnyLesson = (id) => ALL_LESSONS.find((l) => l.id === id) ?? null;

// short: 이유 문장에 쓰는 짧은 부문 이름("검증 부문이 50점이에요")
export const COURSES = [
  {
    id: "prompt",
    short: "프롬프트",
    no: 1,
    title: "프롬프트 작성",
    summary: "명확한 질문과 조건 정하기",
    lede: "목표, 맥락, 조건, 형식, 기준 다섯 요소로 AI에게 일을 분명하게 맡기는 법을 배워요.",
    lessons: LESSONS.map((l) => l.id),
    related: [],
    ready: true,
  },
  {
    id: "memory",
    short: "대화·메모리",
    no: 2,
    title: "대화·메모리 관리",
    summary: "문맥 유지, 기억시킬 정보 고르기",
    lede: "긴 대화에서 앞 내용을 잃지 않고, AI에게 무엇을 기억시킬지 고르는 법을 배워요.",
    note: "여기서 말하는 메모리는 Gemini, ChatGPT 같은 AI 서비스가 나에 대해 기억해 두는 기능이에요. 카멜레온이 저장하는 내 설정이나 학습 기록과는 달라요.",
    lessons: ["mem1", "mem2", "mem3"],
    related: ["a3"],
    ready: true,
  },
  {
    id: "file",
    short: "파일",
    no: 3,
    title: "파일 활용",
    summary: "문서를 붙이고 AI에게 분석 맡기기",
    lede: "보고서, 회의록 같은 파일을 붙이고, AI가 그걸로 무엇을 할지 분명하게 맡기는 법을 배워요.",
    lessons: ["file1", "file2", "file3"],
    related: ["m1"],
    ready: true,
  },
  {
    id: "verify",
    short: "검증",
    no: 4,
    title: "AI 결과 검증",
    summary: "틀린 정보, 지어낸 내용, 출처 확인하기",
    lede: "AI가 쓴 결과에서 틀린 정보, 지어낸 내용, 확인 안 되는 출처를 찾아내는 법을 배워요.",
    lessons: ["ver1", "ver2", "ver3"],
    related: ["a2"],
    ready: true,
  },
  {
    id: "tool",
    short: "도구",
    no: 5,
    title: "AI 도구 활용",
    summary: "작업에 맞는 기능 고르기: 검색, 파일 분석, 그냥 질문",
    lede: "그냥 질문, 검색, 파일 분석 중에서 일에 맞는 방법을 고르고, AI에게 맡기지 않을 일을 가려내는 법을 배워요.",
    lessons: ["tool1", "tool2", "tool3"],
    related: [],
    ready: true,
  },
  {
    id: "flow",
    short: "자동화",
    no: 6,
    title: "업무 자동화",
    summary: "반복 작업 흐름 짜기: 자료 요약 → 보고서 초안 → 검토",
    lede: "자료 요약 → 보고서 초안 → 검토처럼 반복되는 일을 흐름으로 짜는 법을 배워요.",
    lessons: ["flow1", "flow2", "flow3"],
    related: ["m3", "a1"],
    ready: true,
  },
];

export const COURSE = Object.fromEntries(COURSES.map((c) => [c.id, c]));
export const courseOf = (lesson) => COURSE[lesson?.course ?? "prompt"];
