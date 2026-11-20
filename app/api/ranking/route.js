// GET  /api/ranking?job=… : 부문 점수와 랭킹
//   → { me: { total, max, areas, done, rank, ranked, nickname, job } | null, top: [{ rank, nickname, job, total, demo, me }] }
//   top은 랭킹에 참여한 사용자 상위 10명이다. job을 주면 그 직무만 센다.
//   me는 로그인했을 때만 준다. 참여하지 않았어도 내 점수와 부문 점수는 준다(rank: null).
//   로그인 기능(DB와 세션 키)이 꺼져 있으면 { me: null, top: [], off: true }
// POST /api/ranking { ranked, nickname } : 내 참여 여부와 별명을 바꾼다. 로그인해야 한다.
// 점수 규칙은 lib/scoreboard.js, DB 읽기는 lib/server/ranking.js.
import { connection } from "next/server";
import { JOB } from "@/data/jobs";
import { hasDatabase } from "@/lib/server/db";
import { loadRanking, setRanking } from "@/lib/server/ranking";
import { getSessionUser, hasSessionSecret } from "@/lib/server/session";

const MAX_BODY = 2000;
const isOn = () => hasDatabase() && hasSessionSecret();

export async function GET(request) {
  await connection();
  if (!isOn()) return Response.json({ me: null, top: [], off: true });
  const job = new URL(request.url).searchParams.get("job");
  try {
    const user = await getSessionUser();
    return Response.json(await loadRanking(user?.id ?? null, job && Object.hasOwn(JOB, job) ? job : null));
  } catch (error) {
    console.warn("[/api/ranking] 랭킹 읽기 실패:", error?.message || "unknown");
    return Response.json({ error: "랭킹을 불러오지 못했어요. 잠시 후 다시 열어 주세요." }, { status: 500 });
  }
}

export async function POST(request) {
  if (!isOn()) return Response.json({ error: "랭킹은 로그인 기능이 켜져 있을 때 쓸 수 있어요." }, { status: 503 });
  // 다른 사이트의 폼은 JSON 형식으로 보낼 수 없으니, JSON 요청만 받아 몰래 바꾸는 요청을 막는다(가입·로그인과 같다).
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ error: "요청 형식이 올바르지 않아요." }, { status: 415 });
  }
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const text = await request.text();
  if (text.length > MAX_BODY) return Response.json({ error: "요청이 너무 커요." }, { status: 413 });
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
  }
  const result = await setRanking(user.id, body);
  if (result.error) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ ok: true });
}
