// GET /api/exam : 시험 목록 카드(작업 L, 보드 L1·L2)와 내 정보 화면의 '내 시험' 칸
//   → { exams: [{ job, takers, avg, mine: { total, rank, seconds } | null }] } 다섯 직무 모두. 손님은 mine: null.
//   로그인 기능(DB와 세션 키)이 꺼져 있으면 { exams: [0명], off: true }, 결과 표가 아직 없으면 { exams: [0명], notReady: true }
// DB 읽기는 lib/server/examResults.js, 순위 규칙은 lib/examScore.js.
import { connection } from "next/server";
import { emptySummary, examSummary } from "@/lib/server/examResults";
import { getSessionUser } from "@/lib/server/session";
import { examOn } from "./request";

export async function GET() {
  await connection();
  if (!examOn()) return Response.json({ exams: emptySummary(), off: true });
  try {
    const user = await getSessionUser();
    return Response.json(await examSummary(user?.id ?? null));
  } catch (error) {
    console.warn("[/api/exam] 시험 목록 읽기 실패:", error?.message || "unknown");
    return Response.json({ error: "시험 기록을 불러오지 못함. 잠시 후 다시 열기." }, { status: 500 });
  }
}
