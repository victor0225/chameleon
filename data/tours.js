// 처음 열 때 화면 안내(작업 J). 화면마다 처음 한 번 그 화면의 기능을 차례로 짚는다.
// target은 화면 요소의 data-tour 값이다. 그 요소가 화면에 없으면 그 단계는 건너뛴다(lib/tour.js의 visibleSteps).
// 띄우는 곳: components/Tour.js의 <Tour id="..." />. 본 기록은 /api/tour(로그인) 또는 브라우저(손님)에 남긴다.
// 말풍선 자리(없으면 Tour.js가 빈 곳을 고른다):
//   place: 먼저 써 볼 자리. "아래·위·오른쪽·왼쪽(bottom·top·right·left)-맞춤(start·end·center)"
//   near: 말풍선을 붙일 다른 data-tour. 밝게 뚫는 곳은 그대로 target이다.
// 문구: 해요체 없이 짧은 개조식. 첫 점수 규칙은 '처음 푼 점수만 부문 점수와 랭킹에 반영' 한 문장으로 쓴다.
export const TOURS = {
  home: {
    steps: [
      { target: "nav-diagnosis", title: "진단", body: "평소처럼 AI에게 일을 맡기는 프롬프트 쓰기. 빠진 요소를 색으로 표시." },
      { target: "nav-helper", title: "프롬프트 도우미", body: "하고 싶은 일로 프롬프트 만들기. 줄마다 들어간 요소와 이유 표시." },
      { target: "nav-learn", title: "AI 활용 교육", body: "프롬프트·메모리·파일·검증·도구·자동화 여섯 과정의 미션 풀기." },
      { target: "home-start", title: "여기서 시작", body: "평소 AI에게 하던 말 그대로 입력하고 진단하기. 쓴 글은 진단에 그대로 이어짐." },
    ],
  },
  diagnosis: {
    steps: [
      { target: "diagnosis-input", title: "프롬프트 쓰기", body: "정답 없음. 평소 쓰던 대로 쓰기." },
      { target: "file-attach", title: "파일 붙이기", body: "일에 쓰는 자료가 있으면 첨부. 3개까지, 하나에 4MB까지." },
      { target: "diagnosis-meter", title: "다섯 칸 막대", body: "쓰는 동안 목표·맥락·조건·형식·기준 중 채운 요소 표시." },
    ],
  },
  result: {
    steps: [
      { target: "result-prompt", title: "밑줄 친 프롬프트", body: "색 밑줄은 들어 있는 요소. 색이 없는 요소가 빠진 것." },
      { target: "result-guess", title: "AI 추측", body: "빠진 부분을 AI가 마음대로 채운 방식." },
      { target: "result-next", title: "다음에 배울 과정", body: "진단으로 고른 과정과 이유." },
      { target: "result-compare", title: "고치기 전과 결과 비교", body: "프롬프트를 고쳐 다시 진단하면 전후 결과를 나란히 비교." },
    ],
  },
  compare: {
    steps: [
      { target: "compare-steps", title: "세 단계", body: "고치기 전 결과 → 고친 프롬프트 → 두 결과 비교 순서." },
      { target: "compare-new", title: "새로 채움", body: "고치면서 새로 채운 요소." },
    ],
  },
  helper: {
    steps: [
      { target: "helper-input", title: "하고 싶은 일", body: "할 일을 한 줄로 적거나 예시로 채우기. 읽는 사람·결과물 모양을 고르면 더 맞춤." },
      { target: "helper-questions", title: "만든 프롬프트", body: "줄마다 요소 칩 표시. '이유 보기'를 켜면 넣은 이유도 함께." },
    ],
  },
  learn: {
    steps: [
      { target: "learn-foryou", title: "추천 미션", body: "진단과 미션 기록에 맞춘 다음 미션. 여기서 바로 시작." },
      { target: "learn-courses", title: "여섯 과정", body: "과정마다 미션 묶음. 과정 1은 초급·중급·고급으로 구분." },
      { target: "learn-record", title: "학습 기록", body: "처음 통과한 미션마다 XP 30 적립. 다음 수준까지 남은 XP 표시." },
      { target: "score-line", title: "랭킹 점수", body: "여섯 부문 점수의 합. 처음 푼 점수만 부문 점수와 랭킹에 반영." },
    ],
  },
  mission: {
    steps: [
      { target: "mission-steps", place: "left-start", title: "미션 순서", body: "배우기: 핵심 읽기. 해 보기: 직접 풀기. 피드백: 기준별 결과와 코칭 질문." },
      { target: "mission-learn", title: "배우기", body: "핵심 한 줄과 요점 먼저 읽기." },
      {
        target: "mission-steps",
        place: "left-start",
        title: "점수는 처음 한 번만",
        body: "처음 푼 점수만 부문 점수와 랭킹에 반영. 다시 풀기는 자유.",
      },
    ],
  },
  feedback: {
    steps: [
      { target: "feedback-score", place: "top-end", title: "점수", body: "통과 여부와 맞힌 개수 표시. 통과하면 받은 XP도 함께." },
      { target: "feedback-coach", title: "코칭 질문", body: "못 넘은 기준에 답 대신 질문 하나. 질문을 따라 고쳐서 다시 해 보기." },
    ],
  },
  ranking: {
    steps: [
      { target: "ranking-me", title: "내 점수", body: "여섯 부문 점수의 합과 전체 순위. 처음 푼 점수만 부문 점수와 랭킹에 반영." },
      { target: "ranking-areas", title: "과정별 게이지", body: "가운데 숫자가 부문 점수(100점 만점). 아래 숫자는 같은 직무 평균." },
      { target: "ranking-tabs", title: "전체와 내 직무", body: "전체 TOP 10과 내 직무 TOP 10 중 골라 보기." },
      { target: "ranking-join", title: "랭킹 참여", body: "랭킹에는 별명만 표시. 참여는 직접 켜기." },
    ],
  },
  mypage: {
    steps: [
      { target: "mypage-stats", title: "학습 현황", body: "경험치는 푼 만큼, 랭킹 점수는 처음 푼 점수만, 완료한 미션은 통과한 수." },
      { target: "mypage-growth", title: "진단 변화", body: "처음 진단보다 채운 요소가 몇 개 늘었는지 표시." },
    ],
  },
};
