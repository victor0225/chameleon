// POST /api/exam/[job]/start {} : 시험 시작(작업 L, 보드 L3 '시험 시작 · 5분'). 로그인해야 하고 JSON 요청만 받는다.
//   → { token, questions, seconds: 300, practice }
//   questions는 정답·채점 기준·코칭 질문을 뺀 문제(publicExam). token은 제출할 때 그대로 돌려보낸다(lib/server/examToken.js).
//   practice: 이미 본 시험이라 이번은 연습(점수가 랭킹에 안 들어감).
//   로그인 기능 꺼짐 503, JSON 아님 415, 로그인 전 401, 모르는 직무나 문제를 아직 안 쓴 시험 404.
import { EXAM_SECONDS } from "@/data/exams";
import { hasFirstResult } from "@/lib/server/examResults";
import { publicExam } from "@/lib/server/exams/index";
import { signExamToken } from "@/lib/server/examToken";
import { examOf, notFound, readPost } from "../../request";

const MAX_BODY = 200;

export async function POST(request, { params }) {
  const { job } = await params;
  const post = await readPost(request, MAX_BODY);
  if (post.response) return post.response;
  const exam = examOf(job);
  if (!exam) return notFound();
  try {
    const practice = await hasFirstResult(post.user.id, job);
    const token = await signExamToken({ uid: post.user.id, job });
    return Response.json({ token, questions: publicExam(exam), seconds: EXAM_SECONDS, practice });
  } catch (error) {
    console.warn("[/api/exam/[job]/start] 시작 실패:", error?.message || "unknown");
    return Response.json({ error: "시험을 시작하지 못함. 잠시 후 다시 시도." }, { status: 500 });
  }
}
