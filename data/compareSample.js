// AI가 연결되어 있지 않을 때 결과 비교 화면이 보여 주는 예시. 마케팅 과제를 그대로 실행해 본 결과다.
// 모양은 /api/compare의 세 단계 응답과 같다.
export const COMPARE_SAMPLE = {
  job: "marketing",
  prompt: "신제품 텀블러 SNS 글 써 줘",
  segments: [{ text: "신제품 텀블러 SNS 글 써 줘", items: ["goal"] }],
  found: ["goal"],
  missing: ["context", "constraint", "format", "criteria"],
  mine: {
    output:
      "드디어 출시! 언제 어디서나 함께하는 완벽한 텀블러를 소개합니다. 24시간 보온·보냉 기능으로 하루 종일 따뜻하게, 시원하게! 세련된 디자인과 다양한 색상으로 당신의 스타일을 완성하세요. 친환경 소재로 지구도 생각했어요. 지금 바로 만나 보세요! #텀블러 #신제품 #데일리템 #친환경 #보온보냉 #선물추천 #일상 #카페",
    guesses: [
      { item: "context", quote: "언제 어디서나 함께하는", reason: "읽는 사람을 몰라 모두에게 하는 말로 씀." },
      { item: "constraint", quote: "", reason: "분량을 몰라 길게 씀." },
      {
        item: "format",
        quote: "#텀블러 #신제품 #데일리템 #친환경 #보온보냉 #선물추천 #일상 #카페",
        reason: "모양이 없어 해시태그를 마음대로 붙임.",
      },
      { item: "criteria", quote: "24시간 보온·보냉", reason: "제품 정보가 없어 흔한 기능을 지어냄." },
      { item: "context", quote: "당신의 스타일", reason: "읽는 사람을 몰라 누구에게나 맞는 말로 씀." },
      { item: "criteria", quote: "친환경 소재", reason: "받은 적 없는 제품 정보를 지어냄." },
    ],
  },
  refined: {
    sentences: [
      {
        item: "goal",
        text: "신제품 보온 텀블러 출시를 알리는 인스타그램 게시글을 써 줘.",
        why: "원래 문장에 제품 종류와 올릴 곳을 더함.",
        added: false,
      },
      {
        item: "context",
        text: "읽는 사람은 출근길에 커피를 사 가는 20~30대 직장인이야.",
        why: "누가 읽는지 알아야 말투와 내용을 맞출 수 있음.",
        added: true,
      },
      {
        item: "constraint",
        text: "본문은 세 문장 이내, 친근한 말투로 쓰고 가격 29,000원과 출시일 12월 1일은 꼭 넣어 줘.",
        why: "분량과 꼭 들어갈 정보를 정해야 길어지거나 빠지지 않음.",
        added: true,
      },
      { item: "format", text: "본문 아래 줄에 해시태그 다섯 개를 붙여 줘.", why: "결과물의 모양을 미리 정함.", added: true },
      {
        item: "criteria",
        text: "제품 정보에 없는 기능은 지어내지 말고, 모르는 건 {{확인할 내용}}으로 비워 둬.",
        why: "AI가 없는 사실을 지어내지 않게 막음.",
        added: true,
      },
    ],
  },
  run: {
    output:
      "출근길에 산 커피, 점심 회의까지 따뜻하게. 새 보온 텀블러가 12월 1일에 나와요. 가격은 29,000원이에요.\n#출근길 #직장인템 #보온텀블러 #신제품 #커피",
    marks: [
      { item: "context", quote: "출근길에 산 커피, 점심 회의까지 따뜻하게." },
      { item: "criteria", quote: "새 보온 텀블러" },
      { item: "constraint", quote: "12월 1일" },
      { item: "constraint", quote: "29,000원" },
      { item: "format", quote: "#출근길 #직장인템 #보온텀블러 #신제품 #커피" },
    ],
    diffs: [
      { item: "context", before: "모든 사람에게 하는 말", after: "출근길 직장인에게 하는 말" },
      { item: "constraint", before: "여섯 문장, 가격·출시일 없음", after: "세 문장, 가격·출시일 들어감" },
      { item: "format", before: "해시태그 8개", after: "본문 아래 해시태그 5개" },
      { item: "criteria", before: "없는 기능(“24시간 보온·보냉”)을 지어냄", after: "받은 정보만 씀" },
    ],
  },
};
