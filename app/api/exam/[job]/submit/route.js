// POST /api/exam/[job]/submit { token, answers } : 답을 내고 채점 받기(작업 L, 보드 L6·L8). 로그인해야 하고 JSON 요청만 받는다.
//   answers: 문제 순서대로 [답 | null] (모양은 lib/examScore.js validateAnswers). 시간이 끝나 낸 답은 비어 있어도 된다.
//   → { scores, total, seconds, details, counted, first: { total, seconds, rank } | null, rank, takers, saved }
//   details는 문제마다 채점 결과로, 이때 처음 채점 기준과 정답을 보여 준다(lib/examScore.js gradeExam).
//   걸린 시간은 토큰의 시작 시각으로 서버가 센다(5분에서 자름). 처음 낸 결과만 저장하고(counted: true), 다시 푼 것은 연습이다.
//   5분에 LATE_GRACE(오가는 시간 몫)를 넘겨 낸 답은 빈 답으로 채점해(0점, 5:00) 그대로 저장한다(late: true).
//   저장하지 않으면 늦게 내서 채점 기준·정답만 보고 첫 기회를 남길 수 있다. 화면은 시간이 끝나는 순간 답을 내므로 보통은 늦지 않는다.
//   결과 표가 아직 없으면 채점 결과만 주고 saved: false.
//   토큰이 틀리면 400, 다른 사용자·시험의 토큰은 403, 한 시간이 지났으면 410(expired: true).
import { EXAM_SECONDS } from "@/data/exams";
import { gradeExam, validateAnswers } from "@/lib/examScore";
import { saveResult } from "@/lib/server/examResults";
import { elapsedSeconds, readExamToken } from "@/lib/server/examToken";
import { examOf, notFound, readPost } from "../../request";

// 프롬프트 두 문제(3000자씩)와 카드·문장 답, 토큰이 들어갈 만큼
const MAX_BODY = 16000;
// 시작 응답·제출 요청이 오가는 시간 몫(초). 이보다 늦게 낸 답은 처음 점수로 치지 않는다.
const LATE_GRACE = 30;

const TOKEN_ERROR = {
  invalid: { status: 400, error: "시험 시작 정보가 올바르지 않음. 다시 시작." },
  mismatch: { status: 403, error: "다른 시험의 시작 정보. 다시 시작." },
  expired: { status: 410, error: "시작한 지 1시간이 지난 시험. 다시 시작." },
};

export async function POST(request, { params }) {
  const { job } = await params;
  const post = await readPost(request, MAX_BODY);
  if (post.response) return post.response;
  const exam = examOf(job);
  if (!exam) return notFound();

  const now = Date.now();
  const started = await readExamToken(post.body?.token, { uid: post.user.id, job, now });
  if (started.error) {
    const { status, error } = TOKEN_ERROR[started.error];
    return Response.json({ error, expired: started.error === "expired" }, { status });
  }
  const answers = post.body?.answers ?? [];
  const invalid = validateAnswers(exam, answers);
  if (invalid) return Response.json({ error: invalid }, { status: 400 });

  const late = now - started.startedAt > (EXAM_SECONDS + LATE_GRACE) * 1000;
  const seconds = elapsedSeconds(started.startedAt, now);
  const { scores, total, details } = gradeExam(exam, late ? [] : answers);
  try {
    const saved = await saveResult(post.user.id, job, { scores, total, seconds });
    return Response.json({ scores, total, seconds, details, late, ...saved });
  } catch (error) {
    // 답은 화면에 남아 있고 토큰도 한 시간 동안 쓸 수 있으니 다시 내면 된다.
    console.warn("[/api/exam/[job]/submit] 저장 실패:", error?.message || "unknown");
    return Response.json({ error: "채점 결과를 저장하지 못함. 잠시 후 다시 시도." }, { status: 500 });
  }
}
