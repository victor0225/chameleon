// 처음 열 때 화면 안내(작업 J). 화면마다 처음 한 번 그 화면의 기능을 차례로 짚는다.
// target은 화면 요소의 data-tour 값이다. 그 요소가 화면에 없으면 그 단계는 건너뛴다(lib/tour.js의 visibleSteps).
// 띄우는 곳: components/Tour.js의 <Tour id="..." />. 본 기록은 /api/tour(로그인) 또는 브라우저(손님)에 남긴다.
export const TOURS = {
  home: {
    steps: [
      { target: "nav-diagnosis", title: "진단", body: "평소 AI에게 일을 맡기듯 프롬프트를 한 번 써 보세요. 무엇이 빠졌는지 색으로 보여 드려요." },
      { target: "nav-helper", title: "프롬프트 도우미", body: "질문을 따라가며 내 프롬프트를 직접 고쳐 봐요. 답을 대신 써 주지는 않아요." },
      { target: "nav-learn", title: "AI 활용 교육", body: "프롬프트, 메모리, 파일, 검증, 도구, 자동화 여섯 과정의 미션을 풀어요." },
      { target: "home-start", title: "여기서 시작해요", body: "질문 세 개에 답하고 프롬프트 하나를 쓰면 돼요." },
    ],
  },
  diagnosis: {
    steps: [
      { target: "diagnosis-input", title: "프롬프트 쓰기", body: "정답은 없어요. 평소 쓰던 대로 써 주세요." },
      { target: "file-attach", title: "파일 붙이기", body: "일에 쓰는 자료가 있으면 붙여요. 3개까지, 하나에 4MB까지예요." },
      { target: "diagnosis-meter", title: "다섯 칸 막대", body: "쓰는 동안 목표·맥락·조건·형식·기준 중 몇 개가 들어갔는지 보여 줘요." },
    ],
  },
  result: {
    steps: [
      { target: "result-prompt", title: "밑줄 친 프롬프트", body: "색 밑줄은 들어 있는 요소예요. 색이 없는 요소가 빠진 거예요." },
      { target: "result-guess", title: "AI 추측", body: "빠진 부분을 AI가 어떻게 마음대로 채웠는지 보여 줘요." },
      { target: "result-next", title: "다음에 배울 과정", body: "진단으로 고른 과정과 이유예요." },
      { target: "result-compare", title: "고치기 전과 결과 비교", body: "프롬프트를 고쳐 다시 진단하면 전후 결과를 나란히 볼 수 있어요." },
    ],
  },
  compare: {
    steps: [
      { target: "compare-steps", title: "세 단계", body: "고치기 전 결과, 고친 프롬프트, 두 결과 비교 순서로 봐요." },
      { target: "compare-new", title: "새로 채움", body: "고치면서 새로 채운 요소예요." },
    ],
  },
  helper: {
    steps: [
      { target: "helper-input", title: "고칠 프롬프트", body: "고치고 싶은 프롬프트를 넣어요." },
      { target: "helper-questions", title: "질문", body: "빠진 요소마다 질문을 드려요. 답하면서 직접 채워 보세요." },
    ],
  },
  learn: {
    steps: [
      { target: "learn-foryou", title: "나를 위한 커리큘럼", body: "내 진단과 미션 기록으로 고른 미션 세 개와 이유예요." },
      { target: "learn-courses", title: "여섯 과정", body: "과정마다 미션이 있어요. 과정 1은 초급·중급·고급으로 나뉘어요." },
      { target: "learn-record", title: "학습 기록", body: "미션을 처음 통과할 때마다 XP가 30씩 쌓여요." },
      { target: "score-line", title: "내 점수 · 랭킹 보기", body: "부문마다 처음 푼 점수로 내 점수와 랭킹이 정해져요." },
    ],
  },
  mission: {
    steps: [
      { target: "mission-steps", title: "미션 순서", body: "배우기 → 해 보기 → 피드백 순서예요." },
      { target: "mission-learn", title: "배우기", body: "먼저 짧게 읽어 보세요." },
      {
        target: "mission-try",
        title: "해 보기",
        body: "처음 푼 점수가 부문 점수와 랭킹에 들어가요. 다시 풀 수는 있지만 점수는 처음 것만 세요.",
      },
    ],
  },
  feedback: {
    steps: [
      { target: "feedback-score", title: "점수", body: "처음 푼 미션이면 이 점수가 부문 점수에 들어가요." },
      { target: "feedback-coach", title: "코칭 질문", body: "못 넘은 기준에는 답 대신 질문을 드려요. 질문을 따라 고쳐서 다시 해 보세요." },
    ],
  },
  ranking: {
    steps: [
      { target: "ranking-me", title: "내 점수", body: "여섯 부문 점수의 합이 내 점수예요. 부문마다 처음 푼 점수의 평균이에요." },
      { target: "ranking-areas", title: "부문 막대", body: "얇은 선은 같은 직무 평균이에요." },
      { target: "ranking-tabs", title: "전체와 내 직무", body: "전체와 내 직무 순위를 볼 수 있어요." },
      { target: "ranking-join", title: "랭킹 참여", body: "랭킹에는 별명으로만 나가요. 참여는 내가 켜야 해요." },
    ],
  },
  mypage: {
    steps: [
      { target: "mypage-stats", title: "내 점수와 XP", body: "XP는 얼마나 했는지, 내 점수는 얼마나 잘했는지예요." },
      { target: "mypage-growth", title: "진단 변화", body: "처음 진단보다 요소를 얼마나 더 채우게 됐는지 보여 줘요." },
    ],
  },
};
