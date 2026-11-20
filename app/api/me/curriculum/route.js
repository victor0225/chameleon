// GET /api/me/curriculum : DB에 쌓인 진단·실습 기록으로 개인화 엔진(lib/personalize.js)이 고른 강의 세 개와 이유.
// 응답 { focus, weak: [{ id, name, score, mastery, missed, inDiagnosis }], items: [{ lessonId, title, level, focus, reasons }] }
import { connection } from "next/server";
import { personalize } from "@/lib/personalize";
import { getSessionUser } from "@/lib/server/session";
import { loadState, recentAttempts } from "@/lib/server/users";

export async function GET() {
  await connection();
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const [state, attempts] = await Promise.all([loadState(user.id), recentAttempts(user.id)]);
  const result = personalize({
    level: state.profile?.level ?? "초급",
    diagnosis: state.diagnosis,
    record: state.record,
    attempts,
  });
  return Response.json({ ...result, weak: result.weak.map(({ reasons, ...w }) => w) });
}
