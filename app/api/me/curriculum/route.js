// GET /api/me/curriculum : DB에 쌓인 진단·실습 기록과 부문 점수로 개인화 엔진(lib/personalize.js)이 고른 미션 세 개와 이유.
// 응답 { focus, weak: [{ id, name, score, mastery, missed, inDiagnosis }], items: [{ lessonId, title, course, level, focus, reasons }] }
// 과정 2~6은 부문 점수(first_scores), 같은 직무 평균, 설문 3번(used), 마지막 진단의 과정 신호로 고른다(작업 I).
import { connection } from "next/server";
import { courseSignals } from "@/lib/courseSignals";
import { diagnosisTrend } from "@/lib/diagnosisTrend";
import { personalize } from "@/lib/personalize";
import { jobGaps } from "@/lib/scoreboard";
import { recentDiagnoses } from "@/lib/server/history";
import { jobAverages, myAreas } from "@/lib/server/ranking";
import { getSessionUser } from "@/lib/server/session";
import { loadState, recentAttempts } from "@/lib/server/users";

export async function GET() {
  await connection();
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인 필요." }, { status: 401 });
  const [state, attempts, scores, diagnoses] = await Promise.all([
    loadState(user.id),
    recentAttempts(user.id),
    myAreas(user.id),
    recentDiagnoses(user.id, 5),
  ]);
  const job = state.profile?.job ?? null;
  const averages = await jobAverages(job);
  const result = personalize({
    level: state.profile?.level ?? "초급",
    diagnosis: state.diagnosis,
    record: state.record,
    attempts,
    trend: diagnosisTrend(diagnoses),
    courses: {
      areas: scores.areas,
      // 설문 신호는 used로 따로 세니 진단 신호만 넘긴다(두 번 세지 않게).
      signals: courseSignals({ diagnosis: state.diagnosis }),
      used: state.survey?.used,
      gaps: jobGaps(scores.areas, averages),
      job,
    },
  });
  return Response.json({ ...result, weak: result.weak.map(({ reasons, ...w }) => w) });
}
