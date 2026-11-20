// GET /api/exam/[job] : 한 시험의 랭킹과 내 결과(작업 L, 보드 L3·L7)
//   → { takers, avg, top: [{ rank, nickname, demo, me, total, seconds }], me: { rank, total, seconds, scores, nickname } | null,
//       joined: boolean | null }
//   top은 상위 10명. 내가 10위 밖이어도 me를 준다. nickname은 랭킹에 참가한 사람만(아니면 null).
//   joined는 로그인했을 때 내가 랭킹에 참가했는지(손님은 null). 가입 이름과 아이디는 보내지 않는다.
//   모르는 직무는 404. 로그인 기능이 꺼져 있으면 off: true, 결과 표가 아직 없으면 notReady: true를 붙인 빈 값.
import { connection } from "next/server";
import { JOB } from "@/data/jobs";
import { examBoard } from "@/lib/server/examResults";
import { getSessionUser } from "@/lib/server/session";
import { examOn, notFound } from "../request";

const EMPTY = { takers: 0, avg: 0, top: [], me: null, joined: null };

export async function GET(request, { params }) {
  await connection();
  const { job } = await params;
  if (!Object.hasOwn(JOB, job)) return notFound();
  if (!examOn()) return Response.json({ ...EMPTY, off: true });
  try {
    const user = await getSessionUser();
    return Response.json(await examBoard(job, user?.id ?? null));
  } catch (error) {
    console.warn("[/api/exam/[job]] 랭킹 읽기 실패:", error?.message || "unknown");
    return Response.json({ error: "랭킹을 불러오지 못함. 잠시 후 다시 열기." }, { status: 500 });
  }
}
