// GET    /api/me : 로그인한 사용자와 DB에 저장된 상태. 로그인 전이면 { user: null, login }.
//          login = { ready: DB와 세션 키가 있어 가입·로그인을 쓸 수 있음 }
// PUT    /api/me : 화면 상태 { profile, survey, diagnosis, record }를 저장하고 { ok, stats }를 돌려준다.
// DELETE /api/me : 계정은 두고 진단·학습 기록을 지운다.
import { connection } from "next/server";
import { hasDatabase } from "@/lib/server/db";
import { getSessionUser, hasSessionSecret } from "@/lib/server/session";
import { cleanState } from "@/lib/server/state";
import { clearData, loadState, profileJob, saveState, userStats } from "@/lib/server/users";

const MAX_BODY = 200000;

function loginInfo() {
  return { ready: hasDatabase() && hasSessionSecret() };
}

const currentUser = () => getSessionUser();

const needLogin = () => Response.json({ error: "로그인 필요." }, { status: 401 });

export async function GET() {
  await connection();
  const login = loginInfo();
  const user = await currentUser();
  if (!user) return Response.json({ user: null, login });
  const [state, stats] = await Promise.all([loadState(user.id), userStats(user.id)]);
  return Response.json({ user, state, stats, login });
}

export async function PUT(request) {
  const user = await currentUser();
  if (!user) return needLogin();
  const text = await request.text();
  if (text.length > MAX_BODY) return Response.json({ error: "저장할 내용이 너무 큼." }, { status: 413 });
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "요청 형식이 올바르지 않음." }, { status: 400 });
  }
  // 직무 없는 진단(손님 때 한 진단)은 같은 요청의 직무, 없으면 계정의 관심 직무로 채운다(작업 Q).
  const needJob = body?.diagnosis && !body.diagnosis.job && !body.profile?.job;
  const { value, error } = cleanState(body, { accountJob: needJob ? await profileJob(user.id) : null });
  if (error) return Response.json({ error }, { status: 400 });
  await saveState(user.id, value);
  return Response.json({ ok: true, stats: await userStats(user.id) });
}

export async function DELETE() {
  const user = await currentUser();
  if (!user) return needLogin();
  await clearData(user.id);
  return Response.json({ ok: true });
}
