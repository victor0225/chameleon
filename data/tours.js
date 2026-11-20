// 처음 열 때 화면 안내(작업 J). 화면마다 처음 한 번 그 화면의 기능을 차례로 짚는다.
// target은 화면 요소의 data-tour 값이다. 그 요소가 화면에 없으면 그 단계는 건너뛴다(lib/tour.js의 visibleSteps).
// 띄우는 곳: components/Tour.js의 <Tour id="..." />. 본 기록은 /api/tour(로그인) 또는 브라우저(손님)에 남긴다.
// 말풍선 자리(없으면 Tour.js가 빈 곳을 고른다):
//   place: 먼저 써 볼 자리. "아래·위·오른쪽·왼쪽(bottom·top·right·left)-맞춤(start·end·center)"
//   near: 말풍선을 붙일 다른 data-tour. 밝게 뚫는 곳은 그대로 target이다.
// 문구: 해요체 없이 짧은 개조식(보드 F1~F5). 미션 규칙은 '처음 통과할 때만 +30 XP' 한 문장으로 쓴다.
export const TOURS = {
  // 첫 화면(보드 F1, F1-2~4): 진단 입력 칸 → 교육 → 시험 → 내 정보
  home: {
    steps: [
      { target: "home-input", title: "진단", body: "평소 AI에게 하던 말 그대로 입력. 빠진 요소를 색으로 표시." },
      { target: "nav-learn", title: "교육", body: "관심 직무 미션으로 배우기 → 해 보기 → 피드백." },
      { target: "nav-exam", title: "시험", body: "직무별 5분 시험. 처음 본 점수로 랭킹." },
      { target: "nav-me", title: "내 정보", body: "관심 직무와 로그인 정보 바꾸기." },
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
  learn: {
    steps: [
      { target: "learn-foryou", title: "추천 미션", body: "진단과 미션 기록에 맞춘 다음 미션. 여기서 바로 시작." },
      { target: "learn-courses", title: "여섯 과정", body: "과정마다 미션 묶음. 과정 1은 초급·중급·고급으로 구분." },
      { target: "learn-record", title: "학습 기록", body: "처음 통과한 미션마다 XP 30 적립. 다음 수준까지 남은 XP 표시." },
    ],
  },
  mission: {
    steps: [
      { target: "mission-steps", place: "left-start", title: "미션 순서", body: "배우기: 핵심 읽기. 해 보기: 직접 풀기. 피드백: 기준별 결과와 코칭 질문." },
      { target: "mission-learn", title: "배우기", body: "핵심 한 줄과 요점 먼저 읽기." },
      { target: "mission-steps", place: "left-start", title: "통과하면 경험치", body: "처음 통과할 때만 +30 XP. 다시 해 보기는 자유." },
    ],
  },
  feedback: {
    steps: [
      { target: "feedback-score", place: "top-end", title: "점수", body: "맞힌 수와 통과까지 남은 수 표시." },
      { target: "feedback-coach", title: "코칭 질문", body: "못 넘은 기준에 답 대신 질문 하나. 질문을 따라 고쳐서 다시 해 보기." },
    ],
  },
  mypage: {
    steps: [
      { target: "mypage-job", title: "관심 직무", body: "고른 직무로 미션 상황·예시와 메인 입력 칸 예시가 바뀜." },
      { target: "mypage-stats", title: "경험치와 시험", body: "경험치는 처음 통과한 미션마다 30. 시험 점수는 처음 본 점수." },
      { target: "mypage-login", title: "로그인 정보", body: "이름과 비밀번호 바꾸기. 아이디는 바꿀 수 없음." },
      { target: "mypage-growth", title: "진단 변화", body: "처음 진단보다 채운 요소가 몇 개 늘었는지 표시." },
    ],
  },
};
