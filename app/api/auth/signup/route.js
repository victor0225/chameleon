// POST /api/auth/signup { loginId, password, passwordConfirm, name, job } → { user }  가입하면 바로 로그인된다.
// job은 관심 직무 id(data/jobs.js)이고 필수다. profiles.job에 같이 저장한다.
// 실패: 400 { error, field } 입력 규칙(직무를 안 고르면 field "job"), 409 { error, field: "loginId" } 이미 쓰는 아이디, 503 DB 연결 전
import { checkSignup } from "@/lib/credentials";
import { hasDatabase } from "@/lib/server/db";
import { hasSessionSecret, startSession } from "@/lib/server/session";
import { createUser } from "@/lib/server/users";

export async function POST(request) {
  if (!hasDatabase() || !hasSessionSecret()) {
    return Response.json({ error: "아직 가입 불가. 서버에 DB 설정 필요." }, { status: 503 });
  }
  // 다른 사이트의 폼은 JSON 형식으로 보낼 수 없으니, JSON 요청만 받아 몰래 보내는 가입·로그인을 막는다.
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ error: "요청 형식이 올바르지 않음." }, { status: 415 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "요청 형식이 올바르지 않음." }, { status: 400 });
  }
  const invalid = checkSignup(body ?? {});
  if (invalid) return Response.json({ error: invalid.message, field: invalid.field }, { status: 400 });

  const user = await createUser({ loginId: body.loginId, password: body.password, name: body.name, job: body.job });
  if (!user) return Response.json({ error: "이미 쓰는 아이디. 다른 아이디 고르기.", field: "loginId" }, { status: 409 });
  await startSession(user.id);
  return Response.json({ user });
}
