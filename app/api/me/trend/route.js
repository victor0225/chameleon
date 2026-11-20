// GET /api/me/trend : 진단 변화(작업 I-3). 마이페이지의 "처음 진단보다 요소 2개를 더 채웠어요 (1개 → 3개)" 한 줄에 쓴다.
// 응답 { growth, from, to } 진단이 2번보다 적으면 growth는 null이다. 로그인해야 한다.
import { connection } from "next/server";
import { diagnosisTrend } from "@/lib/diagnosisTrend";
import { recentDiagnoses } from "@/lib/server/history";
import { getSessionUser } from "@/lib/server/session";

export async function GET() {
  await connection();
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인 필요." }, { status: 401 });
  const { growth, from, to } = diagnosisTrend(await recentDiagnoses(user.id, 5));
  return Response.json({ growth, from, to });
}
