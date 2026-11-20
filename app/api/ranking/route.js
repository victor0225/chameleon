// POST /api/ranking { ranked, nickname } : 랭킹에 보일 닉네임을 정한다({ ranked: true, nickname }) 또는 빠진다({ ranked: false }).
//   로그인해야 한다. 랭킹은 직무별 시험마다 있고(/api/exam/[job]), 닉네임을 정한 사람만 이름이 보인다.
//   미션 점수 랭킹(예전 GET)은 새 흐름(작업 L)에서 없앴다. 미션은 경험치만 올린다.
// 닉네임 규칙은 lib/scoreboard.js(nicknameError), DB 쓰기는 lib/server/ranking.js(setRanking).
import { hasDatabase } from "@/lib/server/db";
import { setRanking } from "@/lib/server/ranking";
import { getSessionUser, hasSessionSecret } from "@/lib/server/session";

const MAX_BODY = 2000;
const isOn = () => hasDatabase() && hasSessionSecret();

export async function POST(request) {
  if (!isOn()) return Response.json({ error: "랭킹은 로그인 기능이 켜져 있을 때만 사용 가능." }, { status: 503 });
  // 다른 사이트의 폼은 JSON 형식으로 보낼 수 없으니, JSON 요청만 받아 몰래 바꾸는 요청을 막는다(가입·로그인과 같다).
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ error: "요청 형식이 올바르지 않음." }, { status: 415 });
  }
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인 필요." }, { status: 401 });
  const text = await request.text();
  if (text.length > MAX_BODY) return Response.json({ error: "요청이 너무 큼." }, { status: 413 });
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "요청 형식이 올바르지 않음." }, { status: 400 });
  }
  const result = await setRanking(user.id, body);
  if (result.error) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ ok: true });
}
